import prisma from '../db'
import { getAllStandingGroups } from '../sources/sofascore'
import { log, logError } from '../logger'

export async function syncStandings() {
  const start = Date.now()
  let totalRecords = 0

  try {
    log('standings', '🔄 Sincronizando tablas de posiciones...')

    const seasons = await prisma.season.findMany({
      where: { isCurrent: true },
      include: { tournament: true },
    })

    for (const season of seasons) {
      try {
        const allGroups = await getAllStandingGroups(
          season.tournament.sofascoreId,
          season.sofascoreId
        )

        if (!allGroups.length) {
          log('standings', `⏭️  ${season.tournament.name} — sin tabla disponible`)
          continue
        }

        let records = 0

        for (const { groupName, rows } of allGroups) {
          for (const row of rows) {
            let team = await prisma.team.findUnique({ where: { sofascoreId: row.team.id } })

            if (!team) {
              const baseSlug = row.team.slug
                ?? row.team.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
              const slug = season.tournament.gender === 'F'
                ? `${baseSlug}-fem`
                : `${baseSlug}-${row.team.id}`

              team = await prisma.team.upsert({
                where:  { sofascoreId: row.team.id },
                update: {},
                create: {
                  sofascoreId:    row.team.id,
                  name:           row.team.name,
                  slug,
                  shortName:      row.team.shortName ?? null,
                  nameCode:       row.team.nameCode ?? null,
                  primaryColor:   row.team.teamColors?.primary ?? null,
                  secondaryColor: row.team.teamColors?.secondary ?? null,
                  gender:         season.tournament.gender,
                },
              })
            }

            await prisma.standing.upsert({
              where: {
                seasonId_teamId_group: {
                  seasonId: season.id,
                  teamId:   team.id,
                  group:    groupName ?? 'total',
                },
              },
              update: {
                position:     row.position,
                played:       row.matches,
                wins:         row.wins,
                draws:        row.draws,
                losses:       row.losses,
                goalsFor:     row.scoresFor,
                goalsAgainst: row.scoresAgainst,
                points:       row.points,
                zone:         row.promotion?.text ?? null,
                group:        groupName ?? null,
              },
              create: {
                seasonId:     season.id,
                teamId:       team.id,
                position:     row.position,
                played:       row.matches,
                wins:         row.wins,
                draws:        row.draws,
                losses:       row.losses,
                goalsFor:     row.scoresFor,
                goalsAgainst: row.scoresAgainst,
                points:       row.points,
                zone:         row.promotion?.text ?? null,
                group:        groupName ?? null,
              },
            })
            records++
          }
        }

        totalRecords += records
        log('standings', `✅ ${season.tournament.name} — ${records} posiciones`)

      } catch (err: any) {
        log('standings', `⚠️  Error en ${season.tournament.name}: ${String(err)}`)
      }
    }

    await prisma.scraperLog.create({
      data: {
        jobName:        'standings',
        status:         'success',
        sourceUsed:     'sofascore',
        recordsUpdated: totalRecords,
        durationMs:     Date.now() - start,
      },
    })

    log('standings', `✅ Completado — ${totalRecords} posiciones actualizadas`)

  } catch (err) {
    logError('standings', err)
    await prisma.scraperLog.create({
      data: {
        jobName:      'standings',
        status:       'error',
        sourceUsed:   'sofascore',
        errorMessage: String(err),
        durationMs:   Date.now() - start,
      },
    })
  }
}