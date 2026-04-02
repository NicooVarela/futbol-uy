import { prisma } from '../../../lib/prisma'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 60

async function getMatch(sofascoreId: number) {
  return prisma.event.findUnique({
    where: { sofascoreId },
    include: {
      homeTeam: true,
      awayTeam: true,
      season: { include: { tournament: true } },
      stadium: true,
      incidents: {
        include: { player: true },
        orderBy: { minute: 'asc' },
      },
      lineups: {
        include: { player: true },
        orderBy: { jerseyNumber: 'asc' },
      },
    },
  })
}

function IncidentIcon({ type, description }: { type: string; description: string | null }) {
  if (type === 'goal') return <span style={{ color: '#4caf50', fontWeight: 700 }}>⚽</span>
  if (type === 'card' && description === 'yellow') return <span style={{ color: '#ffc107' }}>🟨</span>
  if (type === 'card' && (description === 'red' || description === 'yellowRed')) return <span style={{ color: '#f44336' }}>🟥</span>
  if (type === 'substitution') return <span style={{ color: '#9e9e9e', fontSize: 11 }}>↕</span>
  return null
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('es-UY', {
    timeZone: 'America/Montevideo',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString('es-UY', {
    timeZone: 'America/Montevideo',
    hour: '2-digit', minute: '2-digit'
  })
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const match = await getMatch(parseInt(id))
  if (!match) notFound()

  const homeIncidents = match.incidents.filter(i => i.teamSide === 'home')
  const awayIncidents = match.incidents.filter(i => i.teamSide === 'away')
  const homeStarters = match.lineups.filter(l => l.teamSide === 'home' && l.isStarter)
  const awayStarters = match.lineups.filter(l => l.teamSide === 'away' && l.isStarter)
  const homeSubs = match.lineups.filter(l => l.teamSide === 'home' && !l.isStarter)
  const awaySubs = match.lineups.filter(l => l.teamSide === 'away' && !l.isStarter)

  const isFinished = match.status === 'finished'
  const isLive = match.status === 'inprogress'
  const isPending = match.status === 'notstarted'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* HEADER */}
      <header style={{ background: 'var(--bg-header)', borderBottom: '2px solid var(--green-dk)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)', letterSpacing: -0.5, textDecoration: 'none' }}>
          Futbol<span style={{ color: 'var(--white)' }}>UY</span>
        </Link>
        <nav style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          <Link href="/">Inicio</Link>
          <Link href="/torneo/primera-division">Primera</Link>
          <Link href="/torneo/copa-uruguay">Copa UY</Link>
        </nav>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>

        {/* BREADCRUMB */}
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
          <Link href="/">Inicio</Link> / <Link href="/torneo/primera-division">{match.season.tournament.name}</Link> / Fecha {match.round}
        </div>

        {/* HERO DEL PARTIDO */}
        <div style={{ background: '#1a2e1a', borderRadius: 8, padding: '24px 16px', marginBottom: 16 }}>

          {/* Torneo y fecha */}
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            {match.season.tournament.name} · {match.season.year} · Fecha {match.round}
          </div>

          {/* Score principal */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16 }}>

            {/* Local */}
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.sofascore.com/api/v1/team/${match.homeTeam.sofascoreId}/image`}
                alt={match.homeTeam.name}
                width={48} height={48}
                style={{ objectFit: 'contain' }}
              />
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)' }}>
                {match.homeTeam.name}
              </span>
            </div>

            {/* Score */}
            <div style={{ textAlign: 'center' }}>
              {isPending ? (
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{formatDate(match.startTime)}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--white)' }}>{formatTime(match.startTime)}</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 48, fontWeight: 700, color: isLive ? '#ff6b6b' : 'var(--white)', letterSpacing: 4 }}>
                    {match.homeScore ?? 0} - {match.awayScore ?? 0}
                  </div>
                  {match.homeScoreHt !== null && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                      (PT: {match.homeScoreHt} - {match.awayScoreHt})
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    {isLive && <span style={{ background: 'var(--red)', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3 }}>EN VIVO</span>}
                    {isFinished && <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Finalizado</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Visitante */}
            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.sofascore.com/api/v1/team/${match.awayTeam.sofascoreId}/image`}
                alt={match.awayTeam.name}
                width={48} height={48}
                style={{ objectFit: 'contain' }}
              />
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)' }}>
                {match.awayTeam.name}
              </span>
            </div>
          </div>

          {/* Info del partido */}
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-dim)', display: 'flex', justifyContent: 'center', gap: 24 }}>
            {match.stadium && <span>📍 {match.stadium.name}</span>}
            {match.refereeName && <span>👤 {match.refereeName}</span>}
            {!isPending && <span>📅 {formatDate(match.startTime)}</span>}
          </div>
        </div>

        {/* INCIDENCIAS */}
        {match.incidents.length > 0 && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              Goles y Tarjetas
            </div>

            {match.incidents
              .filter(i => ['goal', 'card'].includes(i.type))
              .map(inc => (
                <div key={inc.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  {/* Local */}
                  <div style={{ textAlign: 'right', paddingRight: 8 }}>
                    {inc.teamSide === 'home' && (
                      <span>
                        {inc.player?.name} <IncidentIcon type={inc.type} description={inc.description} />
                      </span>
                    )}
                  </div>

                  {/* Minuto */}
                  <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-dim)', fontWeight: 700 }}>
                    {inc.minute}&apos;
                    {inc.homeScore !== null && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {inc.homeScore}-{inc.awayScore}
                      </div>
                    )}
                  </div>

                  {/* Visitante */}
                  <div style={{ textAlign: 'left', paddingLeft: 8 }}>
                    {inc.teamSide === 'away' && (
                      <span>
                        <IncidentIcon type={inc.type} description={inc.description} /> {inc.player?.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* FORMACIONES */}
        {(homeStarters.length > 0 || awayStarters.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>

            {/* Local */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                {match.homeTeam.shortName || match.homeTeam.name}
              </div>
              {homeStarters.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-dim)', width: 20, textAlign: 'center', fontSize: 11 }}>{l.jerseyNumber}</span>
                  <span style={{ flex: 1 }}>{l.player.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{l.position}</span>
                  {l.rating && <span style={{ fontSize: 11, color: l.rating >= 7 ? '#4caf50' : l.rating >= 6 ? '#ffc107' : '#f44336', fontWeight: 700 }}>{l.rating.toFixed(1)}</span>}
                </div>
              ))}
              {homeSubs.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8, marginBottom: 4 }}>SUPLENTES</div>
                  {homeSubs.map(l => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 11, color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--text-dim)', width: 20, textAlign: 'center' }}>{l.jerseyNumber}</span>
                      <span>{l.player.name}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Visitante */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                {match.awayTeam.shortName || match.awayTeam.name}
              </div>
              {awayStarters.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-dim)', width: 20, textAlign: 'center', fontSize: 11 }}>{l.jerseyNumber}</span>
                  <span style={{ flex: 1 }}>{l.player.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{l.position}</span>
                  {l.rating && <span style={{ fontSize: 11, color: l.rating >= 7 ? '#4caf50' : l.rating >= 6 ? '#ffc107' : '#f44336', fontWeight: 700 }}>{l.rating.toFixed(1)}</span>}
                </div>
              ))}
              {awaySubs.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8, marginBottom: 4 }}>SUPLENTES</div>
                  {awaySubs.map(l => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 11, color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--text-dim)', width: 20, textAlign: 'center' }}>{l.jerseyNumber}</span>
                      <span>{l.player.name}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* VOLVER */}
        <Link href="/" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          ← Volver al inicio
        </Link>
      </div>
    </div>
  )
}
