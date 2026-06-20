import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function HistoryPage() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    api.transactions(token).then((d) => setTransactions(d.transactions || [])).catch(() => {});
  }, [token]);

  const typeLabel = (t) => {
    const map = {
      bet: 'Bet placed',
      win: 'Win',
      loss: 'Loss',
      daily_reward: 'Daily reward',
      admin_adjustment: 'Admin adjustment',
      admin_deposit: 'Approved deposit',
      admin_withdraw: 'Approved withdrawal',
      referral_commission: 'Referral bonus',
    };
    return map[t] || t;
  };

  return (
    <div className="page">
      <h1>Transaction History</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
        All virtual coin activity on your account
      </p>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.created_at).toLocaleString()}</td>
                <td>{typeLabel(t.type)}</td>
                <td style={{ color: t.amount >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                  {t.amount >= 0 ? '+' : ''}
                  {t.amount}
                </td>
                <td>{t.status}</td>
                <td>{t.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!transactions.length && (
          <p style={{ padding: 20, color: 'var(--muted)' }}>No transactions yet. Play a round!</p>
        )}
      </div>
    </div>
  );
}
