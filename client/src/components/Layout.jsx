import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GlobalSupportChat from './GlobalSupportChat';

export default function Layout({ admin }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <nav className="nav">
        <NavLink to={admin ? '/admin' : '/'} className="nav-brand">
          Aviouter
        </NavLink>
        <div className="nav-links">
          {!admin && (
            <>
              <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                Game
              </NavLink>
              <NavLink to="/leaderboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Leaderboard
              </NavLink>
              <NavLink to="/wallet" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Wallet
              </NavLink>
              <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                History
              </NavLink>
              <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Profile
              </NavLink>
            </>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Admin
            </NavLink>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!admin && (
            <span className="coin-badge">🪙 {user?.balance?.toLocaleString() ?? 0}</span>
          )}
          <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{user?.username}</span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout} style={{ padding: '8px 14px' }}>
            Logout
          </button>
        </div>
      </nav>
      <Outlet />
      <GlobalSupportChat />
    </div>
  );
}
