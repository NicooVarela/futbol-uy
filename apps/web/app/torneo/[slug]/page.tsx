import { prisma } from '../../../lib/prisma'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '../../components/Header'

export const revalidate = 300

async function getTournament(slug: string) {
  return prisma.tournament.findUnique({
    where: { slug },
    include: {
      seasons: {
        orderBy: { year: 'desc' },
      },
    },
  })
}

async function getStandings(seasonId: number) {
  const standings = await prisma.standing.findMany({
    where: { seasonId },
    include: { team: true },
    orderBy: [{ position: 'asc' }],
  })

  const groups: Record<string, typeof standings> = {}
  for (const s of standings) {
    const key = (s as any).group ?? 'total'
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  }
  return groups
}

async function getFixture(seasonId: number) {
  return prisma.event.findMany({
    where: { seasonId },
    include: { homeTeam: true, awayTeam: true },
    orderBy: [{ round: 'asc' }, { startTime: 'asc' }],
  })
}

function getZoneColor(zone: string | null) {
  if (!zone) return 'transparent'
  if (zone.toLowerCase().includes('libertadores')) return '#1565c0'
  if (zone.toLowerCase().includes('sudamericana')) return '#2e7d32'
  if (zone.toLowerCase().includes('descen') || zone.toLowerCase().includes('relega')) return '#c62828'
  return 'transparent'
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString('es-UY', {
    timeZone: 'America/Montevideo',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('es-UY', {
    timeZone: 'America/Montevideo',
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default async function TournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ fecha?: string; tab?: string }>
}) {
  const { slug } = await params
  const { fecha, tab = 'tabla' } = await searchParams

  const tournament = await getTournament(slug)
  if (!tournament) notFound()

  const currentSeason = tournament.seasons.find(s => s.isCurrent) ?? tournament.seasons[0]
  if (!currentSeason) notFound()

  const [standings, fixture] = await Promise.all([
    getStandings(currentSeason.id),
    getFixture(currentSeason.id),
  ])

  const rounds = fixture.reduce((acc, match) => {
    const round = match.round ?? 0
    if (!acc[round]) acc[round] = []
    acc[round].push(match)
    return acc
  }, {} as Record<number, typeof fixture>)

  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b)
  const selectedRound = fecha ? parseInt(fecha) : roundNumbers[roundNumbers.length - 1]
  const currentRoundMatches = rounds[selectedRound] ?? []
  const hasGroups = Object.keys(standings).length > 1

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      <Header activeSlug={slug} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>

        {/* TÍTULO DEL TORNEO */}
        <div style={{ background: '#1f3a22', borderRadius: 8, padding: '16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.sofascore.com/api/v1/unique-tournament/${tournament.sofascoreId}/image/dark`}
            alt={tournament.name}
            width={40} height={40}
            style={{ objectFit: 'contain' }}
          />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)' }}>{tournament.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Temporada {currentSeason.year}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {tournament.seasons.slice(0, 4).map(s => (
              <Link
                key={s.id}
                href={`/torneo/${slug}`}
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 3,
                  border: '1px solid var(--border)',
                  color: s.isCurrent ? 'var(--white)' : 'var(--text-dim)',
                  background: s.isCurrent ? 'var(--green-dk)' : 'transparent',
                }}
              >
                {s.year}
              </Link>
            ))}
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
          {[
            { key: 'tabla', label: 'Tabla' },
            { key: 'fixture', label: 'Fixture' },
          ].map(t => (
            <Link
              key={t.key}
              href={`/torneo/${slug}?tab=${t.key}`}
              style={{
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? 'var(--green)' : 'var(--text-muted)',
                borderBottom: tab === t.key ? '2px solid var(--green)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* CONTENIDO */}
        <div style={{ display: 'grid', gridTemplateColumns: tab === 'tabla' ? '1fr 320px' : '1fr', gap: 16 }}>

          {/* TABLA DE POSICIONES */}
          {tab === 'tabla' && (
            <>
              <div>
                {Object.entries(standings).map(([groupName, rows]) => (
                  <div key={groupName} style={{ marginBottom: 20 }}>
                    {hasGroups && (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '5px 8px', background: '#111', borderRadius: '4px 4px 0 0', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                        {groupName.includes('Group') ? groupName.split(',').pop()?.trim() : groupName}
                      </div>
                    )}
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: hasGroups ? '0 0 6px 6px' : 8, overflow: 'hidden' }}>
                      <thead>
                        <tr style={{ background: '#1a2e1a' }}>
                          <th style={{ padding: '8px 6px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'center', width: 28 }}>#</th>
                          <th style={{ padding: '8px 6px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'left' }}>Club</th>
                          <th style={{ padding: '8px 6px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'center' }}>PJ</th>
                          <th style={{ padding: '8px 6px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'center' }}>G</th>
                          <th style={{ padding: '8px 6px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'center' }}>E</th>
                          <th style={{ padding: '8px 6px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'center' }}>P</th>
                          <th style={{ padding: '8px 6px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'center' }}>GF</th>
                          <th style={{ padding: '8px 6px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'center' }}>GC</th>
                          <th style={{ padding: '8px 6px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'center' }}>GD</th>
                          <th style={{ padding: '8px 6px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'center' }}>Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(s => (
                          <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: 12, color: 'var(--text-dim)', borderLeft: `3px solid ${getZoneColor(s.zone)}` }}>
                              {s.position}
                            </td>
                            <td style={{ padding: '8px 6px' }}>
                              <Link href={`/club/${s.team.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`https://api.sofascore.com/api/v1/team/${s.team.sofascoreId}/image`} alt={s.team.name} width={20} height={20} style={{ objectFit: 'contain' }} />
                                <span style={{ fontSize: 13, fontWeight: s.position <= 3 ? 600 : 400 }}>{s.team.name}</span>
                              </Link>
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{s.played}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{s.wins}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{s.draws}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{s.losses}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{s.goalsFor}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{s.goalsAgainst}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: 12, color: s.goalsFor - s.goalsAgainst > 0 ? 'var(--green-lt)' : s.goalsFor - s.goalsAgainst < 0 ? '#ef9a9a' : 'var(--text-muted)' }}>
                              {s.goalsFor - s.goalsAgainst > 0 ? '+' : ''}{s.goalsFor - s.goalsAgainst}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--white)' }}>{s.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {/* Leyenda */}
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim)', display: 'flex', gap: 16 }}>
                  <span style={{ borderLeft: '3px solid #1565c0', paddingLeft: 6 }}>Copa Libertadores</span>
                  <span style={{ borderLeft: '3px solid #2e7d32', paddingLeft: 6 }}>Copa Sudamericana</span>
                  <span style={{ borderLeft: '3px solid #c62828', paddingLeft: 6 }}>Descenso</span>
                </div>
              </div>

              {/* ÚLTIMO FIXTURE */}
              <div>
                <div style={{ background: '#1a2e1a', borderRadius: '6px 6px 0 0', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--white)', textTransform: 'uppercase' }}>
                  Fecha {selectedRound}
                </div>
                {currentRoundMatches.map(match => (
                  <Link key={match.id} href={`/partido/${match.sofascoreId}`} style={{ display: 'block' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 60px 1fr', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', fontSize: 12 }}>
                      <div style={{ textAlign: 'center', fontSize: 11, color: match.status === 'finished' ? 'var(--text-dim)' : 'var(--text-muted)' }}>
                        {match.status === 'finished' ? 'FIN' : formatTime(match.startTime)}
                      </div>
                      <div style={{ textAlign: 'right', paddingRight: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {match.homeTeam.shortName || match.homeTeam.name}
                      </div>
                      <div style={{ textAlign: 'center', fontWeight: 700, color: 'var(--white)', background: '#2a2a2a', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 4px' }}>
                        {match.status === 'notstarted' ? 'vs' : `${match.homeScore ?? 0}-${match.awayScore ?? 0}`}
                      </div>
                      <div style={{ textAlign: 'left', paddingLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {match.awayTeam.shortName || match.awayTeam.name}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* FIXTURE COMPLETO */}
          {tab === 'fixture' && (
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {roundNumbers.map(r => (
                  <Link
                    key={r}
                    href={`/torneo/${slug}?tab=fixture&fecha=${r}`}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--border)',
                      fontSize: 12,
                      color: r === selectedRound ? 'var(--white)' : 'var(--text-dim)',
                      background: r === selectedRound ? 'var(--green-dk)' : 'var(--bg-card)',
                    }}
                  >
                    F{r}
                  </Link>
                ))}
              </div>

              <div style={{ background: 'var(--bg-card)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#1a2e1a', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--white)' }}>
                  Fecha {selectedRound}
                </div>
                {currentRoundMatches.map(match => (
                  <Link key={match.id} href={`/partido/${match.sofascoreId}`} style={{ display: 'block' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px 1fr', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <div style={{ textAlign: 'center', fontSize: 12, color: match.status === 'finished' ? 'var(--text-dim)' : 'var(--text-muted)' }}>
                        {match.status === 'finished' ? (
                          <span>FIN<br /><span style={{ fontSize: 10 }}>{formatDate(match.startTime)}</span></span>
                        ) : (
                          <span>{formatTime(match.startTime)}<br /><span style={{ fontSize: 10 }}>{formatDate(match.startTime)}</span></span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', paddingRight: 10, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`https://api.sofascore.com/api/v1/team/${match.homeTeam.sofascoreId}/image`} alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
                        <span style={{ fontWeight: match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore ? 700 : 400 }}>
                          {match.homeTeam.name}
                        </span>
                      </div>
                      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--white)', background: '#2a2a2a', border: '1px solid var(--border)', borderRadius: 3, padding: '3px 8px' }}>
                        {match.status === 'notstarted' ? 'vs' : `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`}
                      </div>
                      <div style={{ textAlign: 'left', paddingLeft: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore ? 700 : 400 }}>
                          {match.awayTeam.name}
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`https://api.sofascore.com/api/v1/team/${match.awayTeam.sofascoreId}/image`} alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}