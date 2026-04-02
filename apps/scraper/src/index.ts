import { syncSeasons }     from './jobs/seasons'
import { syncTeams }       from './jobs/teams'
import { syncPlayers }     from './jobs/players'
import { syncStandings }   from './jobs/standings'
import { syncFixtures }    from './jobs/fixtures'
import { syncMatchDetail } from './jobs/match-detail'
import { closeBrowser }    from './sources/sofascore'
import { log }             from './logger'

const job = process.argv[2] || 'all'
const arg = process.argv[3]

async function main() {
  log('main', `🚀 FutbolUY Scraper — job: ${job}`)

  try {
    if (job === 'all' || job === 'seasons')   await syncSeasons()
    if (job === 'all' || job === 'teams')     await syncTeams()
    if (job === 'all' || job === 'players')   await syncPlayers()
    if (job === 'all' || job === 'standings') await syncStandings()
    if (job === 'all' || job === 'fixtures')  await syncFixtures()
    if (job === 'match-detail' && arg)        await syncMatchDetail(parseInt(arg))
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