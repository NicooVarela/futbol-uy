import prisma from '../db'
import { getSeasons } from '../sources/sofascore'
import { log, logError } from '../logger'

const URUGUAY_TOURNAMENTS = [
  { sofascoreId: 278,   name: 'Liga AUF Uruguaya',      slug: 'primera-division',  gender: 'M', format: 'league' },
  { sofascoreId: 1908,  name: 'Segunda División',        slug: 'segunda-division',  gender: 'M', format: 'league' },
  { sofascoreId: 18877, name: 'Copa Uruguay',            slug: 'copa-uruguay',      gender: 'M', format: 'cup'    },
  { sofascoreId: 11705, name: 'Supercopa Uruguaya',      slug: 'supercopa-uruguaya',gender: 'M', format: 'cup'    },
]

export async function syncSeasons() {
  const start = Date.now()
  let records = 0

  try {
    log('seasons', '🔄 Sincronizando torneos y temporadas...')

    for (const t of URUGUAY_TOURNAMENTS) {
      // Upsert torneo
      const tournament = await prisma.tournament.upsert({
        where:  { sofascoreId: t.sofascoreId },
        update: { isActive: true },
        create: {
          sofascoreId: t.sofascoreId,
          name:   t.name,
          slug:   t.slug,
          gender: t.gender,
          format: t.format,
        },
      })

      // Traer temporadas de SofaScore
      const seasons = await getSeasons(t.sofascoreId)
      const currentYear = new Date().getFullYear().toString()

      for (const s of seasons) {
        const isCurrent = s.year === currentYear

        await prisma.season.upsert({
          where:  { sofascoreId: s.id },
          update: { isCurrent, name: s.name },
          create: {
            sofascoreId:  s.id,
            tournamentId: tournament.id,
            year:         s.year,
            name:         s.name,
            isCurrent,
          },
        })
        records++
      }

      // Marcar solo la actual como isCurrent
      await prisma.season.updateMany({
        where: { tournamentId: tournament.id, sofascoreId: { not: seasons.find((s: any) => s.year === currentYear)?.id } },
        data:  { isCurrent: false },
      })

      log('seasons', `✅ ${t.name} — ${seasons.length} temporadas`)
    }

    await prisma.scraperLog.create({
      data: { jobName: 'seasons', status: 'success', sourceUsed: 'sofascore', recordsUpdated: records, durationMs: Date.now() - start }
    })

    log('seasons', `✅ Completado — ${records} temporadas sincronizadas`)

  } catch (err) {
    logError('seasons', err)
    await prisma.scraperLog.create({
      data: { jobName: 'seasons', status: 'error', sourceUsed: 'sofascore', errorMessage: String(err), durationMs: Date.now() - start }
    })
  }
}
