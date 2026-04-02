import prisma from '../db'
import { getStandings } from '../sources/sofascore'
import { log, logError } from '../logger'

export async function syncStandings() {
  const start = Date.now()
  let records = 0

  try {
    log('standings', '🔄 Sincronizando tabla de posiciones...')

    const season = await prisma.season.findFirst({
      where: { isCurrent: true, tournament: { sofascoreId: 278 } },
      include: { tournament: true }
    })

    if (!season) {
      log('standings', '⚠️  No hay temporada actual')
      return
    }

    const rows = await getStandings(278, season.sofascoreId)

    for (const row of rows) {
      const team = await prisma.team.findUnique({ where: { sofascoreId: row.team.id } })
      if (!team) continue

      await prisma.standing.upsert({
        where:  { seasonId_teamId: { seasonId: season.id, teamId: team.id } },
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
        },
      })
      records++
    }

    await prisma.scraperLog.create({
      data: { jobName: 'standings', status: 'success', sourceUsed: 'sofascore', recordsUpdated: records, durationMs: Date.now() - start }
    })

    log('standings', `✅ Completado — ${records} posiciones actualizadas`)

  } catch (err) {
    logError('standings', err)
    await prisma.scraperLog.create({
      data: { jobName: 'standings', status: 'error', sourceUsed: 'sofascore', errorMessage: String(err), durationMs: Date.now() - start }
    })
  }
}
