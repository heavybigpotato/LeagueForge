/**
 * Tiny, dependency-free, theme-aware charts drawn as inline SVG. Colours come
 * from CSS variables so they track the app's palette in any theme. Kept
 * deliberately small — these are glanceable, not analytical.
 */

/** A donut of proportional segments with a centre label. */
export function Donut({
  segments,
  size = 120,
  thickness = 16,
  centerTop,
  centerBottom,
}: {
  segments: { label: string; value: number; color: string }[]
  size?: number
  thickness?: number
  centerTop?: string
  centerBottom?: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="donut" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s, i) => {
            const frac = s.value / total
            const dash = frac * c
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                strokeLinecap="butt"
              />
            )
            offset += dash
            return el
          })}
        {(centerTop || centerBottom) && (
          <>
            <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fill="var(--text)" style={{ fontSize: size * 0.2, fontWeight: 800 }}>
              {centerTop}
            </text>
            <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" fill="var(--faint)" style={{ fontSize: size * 0.1, fontWeight: 700 }}>
              {centerBottom}
            </text>
          </>
        )}
      </svg>
      <div className="donut-legend" style={{ display: 'grid', gap: 6 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--muted)', fontWeight: 700 }}>{s.label}</span>
            <span style={{ color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A row of value-labelled vertical bars. */
export function Bars({ data, height = 90, color = 'var(--volt)' }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="bars" style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: height + 22 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{d.value}</span>
          <div
            style={{
              width: '100%',
              maxWidth: 34,
              height: Math.max(3, (d.value / max) * height),
              background: `linear-gradient(180deg, ${color}, ${color}66)`,
              borderRadius: '6px 6px 3px 3px',
              transition: 'height 0.3s ease',
            }}
          />
          <span className="truncate" style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 700, maxWidth: '100%' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/** A circular percentage ring with a big number in the middle. */
export function Ring({ pct, size = 84, thickness = 9, label, color = 'var(--volt)' }: { pct: number; size?: number; thickness?: number; label?: string; color?: string }) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fill="var(--text)" style={{ fontSize: size * 0.28, fontWeight: 800 }}>
          {Math.round(clamped)}%
        </text>
      </svg>
      {label && <span style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>}
    </div>
  )
}
