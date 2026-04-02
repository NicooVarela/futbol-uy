export function log(job: string, msg: string) {
  const time = new Date().toLocaleTimeString('es-UY', { timeZone: 'America/Montevideo' })
  console.log(`[${time}] [${job}] ${msg}`)
}

export function logError(job: string, err: unknown) {
  const time = new Date().toLocaleTimeString('es-UY', { timeZone: 'America/Montevideo' })
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[${time}] [${job}] ❌ ERROR: ${msg}`)
}
