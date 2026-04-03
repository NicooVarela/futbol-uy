import { chromium, Browser, BrowserContext } from 'playwright'

const BASE_URL = 'https://api.sofascore.com/api/v1'

let browser: Browser | null = null
let context: BrowserContext | null = null

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    })
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      locale: 'es-UY',
      timezoneId: 'America/Montevideo',
      extraHTTPHeaders: {
        'Accept-Language': 'es-UY,es;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.sofascore.com/',
        'Origin': 'https://www.sofascore.com',
      },
    })

    // Visitar sofascore primero para obtener cookies de sesión
    const page = await context.newPage()
    await page.goto('https://www.sofascore.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    await page.close()
  }
  return context!
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function fetchSofascore(endpoint: string): Promise<any> {
  const DELAY = parseInt(process.env.SCRAPER_DELAY_MS || '2000')
  await delay(DELAY + Math.random() * 1000)

  const ctx = await getBrowser()
  const page = await ctx.newPage()

  try {
    const url = `${BASE_URL}${endpoint}`
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

    if (!response || !response.ok()) {
      throw new Error(`SofaScore error ${response?.status()} — ${endpoint}`)
    }

    const text = await page.textContent('pre') || await page.textContent('body') || ''
    const data = JSON.parse(text)

    if (data.error) {
      throw new Error(`SofaScore error ${data.error.code} — ${endpoint}`)
    }

    return data
  } finally {
    await page.close()
  }
}

export async function closeBrowser() {
  if (browser) {
    await browser.close()
    browser = null
    context = null
  }
}

export async function getSeasons(tournamentId: number) {
  const data = await fetchSofascore(`/unique-tournament/${tournamentId}/seasons`)
  return data.seasons
}

export async function getStandings(tournamentId: number, seasonId: number) {
  const data = await fetchSofascore(`/unique-tournament/${tournamentId}/season/${seasonId}/standings/total`)
  return data.standings[0]?.rows ?? []
}

export async function getLastEvents(tournamentId: number, seasonId: number, page = 0) {
  const data = await fetchSofascore(`/unique-tournament/${tournamentId}/season/${seasonId}/events/last/${page}`)
  return data.events ?? []
}

export async function getNextEvents(tournamentId: number, seasonId: number, page = 0) {
  const data = await fetchSofascore(`/unique-tournament/${tournamentId}/season/${seasonId}/events/next/${page}`)
  return data.events ?? []
}

export async function getEvent(eventId: number) {
  const data = await fetchSofascore(`/event/${eventId}`)
  return data.event
}

export async function getTeam(teamId: number) {
  const data = await fetchSofascore(`/team/${teamId}`)
  return data.team
}

export async function getTeamPlayers(teamId: number) {
  const data = await fetchSofascore(`/team/${teamId}/players`)
  return data.players ?? []
}

export async function getUruguayTournaments() {
  const data = await fetchSofascore(`/category/57/unique-tournaments`)
  return data.groups?.flatMap((g: any) => g.uniqueTournaments) ?? []
}

export async function getLiveEvents() {
  const data = await fetchSofascore(`/sport/football/events/live`)
  const allEvents = data.events ?? []
  return allEvents.filter((e: any) => e.tournament?.category?.id === 57)
}

export async function getAllStandingGroups(tournamentId: number, seasonId: number) {
  const data = await fetchSofascore(`/unique-tournament/${tournamentId}/season/${seasonId}/standings/total`)
  if (!data.standings?.length) return []
  return data.standings.map((s: any) => ({
    groupName: s.name ?? null,
    rows: s.rows ?? [],
  }))
}