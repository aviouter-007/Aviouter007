import { useState } from 'react';
import './CopyField.css';

export default function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="copy-field">
      <span className="label">{label}</span>
      <div className="copy-field-row">
        <code className="copy-field-value">{value || '—'}</code>
        <button type="button" className="btn btn-ghost copy-btn" onClick={copy} disabled={!value}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
