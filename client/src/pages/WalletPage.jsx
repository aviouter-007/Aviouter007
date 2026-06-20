import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../config';
import CopyField from '../components/CopyField';
import './WalletPage.css';

const MIN_AMOUNT = 10;
const QUICK_AMOUNTS = [10, 50, 100, 500, 1000, 5000];

function StatusBadge({ status }) {
  const cls =
    status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';
  return <span className={`wallet-status ${cls}`}>{status}</span>;
}

export default function WalletPage() {
  const { user, token, refreshUser } = useAuth();
  const [tab, setTab] = useState('deposit');
  const [depositInfo, setDepositInfo] = useState({ accountName: '', accountNumber: '' });

  const [amount, setAmount] = useState(100);
  const [depositorName, setDepositorName] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');

  const [withdrawAccountType, setWithdrawAccountType] = useState('');
  const [withdrawAccountName, setWithdrawAccountName] = useState('');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState('');

  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadRequests = useCallback(() => {
    api.currencyRequests(token).then((d) => setRequests(d.requests || [])).catch(() => {});
  }, [token]);

  useEffect(() => {
    loadRequests();
    api.depositInfo(token).then(setDepositInfo).catch(() => {});
  }, [loadRequests, token]);

  useEffect(() => {
    if (user?.username && !depositorName) {
      setDepositorName(user.username);
    }
  }, [user, depositorName]);

  useEffect(() => {
    const socketUrl = getSocketUrl();
    const socket = io(socketUrl || '/', {
      auth: { token },
      extraHeaders: { 'Bypass-Tunnel-Reminder': 'true' }
    });
    socket.on('wallet:updated', async () => {
      await refreshUser();
      loadRequests();
      setMessage('Admin processed your request. Balance updated.');
    });
    socket.on('request:reply', () => {
      loadRequests();
      setMessage('Admin sent you a reply — see My requests below.');
    });
    return () => socket.disconnect();
  }, [token, refreshUser, loadRequests]);

  const submitDeposit = async () => {
    setLoading(true);
    setMessage('');
    try {
      await api.currencyRequest(token, {
        type: 'deposit',
        amount: parseInt(amount, 10),
        depositorName,
        senderNumber,
        transactionId,
      });
      setMessage('Deposit request submitted. Admin will verify and add coins.');
      setSenderNumber('');
      setTransactionId('');
      loadRequests();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const submitWithdraw = async () => {
    const parsed = parseInt(amount, 10);
    if ((user?.balance ?? 0) < parsed) {
      setMessage(`Not enough balance. You have ${user?.balance ?? 0} coins.`);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      await api.currencyRequest(token, {
        type: 'withdraw',
        amount: parsed,
        accountName: withdrawAccountName,
        accountNumber: withdrawAccountNumber,
        accountType: withdrawAccountType,
      });
      setMessage('Withdrawal request submitted. Admin will transfer to your account.');
      loadRequests();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pendingDeposit = requests.find((r) => r.type === 'deposit' && r.status === 'pending');
  const pendingWithdraw = requests.find((r) => r.type === 'withdraw' && r.status === 'pending');
  const canPlay = (user?.balance ?? 0) >= MIN_AMOUNT;
  const withdrawTooMuch = parseInt(amount, 10) > (user?.balance ?? 0);

  return (
    <div className="page wallet-page">
      <h1>Wallet</h1>
      <p className="wallet-subtitle">
        Deposit to the account below, then submit your details. Minimum bet:{' '}
        <strong>{MIN_AMOUNT} coins</strong>.
      </p>

      <div className="wallet-balance-card card">
        <div>
          <span className="label">Available balance</span>
          <div className="wallet-balance-value">🪙 {user?.balance?.toLocaleString() ?? 0}</div>
        </div>
        <div className="wallet-balance-meta">
          {canPlay ? (
            <span className="wallet-can-play">Ready to play</span>
          ) : (
            <span className="wallet-need-deposit">
              Need at least {MIN_AMOUNT} coins — deposit first
            </span>
          )}
          <Link to="/" className="btn btn-primary">
            Go to game
          </Link>
        </div>
      </div>

      <div className="wallet-tabs tabs">
        <button
          type="button"
          className={`tab ${tab === 'deposit' ? 'active' : ''}`}
          onClick={() => setTab('deposit')}
        >
          Deposit
        </button>
        <button
          type="button"
          className={`tab ${tab === 'withdraw' ? 'active' : ''}`}
          onClick={() => setTab('withdraw')}
        >
          Withdraw
        </button>
        <button
          type="button"
          className={`tab ${tab === 'history' ? 'active' : ''}`}
          onClick={() => setTab('history')}
        >
          My requests
        </button>
      </div>

      {tab === 'deposit' && (
        <>
          <div className="card deposit-account-card">
            <h3>Send payment to this account</h3>
            <p className="wallet-form-hint">
              Transfer the amount first, then fill the form below with your payment details.
            </p>
            <CopyField label="Account type" value={depositInfo.accountType} />
            <CopyField label="Account name" value={depositInfo.accountName} />
            <CopyField label="Account number" value={depositInfo.accountNumber} />
          </div>

          <div className="card wallet-form-card">
            <h3>Deposit request</h3>

            {pendingDeposit && (
              <div className="wallet-alert pending">
                Pending deposit ({pendingDeposit.amount} coins) — waiting for admin
              </div>
            )}

            <label className="label">Amount to deposit (min {MIN_AMOUNT})</label>
            <input
              type="number"
              className="input"
              min={MIN_AMOUNT}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="wallet-quick-amounts">
              {QUICK_AMOUNTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setAmount(v)}
                >
                  {v}
                </button>
              ))}
            </div>

            <label className="label">Your full name</label>
            <input
              className="input"
              placeholder="Name on your payment account"
              value={depositorName}
              onChange={(e) => setDepositorName(e.target.value)}
            />

            <label className="label">Number / account you paid from</label>
            <input
              className="input"
              placeholder="Mobile or bank number used for transfer"
              value={senderNumber}
              onChange={(e) => setSenderNumber(e.target.value)}
            />

            <label className="label">Transaction ID (TID)</label>
            <input
              className="input"
              placeholder="Receipt / transaction reference number"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
            />

            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || pendingDeposit}
              onClick={submitDeposit}
            >
              {loading ? 'Submitting...' : 'Submit deposit request'}
            </button>
          </div>
        </>
      )}

      {tab === 'withdraw' && (
        <div className="card wallet-form-card">
          <h3>Withdraw request</h3>
          <p className="wallet-form-hint">
            You can only withdraw if your balance is enough. Coins are sent to the account
            you provide after admin approval.
          </p>

          {pendingWithdraw && (
            <div className="wallet-alert pending">
              Pending withdrawal ({pendingWithdraw.amount} coins) — waiting for admin
            </div>
          )}

          <label className="label">
            Amount to withdraw (min {MIN_AMOUNT}) — Balance: {user?.balance ?? 0}
          </label>
          <input
            type="number"
            className="input"
            min={MIN_AMOUNT}
            max={user?.balance ?? 0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="wallet-quick-amounts">
            {QUICK_AMOUNTS.filter((v) => v <= (user?.balance ?? 0)).map((v) => (
              <button
                key={v}
                type="button"
                className="btn btn-ghost"
                onClick={() => setAmount(v)}
              >
                {v}
              </button>
            ))}
          </div>
          {withdrawTooMuch && (
            <p className="error-text">
              Amount exceeds your balance ({user?.balance ?? 0} coins). Withdraw not possible.
            </p>
          )}

          <label className="label">Account type</label>
          <input
            className="input"
            placeholder="e.g. JazzCash, EasyPaisa, Bank Name"
            value={withdrawAccountType}
            onChange={(e) => setWithdrawAccountType(e.target.value)}
          />

          <label className="label">Your account holder name</label>
          <input
            className="input"
            placeholder="Name on bank / wallet account"
            value={withdrawAccountName}
            onChange={(e) => setWithdrawAccountName(e.target.value)}
          />

          <label className="label">Your account number</label>
          <input
            className="input"
            placeholder="Bank or mobile wallet account number"
            value={withdrawAccountNumber}
            onChange={(e) => setWithdrawAccountNumber(e.target.value)}
          />

          <button
            type="button"
            className="btn btn-gold"
            disabled={loading || pendingWithdraw || withdrawTooMuch}
            onClick={submitWithdraw}
          >
            {loading ? 'Submitting...' : 'Submit withdrawal request'}
          </button>
        </div>
      )}

      {tab === 'history' && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Details</th>
                <th>Status</th>
                <th>Admin reply</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td className={r.type === 'deposit' ? 'type-deposit' : 'type-withdraw'}>
                    {r.type}
                  </td>
                  <td>{r.amount} 🪙</td>
                  <td className="request-details">
                    {r.type === 'deposit' ? (
                      <>
                        <div>Name: {r.depositor_name}</div>
                        <div>From: {r.sender_number}</div>
                        <div>TID: {r.transaction_id}</div>
                      </>
                    ) : (
                      <>
                        <div>Type: {r.account_type}</div>
                        <div>Name: {r.account_name}</div>
                        <div>Account: {r.account_number}</div>
                      </>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="admin-reply-cell">
                    {r.admin_reply ? (
                      <span className="user-admin-reply">{r.admin_reply}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!requests.length && (
            <p className="wallet-empty">No requests yet.</p>
          )}
        </div>
      )}

      <div className="card wallet-info-card">
        <h4>How it works</h4>
        <ol>
          <li>
            <strong>Deposit:</strong> Copy account above → pay → enter amount, your name, sender
            number & TID → admin approves → coins added.
          </li>
          <li>
            <strong>Withdraw:</strong> Enter amount (must be ≤ balance), your account name &
            number → admin approves → coins deducted & paid out.
          </li>
        </ol>
      </div>

      {message && <p className="wallet-message">{message}</p>}
    </div>
  );
}
