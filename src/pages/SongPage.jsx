import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSong } from '../lib/songs'
import SongViewer from '../components/SongViewer'
import TransposeBar from '../components/TransposeBar'
import { detectKey } from '../lib/transpose'

export default function SongPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [song, setSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [semi, setSemi] = useState(0)
  const [readMode, setReadMode] = useState(true)

  useEffect(() => {
    setLoading(true)
    getSong(id)
      .then(setSong)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--subtext)' }}>טוען שיר…</div>
  }
  if (!song) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: 'var(--red)' }}>שיר לא נמצא</p>
        <button onClick={() => navigate('/library')} style={{ marginTop: 12, color: 'var(--blue)' }}>
          ← חזרה לספרייה
        </button>
      </div>
    )
  }

  const chords = song.pages.flatMap(p => p.items.filter(i => i.type === 'chord').map(i => i.text))
  const baseKey = song.key?.manual ?? song.key?.detected ?? detectKey(chords)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => navigate('/library')}
          style={{ color: 'var(--blue)', background: 'none', border: 'none', marginBottom: 4, fontSize: 13 }}
        >
          ← ספרייה
        </button>
        <h1 style={{ color: 'var(--accent)', fontSize: 20, margin: 0 }}>{song.title}</h1>
        {song.artist && <p style={{ color: 'var(--subtext)', fontSize: 13, margin: '2px 0 0' }}>{song.artist}</p>}
      </div>

      <TransposeBar
        baseKey={baseKey}
        semi={semi}
        onSemi={setSemi}
        readMode={readMode}
        onReadMode={setReadMode}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 8px' }}>
        <SongViewer song={song} semi={semi} readMode={readMode} />
      </div>
    </div>
  )
}
