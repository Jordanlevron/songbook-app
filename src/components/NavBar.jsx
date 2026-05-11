import { NavLink } from 'react-router-dom'

const s = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 16,
    background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    padding: '0 16px', height: 48, flexShrink: 0,
  },
  brand: { color: 'var(--accent)', fontWeight: 'bold', fontSize: 16 },
  link: { color: 'var(--subtext)', fontSize: 14, padding: '4px 8px', borderRadius: 6 },
  active: { color: 'var(--text)', background: 'var(--surface2)' },
}

export default function NavBar() {
  return (
    <nav style={s.bar}>
      <span style={s.brand}>🎸 Songbook</span>
      <NavLink to="/library" style={({ isActive }) => ({ ...s.link, ...(isActive ? s.active : {}) })}>
        ספרייה
      </NavLink>
    </nav>
  )
}
