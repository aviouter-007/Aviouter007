import { useState, useRef, useEffect } from 'react';
import './ChatPanel.css';

export default function SupportChat({
  messages,
  onSend,
  disabled,
  title = 'Support chat (Admin)',
  viewerRole = 'user',
  floating = false,
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const chatMessagesRef = useRef(null);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages.length, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError('');
    const result = await onSend(text.trim());
    if (result?.error) setError(result.error);
    else setText('');
  };

  const renderChatContent = () => (
    <>
      <h3>{title}</h3>
      <p className="chat-support-hint">Private chat with admin only — not public</p>
      <div className="chat-messages" ref={chatMessagesRef}>
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
    </>
  );

  if (floating) {
    return (
      <div className="floating-support-container">
        {isOpen && (
          <div className="chat-panel card floating-support-card">
            {renderChatContent()}
          </div>
        )}
        <button
          type="button"
          className={`floating-support-btn ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="support-icon-svg">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="support-icon-svg">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          )}
        </button>

        <style>{`
          .floating-support-container {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            font-family: inherit;
          }
          .floating-support-btn {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--gold, #fbbf24), #d97706);
            border: none;
            box-shadow: 0 4px 16px rgba(217, 119, 6, 0.4);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          }
          .floating-support-btn:hover {
            transform: scale(1.08) translateY(-2px);
            box-shadow: 0 6px 20px rgba(217, 119, 6, 0.5);
          }
          .floating-support-btn:active {
            transform: scale(0.95);
          }
          .support-icon-svg {
            width: 26px;
            height: 26px;
          }
          .floating-support-card {
            position: absolute;
            bottom: 72px;
            right: 0;
            width: 330px;
            height: 400px;
            display: flex;
            flex-direction: column;
            background: rgba(15, 23, 42, 0.95) !important;
            backdrop-filter: blur(12px);
            border: 1px solid rgba(251, 191, 36, 0.25) !important;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6) !important;
            border-radius: 16px !important;
            padding: 16px;
            animation: support-popup-fade 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            transform-origin: bottom right;
          }
          @keyframes support-popup-fade {
            from {
              opacity: 0;
              transform: scale(0.8) translateY(20px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
          .floating-support-card h3 {
            margin-top: 0;
            margin-bottom: 6px;
            color: var(--gold, #fbbf24);
            font-size: 1.15rem;
          }
          .floating-support-card .chat-messages {
            max-height: 240px !important;
            overflow-y: auto;
            flex: 1;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="chat-panel card support-chat">
      {renderChatContent()}
    </div>
  );
}

