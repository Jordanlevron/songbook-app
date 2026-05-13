import { useRef, useEffect, useState, useCallback } from 'react'
import { transposeChord } from '../lib/transpose'

const BARLINE_RE = /^(I{1,3}:?|:I{1,3}|:\||\|:?:?|\||x\d+)$/i

function isBarlineText(t) {
  return BARLINE_RE.test(t.trim())
}

function normalizeBarline(t) {
  const s = t.trim()
  if (/^x\d+$/i.test(s))            return s     // x2, x3 — keep as-is
  if (/^(II+|:\|:|\|\|)$/i.test(s)) return '||'
  if (/^(:I+|:\|)$/.test(s))        return '|:'
  if (/^(I+:|:\|)$/.test(s))        return ':|'
  return '|'
}

// A line is a chord-box if ALL items are chords and at least one is a barline
function isChordBoxLine(items) {
  return items.length > 0
    && items.every(i => i.type === 'chord')
    && items.some(i => isBarlineText(i.text))
}

const PT_TO_PX = 96 / 72

const TYPE_STYLE = {
  chord:     { bg: 'rgba(80,80,80,0.15)', border: '#555', color: '#333' },
  lyric:     { bg: 'rgba(187,247,208,0.85)', border: '#16a34a', color: '#14532d' },
  structure: { bg: 'rgba(254,215,170,0.9)',  border: '#ea580c', color: '#7c2d12' },
}

const DEFAULT_READ_COLORS = { chord: '#555555', lyric: '#111111', structure: '#9a3412' }

function readStyle(colors) {
  const c = { ...DEFAULT_READ_COLORS, ...colors }
  return {
    chord:     { bg: 'transparent', border: 'transparent', color: c.chord },
    lyric:     { bg: 'transparent', border: 'transparent', color: c.lyric },
    structure: { bg: 'transparent', border: 'transparent', color: c.structure },
  }
}

// Group items by Y position into lines (tolerance = yTol pt)
function groupLines(items, yTol = 5) {
  const sorted = [...items].sort((a, b) => a.y - b.y)
  const lines = []
  for (const item of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(item.y - last.y) <= yTol) {
      last.items.push(item)
    } else {
      lines.push({ y: item.y, items: [item] })
    }
  }
  return lines
}

// Within a Y-line, split items into independent X-clusters when a gap > minGapPt
// exists between them. This separates left/right columns that share a Y coordinate.
function splitXClusters(items, minGapPt = 45) {
  const sorted = [...items].sort((a, b) => a.x0 - b.x0)
  const clusters = []
  let cur = []
  for (const item of sorted) {
    if (!cur.length) { cur.push(item); continue }
    const lastX1 = Math.max(...cur.map(i => i.x1))
    if (item.x0 - lastX1 > minGapPt) { clusters.push(cur); cur = [] }
    cur.push(item)
  }
  if (cur.length) clusters.push(cur)
  return clusters
}

// Within a line, merge adjacent same-type items into runs.
// Chords are never merged.
function groupRuns(lineItems, lineY, xTol = 22) {
  const sorted = [...lineItems].sort((a, b) => a.x0 - b.x0)
  const runs = []
  for (const item of sorted) {
    const last = runs[runs.length - 1]
    const gap = last ? item.x0 - last.x1 : Infinity
    const canMerge = last
      && last.type === item.type
      && item.type !== 'chord'
      && gap >= 0
      && gap < xTol
    if (canMerge) {
      last.items.push(item)
      last.x1 = Math.max(last.x1, item.x1)
    } else {
      runs.push({
        type: item.type,
        items: [item],
        x0: item.x0,
        x1: item.x1,
        y: lineY ?? item.y,
        font_pt: item.font_pt,
        is_heb: item.is_heb,
      })
    }
  }
  return runs
}

// Build display text for a run in correct visual reading order
function runText(run, semi, baseKey) {
  const ordered = run.is_heb
    ? [...run.items].sort((a, b) => b.x0 - a.x0)
    : [...run.items].sort((a, b) => a.x0 - b.x0)
  return ordered
    .map(i => (i.type === 'chord' ? transposeChord(i.text, semi, baseKey) : i.text))
    .join(' ')
}

