import prisma from '../db'
import { getEvent, getLastEvents } from '../sources/sofascore'
import { log, logError } from '../logger'
import { chromium } from 'playwright'

const BASE_URL = 'https://api.sofascore.com/api/v1'

let _browser: any = null
let _context: any = null

async function getContext() {
  if (!_browser) {
    _browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
    _context = await _browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      locale: 'es-UY',
    })
    const page = await _context.newPage()
    await page.goto('https://www.sofascore.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    await page.close()
  }
  return _context
}

async function fetchJSON(endpoint: string) {
  const ctx = await getContext()
  const page = await ctx.newPage()
  try {
    const res = await page.goto(`${BASE_URL}${endpoint}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    if (!res?.ok()) throw new Error(`HTTP ${res?.status()} — ${endpoint}`)
    const text = await page.textContent('pre') || await page.textContent('body') || ''
    const data = JSON.parse(text)
    if (data.error) throw new Error(`API error ${data.error.code}`)
    return data
  } finally {
    await page.close()
  }
}

export async function syncMatchDetail(sofascoreEventId: number) {
  const start = Date.now()

  try {
    const event = await prisma.event.findUnique({ where: { sofascoreId: sofascoreEventId } })
    if (!event) {
      log('match-detail', `⚠️  Partido ${sofascoreEventId} no encontrado en BD`)
      return
    }

    log('match-detail', `🔄 Sincronizando detalle: partido ${sofascoreEventId}`)

    // Incidencias
    const incData = await fetchJSON(`/event/${sofascoreEventId}/incidents`)
    const incidents = incData.incidents ?? []

    // Borrar incidencias anteriores del partido
    await prisma.incident.deleteMany({ where: { eventId: event.id } })

    for (const inc of incidents) {
      if (!['goal', 'card', 'substitution'].includes(inc.incidentType)) continue

      let playerId: number | undefined
      if (inc.player?.id) {
        const player = await prisma.player.findUnique({ where: { sofascoreId: inc.player.id } })
        playerId = player?.id
      }

      let teamId: number | undefined
      if (inc.isHome !== undefined) {
        const team = inc.isHome
          ? await prisma.team.findUnique({ where: { id: event.homeTeamId } })
          : await prisma.team.findUnique({ where: { id: event.awayTeamId } })
        teamId = team?.id
      }

      await prisma.incident.create({
        data: {
          eventId:    event.id,
          type:       inc.incidentType,
          minute:     inc.time ?? null,
          extraMinute: inc.addedTime ?? null,
          teamSide:   inc.isHome !== undefined ? (inc.isHome ? 'home' : 'away') : null,
          description: inc.incidentClass ?? null,
          homeScore:  inc.homeScore ?? null,
          awayScore:  inc.awayScore ?? null,
          playerId:   playerId ?? null,
          teamId:     teamId ?? null,
        },
      })
    }

    // Formaciones
    try {
      const lineupData = await fetchJSON(`/event/${sofascoreEventId}/lineups`)

      await prisma.lineup.deleteMany({ where: { eventId: event.id } })

      for (const side of ['home', 'away'] as const) {
        const sideData = lineupData[side]
        if (!sideData?.players) continue

        for (const p of sideData.players) {
          const player = await prisma.player.findUnique({ where: { sofascoreId: p.player.id } })
          if (!player) continue

          await prisma.lineup.create({
            data: {
              eventId:     event.id,
              playerId:    player.id,
              teamSide:    side,
              position:    p.position ?? null,
              jerseyNumber: p.jerseyNumber ? parseInt(p.jerseyNumber) : null,
              isStarter:   p.substitute === false,
              rating:      p.statistics?.rating ?? null,
            },
          })
        }
      }
    } catch (e) {
      log('match-detail', `⚠️  Sin formaciones disponibles`)
    }

    await prisma.scraperLog.create({
      data: { jobName: 'match-detail', status: 'success', sourceUsed: 'sofascore', recordsUpdated: incidents.length, durationMs: Date.now() - start }
    })

    log('match-detail', `✅ Partido ${sofascoreEventId} — ${incidents.length} incidencias sincronizadas`)

  } catch (err) {
    logError('match-detail', err)
    await prisma.scraperLog.create({
      data: { jobName: 'match-detail', status: 'error', sourceUsed: 'sofascore', errorMessage: String(err), durationMs: Date.now() - start }
    })
  }

  if (_browser) {
    await _browser.close()
    _browser = null
    _context = null
  }
}
