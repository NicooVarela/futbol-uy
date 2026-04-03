'use client'

import { useRouter } from 'next/navigation'

interface Props {
  seasons: { id: number; year: string }[]
  currentSeasonId: number
  slug: string
}

export default function SeasonSelector({ seasons, currentSeasonId, slug }: Props) {
  const router = useRouter()
  const currentSeason = seasons.find(s => s.id === currentSeasonId)

  return (
    <select
      value={currentSeason?.year ?? ''}
      onChange={(e) => router.push(`/torneo/${slug}?season=${e.target.value}`)}
      style={{
        background: '#1a2e1a',
        color: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '5px 10px',
        fontSize: 12,
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      {seasons.map(s => (
        <option key={s.id} value={s.year}>
          {s.year}
        </option>
      ))}
    </select>
  )
}