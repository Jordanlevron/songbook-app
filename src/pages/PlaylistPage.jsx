import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { getSong } from '../lib/songs'
import SongViewer from '../components/SongViewer'
import TransposeBar from '../components/TransposeBar'
import { detectKey } from '../lib/transpose'

export default function PlaylistPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [playlist, setPlaylist] = useState(null)
  const [songs, setSongs] = useState([])
  const [idx, setIdx] = useState(0)
  const [semi, setSemi] = useState(0)
  const [readMode, setReadMode] = useState(true)

  useEffect(() => {
    getDoc(doc(db, 'playlists', id)).then(snap => {
      if (!snap.exists()) return
      const pl = { id: snap.id, ...snap.data() }
      setPlaylist(pl)
      Promise.all(pl.songIds.map(sid => getSong(sid))).then(setSongs)
    })
  }, [id])

  const song = songs[idx]

  if (!playlist) return <div style={{ padding: 32, color: 'var(--subtext)' }}>טוען פלייליסט…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Playlist header */}
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <button onClick={() => navigate('/library')}
          style={{ color: 'var(--blue)', background: 'none', border: 'none', fontSize: 13 }}>
          ← ספרייה
        </button>
        <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{playlist.name}</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { setIdx(i => Math.max(0, i - 1)); setSemi(0) }}
          disabled={idx === 0}
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '4px 12px' }}
        >
          ← קודם
        </button>
        <span style={{ color: 'var(--subtext)', fontSize: 12 }}>{idx + 1} / {songs.length}</span>
        <button
          onClick={() => { setIdx(i => Math.min(songs.length - 1, i + 1)); setSemi(0) }}
          disabled={idx >= songs.length - 1}
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '4px 12px' }}
        >
          הבא →
        </button>
      </div>

      {song && (
        <>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ color: 'var(--accent)', margin: 0, fontSize: 18 }}>{song.title}</h2>
            {song.artist && <p style={{ color: 'var(--subtext)', fontSize: 12, margin: '2px 0 0' }}>{song.artist}</p>}
          </div>
          <TransposeBar
            baseKey={song.key?.manual ?? song.key?.detected ?? detectKey(
              song.pages.flatMap(p => p.items.filter(i => i.type === 'chord').map(i => i.text))
            )}
            semi={semi}
            onSemi={setSemi}
            readMode={readMode}
            onReadMode={setReadMode}
          />
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 8px' }}>
            <SongViewer song={song} semi={semi} readMode={readMode} />
          </div>
        </>
      )}

      {!song && songs.length === 0 && (
        <p style={{ padding: 32, color: 'var(--subtext)' }}>טוען שירים…</p>
      )}

      {/* Song list at bottom */}
      <div style={{ borderTop: '1px solid var(--border)', maxHeight: 120, overflow: 'auto' }}>
        {songs.map((s, i) => (
          <button key={s.id} onClick={() => { setIdx(i); setSemi(0) }}
            style={{
              display: 'block', width: '100%', textAlign: 'right',
              padding: '6px 16px', background: i === idx ? 'var(--surface2)' : 'transparent',
              border: 'none', color: i === idx ? 'var(--text)' : 'var(--subtext)',
              fontSize: 13, cursor: 'pointer',
            }}>
            {i + 1}. {s.title}
          </button>
        ))}
      </div>
    </div>
  )
}
