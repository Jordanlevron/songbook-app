// All 12 chromatic pitches in sharp and flat spellings
const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']

// Normalize flat note names to chromatic index
const EH = { Db:1, Eb:3, Fb:4, Gb:6, Ab:8, Bb:10, Cb:11 }

// Target key root indices (0–11) that use flat spellings.
// Covers: Db(1), Eb(3), F(5), Ab(8), Bb(10) — and their relative minors.
// F# major / F# minor stays sharp (index 6 excluded).
const FLAT_KEY_IDX = new Set([1, 3, 5, 8, 10])

function ni(note) {
  const idx = EH[note]
  return idx !== undefined ? idx : SHARP.indexOf(note)
}

function usesFlats(baseKey, semi) {
  const bi = ni(baseKey)
  if (bi < 0) return false
  return FLAT_KEY_IDX.has((bi + semi + 120) % 12)
}

function transposeNote(note, semi, flats) {
  const i = ni(note)
  if (i < 0) return note
  return (flats ? FLAT : SHARP)[(i + semi + 120) % 12]
}

// Normalize chord quality to canonical notation:
//   Fully diminished (dim, °, o, O variants) → o7
//   Half-diminished (m7b5, ø7)              → ø
function normalizeQuality(q) {
  if (/^(dim7?|Dim7?|[°oO]7?)$/.test(q)) return 'o7'
  if (/^(m7[b♭]5|ø7)$/.test(q))          return 'ø'
  if (/^[Mm]aj7$/.test(q))               return '∆7'
  return q
}

function transposeRoot(chord, semi, flats) {
  const m = /^([A-G][b#]?)(.*)$/.exec(chord)
  if (!m) return chord
  return transposeNote(m[1], semi, flats) + normalizeQuality(m[2])
}

// baseKey: the original key root (e.g. 'A' for Am) — used to determine flat/sharp context
// Always normalizes chord notation even when semi=0
export function transposeChord(text, semi, baseKey = null) {
  const flats = (semi && baseKey) ? usesFlats(baseKey, semi) : false

  if (text.includes('/')) {
    const [l, r] = text.split('/', 2)
    return transposeRoot(l, semi, flats) + '/' + transposeRoot(r, semi, flats)
  }
  // Chord with parenthesised note range, e.g. "Am(1-5)"
  const pm = /^([A-G][b#]?[^(]*)(\(.+\))$/.exec(text)
  if (pm) return transposeRoot(pm[1], semi, flats) + pm[2]

  return transposeRoot(text, semi, flats)
}

// Display the transposed key root in the correct enharmonic spelling
export function shiftKeyDisplay(root, semi) {
  if (!root) return '—'
  const flats = usesFlats(root, semi)
  const result = transposeNote(root, semi, flats)
  return result || '—'
}

// Detect the most common root note from a list of chord strings
export function detectKey(chords) {
  const counts = {}
  for (const c of chords) {
    const m = /^([A-G][b#]?)/.exec(c)
    if (m) counts[m[1]] = (counts[m[1]] || 0) + 1
  }
  if (!Object.keys(counts).length) return null
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}
