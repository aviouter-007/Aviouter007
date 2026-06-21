import { useState, useRef, useEffect } from 'react';
import './ChatPanel.css';

export default function ChatPanel({ messages, onSend, disabled }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const chatMessagesRef = useRef(null);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
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
    <div className="chat-panel card">
      <h3>Live Chat</h3>
      <div className="chat-messages" ref={chatMessagesRef}>
        {messages.length === 0 && (
          <p className="chat-empty">Say hello to other pilots!</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="chat-msg">
            <strong>{m.username}</strong>
            <span>{m.message}</span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="chat-form">
        <input
          className="input"
          placeholder={disabled ? 'Login to chat' : 'Type a message...'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
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

