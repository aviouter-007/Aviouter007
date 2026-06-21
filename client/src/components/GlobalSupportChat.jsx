import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import SupportChat from './SupportChat';

export default function GlobalSupportChat() {
  const { token, user } = useAuth();
  const [supportMessages, setSupportMessages] = useState([]);

  useEffect(() => {
    if (!token || user?.role === 'admin') {
      setSupportMessages([]);
      return;
    }
    const fetchSupport = () => {
      api.supportMessages(token).then((d) => setSupportMessages(d.messages || [])).catch(() => {});
    };
    fetchSupport();
    const interval = setInterval(fetchSupport, 3000);
    return () => clearInterval(interval);
  }, [token, user?.role]);

  const sendSupport = useCallback(
    async (message) => {
      if (!token) return { error: 'Login required' };
      try {
        const result = await api.sendSupportMessage(token, message);
        api.supportMessages(token).then((d) => setSupportMessages(d.messages || [])).catch(() => {});
        return result;
      } catch (e) {
        return { error: e.message };
      }
    },
    [token]
  );

  if (!token || user?.role === 'admin') return null;

  return (
    <SupportChat
      messages={supportMessages}
      onSend={sendSupport}
      disabled={!token}
      floating
    />
  );
}
