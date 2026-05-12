import { useRef, useEffect, useState, useCallback } from 'react'
import { transposeChord } from '../lib/transpose'

const BARLINE_RE = /^(I{1,3}:?|:I{1,3}|:\||\|:?:?|\||x\d+)$/i

function isBarlineText(t) {
  return BARLINE_RE.test(t.trim())
}

function normalizeBarline(t) {
  const s = t.trim()
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

const READ_STYLE = {
  chord:     { bg: 'transparent', border: 'transparent', color: '#555' },
  lyric:     { bg: 'transparent', border: 'transparent', color: '#111' },
  structure: { bg: 'transparent', border: 'transparent', color: '#9a3412' },
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
function ChordBoxSection({ lines, scale, semi, baseKey, readMode }) {
  const allItems = lines.flatMap(l => l.items)
  const fontPt   = Math.max(...allItems.map(i => i.font_pt))
  const minX     = Math.min(...allItems.map(i => i.x0))
  const top      = lines[0].y * PT_TO_PX * scale
  const left     = minX       * PT_TO_PX * scale
  const fontSize = fontPt * PT_TO_PX * scale
  const lineH    = fontSize * 1.25
  const lastY    = lines[lines.length - 1].y
  const height   = (lastY - lines[0].y) * PT_TO_PX * scale + lineH

  const chordColor   = readMode ? '#555' : '#333'
  const barlineColor = readMode ? '#999' : '#777'

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
                return (
                  <span key={i} style={{ color: barlineColor, padding: '0 1px', fontWeight: 400 }}>
                    {normalizeBarline(item.text)}
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

// One container per chord line — one selectable unit, original x-positions preserved.
// Flex layout with min-width = gap to next chord: preserves positions when text fits,
// shifts subsequent chords right when transposed text is wider (they respond to each other).
// Stray tokens (bare '#', ',') are filtered. direction:ltr set explicitly.
function ChordLine({ chordItems, lineY, scale, semi, baseKey, readMode }) {
  const ts   = readMode ? READ_STYLE.chord : TYPE_STYLE.chord
  const real = [...chordItems]
    .filter(i => /^[A-G]/.test(i.text))
    .sort((a, b) => a.x0 - b.x0)
  if (!real.length) return null

  const fontPt  = Math.max(...real.map(i => i.font_pt))
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

function Run({ run, scale, contentW, semi, baseKey, readMode, underline }) {
  const ts = readMode ? READ_STYLE[run.type] : TYPE_STYLE[run.type]
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

// Render the title line as one text block with a "—" between title and artist.
// Uses song.title words to separate title items from artist items.
function TitleLine({ items, scale, contentW, songTitle }) {
  const sorted = [...items].sort((a, b) => a.x0 - b.x0)
  const fontPt = Math.max(...sorted.map(i => i.font_pt))
  const topY   = sorted[0].y
  const maxX1  = Math.max(...sorted.map(i => i.x1))

  // RTL text order: larger x0 = visually to the right = earlier in reading order
  const rtlText = (arr) => [...arr].sort((a, b) => b.x0 - a.x0).map(i => i.text).join(' ')

  // Identify which items belong to the title vs artist using song.title words
  const titleWords = new Set((songTitle || '').trim().split(/\s+/).filter(Boolean))
  const titleItems  = sorted.filter(i => titleWords.has(i.text.trim()))
  const artistItems = sorted.filter(i => !titleWords.has(i.text.trim()))

  let text
  if (artistItems.length > 0 && titleItems.length > 0) {
    text = rtlText(titleItems) + ' — ' + rtlText(artistItems)
  } else {
    text = rtlText(sorted)
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

export default function SongViewer({ song, semi = 0, readMode = true, zoom = 1, baseKey = null }) {
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

        const elements = []
        let li = 0
        while (li < lines.length) {
          const line = lines[li]
          const isTitleByData = line.items.some(i => i.is_underline)
          const effectiveTitleLine = pi === 0 && (isTitleByData || li === 0)

          if (effectiveTitleLine) {
            elements.push(
              <TitleLine
                key={`${pi}-title`}
                items={line.items}
                scale={scale}
                contentW={contentW}
                songTitle={song.title}
              />
            )
            li++
          } else if (isChordBoxLine(line.items)) {
            // Collect all consecutive chord-box lines into one section
            const group = [line]
            let gi = li + 1
            while (gi < lines.length && isChordBoxLine(lines[gi].items)) {
              group.push(lines[gi])
              gi++
            }
            elements.push(
              <ChordBoxSection
                key={`${pi}-${li}-section`}
                lines={group}
                scale={scale}
                semi={semi}
                baseKey={baseKey}
                readMode={readMode}
              />
            )
            li = gi
          } else {
            const chordItems = line.items.filter(i => i.type === 'chord')
            const otherItems = line.items.filter(i => i.type !== 'chord')

            if (chordItems.length > 0) {
              elements.push(
                <ChordLine
                  key={`${pi}-${li}-chords`}
                  chordItems={chordItems}
                  lineY={line.y}
                  scale={scale}
                  semi={semi}
                  baseKey={baseKey}
                  readMode={readMode}
                />
              )
            }
            groupRuns(otherItems, line.y).forEach((run, ri) => {
              elements.push(
                <Run
                  key={`${pi}-${li}-${ri}`}
                  run={run}
                  scale={scale}
                  contentW={contentW}
                  semi={semi}
                  baseKey={baseKey}
                  readMode={readMode}
                  underline={false}
                />
              )
            })
            li++
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
              {elements}
            </div>
          </div>
        )
      })}
    </div>
  )
}
