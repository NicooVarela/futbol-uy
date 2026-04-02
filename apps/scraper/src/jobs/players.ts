import prisma from '../db'
import { getTeamPlayers } from '../sources/sofascore'
import { log, logError } from '../logger'

export async function syncPlayers() {
  const start = Date.now()
  let records = 0

  try {
    log('players', '🔄 Sincronizando jugadores...')

    const teams = await prisma.team.findMany({ where: { isActive: true } })

    for (const team of teams) {
      try {
        const players = await getTeamPlayers(team.sofascoreId)

        for (const p of players) {
          const player = p.player

          await prisma.player.upsert({
            where: { sofascoreId: player.id },
            update: {
              teamId: team.id,
              shirtNumber: p.jerseyNumber ? parseInt(p.jerseyNumber) : player.shirtNumber ?? null,
            },
            create: {
              sofascoreId: player.id,
              name: player.name,
              slug: player.slug ?? null,
              position: player.position ?? null,
              nationality: player.nationality?.name ?? null,
              dateOfBirth: player.dateOfBirthTimestamp
                ? new Date(player.dateOfBirthTimestamp * 1000)
                : null,
              height: player.height ?? null,
              preferredFoot: player.preferredFoot ?? null,
              shirtNumber: p.jerseyNumber
                ? parseInt(p.jerseyNumber)
                : player.shirtNumber ?? null,
              teamId: team.id,
            },
          })
          records++
        }

        log('players', `✅ ${team.name} — ${players.length} jugadores`)
      } catch (err) {
        log('players', `⚠️  Error en ${team.name}: ${String(err)}`)
      }
    }

    await prisma.scraperLog.create({
      data: {
        jobName: 'players',
        status: 'success',
        sourceUsed: 'sofascore',
        recordsUpdated: records,
        durationMs: Date.now() - start,
      },
    })

    log('players', `✅ Completado — ${records} jugadores sincronizados`)
  } catch (err) {
    logError('players', err)
    await prisma.scraperLog.create({
      data: {
        jobName: 'players',
        status: 'error',
        sourceUsed: 'sofascore',
        errorMessage: String(err),
        durationMs: Date.now() - start,
      },
    })
  }
}