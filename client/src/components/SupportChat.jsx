import { useState, useRef, useEffect } from 'react';
import './ChatPanel.css';

export default function SupportChat({
  messages,
  onSend,
  disabled,
  title = 'Support chat (Admin)',
  viewerRole = 'user',
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError('');
    const result = await onSend(text.trim());
    if (result?.error) setError(result.error);
    else setText('');
  };

  return (
    <div className="chat-panel card support-chat">
      <h3>{title}</h3>
      <p className="chat-support-hint">Private chat with admin only — not public</p>
      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">Message admin for help with deposit or withdraw.</p>
        )}
        {messages.map((m) => {
          const mine =
            viewerRole === 'admin' ? m.sender_role === 'admin' : m.sender_role === 'user';
          const label = mine ? 'You' : viewerRole === 'admin' ? 'User' : 'Admin';
          return (
            <div
              key={m.id}
              className={`chat-msg ${mine ? 'chat-msg-user' : 'chat-msg-admin'}`}
            >
              <strong>{label}</strong>
              <span>{m.message}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="chat-form">
        <input
          className="input"
          placeholder={disabled ? 'Login to chat' : 'Message admin...'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          disabled={disabled}
        />
        <button type="submit" className="btn btn-primary" disabled={disabled}>
          Send
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
