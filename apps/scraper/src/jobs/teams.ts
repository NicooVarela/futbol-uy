import prisma from '../db'
import { getStandings, getTeam } from '../sources/sofascore'
import { log, logError } from '../logger'

export async function syncTeams() {
  const start = Date.now()
  let records = 0

  try {
    log('teams', '🔄 Sincronizando equipos...')

    const season = await prisma.season.findFirst({
      where: { isCurrent: true, tournament: { sofascoreId: 278 } },
      include: { tournament: true }
    })

    if (!season) {
      log('teams', '⚠️  No hay temporada actual — corré syncSeasons primero')
      return
    }

    const rows = await getStandings(278, season.sofascoreId)

    for (const row of rows) {
      const t = row.team

      // Traer info detallada del equipo
      const detail = await getTeam(t.id)

      // Upsert estadio si tiene
      let stadiumId: number | undefined
      if (detail.venue?.name) {
        const stadium = await prisma.stadium.upsert({
          where:  { sofascoreId: detail.venue.id ?? -t.id },
          update: { name: detail.venue.name, capacity: detail.venue.stadium?.capacity },
          create: {
            sofascoreId: detail.venue.id ?? -t.id,
            name:        detail.venue.name,
            city:        detail.venue.city?.name,
            capacity:    detail.venue.stadium?.capacity,
            latitude:    detail.venue.venueCoordinates?.latitude,
            longitude:   detail.venue.venueCoordinates?.longitude,
          },
        })
        stadiumId = stadium.id
      }

      // Upsert equipo — respeta manuallyOverridden
      const existing = await prisma.team.findUnique({ where: { sofascoreId: t.id } })

      if (existing?.manuallyOverridden) {
        log('teams', `⏭️  ${t.name} — manuallyOverridden, saltando`)
        continue
      }

      await prisma.team.upsert({
        where:  { sofascoreId: t.id },
        update: {
          primaryColor:   t.teamColors?.primary,
          secondaryColor: t.teamColors?.secondary,
          managerName:    detail.manager?.name,
          stadiumId,
        },
        create: {
          sofascoreId:    t.id,
          name:           t.name,
          slug:           t.slug,
          shortName:      t.shortName,
          nameCode:       t.nameCode,
          country:        t.country?.name ?? 'Uruguay',
          primaryColor:   t.teamColors?.primary,
          secondaryColor: t.teamColors?.secondary,
          managerName:    detail.manager?.name,
          stadiumId,
        },
      })

      records++
      log('teams', `✅ ${t.name}`)
    }

    await prisma.scraperLog.create({
      data: { jobName: 'teams', status: 'success', sourceUsed: 'sofascore', recordsUpdated: records, durationMs: Date.now() - start }
    })

    log('teams', `✅ Completado — ${records} equipos sincronizados`)

  } catch (err) {
    logError('teams', err)
    await prisma.scraperLog.create({
      data: { jobName: 'teams', status: 'error', sourceUsed: 'sofascore', errorMessage: String(err), durationMs: Date.now() - start }
    })
  }
}
