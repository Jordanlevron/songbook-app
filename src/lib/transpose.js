const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']

const EH = { Db:1, Eb:3, Fb:4, Gb:6, Ab:8, Bb:10, Cb:11 }

// Major key roots that use flat notation: Db Eb F Ab Bb
const FLAT_KEY_IDX = new Set([1, 3, 5, 8, 10])

function ni(note) {
  const idx = EH[note]
  return idx !== undefined ? idx : SHARP.indexOf(note)
}

// Parse "Gm" → {root:"G", isMinor:true}  |  "Bb" → {root:"Bb", isMinor:false}
function parseKey(key) {
  if (!key) return { root: null, isMinor: false }
  const m = /^([A-G][b#]?)(m)?$/.exec(key.trim())
  if (!m) return { root: key.trim(), isMinor: false }
  return { root: m[1], isMinor: !!m[2] }
}

// Determine flat/sharp convention for target key.
// Minor keys use their relative major (root+3) to decide.
function usesFlats(baseKey, semi) {
  const { root, isMinor } = parseKey(baseKey)
  const bi = ni(root)
  if (bi < 0) return false
  const refIdx = isMinor
    ? (bi + 3 + semi + 120) % 12   // relative major of target minor
    : (bi     + semi + 120) % 12
  return FLAT_KEY_IDX.has(refIdx)
}

function transposeNote(note, semi, flats) {
  const i = ni(note)
  if (i < 0) return note
  if (!semi) return note            // preserve original PDF spelling when not transposing
  return (flats ? FLAT : SHARP)[(i + semi + 120) % 12]
}

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

export function transposeChord(text, semi, baseKey = null) {
  const flats = baseKey ? usesFlats(baseKey, semi) : false

  if (text.includes('/')) {
    const [l, r] = text.split('/', 2)
    return transposeRoot(l, semi, flats) + '/' + transposeRoot(r, semi, flats)
  }
  const pm = /^([A-G][b#]?[^(]*)(\(.+\))$/.exec(text)
  if (pm) return transposeRoot(pm[1], semi, flats) + pm[2]
  return transposeRoot(text, semi, flats)
}

// Display the transposed key with major/minor quality: "Am"+3 → "Cm", "Gm"+2 → "Am"
export function shiftKeyDisplay(key, semi) {
  if (!key) return '—'
  const { root, isMinor } = parseKey(key)
  const bi = ni(root)
  if (bi < 0) return '—'
  const flats = usesFlats(key, semi)
  const transposedRoot = (flats ? FLAT : SHARP)[(bi + semi + 120) % 12]
  return (transposedRoot || '—') + (isMinor ? 'm' : '')
}

// Detect key root + major/minor tonality from chord list.
// Returns e.g. "Am", "Gm", "C", "Bb"
export function detectKey(chords) {
  const rootCounts  = {}
  const minorCounts = {}
  for (const c of chords) {
    const m = /^([A-G][b#]?)(m(?!aj))?/.exec(c)
    if (!m) continue
    const root = m[1]
    rootCounts[root] = (rootCounts[root] || 0) + 1
    if (m[2]) minorCounts[root] = (minorCounts[root] || 0) + 1
  }
  if (!Object.keys(rootCounts).length) return null
  const root       = Object.entries(rootCounts).sort((a, b) => b[1] - a[1])[0][0]
  const minorCount = minorCounts[root] || 0
  const majorCount = (rootCounts[root] || 0) - minorCount
  return minorCount > majorCount ? root + 'm' : root
}
