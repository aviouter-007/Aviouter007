import { useAuth } from '../context/AuthContext';
import { useGameSocket } from '../hooks/useGameSocket';
import CrashCanvas from '../components/CrashCanvas';
import GamePanel from '../components/GamePanel';
import SupportChat from '../components/SupportChat';
import { api } from '../api';
import './GamePage.css';

export default function GamePage() {
  const { user, token, refreshUser } = useAuth();
  const { gameState, history, supportMessages, placeBet, cashout, sendSupport } =
    useGameSocket(token);

  const phase = gameState?.phase || 'waiting';
  const multiplier = gameState?.multiplier ?? 1;
  const round = gameState?.round;
  const settings = gameState?.settings;

  const handleBet = async (amount, autoCashout) => {
    const result = await placeBet(amount, autoCashout);
    if (!result?.error) await refreshUser();
    return result;
  };

  const handleCashout = async () => {
    const result = await cashout();
    if (!result?.error) await refreshUser();
    return result;
  };

  const playersOnline = gameState?.playersOnline ?? 0;
  const liveBetCount = gameState?.activeBets?.length ?? 0;

  return (
    <div className="game-page">
      <div className="game-main">
        <div className="game-live-stats">
          <span className="live-stat online">
            <span className="live-dot" />
            {playersOnline} playing
          </span>
          <span className="live-stat bets">{liveBetCount} bets this round</span>
        </div>

        <CrashCanvas
          phase={phase}
          multiplier={multiplier}
          crashPoint={round?.crash_point}
          avatarId={user?.avatarId}
          planeSkin={user?.planeSkin}
          activeBets={gameState?.activeBets}
          user={user}
        />

        <div className="round-history">
          <span className="history-label">Recent crashes:</span>
          {history.slice(0, 12).map((r) => (
            <span
              key={r.id}
              className={`history-pill ${r.crash_point < 2 ? 'low' : r.crash_point >= 5 ? 'high' : ''}`}
            >
              {r.crash_point?.toFixed(2)}x
            </span>
          ))}
        </div>



        <GamePanel
          phase={phase}
          balance={user?.balance}
          settings={settings}
          onBet={handleBet}
          onCashout={handleCashout}
          activeBets={gameState?.activeBets}
        />
      </div>

      <aside className="game-sidebar">
        <SupportChat
          messages={supportMessages}
          onSend={sendSupport}
          disabled={!token}
        />
      </aside>
    </div>
  );
}
