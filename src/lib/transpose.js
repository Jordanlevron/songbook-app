// Transpose logic — from SPEC.md, untouched
const CH = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const EH = { Db:'C#', Eb:'D#', Fb:'E', Gb:'F#', Ab:'G#', Bb:'A#', Cb:'B' }
const FL = { 'D#':'Eb', 'A#':'Bb', 'G#':'Ab' }
const FN = { 'C#':'Db', 'D#':'Eb', 'F#':'Gb', 'G#':'Ab', 'A#':'Bb' }

function ni(n) { return CH.indexOf(EH[n] || n) }
function tn(n, s) {
  const i = ni(n)
  if (i < 0) return n
  const r = CH[(i + s + 12) % 12]
  return FL[r] || (EH[n] && FN[r]) || r
}

export function transposeChord(text, semi) {
  if (!semi) return text
  const N = /^([A-G][b#]?)/
  if (text.includes('/')) {
    const [l, r] = text.split('/', 2)
    const lm = N.exec(l), rm = N.exec(r)
    return (lm ? tn(lm[1], semi) + l.slice(lm[1].length) : l) +
           '/' +
           (rm ? tn(rm[1], semi) + r.slice(rm[1].length) : r)
  }
  const pm = /^([A-G][b#]?[^(]*)(\(.+\))$/.exec(text)
  if (pm) {
    const m = N.exec(pm[1])
    return m ? tn(m[1], semi) + pm[1].slice(m[1].length) + pm[2] : text
  }
  const m = N.exec(text)
  if (!m) return text
  return tn(m[1], semi) + text.slice(m[1].length)
}

// Detect the root key from a list of chord strings
export function detectKey(chords) {
  const counts = {}
  for (const c of chords) {
    const m = /^([A-G][b#]?)/.exec(c)
    if (m) counts[m[1]] = (counts[m[1]] || 0) + 1
  }
  if (!Object.keys(counts).length) return null
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}
