import prisma from '../db'
import { getLastEvents, getNextEvents } from '../sources/sofascore'
import { log, logError } from '../logger'

async function upsertEvent(e: any, seasonId: number, season?: any) {
  const homeTeam = await prisma.team.findUnique({ where: { sofascoreId: e.homeTeam.id } })
  const awayTeam = await prisma.team.findUnique({ where: { sofascoreId: e.awayTeam.id } })
  const gender = season?.tournament?.gender ?? 'M'

  // Si el equipo no existe lo creamos básico
  let homeTeamId = homeTeam?.id
  let awayTeamId = awayTeam?.id

  if (!homeTeamId) {
    const baseSlug = e.homeTeam.slug ?? e.homeTeam.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const slug = season?.tournament?.gender === 'F' ? `${baseSlug}-fem` : `${baseSlug}-${e.homeTeam.id}`
    const t = await prisma.team.upsert({
      where:  { sofascoreId: e.homeTeam.id },
      update: {},
        create: {
          sofascoreId: e.homeTeam.id,
          name:        e.homeTeam.name,
          slug,
          shortName:   e.homeTeam.shortName ?? null,
          nameCode:    e.homeTeam.nameCode ?? null,
          gender,
        },
      })
    homeTeamId = t.id
  }

  if (!awayTeamId) {
    const baseSlug = e.awayTeam.slug ?? e.awayTeam.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const slug = season?.tournament?.gender === 'F' ? `${baseSlug}-fem` : `${baseSlug}-${e.awayTeam.id}`
    const t = await prisma.team.upsert({
      where:  { sofascoreId: e.awayTeam.id },
      update: {},
        create: {
          sofascoreId: e.awayTeam.id,
          name:        e.awayTeam.name,
          slug,
          shortName:   e.awayTeam.shortName ?? null,
          nameCode:    e.awayTeam.nameCode ?? null,
          gender,
        },
      })
    awayTeamId = t.id
  }

  await prisma.event.upsert({
    where:  { sofascoreId: e.id },
    update: {
      homeScore:   e.homeScore?.current ?? null,
      awayScore:   e.awayScore?.current ?? null,
      homeScoreHt: e.homeScore?.period1 ?? null,
      awayScoreHt: e.awayScore?.period1 ?? null,
      status:      e.status?.type ?? 'notstarted',
    },
    create: {
      sofascoreId:  e.id,
      seasonId,
      homeTeamId,
      awayTeamId,
      homeScore:    e.homeScore?.current ?? null,
      awayScore:    e.awayScore?.current ?? null,
      homeScoreHt:  e.homeScore?.period1 ?? null,
      awayScoreHt:  e.awayScore?.period1 ?? null,
      status:       e.status?.type ?? 'notstarted',
      startTime:    new Date(e.startTimestamp * 1000),
      round:        e.roundInfo?.round ?? null,
      refereeName:  e.referee?.name ?? null,
    },
  })
  return true
}

export async function syncFixtures() {
  const start = Date.now()
  let totalRecords = 0

  try {
    log('fixtures', '🔄 Sincronizando fixture de todos los torneos...')

    // Traer todas las temporadas activas
    const seasons = await prisma.season.findMany({
      where: { isCurrent: true },
      include: { tournament: true },
    })

    for (const season of seasons) {
      let records = 0

      try {
        // Últimos partidos
// Últimos partidos — page 0 siempre, page 1 solo si hay suficientes partidos
        for (const page of [0, 1]) {
          try {
            const events = await getLastEvents(season.tournament.sofascoreId, season.sofascoreId, page)
            if (!events.length) break
            for (const e of events) {
              await upsertEvent(e, season.id, season)
              records++
            }
          } catch (err: any) {
            if (err.message?.includes('404')) break
            throw err
          }
        }

        // Próximos partidos
        try {
          const nextEvents = await getNextEvents(season.tournament.sofascoreId, season.sofascoreId, 0)
          for (const e of nextEvents) {
            await upsertEvent(e, season.id, season)
            records++
          }
        } catch (err: any) {
          if (!err.message?.includes('404')) throw err
        }

        log('fixtures', `✅ ${season.tournament.name} — ${records} partidos`)
        totalRecords += records

      } catch (err) {
        log('fixtures', `⚠️  Error en ${season.tournament.name}: ${String(err)}`)
      }
    }

    await prisma.scraperLog.create({
      data: { jobName: 'fixtures', status: 'success', sourceUsed: 'sofascore', recordsUpdated: totalRecords, durationMs: Date.now() - start }
    })

    log('fixtures', `✅ Completado — ${totalRecords} partidos sincronizados`)

  } catch (err) {
    logError('fixtures', err)
    await prisma.scraperLog.create({
      data: { jobName: 'fixtures', status: 'error', sourceUsed: 'sofascore', errorMessage: String(err), durationMs: Date.now() - start }
    })
  }
}
