import { syncSeasons }    from './jobs/seasons'
import { syncTeams }      from './jobs/teams'
import { syncPlayers }    from './jobs/players'
import { syncStandings }  from './jobs/standings'
import { syncFixtures }   from './jobs/fixtures'
import { syncMatchDetail } from './jobs/match-detail'
import { syncHistorical } from './jobs/historical'
import { closeBrowser }   from './sources/sofascore'
import { log }            from './logger'

const job = process.argv[2] || 'all'
const arg = process.argv[3]

async function main() {
  log('main', `🚀 FutbolUY Scraper — job: ${job}`)

  try {
    if (job === 'sync') {
      await syncSeasons()
      await syncTeams()
      await syncPlayers()
      await syncStandings()
      await syncFixtures()
    } else if (job === 'all') {
      await syncSeasons()
      await syncTeams()
      await syncPlayers()
      await syncStandings()
      await syncFixtures()
    } else if (job === 'seasons')      await syncSeasons()
    else if (job === 'teams')          await syncTeams()
    else if (job === 'players')        await syncPlayers()
    else if (job === 'standings')      await syncStandings()
    else if (job === 'fixtures')       await syncFixtures()
    else if (job === 'match-detail' && arg) await syncMatchDetail(parseInt(arg))
    else if (job === 'historical') {
      const fromYear = arg ? parseInt(arg) : 2020
      await syncHistorical(fromYear)
    }
    log('main', '✅ Completado')
  } finally {
    await closeBrowser()
  }

  process.exit(0)
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})