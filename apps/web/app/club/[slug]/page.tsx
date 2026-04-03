import { prisma } from '../../../lib/prisma'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '../../components/Header'

export const revalidate = 300

async function getTeam(slug: string) {
  return prisma.team.findUnique({
    where: { slug },
    include: {
      stadium: true,
      players: {
        orderBy: [{ position: 'asc' }, { shirtNumber: 'asc' }],
      },
    },
  })
}

async function getTeamMatches(teamId: number) {
  return prisma.event.findMany({
    where: {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      season: { isCurrent: true },
    },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { startTime: 'desc' },
    take: 10,
  })
}

async function getTeamStanding(teamId: number) {
  const all = await prisma.standing.findMany({
    where: {
      teamId,
      season: { isCurrent: true, tournament: { sofascoreId: 278 } },
    },
    include: { season: { include: { tournament: true } } },
    orderBy: { position: 'asc' },
  })

  // Preferir Apertura > Clausura > Anual > cualquier otro
  const preferred = ['Apertura', 'Clausura', 'Anual']
  for (const p of preferred) {
    const match = all.find(s => (s as any).group?.includes(p))
    if (match) return match
  }
  return all[0] ?? null
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('es-UY', {
    timeZone: 'America/Montevideo',
    day: 'numeric', month: 'short',
  })
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString('es-UY', {
    timeZone: 'America/Montevideo',
    hour: '2-digit', minute: '2-digit',
  })
}

const positionLabel: Record<string, string> = {
  G: 'Porteros',
  D: 'Defensas',
  M: 'Mediocampistas',
  F: 'Delanteros',
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const team = await getTeam(slug)
  if (!team) notFound()

  const [matches, standing] = await Promise.all([
    getTeamMatches(team.id),
    getTeamStanding(team.id),
  ])

  const primaryColor = team.primaryColor ?? '#2e7d32'

  const playersByPosition = team.players.reduce((acc, p) => {
    const pos = p.position ?? 'X'
    if (!acc[pos]) acc[pos] = []
    acc[pos].push(p)
    return acc
  }, {} as Record<string, typeof team.players>)

  const positionOrder = ['G', 'D', 'M', 'F']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />

      {/* BANNER DEL CLUB */}
      <div style={{ background: `linear-gradient(135deg, ${primaryColor}33, #1a1a1a)`, borderBottom: '1px solid var(--border)', padding: '24px 16px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://api.sofascore.com/api/v1/team/${team.sofascoreId}/image`} alt={team.name} width={80} height={80} style={{ objectFit: 'contain' }} />
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--white)', marginBottom: 4 }}>{team.name}</h1>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
              {team.foundedYear && <span>⚽ Fundado: {team.foundedYear}</span>}
              {team.stadium && <span>📍 {team.stadium.name}</span>}
              {team.stadium?.capacity && <span>👥 {team.stadium.capacity.toLocaleString()} cap.</span>}
              {team.managerName && <span>🧑‍💼 DT: {team.managerName}</span>}
            </div>
          </div>

          {standing && (
            <div style={{ marginLeft: 'auto', background: 'var(--bg-card)', borderRadius: 8, padding: '12px 20px', textAlign: 'center', border: `1px solid ${primaryColor}44` }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>
                {standing.season.tournament.name}
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--white)', lineHeight: 1 }}>
                {standing.position}°
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{standing.points} pts</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                {standing.wins}G {standing.draws}E {standing.losses}P
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16, display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>

        {/* PLANTEL */}
        <div>
          <div style={{ background: '#1f3a22', borderRadius: '6px 6px 0 0', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--white)', textTransform: 'uppercase' }}>
            Plantel
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
            {positionOrder.map(pos => {
              const players = playersByPosition[pos]
              if (!players?.length) return null
              return (
                <div key={pos}>
                  <div style={{ background: '#1a2a1a', padding: '5px 12px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {positionLabel[pos] ?? pos}
                  </div>
                  {players.map(p => (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 60px 60px 60px', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: 12, fontWeight: 600 }}>{p.shirtNumber ?? '-'}</span>
                      <span>{p.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>{p.nationality ?? '-'}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>{p.height ? `${p.height}cm` : '-'}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>{p.preferredFoot ?? '-'}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>

        {/* ÚLTIMOS PARTIDOS */}
        <div>
          <div style={{ background: '#1f3a22', borderRadius: '6px 6px 0 0', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--white)', textTransform: 'uppercase' }}>
            Últimos partidos
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
            {matches.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                Sin partidos recientes
              </div>
            )}
            {matches.map(match => {
              const isHome = match.homeTeamId === team.id
              const opponent = isHome ? match.awayTeam : match.homeTeam
              const myScore = isHome ? match.homeScore : match.awayScore
              const oppScore = isHome ? match.awayScore : match.homeScore
              const result = match.status === 'finished'
                ? myScore! > oppScore! ? 'W' : myScore! < oppScore! ? 'L' : 'D'
                : null

              return (
                <Link key={match.id} href={`/partido/${match.sofascoreId}`} style={{ display: 'block' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 50px', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    <div style={{ textAlign: 'center' }}>
                      {result && (
                        <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 3, textAlign: 'center', lineHeight: '18px', fontSize: 11, fontWeight: 700, background: result === 'W' ? '#1b5e20' : result === 'L' ? '#b71c1c' : '#333', color: 'white' }}>
                          {result}
                        </span>
                      )}
                      {!result && (
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{formatDate(match.startTime)}</span>
                      )}
                    </div>
                    <div style={{ paddingLeft: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{isHome ? 'vs' : 'en'}</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`https://api.sofascore.com/api/v1/team/${opponent.sofascoreId}/image`} alt="" width={14} height={14} style={{ objectFit: 'contain' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{opponent.shortName || opponent.name}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{formatDate(match.startTime)}</div>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: 'var(--white)' }}>
                      {match.status === 'notstarted' ? formatTime(match.startTime) : `${myScore ?? 0}-${oppScore ?? 0}`}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}