import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

/**
 * This page handles the redirect back from Google OAuth.
 * Supabase puts the access_token in the URL hash, we extract it,
 * send it to our backend, get our JWT, and redirect to home.
 */
export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [status, setStatus] = useState('Signing you in with Google...');

  useEffect(() => {
    const handle = async () => {
      try {
        // Get the current session Supabase set after redirect
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.access_token) {
          setStatus('Google sign-in failed. Please try again.');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

        const data = await api.loginWithGoogle(session.access_token);
        localStorage.setItem('aviouter_token', data.token);
        setUser(data.user);
        navigate(data.user.role === 'admin' ? '/admin' : '/', { replace: true });
      } catch (e) {
        setStatus(e.message || 'Sign-in failed. Please try again.');
        setTimeout(() => navigate('/login'), 2500);
      }
    };

    handle();
  }, [navigate, setUser]);

  return (
    <div className="auth-page">
      <div className="auth-card card" style={{ textAlign: 'center' }}>
        <div className="google-callback-spinner" />
        <p style={{ color: 'var(--muted)', marginTop: 16 }}>{status}</p>
      </div>
      <style>{`
        .google-callback-spinner {
          width: 44px;
          height: 44px;
          border: 4px solid rgba(255,255,255,0.1);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
