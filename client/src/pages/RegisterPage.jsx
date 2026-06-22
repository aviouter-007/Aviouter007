import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';

export default function RegisterPage() {
  const { register, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  if (user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email.trim(), password, reference.trim());
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      // Page will redirect to Google
    } catch (err) {
      setError(err.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1>Create Account</h1>
        <p>Sign up to play — deposit after admin approval</p>

        {/* Google Button */}
        <button
          type="button"
          className="btn-google"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
        >
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M47.532 24.552c0-1.636-.132-3.196-.388-4.68H24.48v9.02h12.952c-.564 2.98-2.212 5.5-4.712 7.196v5.98h7.632c4.468-4.116 7.18-10.18 7.18-17.516z" fill="#4285F4"/>
            <path d="M24.48 48c6.476 0 11.912-2.148 15.876-5.828l-7.632-5.98c-2.148 1.44-4.892 2.296-8.244 2.296-6.34 0-11.712-4.284-13.632-10.04H3.004v6.176C6.952 42.9 15.108 48 24.48 48z" fill="#34A853"/>
            <path d="M10.848 28.448A14.956 14.956 0 0 1 9.992 24c0-1.556.268-3.064.756-4.448v-6.176H3.004A23.956 23.956 0 0 0 .48 24c0 3.876.932 7.54 2.524 10.624l7.844-6.176z" fill="#FBBC05"/>
            <path d="M24.48 9.512c3.568 0 6.768 1.228 9.284 3.636l6.952-6.952C36.384 2.372 30.952 0 24.48 0 15.108 0 6.952 5.1 3.004 13.376l7.844 6.176c1.92-5.756 7.292-10.04 13.632-10.04z" fill="#EA4335"/>
          </svg>
          {googleLoading ? 'Redirecting...' : 'Continue with Google'}
        </button>

        <div className="auth-divider">
          <span>or register with email</span>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">Referral code (optional)</label>
            <input
              className="input"
              placeholder="Friend's code e.g. AV3K9X2M"
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase())}
              style={{ textTransform: 'uppercase' }}
            />
            <p className="field-hint">Each user gets their own unique code after signup (Profile).</p>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading || googleLoading}>
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>
        <p style={{ marginTop: 20, textAlign: 'center', color: 'var(--muted)' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
      <style>{`
        .field-hint {
          font-size: 0.8rem;
          color: var(--muted);
          margin-top: 6px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
