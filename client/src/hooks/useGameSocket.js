import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api';
import { getSocketUrl } from '../config';

export function useGameSocket(token) {
  const [gameState, setGameState] = useState(null);
  const [history, setHistory] = useState([]);
  const [supportMessages, setSupportMessages] = useState([]);
  const socketRef = useRef(null);

  const refreshHistory = useCallback(() => {
    api.gameHistory().then((d) => setHistory(d.rounds || [])).catch(() => {});
  }, []);

  useEffect(() => {
    api.gameState().then(setGameState).catch(() => {});
    if (token) {
      api.supportMessages(token).then((d) => setSupportMessages(d.messages || [])).catch(() => {});
    } else {
      setSupportMessages([]);
    }
    refreshHistory();

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl || '/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('game:state', setGameState);
    socket.on('round:betting', setGameState);
    socket.on('round:flying', setGameState);
    socket.on('round:tick', (data) => {
      setGameState((prev) =>
        prev ? { ...prev, multiplier: data.multiplier } : prev
      );
    });
    socket.on('round:crashed', (data) => {
      setGameState(data);
      refreshHistory();
    });
    socket.on('round:bet', setGameState);
    socket.on('round:cashout', setGameState);

    socket.on('support:message', (msg) => {
      setSupportMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => socket.disconnect();
  }, [token, refreshHistory]);

  const placeBet = useCallback(
    (amount, autoCashout) =>
      new Promise((resolve) => {
        socketRef.current?.emit('bet:place', { amount, autoCashout }, resolve);
      }),
    []
  );

  const cashout = useCallback(
    () =>
      new Promise((resolve) => {
        socketRef.current?.emit('bet:cashout', {}, resolve);
      }),
    []
  );

  const sendSupport = useCallback(
    (message) =>
      new Promise((resolve) => {
        socketRef.current?.emit('support:send', { message }, resolve);
      }),
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
