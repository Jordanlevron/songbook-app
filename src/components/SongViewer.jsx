import { useRef, useEffect, useState, useCallback } from 'react'
import { transposeChord } from '../lib/transpose'

const PT_TO_PX = 96 / 72

const TYPE_STYLE = {
  chord:     { bg: 'rgba(191,219,254,0.85)', border: '#2563eb', color: '#1e3a8a' },
  lyric:     { bg: 'rgba(187,247,208,0.85)', border: '#16a34a', color: '#14532d' },
  structure: { bg: 'rgba(254,215,170,0.9)',  border: '#ea580c', color: '#7c2d12' },
}

const READ_STYLE = {
  chord:     { bg: 'transparent', border: 'transparent', color: '#1a56db' },
  lyric:     { bg: 'transparent', border: 'transparent', color: '#111' },
  structure: { bg: 'transparent', border: 'transparent', color: '#9a3412' },
}

function Item({ item, scale, contentW, semi, readMode }) {
  const ts = readMode ? READ_STYLE[item.type] : TYPE_STYLE[item.type]
  const text = item.type === 'chord' ? transposeChord(item.text, semi) : item.text

  const base = {
    position: 'absolute',
    top:        item.y         * PT_TO_PX * scale,
    height:     item.font_pt  * PT_TO_PX * scale * 1.25,
    lineHeight: (item.font_pt * PT_TO_PX * scale * 1.25) + 'px',
    fontSize:   item.font_pt  * PT_TO_PX * scale,
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    background:   ts.bg,
    borderBottom: readMode ? 'none' : `2px solid ${ts.border}`,
    color:  ts.color,
    fontFamily: 'Arial, sans-serif',
  }

  if (item.is_heb) {
    return (
      <div style={{
        ...base,
        right:  (contentW - item.x1) * PT_TO_PX * scale,
        width:  (item.x1 - item.x0)  * PT_TO_PX * scale,
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
      left:    item.x0 * PT_TO_PX * scale,
      padding: '0 3px',
      direction: 'ltr',
    }}>
      {text}
    </div>
  )
}

export default function SongViewer({ song, semi = 0, readMode = true }) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)

  // Per spec: CONTENT_W = max(page_w, max(all x1 values) + 8)
  const pageW = song.page_size?.w ?? 540
  const allX1 = song.pages.flatMap(p => p.items.map(it => it.x1 ?? it.x0))
  const contentW = Math.max(pageW, allX1.length ? Math.max(...allX1) + 8 : pageW)

  const recalcScale = useCallback(() => {
    if (!containerRef.current) return
    const displayW = containerRef.current.clientWidth || 660
    setScale(displayW / (contentW * PT_TO_PX))
  }, [contentW])

  useEffect(() => {
    recalcScale()
    const ro = new ResizeObserver(recalcScale)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [recalcScale])

  return (
    <div ref={containerRef} style={{ width: '100%', padding: '0 8px' }}>
      {song.pages.map((page, pi) => {
        const pageH = (page.height_pt ?? 780) * PT_TO_PX * scale + 20
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
              overflow: 'hidden',
            }}>
              {page.items.map((item, ii) => (
                <Item key={ii} item={item} scale={scale} contentW={contentW} semi={semi} readMode={readMode} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
