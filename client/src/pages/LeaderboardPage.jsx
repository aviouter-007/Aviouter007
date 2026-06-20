import { useEffect, useState } from 'react';
import { api } from '../api';

export default function LeaderboardPage() {
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState({ topWins: [], topMultipliers: [] });

  useEffect(() => {
    api.leaderboard(period).then(setData).catch(() => {});
  }, [period]);

  return (
    <div className="page">
      <h1>Leaderboards</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
        Compete with other pilots — virtual coins only
      </p>

      <div className="tabs">
        {['daily', 'weekly', 'all'].map((p) => (
          <button
            key={p}
            type="button"
            className={`tab ${period === p ? 'active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="card">
          <h3>Top winnings</h3>
          <ol className="lb-list">
            {data.topWins?.map((row, i) => (
              <li key={i}>
                <span className="lb-rank">#{i + 1}</span>
                <span>{row.username}</span>
                <span className="lb-score">+{row.score?.toLocaleString()} 🪙</span>
              </li>
            ))}
            {!data.topWins?.length && <p className="lb-empty">No data yet</p>}
          </ol>
        </div>

        <div className="card">
          <h3>Highest multipliers</h3>
          <ol className="lb-list">
            {data.topMultipliers?.map((row, i) => (
              <li key={i}>
                <span className="lb-rank">#{i + 1}</span>
                <span>{row.username}</span>
                <span className="lb-score">{row.score?.toFixed(2)}x</span>
              </li>
            ))}
            {!data.topMultipliers?.length && <p className="lb-empty">No data yet</p>}
          </ol>
        </div>
      </div>

      <style>{`
        .lb-list { list-style: none; }
        .lb-list li {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
        }
        .lb-rank { color: var(--gold); font-weight: 800; min-width: 36px; }
        .lb-score { margin-left: auto; color: var(--accent); font-weight: 700; }
        .lb-empty { color: var(--muted); padding: 16px 0; }
      `}</style>
    </div>
  );
}
