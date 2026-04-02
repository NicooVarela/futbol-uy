import { prisma } from '../lib/prisma'
import Link from 'next/link'

export const revalidate = 60

async function getStandings() {
  return prisma.standing.findMany({
    where: {
      season: {
        isCurrent: true,
        tournament: { sofascoreId: 278 }
      }
    },
    include: { team: true },
    orderBy: { position: 'asc' },
  })
}

async function getRecentMatches() {
  return prisma.event.findMany({
    where: {
      season: {
        isCurrent: true,
        tournament: { sofascoreId: 278 }
      }
    },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { startTime: 'desc' },
    take: 30,
  })
}

function getZoneColor(zone: string | null) {
  if (!zone) return 'transparent'
  if (zone.toLowerCase().includes('libertadores')) return '#1565c0'
  if (zone.toLowerCase().includes('sudamericana')) return '#2e7d32'
  if (zone.toLowerCase().includes('descen') || zone.toLowerCase().includes('relega')) return '#c62828'
  return 'transparent'
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('es-UY', {
    timeZone: 'America/Montevideo',
    weekday: 'short', day: 'numeric', month: 'short'
  })
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString('es-UY', {
    timeZone: 'America/Montevideo',
    hour: '2-digit', minute: '2-digit'
  })
}

export default async function HomePage() {
  const [standings, matches] = await Promise.all([getStandings(), getRecentMatches()])

  const matchesByDate = matches.reduce((acc, match) => {
    const date = formatDate(match.startTime)
    if (!acc[date]) acc[date] = []
    acc[date].push(match)
    return acc
  }, {} as Record<string, typeof matches>)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* HEADER */}
      <header style={{ background: 'var(--bg-header)', borderBottom: '2px solid var(--green-dk)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)', letterSpacing: -0.5 }}>
          Futbol<span style={{ color: 'var(--white)' }}>UY</span>
        </div>
        <nav style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          <Link href="/" style={{ color: 'var(--green)' }}>Inicio</Link>
          <Link href="/torneo/primera-division">Primera</Link>
          <Link href="/torneo/copa-uruguay">Copa UY</Link>
          <Link href="/torneo/segunda-division">Segunda</Link>
        </nav>
      </header>

      {/* LAYOUT */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>

        {/* PARTIDOS */}
        <div>
          <div style={{ background: '#1f3a22', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontWeight: 600, fontSize: 13, color: 'var(--white)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            🇺🇾 Liga AUF Uruguaya 2026
          </div>

          {Object.entries(matchesByDate).map(([date, dayMatches]) => (
            <div key={date} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '4px 0', borderBottom: '1px solid var(--border)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {date}
              </div>
              {dayMatches.map(match => (
                <Link key={match.id} href={`/partido/${match.sofascoreId}`} style={{ display: 'block' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 70px 1fr 28px',
                    alignItems: 'center',
                    padding: '6px 8px',
                    borderBottom: '1px solid var(--border)',
                    background: match.status === 'inprogress' ? '#2a0a0a' : 'transparent',
                  }}>
                    <div style={{ textAlign: 'center', fontSize: 12, color: match.status === 'inprogress' ? 'var(--red)' : match.status === 'finished' ? 'var(--text-dim)' : 'var(--text-muted)', fontWeight: match.status === 'inprogress' ? 700 : 400 }}>
                      {match.status === 'finished' ? 'FIN' : match.status === 'inprogress' ? '● VIVO' : formatTime(match.startTime)}
                    </div>
                    <div style={{ textAlign: 'right', paddingRight: 8, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore ? 700 : 400 }}>
                      {match.homeTeam.name}
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, color: match.status === 'inprogress' ? '#ff6b6b' : 'var(--white)', background: match.status === 'notstarted' ? 'transparent' : '#2a2a2a', border: match.status === 'notstarted' ? 'none' : '1px solid var(--border)', borderRadius: 3, padding: '2px 6px' }}>
                      {match.status === 'notstarted' ? 'vs' : `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`}
                    </div>
                    <div style={{ textAlign: 'left', paddingLeft: 8, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore ? 700 : 400 }}>
                      {match.awayTeam.name}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-dim)' }}>F{match.round}</div>
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* TABLA */}
        <div>
          <div style={{ background: '#1f3a22', borderRadius: '6px 6px 0 0', padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--white)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Tabla de Posiciones
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)' }}>
            <thead>
              <tr style={{ background: '#1a2e1a' }}>
                <th style={{ padding: '5px 4px', fontSize: 10, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'center', width: 24 }}>#</th>
                <th style={{ padding: '5px 4px', fontSize: 10, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'left' }}>Club</th>
                <th style={{ padding: '5px 4px', fontSize: 10, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'center' }}>PJ</th>
                <th style={{ padding: '5px 4px', fontSize: 10, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'center' }}>GD</th>
                <th style={{ padding: '5px 4px', fontSize: 10, color: 'var(--text-dim)', fontWeight: 400, textAlign: 'center' }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '5px 4px', textAlign: 'center', fontSize: 11, color: 'var(--text-dim)', borderLeft: `3px solid ${getZoneColor(s.zone)}` }}>
                    {s.position}
                  </td>
                  <td style={{ padding: '5px 4px', fontSize: 12 }}>
                    <Link href={`/club/${s.team.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.sofascore.com/api/v1/team/${s.team.sofascoreId}/image`}
                        alt={s.team.name}
                        width={16}
                        height={16}
                        style={{ objectFit: 'contain' }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                        {s.team.shortName || s.team.name}
                      </span>
                    </Link>
                  </td>
                  <td style={{ padding: '5px 4px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>{s.played}</td>
                  <td style={{ padding: '5px 4px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                    {s.goalsFor - s.goalsAgainst > 0 ? '+' : ''}{s.goalsFor - s.goalsAgainst}
                  </td>
                  <td style={{ padding: '5px 4px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--white)' }}>{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ borderLeft: '3px solid #1565c0', paddingLeft: 6 }}>Copa Libertadores</span>
            <span style={{ borderLeft: '3px solid #2e7d32', paddingLeft: 6 }}>Copa Sudamericana</span>
            <span style={{ borderLeft: '3px solid #c62828', paddingLeft: 6 }}>Descenso</span>
          </div>
        </div>

      </div>
    </div>
  )
}
