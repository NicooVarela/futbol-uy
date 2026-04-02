import prisma from '../db'
import { getLastEvents, getNextEvents } from '../sources/sofascore'
import { log, logError } from '../logger'

async function upsertEvent(e: any, seasonId: number) {
  const homeTeam = await prisma.team.findUnique({ where: { sofascoreId: e.homeTeam.id } })
  const awayTeam = await prisma.team.findUnique({ where: { sofascoreId: e.awayTeam.id } })
  if (!homeTeam || !awayTeam) return false

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
      homeTeamId:   homeTeam.id,
      awayTeamId:   awayTeam.id,
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
  let records = 0

  try {
    log('fixtures', '🔄 Sincronizando fixture...')

    const season = await prisma.season.findFirst({
      where: { isCurrent: true, tournament: { sofascoreId: 278 } },
    })

    if (!season) {
      log('fixtures', '⚠️  No hay temporada actual')
      return
    }

    // Últimos partidos (página 0 y 1)
    for (const page of [0, 1]) {
      const events = await getLastEvents(278, season.sofascoreId, page)
      for (const e of events) {
        const ok = await upsertEvent(e, season.id)
        if (ok) records++
      }
    }

    // Próximos partidos
    const nextEvents = await getNextEvents(278, season.sofascoreId, 0)
    for (const e of nextEvents) {
      const ok = await upsertEvent(e, season.id)
      if (ok) records++
    }

    await prisma.scraperLog.create({
      data: { jobName: 'fixtures', status: 'success', sourceUsed: 'sofascore', recordsUpdated: records, durationMs: Date.now() - start }
    })

    log('fixtures', `✅ Completado — ${records} partidos sincronizados`)

  } catch (err) {
    logError('fixtures', err)
    await prisma.scraperLog.create({
      data: { jobName: 'fixtures', status: 'error', sourceUsed: 'sofascore', errorMessage: String(err), durationMs: Date.now() - start }
    })
  }
}
