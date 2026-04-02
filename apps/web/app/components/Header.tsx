import Link from 'next/link'

const TORNEOS = [
  { slug: 'primera-division',          label: 'Primera',   emoji: '🇺🇾' },
  { slug: 'segunda-division',          label: 'Segunda',   emoji: '🇺🇾' },
  { slug: 'copa-uruguay',              label: 'Copa UY',   emoji: '🏆' },
  { slug: 'primera-division-femenina', label: 'Femenino',  emoji: '⚽' },
  { slug: 'primera-division-reservas', label: 'Reservas',  emoji: '🔵' },
  { slug: 'copa-de-la-liga',           label: 'Copa Liga', emoji: '🥈' },
]

export default function Header({ activeSlug }: { activeSlug?: string }) {
  return (
    <header style={{ background: 'var(--bg-header)', borderBottom: '2px solid var(--green-dk)', padding: '10px 16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 24 }}>
        <Link href="/" style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)', letterSpacing: -0.5, whiteSpace: 'nowrap' }}>
          Futbol<span style={{ color: 'var(--white)' }}>UY</span>
        </Link>
        <nav style={{ display: 'flex', gap: 4, overflowX: 'auto', flexWrap: 'nowrap' }}>
          {TORNEOS.map(t => (
            <Link
              key={t.slug}
              href={`/torneo/${t.slug}`}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 12,
                whiteSpace: 'nowrap',
                color: activeSlug === t.slug ? 'var(--white)' : 'var(--text-muted)',
                background: activeSlug === t.slug ? 'var(--green-dk)' : 'transparent',
                fontWeight: activeSlug === t.slug ? 600 : 400,
              }}
            >
              {t.emoji} {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}