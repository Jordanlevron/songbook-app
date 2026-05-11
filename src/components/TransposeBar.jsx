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

// Map a root note + semitone shift to the new root note label
const CH = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const EH = { Db:'C#', Eb:'D#', Fb:'E', Gb:'F#', Ab:'G#', Bb:'A#', Cb:'B' }
const FL = { 'D#':'Eb', 'A#':'Bb', 'G#':'Ab' }
function shiftKey(root, semi) {
  if (!root) return '—'
  const base = EH[root] || root
  const i = CH.indexOf(base)
  if (i < 0) return root
  const r = CH[(i + semi + 12) % 12]
  return FL[r] || r
}

export default function TransposeBar({ baseKey, semi, onSemi, readMode, onReadMode }) {
  const currentKey = shiftKey(baseKey, semi)

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

      <button style={s.toggle(!readMode)} onClick={() => onReadMode(!readMode)}>
        {readMode ? '🎨 הצג צבעים' : '📖 מצב קריאה'}
      </button>
    </div>
  )
}
