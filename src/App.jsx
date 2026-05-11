import { Routes, Route, Navigate } from 'react-router-dom'
import LibraryPage from './pages/LibraryPage'
import SongPage from './pages/SongPage'
import PlaylistPage from './pages/PlaylistPage'
import NavBar from './components/NavBar'

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <NavBar />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/song/:id" element={<SongPage />} />
          <Route path="/playlist/:id" element={<PlaylistPage />} />
        </Routes>
      </main>
    </div>
  )
}
