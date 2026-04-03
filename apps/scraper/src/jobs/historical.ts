import prisma from '../db'
import { getLastEvents, getAllStandingGroups } from '../sources/sofascore'
import { log, logError } from '../logger'

// Torneos a sincronizar con año mínimo configurable
const TOURNAMENTS = [
  { sofascoreId: 278,   slug: 'primera-division',          name: 'Liga AUF Uruguaya'        },
  { sofascoreId: 1908,  slug: 'segunda-division',          name: 'Segunda División'          },
  { sofascoreId: 18877, slug: 'copa-uruguay',              name: 'Copa Uruguay'              },
  { sofascoreId: 11705, slug: 'supercopa-uruguaya',        name: 'Supercopa Uruguaya'        },
  { sofascoreId: 26301, slug: 'primera-division-femenina', name: 'Liga AUF Femenina'        },
  { sofascoreId: 31832, slug: 'copa-de-la-liga',           name: 'Copa de la Liga'           },
  { sofascoreId: 21284, slug: 'primera-division-reservas', name: 'Primera División Reservas' },
  { sofascoreId: 384, slug: 'copa-libertadores',  name: 'Copa Libertadores'  },
  { sofascoreId: 480, slug: 'copa-sudamericana',  name: 'Copa Sudamericana'  },
]

async function upsertTeamBasic(teamData: any, gender: string) {
  const existing = await prisma.team.findUnique({ where: { sofascoreId: teamData.id } })
  if (existing) return existing

  const baseSlug = teamData.slug
    ?? teamData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const slug = gender === 'F' ? `${baseSlug}-fem` : `${baseSlug}-${teamData.id}`

  return prisma.team.upsert({
    where:  { sofascoreId: teamData.id },
    update: {},
    create: {
      sofascoreId:    teamData.id,
      name:           teamData.name,
      slug,
      shortName:      teamData.shortName ?? null,
      nameCode:       teamData.nameCode ?? null,
      primaryColor:   teamData.teamColors?.primary ?? null,
      secondaryColor: teamData.teamColors?.secondary ?? null,
      gender,
    },
  })
}

async function syncHistoricalSeason(
  tournament: typeof TOURNAMENTS[0],
  season: { id: number; sofascoreId: number; year: string },
  gender: string
) {
  let eventCount = 0
  let standingCount = 0

  // ── Partidos ─────────────────────────────────────────────
  for (let page = 0; page <= 5; page++) {
    try {
      const events = await getLastEvents(tournament.sofascoreId, season.sofascoreId, page)
      if (!events.length) break

      for (const e of events) {
        const homeTeam = await upsertTeamBasic(e.homeTeam, gender)
        const awayTeam = await upsertTeamBasic(e.awayTeam, gender)

        await prisma.event.upsert({
          where:  { sofascoreId: e.id },
          update: {
            homeScore:   e.homeScore?.current ?? null,
            awayScore:   e.awayScore?.current ?? null,
            homeScoreHt: e.homeScore?.period1 ?? null,
            awayScoreHt: e.awayScore?.period1 ?? null,
            status:      e.status?.type ?? 'finished',
          },
          create: {
            sofascoreId:  e.id,
            seasonId:     season.id,
            homeTeamId:   homeTeam.id,
            awayTeamId:   awayTeam.id,
            homeScore:    e.homeScore?.current ?? null,
            awayScore:    e.awayScore?.current ?? null,
            homeScoreHt:  e.homeScore?.period1 ?? null,
            awayScoreHt:  e.awayScore?.period1 ?? null,
            status:       e.status?.type ?? 'finished',
            startTime:    new Date(e.startTimestamp * 1000),
            round:        e.roundInfo?.round ?? null,
            refereeName:  e.referee?.name ?? null,
          },
        })
        eventCount++
      }
    } catch (err: any) {
      if (err.message?.includes('404')) break
      throw err
    }
  }

  // ── Tabla de posiciones ───────────────────────────────────
  try {
    const allGroups = await getAllStandingGroups(tournament.sofascoreId, season.sofascoreId)

    for (const { groupName, rows } of allGroups) {
      for (const row of rows) {
        const team = await upsertTeamBasic(row.team, gender)

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
        standingCount++
      }
    }
  } catch {
    // Sin tabla disponible para este torneo/temporada — normal en copas
  }

  return { eventCount, standingCount }
}

export async function syncHistorical(fromYear = 2020) {
  const start = Date.now()
  let totalEvents = 0
  let totalStandings = 0

  log('historical', `🔄 Sincronizando histórico desde ${fromYear}...`)

  for (const tournament of TOURNAMENTS) {
    // Traer solo temporadas ya guardadas en la BD
    const seasons = await prisma.season.findMany({
      where: {
        tournament: { sofascoreId: tournament.sofascoreId },
        // Filtrar por año — manejar años con formato "20/21" también
        OR: [
          { year: { gte: fromYear.toString() } },
          { year: { contains: '/' } }, // Años como "20/21" — incluirlos si son >= fromYear
        ],
      },
      orderBy: { year: 'desc' },
    })

    // Filtrar temporadas por año mínimo
    const filteredSeasons = seasons.filter(s => {
      const yearNum = parseInt(s.year.split('/')[0])
      return yearNum >= fromYear
    })

    // Excluir la temporada actual (ya la manejamos con syncFixtures)
    const historicalSeasons = filteredSeasons.filter(s => !s.isCurrent)

    if (!historicalSeasons.length) {
      log('historical', `⏭️  ${tournament.name} — sin temporadas históricas en rango`)
      continue
    }

    log('historical', `📅 ${tournament.name} — ${historicalSeasons.length} temporadas para sincronizar`)

    // Obtener género del torneo
    const tournamentDb = await prisma.tournament.findUnique({
      where: { sofascoreId: tournament.sofascoreId }
    })
    const gender = tournamentDb?.gender ?? 'M'

    for (const season of historicalSeasons) {
      // Verificar si ya tiene datos — si ya tiene partidos, saltar
      const existingEvents = await prisma.event.count({
        where: { seasonId: season.id }
      })

      if (existingEvents > 0) {
        log('historical', `  ⏭️  ${season.year} — ya tiene ${existingEvents} partidos, saltando`)
        continue
      }

      log('historical', `  ⬇️  ${tournament.name} ${season.year}...`)

      try {
        const { eventCount, standingCount } = await syncHistoricalSeason(
          tournament, season, gender
        )

        totalEvents += eventCount
        totalStandings += standingCount

        log('historical', `  ✅ ${season.year} — ${eventCount} partidos, ${standingCount} posiciones`)

      } catch (err) {
        log('historical', `  ⚠️  Error en ${season.year}: ${String(err)}`)
      }
    }
  }

  const duration = Math.round((Date.now() - start) / 1000)

  await prisma.scraperLog.create({
    data: {
      jobName:        'historical',
      status:         'success',
      sourceUsed:     'sofascore',
      recordsUpdated: totalEvents,
      durationMs:     Date.now() - start,
    },
  })

  log('historical', `✅ Completado en ${duration}s — ${totalEvents} partidos, ${totalStandings} posiciones`)
}