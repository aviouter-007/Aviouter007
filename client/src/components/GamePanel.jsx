import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './GamePanel.css';

export default function GamePanel({
  phase,
  balance,
  settings,
  onBet,
  onCashout,
  activeBets,
}) {
  const [amount, setAmount] = useState(100);
  const [autoCashout, setAutoCashout] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { user } = useAuth();

  const myBet = activeBets?.find(b => b.username === user?.username && b.status === 'active');
  const hasActiveBet = !!myBet;
  const myCashedOutBet = activeBets?.find(b => b.username === user?.username && b.status === 'cashed_out');

  const handleBet = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await onBet(
        parseInt(amount, 10),
        autoCashout ? parseFloat(autoCashout) : null
      );
      if (result?.error) setMessage(result.error);
      else setMessage('Bet placed!');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCashout = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await onCashout();
      if (result?.error) setMessage(result.error);
      else setMessage(`Cashed out at ${result.multiplier}x — +${result.profit} coins!`);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const min = settings?.minBet ?? 10;
  const max = Math.min(settings?.maxBet ?? 10000, balance ?? 0);
  const lowBalance = (balance ?? 0) < min;

  return (
    <div className="game-panel card">

      {lowBalance && (
        <div className="low-balance-banner">
          Balance too low to play.{' '}
          <Link to="/wallet">Deposit via Wallet</Link> (admin approval required).
        </div>
      )}

      <div className="aviator-bet-container">
        <div className="aviator-bet-controls">
          <div className="aviator-amount-input">
            <button 
              className="amount-btn" 
              onClick={() => setAmount(Math.max(min, Number(amount) - 1))}
            >-</button>
            <input
              type="number"
              className="amount-field"
              min={min}
              max={max}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button 
              className="amount-btn" 
              onClick={() => setAmount(Number(amount) + 1)}
            >+</button>
          </div>
          <div className="aviator-quick-bets">
            {[1, 2, 5, 10].map((v) => (
              <button
                key={v}
                type="button"
                className="quick-bet-btn"
                onClick={() => setAmount(v)}
              >
                {v.toFixed(2)}
              </button>
            ))}
          </div>
        </div>

        <div className="aviator-bet-action">
          {phase === 'betting' && !hasActiveBet && (
            <button
              type="button"
              className="btn-aviator btn-aviator-bet"
              onClick={handleBet}
              disabled={loading || lowBalance}
            >
              <span className="btn-title">Bet</span>
              <span className="btn-subtitle">{Number(amount).toFixed(2)} USD</span>
            </button>
          )}

          {phase === 'betting' && hasActiveBet && (
            <button
              type="button"
              className="btn-aviator btn-aviator-disabled"
              disabled
            >
              <span className="btn-title">Bet Placed</span>
              <span className="btn-subtitle">Waiting for round</span>
            </button>
          )}

          {phase === 'flying' && hasActiveBet && (
            <button
              type="button"
              className="btn-aviator btn-aviator-cashout"
              onClick={handleCashout}
              disabled={loading}
            >
              <span className="btn-title">Cash Out</span>
              <span className="btn-subtitle">{Number(myBet.amount).toFixed(2)} USD</span>
            </button>
          )}

          {((phase === 'flying' && !hasActiveBet) || phase === 'waiting' || phase === 'crashed') && (
            <button
              type="button"
              className={myCashedOutBet ? "btn-aviator btn-aviator-cashedout" : "btn-aviator btn-aviator-disabled"}
              disabled
            >
              {myCashedOutBet ? (
                <>
                  <span className="btn-title">Cashed Out!</span>
                  <span className="btn-subtitle">+{Number(myCashedOutBet.amount * myCashedOutBet.cashoutMultiplier).toFixed(2)} USD</span>
                </>
              ) : (
                <>
                  <span className="btn-title">Waiting</span>
                  <span className="btn-subtitle">for next round</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="bet-auto" style={{marginTop: '15px'}}>
        <label className="label" style={{fontSize: '0.8rem'}}>Auto cashout (optional)</label>
        <input
          type="number"
          className="input"
          step="0.1"
          min="1.1"
          placeholder="e.g. 2.00"
          value={autoCashout}
          onChange={(e) => setAutoCashout(e.target.value)}
        />
      </div>

      {message && <p className={message.includes('!') ? 'success-text' : 'error-text'}>{message}</p>}

      {activeBets?.length > 0 && (
        <div className="live-bets">
          <h4>Live bets ({activeBets.length})</h4>
          <ul>
            {[...activeBets]
              .sort((a, b) => (b.amount || 0) - (a.amount || 0))
              .slice(0, 20)
              .map((b) => (
                <li key={b.id} className={b.status === 'cashed_out' ? 'bet-cashed' : ''}>
                  <span className="bet-user">{b.username}</span>
                  <span>{b.amount} 🪙</span>
                  {b.status === 'cashed_out' && b.cashoutMultiplier && (
                    <span className="cashout-tag">{b.cashoutMultiplier}x ✓</span>
                  )}
                  {b.status === 'lost' && <span className="bet-lost">crashed</span>}
                  {b.status === 'active' && phase === 'flying' && (
                    <span className="bet-active">in flight</span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