// Renders a group of consecutive chord-box lines as one shared container.
// All rows share the same left anchor and auto-size together.
function ChordBoxSection({ lines, scale, semi, baseKey, readMode, colors }) {
  const allItems = lines.flatMap(l => l.items)
  const fontPt   = Math.max(...allItems.map(i => i.font_pt))
  const minX     = Math.min(...allItems.map(i => i.x0))
  const top      = lines[0].y * PT_TO_PX * scale
  const left     = minX       * PT_TO_PX * scale
  const fontSize = fontPt * PT_TO_PX * scale
  const lineH    = fontSize * 1.25
  const lastY    = lines[lines.length - 1].y
  const height   = (lastY - lines[0].y) * PT_TO_PX * scale + lineH

  const chordColor   = readMode ? (colors?.chord   ?? '#555555') : '#333'
  const barlineColor = readMode ? '#aaa' : '#777'

  return (
    <div style={{
      position:   'absolute',
      top,
      left,
      height,
      direction:  'ltr',
      fontSize,
      fontWeight: 'bold',
      fontFamily: 'Arial, sans-serif',
      whiteSpace: 'nowrap',
    }}>
      {lines.map((line, li) => {
        const rowTop = (line.y - lines[0].y) * PT_TO_PX * scale
        const sorted = [...line.items].sort((a, b) => a.x0 - b.x0)
        return (
          <div key={li} style={{
            position: 'absolute', top: rowTop,
            display: 'flex', alignItems: 'center', direction: 'ltr',
            height: lineH, lineHeight: lineH + 'px',
          }}>
            {sorted.map((item, i) => {
              if (isBarlineText(item.text)) {
                const nb       = normalizeBarline(item.text)
                const isRepeat = /^x\d+$/i.test(item.text)
                return (
                  <span key={i} style={{
                    color:      isRepeat ? '#9333ea' : barlineColor,
                    padding:    isRepeat ? '0 3px'   : '0 1px',
                    fontWeight: isRepeat ? 'bold'     : 400,
                    fontSize:   isRepeat ? '0.82em'  : undefined,
                  }}>
                    {nb}
                  </span>
                )
              }
              if (!/^[A-G]/.test(item.text)) return null
              const chord = transposeChord(item.text, semi, baseKey)
              return (
                <span key={i} style={{ color: chordColor, padding: '0 2px' }}>
                  {chord}
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// One container per chord line — original x-positions preserved via flex min-width.
// Renders both actual chords (A-G) and barlines (I, II, x2, |, ||, ...) so that
// chord-box lines embedded in mixed-column layouts (lyrics on one side, chords on
// the other) retain their barlines even when isChordBoxLine returns false.
function ChordLine({ chordItems, lineY, scale, semi, baseKey, readMode, colors }) {
  const ts          = readMode ? readStyle(colors).chord : TYPE_STYLE.chord
  const barlineColor = readMode ? '#aaa' : '#777'

  const real = [...chordItems]
    .filter(i => /^[A-G]/.test(i.text) || isBarlineText(i.text))
    .sort((a, b) => a.x0 - b.x0)
  if (!real.length) return null

  const chordOnly = real.filter(i => /^[A-G]/.test(i.text))
  if (!chordOnly.length) return null

  const fontPt  = Math.max(...chordOnly.map(i => i.font_pt))
  const fontSize = fontPt * PT_TO_PX * scale
  const lineH    = fontSize * 1.25
  const originX  = real[0].x0

  return (
    <div style={{
      position:   'absolute',
      top:        lineY * PT_TO_PX * scale,
      left:       originX * PT_TO_PX * scale,
      height:     lineH,
      lineHeight: lineH + 'px',
      direction:  'ltr',
      whiteSpace: 'nowrap',
      display:    'flex',
      alignItems: 'center',
    }}>
      {real.map((item, idx) => {
        const nextX    = real[idx + 1]?.x0
        const minWidth = nextX != null ? (nextX - item.x0) * PT_TO_PX * scale : undefined

        if (isBarlineText(item.text)) {
          const nb       = normalizeBarline(item.text)
          const isRepeat = /^x\d+$/i.test(item.text)
          return (
            <span key={idx} style={{
              minWidth,
              display:    'inline-block',
              fontSize:   isRepeat ? fontSize * 0.82 : fontSize,
              fontFamily: 'Arial, sans-serif',
              whiteSpace: 'nowrap',
              direction:  'ltr',
              color:      isRepeat ? '#9333ea' : barlineColor,
              padding:    isRepeat ? '0 3px'   : '0 1px',
              fontWeight: isRepeat ? 'bold'     : 400,
            }}>
              {nb}
            </span>
          )
        }

        return (
          <span key={idx} style={{
            minWidth,
            display:      'inline-block',
            fontSize,
            fontWeight:   'bold',
            fontFamily:   'Arial, sans-serif',
            whiteSpace:   'nowrap',
            direction:    'ltr',
            color:        ts.color,
            background:   ts.bg,
            borderBottom: readMode ? 'none' : `2px solid ${ts.border}`,
            padding:      '0 3px',
          }}>
            {transposeChord(item.text, semi, baseKey)}
          </span>
        )
      })}
    </div>
  )
}

function Run({ run, scale, contentW, semi, baseKey, readMode, underline, colors }) {
  const ts = readMode ? readStyle(colors)[run.type] : TYPE_STYLE[run.type]
  const text = runText(run, semi, baseKey)

  const base = {
    position: 'absolute',
    top:        run.y        * PT_TO_PX * scale,
    height:     run.font_pt * PT_TO_PX * scale * 1.25,
    lineHeight: (run.font_pt * PT_TO_PX * scale * 1.25) + 'px',
    fontSize:   run.font_pt * PT_TO_PX * scale,
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    background:   ts.bg,
    borderBottom: readMode ? 'none' : `2px solid ${ts.border}`,
    color:  ts.color,
    fontFamily: 'Arial, sans-serif',
    textDecoration: underline ? 'underline' : 'none',
    textUnderlineOffset: '3px',
  }

  if (run.is_heb) {
    return (
      <div style={{
        ...base,
        right:  (contentW - run.x1) * PT_TO_PX * scale,
        width:  (run.x1 - run.x0)   * PT_TO_PX * scale,
        padding: '0 2px',
        direction: 'rtl',
      }}>
        {text}
      </div>
    )
  }
  return (
    <div style={{
      ...base,
      left:  run.x0 * PT_TO_PX * scale,
      width: (run.x1 - run.x0) * PT_TO_PX * scale,
      padding: '0 3px',
      direction: 'ltr',
    }}>
      {text}
    </div>
  )
}

const TITLE_CHORD_RE  = /^[A-G][b#]?/
const TITLE_STRUCT_KW = new Set([
  'intro', 'verse', 'chorus', 'bridge', 'solo', 'interlude', 'outro',
  'coda', 'tag', 'refrain', 'intrld', 'intrlde', 'brdg', 'hook', 'break', 'chords',
  'פתיחה', 'בית', 'פזמון', 'גשר', 'מעבר', 'סיום',
])

function isTitleWord(item) {
  const t = item.text.trim().replace(/:$/, '')
  if (!t) return false
  if (TITLE_CHORD_RE.test(t)) return false
  if (TITLE_STRUCT_KW.has(t.toLowerCase())) return false
  return true
}

// Render the title line as one text block with a "—" between title and artist.
// Filters out chords and structure keywords (e.g. "Dm", "Intro:") before rendering.
// Uses song.title words to separate title items from artist items.
function TitleLine({ items, scale, contentW, songTitle }) {
  const sorted = [...items].sort((a, b) => a.x0 - b.x0)
  const fontPt = Math.max(...sorted.map(i => i.font_pt))
  const topY   = sorted[0].y
  const maxX1  = Math.max(...sorted.map(i => i.x1))

  // RTL text order: larger x0 = visually to the right = earlier in reading order
  const rtlText = (arr) => [...arr].sort((a, b) => b.x0 - a.x0).map(i => i.text).join(' ')

  // Keep only real words (no chords, no structure keywords)
  const wordItems  = sorted.filter(isTitleWord)
  const titleWords = new Set((songTitle || '').trim().split(/\s+/).filter(Boolean))
  const titleItems  = wordItems.filter(i => titleWords.has(i.text.trim()))
  const artistItems = wordItems.filter(i => !titleWords.has(i.text.trim()))

  let text
  if (artistItems.length > 0 && titleItems.length > 0) {
    text = rtlText(titleItems) + ' — ' + rtlText(artistItems)
  } else {
    text = rtlText(wordItems.length ? wordItems : sorted)
  }

  return (
    <div style={{
      position: 'absolute',
      top:        topY * PT_TO_PX * scale,
      right:      (contentW - maxX1) * PT_TO_PX * scale,
      fontSize:   fontPt * PT_TO_PX * scale,
      lineHeight: (fontPt * PT_TO_PX * scale * 1.25) + 'px',
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
      color: '#111',
      fontFamily: 'Arial, sans-serif',
      direction: 'rtl',
      textDecoration: 'underline',
      textUnderlineOffset: '3px',
    }}>
      {text}
    </div>
  )
}

export default function SongViewer({ song, semi = 0, readMode = true, zoom = 1, baseKey = null, colors }) {
  const containerRef = useRef(null)
  const [baseScale, setBaseScale] = useState(1)

  const pageW = song.page_size?.w ?? 540
  const allX1 = song.pages.flatMap(p => p.items.map(it => it.x1 ?? it.x0))
  const contentW = Math.max(pageW, allX1.length ? Math.max(...allX1) + 8 : pageW)
  const scale = baseScale * zoom

  const recalcScale = useCallback(() => {
    if (!containerRef.current) return
    const displayW = containerRef.current.clientWidth || 660
    setBaseScale(displayW / (contentW * PT_TO_PX))
  }, [contentW])

  useEffect(() => {
    recalcScale()
    const ro = new ResizeObserver(recalcScale)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [recalcScale])


  return (
    <div ref={containerRef} style={{ width: '100%', padding: '0 8px', overflowX: 'auto' }}>
      {song.pages.map((page, pi) => {
        const pageH = (page.height_pt ?? 780) * PT_TO_PX * scale + 20
        const lines = groupLines(page.items)

        // Flatten Y-lines into X-clusters: each cluster is an independent visual unit.
        // This separates left/right column items that share a Y coordinate.
        const clusters = []
        for (const line of lines) {
          for (const clusterItems of splitXClusters(line.items)) {
            clusters.push({ y: line.y, items: clusterItems })
          }
        }

        const elements = []
        let ci = 0
        while (ci < clusters.length) {
          const cluster = clusters[ci]
          const isTitleByData = cluster.items.some(i => i.is_underline)
          const effectiveTitleLine = pi === 0 && (isTitleByData || ci === 0)

          if (effectiveTitleLine) {
            elements.push(
              <TitleLine
                key={`${pi}-title`}
                items={cluster.items}
                scale={scale}
                contentW={contentW}
                songTitle={song.title}
              />
            )
            ci++
          } else if (isChordBoxLine(cluster.items)) {
            // Collect consecutive chord-box clusters into one section
            const group = [cluster]
            let gi = ci + 1
            while (gi < clusters.length && isChordBoxLine(clusters[gi].items)) {
              group.push(clusters[gi])
              gi++
            }
            elements.push(
              <ChordBoxSection
                key={`${pi}-${ci}-section`}
                lines={group}
                scale={scale}
                semi={semi}
                baseKey={baseKey}
                readMode={readMode}
                colors={colors}
              />
            )
            ci = gi
          } else {
            const chordItems = cluster.items.filter(i => i.type === 'chord')
            const otherItems = cluster.items.filter(i => i.type !== 'chord')

            if (chordItems.length > 0) {
              elements.push(
                <ChordLine
                  key={`${pi}-${ci}-chords`}
                  chordItems={chordItems}
                  lineY={cluster.y}
                  scale={scale}
                  semi={semi}
                  baseKey={baseKey}
                  readMode={readMode}
                  colors={colors}
                />
              )
            }
            groupRuns(otherItems, cluster.y).forEach((run, ri) => {
              elements.push(
                <Run
                  key={`${pi}-${ci}-${ri}`}
                  run={run}
                  scale={scale}
                  contentW={contentW}
                  semi={semi}
                  baseKey={baseKey}
                  readMode={readMode}
                  underline={false}
                  colors={colors}
                />
              )
            })
            ci++
          }
        }

        return (
          <div key={pi} style={{ marginBottom: 40 }}>
            {song.pages.length > 1 && (
              <p style={{ color: 'var(--blue)', fontSize: 12, fontWeight: 'bold', margin: '0 0 6px' }}>
                עמוד {page.page_num ?? pi + 1}
              </p>
            )}
            <div style={{
              position: 'relative',
              width:  contentW * PT_TO_PX * scale,
              height: pageH,
              background: 'white',
              borderRadius: 4,
              marginBottom: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,.4)',
              overflow: 'visible',
            }}>
              {page.rects?.map((rect, ri) => (
                <div key={`rect-${ri}`} style={{
                  position:     'absolute',
                  left:         rect.x0 * PT_TO_PX * scale,
                  top:          rect.y  * PT_TO_PX * scale,
                  width:        (rect.x1 - rect.x0) * PT_TO_PX * scale,
                  height:       (rect.y2 - rect.y)  * PT_TO_PX * scale,
                  border:       '1.5px solid #aaa',
                  borderRadius: 2,
                  pointerEvents: 'none',
                  boxSizing:    'border-box',
                }} />
              ))}
              {elements}
            </div>
          </div>
        )
      })}
    </div>
  )
}
