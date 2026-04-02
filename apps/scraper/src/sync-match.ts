import { syncMatchDetail } from './jobs/match-detail'

const eventId = parseInt(process.argv[2] || '15635513')

syncMatchDetail(eventId).then(() => {
  console.log('✅ Listo')
  process.exit(0)
}).catch(err => {
  console.error(err)
  process.exit(1)
})
