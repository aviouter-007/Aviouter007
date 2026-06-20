import { useState } from 'react';
import { getServerUrl, setServerUrl, DEFAULT_SERVER_URL, isNativeApp } from '../config';
import './ServerSettings.css';

export default function ServerSettings({ onSaved }) {
  const [url, setUrl] = useState(getServerUrl() || DEFAULT_SERVER_URL);
  const [hint, setHint] = useState('');

  if (!isNativeApp()) return null;

  const handleSave = () => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setHint('URL must start with http:// or https://');
      return;
    }
    setServerUrl(url);
    setHint('Saved! Restart the app or pull to refresh.');
    onSaved?.();
  };

  return (
    <div className="server-settings card">
      <h3>Server connection</h3>
      <p className="server-settings-desc">
        The app needs your Aviouter backend running on a PC. Use your computer&apos;s LAN IP
        (same Wi‑Fi as this phone). Example: <code>http://192.168.1.5:3001</code>
      </p>
      <label className="label">Backend URL</label>
      <input
        className="input"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={DEFAULT_SERVER_URL}
      />
      <button type="button" className="btn btn-primary" onClick={handleSave}>
        Save server URL
      </button>
      {hint && <p className="server-hint">{hint}</p>}
    </div>
  );
}
