import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api';

export function useGameSocket(token) {
  const [gameState, setGameState] = useState(null);
  const [history, setHistory] = useState([]);
  const [supportMessages, setSupportMessages] = useState([]);
  const intervalRef = useRef(null);
  const animationRef = useRef(null);

  const fetchState = useCallback(async () => {
    try {
      const data = await api.gameState();
      setGameState(prev => {
        // If transitioning from crashed/betting to flying, store the exact start time locally
        if (data.phase === 'flying' && prev?.phase !== 'flying') {
           data.localStartTime = Date.now() - (Date.now() - new Date(data.round.started_at).getTime());
        } else if (data.phase === 'flying' && prev?.phase === 'flying') {
           data.localStartTime = prev.localStartTime; // Preserve start time
        }
        return data;
      });
    } catch (e) { }
  }, []);

  const refreshHistory = useCallback(() => {
    api.gameHistory().then((d) => setHistory(d.rounds || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchState();
    refreshHistory();

    // Poll the server state every 1 second
    intervalRef.current = setInterval(fetchState, 1000);

    return () => {
      clearInterval(intervalRef.current);
      cancelAnimationFrame(animationRef.current);
    };
  }, [fetchState, refreshHistory]);

  // Smooth local animation of the multiplier
  useEffect(() => {
    if (gameState?.phase === 'flying' && gameState?.localStartTime) {
      const animate = () => {
        const elapsedSec = (Date.now() - gameState.localStartTime) / 1000;
        const currentMultiplier = Math.round((1 + elapsedSec * 0.15 + Math.pow(elapsedSec, 1.6) * 0.08) * 100) / 100;
        
        setGameState(prev => prev ? { ...prev, multiplier: currentMultiplier } : prev);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
      
      return () => cancelAnimationFrame(animationRef.current);
    }
  }, [gameState?.phase, gameState?.localStartTime]);

  const placeBet = useCallback(
    async (amount, autoCashout) => {
      await api.placeBet(token, { amount, autoCashout });
      fetchState();
    },
    [token, fetchState]
  );

  const cashout = useCallback(
    async () => {
      await api.cashout(token);
      fetchState();
    },
    [token, fetchState]
  );

  const sendSupport = useCallback(
    async (message) => {
      // Stub
    },
    []
  );

  return {
    gameState,
    history,
    supportMessages,
    placeBet,
    cashout,
    sendSupport,
  };
}
