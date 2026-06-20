import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import ServerSettings from '../components/ServerSettings';
import CopyField from '../components/CopyField';

export default function ProfilePage() {
  const { user, token, refreshUser } = useAuth();
  const [avatars, setAvatars] = useState({ avatars: [], skins: [] });
  const [username, setUsername] = useState(user?.username || '');
  const [message, setMessage] = useState('');
  const [referral, setReferral] = useState(null);

  useEffect(() => {
    api.avatars().then(setAvatars).catch(() => {});
    if (token) api.referral(token).then(setReferral).catch(() => {});
  }, [token]);

  useEffect(() => {
    setUsername(user?.username || '');
  }, [user]);

  const saveProfile = async (patch) => {
    try {
      await api.updateProfile(token, patch);
      await refreshUser();
      setMessage('Profile updated');
    } catch (e) {
      setMessage(e.message);
    }
  };

  return (
    <div className="page">
      <h1>Profile & Avatar</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Customize your pilot and manage virtual coin requests
      </p>

      <ServerSettings />

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Account</h3>
        <p>Email: {user?.email}</p>
        <p>
          Balance: <span className="coin-badge">🪙 {user?.balance?.toLocaleString()}</span>
          {' '}
          <Link to="/wallet" style={{ fontSize: '0.9rem' }}>Deposit / Withdraw →</Link>
        </p>
        <p>Best multiplier: {user?.bestMultiplier?.toFixed(2) || '1.00'}x</p>
        <p>Total profit: {user?.totalWon?.toLocaleString() ?? 0} coins</p>

        <div style={{ marginTop: 16 }}>
          <label className="label">Username</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
            <button type="button" className="btn btn-primary" onClick={() => saveProfile({ username })}>
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="card referral-card" style={{ marginBottom: 20 }}>
        <h3>Referral program</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 12 }}>
          Share your code. Only about{' '}
          <strong>{referral?.winChancePercent ?? 10}%</strong> of your team&apos;s wins count — then
          you earn <strong>{referral?.commissionPercent ?? 2}%</strong> of that win&apos;s profit
          (not every win).
        </p>
        <CopyField label="Your unique referral code" value={referral?.myCode || user?.referralCode} />
        <p style={{ marginTop: 12 }}>
          Referral earnings:{' '}
          <span className="coin-badge">
            🪙 {(referral?.referralEarnings ?? user?.referralEarnings ?? 0).toLocaleString()}
          </span>
        </p>
        {referral?.referredBy && (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            You joined via: <strong>{referral.referredBy.code}</strong> (
            {referral.referredBy.username})
          </p>
        )}
        {referral?.team?.length > 0 && (
          <div className="referral-team">
            <h4>Your team ({referral.teamCount})</h4>
            <ul>
              {referral.team.map((m, i) => (
                <li key={i}>
                  <span>{m.username}</span>
                  <span>{m.total_won ?? 0} won</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Plane / Avatar</h3>
        <div className="avatar-grid">
          {avatars.avatars?.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`avatar-option ${user?.avatarId === a.id ? 'selected' : ''}`}
              style={{ '--av-color': a.color }}
              onClick={() => saveProfile({ avatarId: a.id })}
            >
              <span className="avatar-dot" />
              {a.name}
            </button>
          ))}
        </div>
        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Plane skin</h4>
        <div className="skin-row">
          {avatars.skins?.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`btn btn-ghost ${user?.planeSkin === s.id ? 'active-skin' : ''}`}
              onClick={() => saveProfile({ planeSkin: s.id })}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {message && <p style={{ marginTop: 16, color: 'var(--accent)' }}>{message}</p>}

      <style>{`
        .avatar-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
        }
        .avatar-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: var(--surface2);
          border: 2px solid var(--border);
          border-radius: 12px;
          color: var(--text);
          cursor: pointer;
          font-weight: 600;
        }
        .avatar-option.selected {
          border-color: var(--accent);
        }
        .avatar-dot {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--av-color);
        }
        .skin-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .active-skin { border-color: var(--accent) !important; color: var(--accent) !important; }
        .referral-card { border-color: rgba(251, 191, 36, 0.3); }
        .referral-team { margin-top: 16px; }
        .referral-team h4 { font-size: 0.95rem; margin-bottom: 8px; color: var(--muted); }
        .referral-team ul { list-style: none; max-height: 160px; overflow-y: auto; }
        .referral-team li {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
