const s = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    padding: '8px 16px', flexShrink: 0, flexWrap: 'wrap',
  },
  btn: {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    color: 'var(--text)', borderRadius: 6, padding: '4px 10px',
    fontSize: 18, lineHeight: 1,
  },
  key: {
    minWidth: 56, textAlign: 'center',
    color: 'var(--accent)', fontWeight: 'bold', fontSize: 16,
  },
  label: { color: 'var(--subtext)', fontSize: 12 },
  toggle: (active) => ({
    background: active ? 'var(--accent)' : 'var(--surface2)',
    border: '1px solid var(--border)',
    color: active ? '#11111b' : 'var(--text)',
    borderRadius: 6, padding: '4px 10px', fontSize: 13,
  }),
}

import { shiftKeyDisplay } from '../lib/transpose'

export default function TransposeBar({ baseKey, semi, onSemi, readMode, onReadMode, zoom = 1, onZoom }) {
  const currentKey = shiftKeyDisplay(baseKey, semi)

  return (
    <div style={s.bar}>
      <span style={s.label}>סולם:</span>
      <span style={s.key}>{currentKey}</span>

      <button style={s.btn} onClick={() => onSemi(semi - 1)} title="חצי טון למטה">−</button>
      <button style={s.btn} onClick={() => onSemi(0)}         title="אפס">↺</button>
      <button style={s.btn} onClick={() => onSemi(semi + 1)} title="חצי טון למעלה">+</button>

      {semi !== 0 && (
        <span style={{ color: 'var(--subtext)', fontSize: 12 }}>
          ({semi > 0 ? '+' : ''}{semi})
        </span>
      )}

      <div style={{ flex: 1 }} />

      <button style={s.btn} onClick={() => onZoom(zoom - 0.1)} title="הקטן">−🔍</button>
      <span style={{ ...s.label, minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
      <button style={s.btn} onClick={() => onZoom(zoom + 0.1)} title="הגדל">+🔍</button>
      <button style={{ ...s.btn, fontSize: 13 }} onClick={() => onZoom(1)} title="אפס זום">↺</button>

      <button style={s.toggle(!readMode)} onClick={() => onReadMode(!readMode)}>
        {readMode ? '🎨 צבעים' : '📖 קריאה'}
      </button>
    </div>
  )
}
