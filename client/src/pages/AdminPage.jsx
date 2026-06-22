import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import CopyField from '../components/CopyField';
import SupportChat from '../components/SupportChat';

function copyText(value, onDone) {
  if (!value) return;
  navigator.clipboard.writeText(value).then(onDone).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    onDone();
  });
}

export default function AdminPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState({});
  const [supportThreads, setSupportThreads] = useState([]);
  const [selectedSupportUser, setSelectedSupportUser] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [adjustUser, setAdjustUser] = useState('');
  const [adjustAmount, setAdjustAmount] = useState(1000);
  const [message, setMessage] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [copiedId, setCopiedId] = useState('');
  const socketRef = useRef(null);

  const load = async () => {
    const [s, u, r, t, set] = await Promise.all([
      api.adminStats(token),
      api.adminUsers(token),
      api.adminRequests(token),
      api.adminTransactions(token),
      api.adminSettings(token),
    ]);
    setStats(s);
    setUsers(u.users);
    setRequests(r.requests);
    setTransactions(t.transactions);
    setSettings(set.settings);
  };

  const loadSupportThreads = useCallback(async () => {
    const { threads } = await api.adminSupportThreads(token);
    setSupportThreads(threads || []);
  }, [token]);

  const loadSupportMessages = useCallback(
    async (userId) => {
      if (!userId) return;
      const data = await api.adminSupportMessages(token, userId);
      setSupportMessages(data.messages || []);
      setSelectedSupportUser(data.user);
    },
    [token]
  );

  useEffect(() => {
    load().catch(console.error);
  }, [token]);

  useEffect(() => {
    if (tab === 'support') {
      loadSupportThreads().catch(console.error);
    }
  }, [tab, loadSupportThreads]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      load().catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token || tab !== 'support') return;
    const interval = setInterval(() => {
      loadSupportThreads().catch(() => {});
      if (selectedSupportUser?.id) {
        loadSupportMessages(selectedSupportUser.id).catch(() => {});
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [token, tab, selectedSupportUser?.id, loadSupportThreads, loadSupportMessages]);

  const sendAdminSupport = async (text) => {
    if (!selectedSupportUser?.id) {
      return { error: 'Select a user thread first' };
    }
    try {
      const result = await api.adminSendSupportMessage(token, selectedSupportUser.id, text);
      await loadSupportMessages(selectedSupportUser.id);
      return result;
    } catch (e) {
      return { error: e.message };
    }
  };

  const handleBalance = async (userId) => {
    try {
      await api.adminBalance(token, userId, {
        amount: parseInt(adjustAmount, 10),
        note: 'Admin adjustment',
      });
      setMessage('Balance updated');
      load();
    } catch (e) {
      setMessage(e.message);
    }
  };

  const handleRequest = async (id, status) => {
    try {
      const adminReply = replyDrafts[id]?.trim();
      await api.adminPatchRequest(token, id, { status, adminReply: adminReply || undefined });
      setReplyDrafts((d) => ({ ...d, [id]: '' }));
      setMessage(status === 'approved' ? 'Request approved' : 'Request rejected');
      load();
    } catch (e) {
      setMessage(e.message);
    }
  };

  const handleReply = async (id) => {
    const text = replyDrafts[id]?.trim();
    if (!text) {
      setMessage('Write a reply message first');
      return;
    }
    try {
      await api.adminReplyRequest(token, id, text);
      setReplyDrafts((d) => ({ ...d, [id]: '' }));
      setMessage('Reply sent to user');
      load();
    } catch (e) {
      setMessage(e.message);
    }
  };

  const handleBlock = async (id, isBlocked) => {
    await api.adminPatchUser(token, id, { isBlocked });
    load();
  };

  const saveSettings = async () => {
    try {
      await api.adminPatchSettings(token, settings);
      setMessage('Settings saved');
    } catch (e) {
      setMessage(e.message);
    }
  };

  const handleCopyAccount = (id, accountNumber) => {
    copyText(accountNumber, () => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 2000);
    });
  };

  const pendingWithdrawals = stats.pendingWithdrawals || [];
  const withdrawBadge = stats.pendingWithdraw || 0;
  const depositBadge = stats.pendingDeposit || 0;
  const totalPendingBadge = withdrawBadge + depositBadge;

  const tabs = [
    ['overview', 'Overview'],
    ['users', 'Users'],
    ['requests', `Coin requests${totalPendingBadge ? ` (${totalPendingBadge})` : ''}`],
    ['support', 'Support chat'],
    ['transactions', 'Transactions'],
    ['settings', 'Game settings'],
  ];

  const renderRequestCard = (r) => (
    <div
      key={r.id}
      className={`card admin-request-card ${r.type === 'withdraw' && r.status === 'pending' ? 'admin-request-withdraw' : ''}`}
    >
      <div className="admin-request-header">
        <div>
          <strong>{r.username}</strong>
          <span className="admin-req-meta">{r.email}</span>
        </div>
        <span className={`wallet-status ${r.status}`}>{r.status}</span>
      </div>
      <div className="admin-request-body">
        <span className={r.type === 'withdraw' ? 'admin-withdraw-type' : ''}>
          {r.type} — <strong>{r.amount} 🪙</strong>
        </span>
        <div className="admin-request-details">
          {r.type === 'deposit' ? (
            <>
              <div>Name: {r.depositor_name || '—'}</div>
              <div>From: {r.sender_number || '—'}</div>
              <div>TID: {r.transaction_id || '—'}</div>
            </>
          ) : (
            <>
              <div>Account type: {r.account_type || '—'}</div>
              <div>Account holder: {r.account_name || '—'}</div>
              <div className="admin-account-row">
                <span>Account number: <strong>{r.account_number || '—'}</strong></span>
                {r.account_number && (
                  <button
                    type="button"
                    className="btn btn-ghost copy-btn-inline"
                    onClick={() => handleCopyAccount(r.id, r.account_number)}
                  >
                    {copiedId === r.id ? 'Copied!' : 'Copy number'}
                  </button>
                )}
              </div>
              {r.status === 'pending' && r.type === 'withdraw' && (
                <p className="admin-withdraw-hint">
                  Copy account → send payment → then Approve or Reject
                </p>
              )}
            </>
          )}
        </div>
        {r.admin_reply && (
          <div className="admin-prev-reply">
            <strong>Your last reply:</strong> {r.admin_reply}
            {r.admin_replied_at && (
              <small> ({new Date(r.admin_replied_at).toLocaleString()})</small>
            )}
          </div>
        )}
      </div>
      <div className="admin-reply-box">
        <label className="label">Reply to user</label>
        <textarea
          className="input admin-reply-input"
          rows={2}
          placeholder="e.g. Withdraw sent to your account."
          value={replyDrafts[r.id] ?? ''}
          onChange={(e) => setReplyDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
        />
        <div className="admin-reply-actions">
          <button type="button" className="btn btn-ghost" onClick={() => handleReply(r.id)}>
            Send reply
          </button>
          {r.status === 'pending' && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleRequest(r.id, 'approved')}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleRequest(r.id, 'rejected')}
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="page admin-page">
      <h1>Admin Dashboard</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
        Users, withdraw payments, private support chat, and game settings
      </p>

      <div className="tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <p style={{ color: 'var(--accent)', marginBottom: 12 }}>{message}</p>}

      {tab === 'overview' && (
        <>
          <div className="admin-stats">
            <div className="card stat-card">
              <span>Total users</span>
              <strong>{stats.users}</strong>
            </div>
            <div className={`card stat-card ${(stats.pendingDeposit ?? 0) > 0 ? 'stat-card-urgent' : ''}`}
              style={{ cursor: 'pointer' }} onClick={() => setTab('requests')}>
              <span>⏳ Pending deposits</span>
              <strong style={{ fontSize: '1.8rem' }}>{stats.pendingDeposit ?? 0}</strong>
            </div>
            <div className={`card stat-card ${(stats.pendingWithdraw ?? 0) > 0 ? 'stat-card-warn' : ''}`}
              style={{ cursor: 'pointer' }} onClick={() => setTab('requests')}>
              <span>💸 Pending withdrawals</span>
              <strong style={{ fontSize: '1.8rem' }}>{stats.pendingWithdraw ?? 0}</strong>
            </div>
            <div className="card stat-card">
              <span>Total bets</span>
              <strong>{stats.totalBets}</strong>
            </div>
          </div>

          {/* Quick action: All pending requests right on overview */}
          {requests.filter(r => r.status === 'pending').length > 0 && (
            <section className="admin-withdraw-section">
              <h2>🔔 Pending Requests — Action Required</h2>
              <p style={{ color: 'var(--muted)', marginBottom: 16, fontSize: '0.9rem' }}>
                Deposits: verify TID then Approve. &nbsp;|&nbsp; Withdrawals: pay user first then Approve.
              </p>
              <div className="admin-withdraw-grid">
                {requests.filter(r => r.status === 'pending').map((r) => (
                  <div key={r.id} className={`card admin-withdraw-card ${r.type === 'deposit' ? 'admin-deposit-card' : 'admin-request-withdraw'}`}>
                    <div className="admin-withdraw-card-top">
                      <div>
                        <span className={`req-type-badge ${r.type}`}>{r.type === 'deposit' ? '📥 Deposit' : '📤 Withdraw'}</span>
                        <strong style={{ display: 'block', marginTop: 4 }}>{r.username}</strong>
                        <span className="admin-req-meta">{r.email}</span>
                      </div>
                      <span className="admin-withdraw-amount">{r.amount} 🪙</span>
                    </div>

                    {r.type === 'deposit' ? (
                      <div className="admin-request-details" style={{ marginTop: 8 }}>
                        <div>👤 Name: <strong>{r.depositor_name || '—'}</strong></div>
                        <div>📱 From: <strong>{r.sender_number || '—'}</strong></div>
                        <div>🆔 TID: <strong>{r.transaction_id || '—'}</strong></div>
                      </div>
                    ) : (
                      <div className="admin-request-details" style={{ marginTop: 8 }}>
                        <div>💳 Type: <strong>{r.account_type || '—'}</strong></div>
                        <div>👤 Holder: <strong>{r.account_name || '—'}</strong></div>
                        <CopyField label="Account number" value={r.account_number} />
                      </div>
                    )}

                    <div className="admin-withdraw-card-actions" style={{ marginTop: 12, gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                        onClick={() => handleRequest(r.id, 'approved')}
                      >
                        ✅ Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ flex: 1 }}
                        onClick={() => handleRequest(r.id, 'rejected')}
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {requests.filter(r => r.status === 'pending').length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
              ✅ No pending requests right now.
            </div>
          )}
        </>
      )}

      {tab === 'users' && (
        <div className="card table-wrap">
          <div className="admin-adjust-bar">
            <select className="input" value={adjustUser} onChange={(e) => setAdjustUser(e.target.value)}>
              <option value="">Select user to adjust balance</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.balance} coins)
                </option>
              ))}
            </select>
            <input
              type="number"
              className="input"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="Amount (+ or -)"
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!adjustUser}
              onClick={() => handleBalance(adjustUser)}
            >
              Apply
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Referral code</th>
                <th>Balance</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{u.referral_code || '—'}</td>
                  <td>{u.balance?.toLocaleString()}</td>
                  <td>{u.role}</td>
                  <td>{u.is_blocked ? 'Blocked' : 'Active'}</td>
                  <td>
                    {u.role !== 'admin' && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                        onClick={() => handleBlock(u.id, !u.is_blocked)}
                      >
                        {u.is_blocked ? 'Unblock' : 'Block'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'requests' && (
        <div className="admin-requests-list">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>All Requests</h2>
            <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              Pending: Deposits ({requests.filter(r => r.status === 'pending' && r.type === 'deposit').length}) &nbsp;|&nbsp;
              Withdrawals ({requests.filter(r => r.status === 'pending' && r.type === 'withdraw').length})
            </span>
          </div>
          {requests.map(renderRequestCard)}
          {!requests.length && <p className="wallet-empty">No requests yet.</p>}
        </div>
      )}

      {tab === 'support' && (
        <div className="admin-support-layout">
          <div className="card admin-support-threads">
            <h3>User threads</h3>
            <p className="chat-support-hint">Private chat — each user talks only with you</p>
            {supportThreads.length === 0 && (
              <p className="wallet-empty">No messages yet. Users chat from the game page.</p>
            )}
            <ul className="admin-thread-list">
              {supportThreads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`admin-thread-btn ${selectedSupportUser?.id === t.id ? 'active' : ''}`}
                    onClick={() => loadSupportMessages(t.id)}
                  >
                    <strong>{t.username}</strong>
                    <small>{t.last_message?.slice(0, 60) || '—'}</small>
                  </button>
                </li>
              ))}
            </ul>
            {users
              .filter((u) => u.role === 'user')
              .slice(0, 30)
              .map((u) =>
                supportThreads.some((t) => t.id === u.id) ? null : (
                  <button
                    key={u.id}
                    type="button"
                    className="btn btn-ghost admin-start-thread"
                    onClick={() => loadSupportMessages(u.id)}
                  >
                    Message {u.username}
                  </button>
                )
              )}
          </div>
          <div className="admin-support-chat-wrap">
            {selectedSupportUser ? (
              <>
                <p style={{ marginBottom: 8 }}>
                  Chat with <strong>{selectedSupportUser.username}</strong> ({selectedSupportUser.email})
                </p>
                <SupportChat
                  title="Private support"
                  messages={supportMessages}
                  onSend={sendAdminSupport}
                  disabled={false}
                  viewerRole="admin"
                />
              </>
            ) : (
              <div className="card admin-support-placeholder">
                Select a user thread or start a new conversation
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.created_at).toLocaleString()}</td>
                  <td>{t.username || '—'}</td>
                  <td>{t.type}</td>
                  <td>{t.amount}</td>
                  <td>{t.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'settings' && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Deposit account (shown to users — copyable)</h3>
          <div className="settings-grid" style={{ marginBottom: 24 }}>
            <div>
              <label className="label">deposit_account_type</label>
              <input
                className="input"
                value={settings.deposit_account_type || ''}
                placeholder="e.g. JazzCash, Bank"
                onChange={(e) =>
                  setSettings((s) => ({ ...s, deposit_account_type: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">deposit_account_name</label>
              <input
                className="input"
                value={settings.deposit_account_name || ''}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, deposit_account_name: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">deposit_account_number</label>
              <input
                className="input"
                value={settings.deposit_account_number || ''}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, deposit_account_number: e.target.value }))
                }
              />
            </div>
          </div>
          <h3 style={{ marginBottom: 12 }}>Game settings</h3>
          <div className="settings-grid">
            {Object.entries(settings)
              .filter(([key]) => !key.startsWith('deposit_account'))
              .map(([key, value]) => (
                <div key={key}>
                  <label className="label">{key.replace(/_/g, ' ')}</label>
                  <input
                    className="input"
                    value={value}
                    onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                  />
                </div>
              ))}
          </div>
          <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={saveSettings}>
            Save settings
          </button>
        </div>
      )}

      <style>{`
        .admin-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .stat-card span { color: var(--muted); font-size: 0.9rem; }
        .stat-card strong { font-size: 2rem; color: var(--gold); }
        .stat-card-warn {
          border-color: rgba(251, 191, 36, 0.45);
        }
        .stat-card-warn strong { color: #fbbf24; }
        .stat-card-urgent {
          border-color: rgba(34, 197, 94, 0.55);
          background: rgba(34, 197, 94, 0.07);
          animation: pulse-border 1.8s ease-in-out infinite;
        }
        .stat-card-urgent strong { color: var(--accent); }
        @keyframes pulse-border {
          0%, 100% { border-color: rgba(34, 197, 94, 0.55); }
          50% { border-color: rgba(34, 197, 94, 0.9); }
        }
        .admin-deposit-card {
          border-color: rgba(34, 197, 94, 0.4);
          background: rgba(34, 197, 94, 0.05);
        }
        .req-type-badge {
          display: inline-block;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
          letter-spacing: 0.04em;
        }
        .req-type-badge.deposit {
          background: rgba(34, 197, 94, 0.18);
          color: var(--accent);
        }
        .req-type-badge.withdraw {
          background: rgba(251, 191, 36, 0.18);
          color: #fbbf24;
        }
        .admin-withdraw-card-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .admin-withdraw-section h2 {
          font-size: 1.15rem;
          margin-bottom: 8px;
        }
        .admin-withdraw-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .admin-withdraw-card {
          padding: 16px;
          border-color: rgba(251, 191, 36, 0.35);
        }
        .admin-withdraw-card-top {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .admin-withdraw-amount {
          color: var(--gold);
          font-weight: 700;
          font-size: 1.1rem;
        }
        .admin-adjust-bar {
          display: grid;
          grid-template-columns: 2fr 1fr auto;
          gap: 12px;
          margin-bottom: 20px;
        }
        @media (max-width: 700px) {
          .admin-adjust-bar { grid-template-columns: 1fr; }
        }
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        .admin-request-details {
          font-size: 0.82rem;
          line-height: 1.55;
          min-width: 200px;
        }
        .admin-requests-list { display: flex; flex-direction: column; gap: 16px; }
        .admin-request-card { padding: 16px; }
        .admin-request-withdraw {
          border-color: rgba(251, 191, 36, 0.4);
          background: rgba(251, 191, 36, 0.06);
        }
        .admin-withdraw-type { color: #fbbf24; font-weight: 600; }
        .admin-account-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-top: 6px;
        }
        .copy-btn-inline {
          padding: 4px 10px !important;
          font-size: 0.8rem !important;
        }
        .admin-withdraw-hint {
          margin-top: 8px;
          color: var(--muted);
          font-size: 0.8rem;
        }
        .admin-request-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }
        .admin-req-meta {
          display: block;
          font-size: 0.85rem;
          color: var(--muted);
          font-weight: 400;
        }
        .admin-request-body { margin-bottom: 12px; font-size: 0.9rem; }
        .admin-prev-reply {
          margin-top: 10px;
          padding: 10px;
          background: rgba(34, 197, 94, 0.1);
          border-radius: 8px;
          color: var(--accent);
          font-size: 0.88rem;
        }
        .admin-prev-reply small { color: var(--muted); }
        .admin-reply-input {
          resize: vertical;
          min-height: 56px;
          margin-bottom: 10px;
        }
        .admin-reply-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .admin-support-layout {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 800px) {
          .admin-support-layout { grid-template-columns: 1fr; }
        }
        .admin-support-threads {
          padding: 16px;
          max-height: 70vh;
          overflow-y: auto;
        }
        .admin-thread-list {
          list-style: none;
          padding: 0;
          margin: 0 0 12px;
        }
        .admin-thread-btn {
          width: 100%;
          text-align: left;
          padding: 10px;
          border: none;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          color: var(--text);
        }
        .admin-thread-btn:hover,
        .admin-thread-btn.active {
          background: rgba(59, 130, 246, 0.15);
        }
        .admin-thread-btn small {
          display: block;
          color: var(--muted);
          font-size: 0.75rem;
          margin-top: 4px;
        }
        .admin-start-thread {
          width: 100%;
          margin-top: 4px;
          font-size: 0.8rem;
        }
        .admin-support-placeholder {
          padding: 40px;
          text-align: center;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
