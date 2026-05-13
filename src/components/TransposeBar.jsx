import { useState } from 'react'
import { shiftKeyDisplay } from '../lib/transpose'

export const DEFAULT_COLORS = { lyric: '#111111', chord: '#555555', structure: '#9a3412' }

const s = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '8px 16px', flexWrap: 'wrap',
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

export default function TransposeBar({
  baseKey, semi, onSemi,
  readMode, onReadMode,
  zoom = 1, onZoom,
  colors = DEFAULT_COLORS, onColors,
}) {
  const [showColors, setShowColors] = useState(false)
  const currentKey = shiftKeyDisplay(baseKey, semi)

  return (
    <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
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

        <button style={s.toggle(showColors)} onClick={() => setShowColors(v => !v)}>
          🎨 צבעים
        </button>
        <button style={s.toggle(!readMode)} onClick={() => onReadMode(!readMode)}>
          {readMode ? '✏️ עריכה' : '📖 קריאה'}
        </button>
      </div>

      {showColors && (
        <div style={{
          display: 'flex', gap: 24, alignItems: 'center',
          padding: '8px 16px', borderTop: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}>
          {[
            { key: 'lyric',     label: 'מילים'    },
            { key: 'chord',     label: 'אקורדים'  },
            { key: 'structure', label: 'מבנה'     },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <span style={{ ...s.label, fontSize: 13 }}>{label}</span>
              <input
                type="color"
                value={colors[key]}
                onChange={e => onColors({ ...colors, [key]: e.target.value })}
                style={{ width: 32, height: 28, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: 2 }}
              />
            </label>
          ))}
          <button
            style={{ ...s.btn, fontSize: 12 }}
            onClick={() => onColors(DEFAULT_COLORS)}
          >
            ↺ ברירת מחדל
          </button>
        </div>
      )}
    </div>
  )
}
