import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listSongs } from '../lib/songs'

export default function LibraryPage() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (q) => {
    setLoading(true)
    try {
      const results = await listSongs({ search: q })
      setSongs(results)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search), 300)
    return () => clearTimeout(t)
  }, [search, load])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <input
          type="search"
          placeholder="חיפוש לפי שם שיר או אמן…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text)', fontSize: 15,
            direction: 'rtl',
          }}
        />
      </div>

      {loading && <p style={{ color: 'var(--subtext)' }}>טוען…</p>}

      {!loading && songs.length === 0 && (
        <p style={{ color: 'var(--subtext)', textAlign: 'center', marginTop: 40 }}>
          {search ? 'לא נמצאו שירים' : 'הספרייה ריקה — העלה שיר כדי להתחיל'}
        </p>
      )}

      <ul style={{ listStyle: 'none' }}>
        {songs.map(song => (
          <li key={song.id}>
            <button
              onClick={() => navigate(`/song/${song.id}`)}
              style={{
                width: '100%', textAlign: 'right', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}
            >
              <span style={{ color: 'var(--text)', fontWeight: 'bold', fontSize: 15 }}>
                {song.title}
              </span>
              {song.artist && (
                <span style={{ color: 'var(--subtext)', fontSize: 12 }}>{song.artist}</span>
              )}
              {song.key?.detected && (
                <span style={{ color: 'var(--accent)', fontSize: 11 }}>
                  סולם: {song.key.manual ?? song.key.detected}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
