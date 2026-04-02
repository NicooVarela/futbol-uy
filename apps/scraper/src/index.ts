import { syncSeasons }   from './jobs/seasons'
import { syncTeams }     from './jobs/teams'
import { syncStandings } from './jobs/standings'
import { syncFixtures }  from './jobs/fixtures'
import { closeBrowser }  from './sources/sofascore'
import { log }           from './logger'

async function main() {
  log('main', '🚀 FutbolUY Scraper iniciando...')

  try {
    await syncSeasons()
    await syncTeams()
    await syncStandings()
    await syncFixtures()
    log('main', '✅ Sincronización inicial completa')
  } finally {
    await closeBrowser()
  }

  process.exit(0)
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
