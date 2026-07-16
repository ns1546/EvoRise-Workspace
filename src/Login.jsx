import React, { useState, useEffect } from 'react';
import { auth, googleProvider } from './firebase';
import {
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, MapPin, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';

// ─── Google "G" SVG Icon ──────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    <path fill="none" d="M0 0h48v48H0z" />
  </svg>
);

const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
};

const Login = () => {
  const [mode, setMode] = useState('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [animateIn, setAnimateIn] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      navigate('/', { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    setTimeout(() => setAnimateIn(true), 50);
    if (navigator.geolocation) {
      setLocationStatus('requesting');
      navigator.geolocation.getCurrentPosition(
        () => setLocationStatus('granted'),
        () => setLocationStatus('denied'),
        { timeout: 8000, maximumAge: 0 }
      );
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(getFriendlyError(err.code));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(getFriendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email address first.'); return; }
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg(`Password reset link sent to ${email}. Check your inbox!`);
    } catch (err) {
      setError(getFriendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const getFriendlyError = (code) => {
    const map = {
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/too-many-requests': 'Too many failed attempts. Try again later.',
      'auth/network-request-failed': 'Network error. Check your connection.',
      'auth/popup-blocked': 'Popup was blocked by your browser. Please allow popups.',
      'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method.',
    };
    return map[code] || 'Authentication failed. Please try again.';
  };

  const switchMode = (newMode) => {
    setError('');
    setSuccessMsg('');
    setMode(newMode);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0b1a3a 40%, #0d1f4a 70%, #091529 100%)',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Inter', 'Segoe UI', sans-serif"
    }}>

      {/* Animated background orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(11,87,208,0.18) 0%, transparent 70%)', top: '-100px', left: '-100px', animation: 'orbFloat 8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(26,115,232,0.14) 0%, transparent 70%)', bottom: '-80px', right: '-80px', animation: 'orbFloat 10s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(66,133,244,0.10) 0%, transparent 70%)', top: '40%', right: '20%', animation: 'orbFloat 6s ease-in-out infinite 2s' }} />
        {/* Grid lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <style>{`
        @keyframes orbFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.7; }
          50% { transform: scale(1.1); opacity: 0.3; }
          100% { transform: scale(0.9); opacity: 0.7; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .login-input {
          width: 100%;
          padding: 14px 14px 14px 46px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          color: white;
          font-size: 15px;
          outline: none;
          box-sizing: border-box;
          transition: all 0.2s;
          font-family: inherit;
        }
        .login-input:focus {
          border-color: rgba(66,133,244,0.6);
          background: rgba(255,255,255,0.09);
          box-shadow: 0 0 0 3px rgba(66,133,244,0.15);
        }
        .login-input::placeholder { color: rgba(255,255,255,0.35); }
        .login-btn-primary {
          width: 100%;
          padding: 15px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #1a73e8 0%, #0b57d0 100%);
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          box-shadow: 0 8px 24px rgba(11,87,208,0.4);
        }
        .login-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(11,87,208,0.5);
        }
        .login-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .google-btn {
          width: 100%;
          padding: 14px;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 14px;
          background: rgba(255,255,255,0.07);
          color: white;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-family: inherit;
          backdrop-filter: blur(10px);
        }
        .google-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.25);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .google-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .text-link {
          background: none;
          border: none;
          color: rgba(100,181,246,0.9);
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 3px;
          font-family: inherit;
          transition: color 0.2s;
        }
        .text-link:hover { color: #64b5f6; }
        .divider-text {
          display: flex;
          align-items: center;
          gap: 12px;
          color: rgba(255,255,255,0.25);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
        }
        .divider-text::before, .divider-text::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.12);
        }
      `}</style>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        margin: '16px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '28px',
        padding: '40px 36px',
        backdropFilter: 'blur(24px)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        animation: animateIn ? 'slideUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards' : 'none',
        opacity: animateIn ? 1 : 0,
        position: 'relative',
        zIndex: 1
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '16px',
            position: 'relative'
          }}>
            <img src="/ev_logo.png" alt="Evorise Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', zIndex: 2 }} />
            {/* Pulse ring */}
            <div style={{ position: 'absolute', inset: '-8px', borderRadius: '28px', border: '2px solid rgba(42, 159, 175, 0.3)', animation: 'pulse-ring 2.5s ease-in-out infinite' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>EVORISE Workspace</h1>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
            {mode === 'main' ? 'Sign in to continue' : mode === 'email' ? 'Sign in with email & password' : 'Reset your password'}
          </p>
        </div>

        {/* Error / Success Messages */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '12px 14px', marginBottom: '20px', animation: 'fadeIn 0.2s ease' }}>
            <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0 }} />
            <span style={{ color: '#f87171', fontSize: '13px', fontWeight: 500 }}>{error}</span>
          </div>
        )}
        {successMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '12px', padding: '12px 14px', marginBottom: '20px', animation: 'fadeIn 0.2s ease' }}>
            <CheckCircle size={16} color="#34d399" style={{ flexShrink: 0 }} />
            <span style={{ color: '#34d399', fontSize: '13px', fontWeight: 500 }}>{successMsg}</span>
          </div>
        )}

        {/* ── MAIN MODE: Google + Switch to email ── */}
        {mode === 'main' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.3s ease' }}>
            <button className="google-btn" onClick={handleGoogleSignIn} disabled={googleLoading}>
              {googleLoading
                ? <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                : <GoogleIcon />
              }
              {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
            </button>

            <div className="divider-text">OR</div>

            <button
              className="login-btn-primary"
              style={{ background: 'rgba(255,255,255,0.08)', boxShadow: 'none', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}
              onClick={() => switchMode('email')}
            >
              Sign in with Email & Password
            </button>

            {/* Location Status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)' }}>
              <MapPin size={14} color={locationStatus === 'granted' ? '#34d399' : locationStatus === 'denied' ? '#f87171' : '#64b5f6'} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: locationStatus === 'granted' ? '#34d399' : locationStatus === 'denied' ? '#f87171' : 'rgba(255,255,255,0.5)' }}>
                {locationStatus === 'idle' && 'Preparing location...'}
                {locationStatus === 'requesting' && 'Requesting your location...'}
                {locationStatus === 'granted' && 'Location verified ✓'}
                {locationStatus === 'denied' && 'Location access denied – some features may be limited'}
              </span>
            </div>
          </div>
        )}

        {/* ── EMAIL MODE ── */}
        {mode === 'email' && (
          <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.3s ease' }}>

            <div style={{ position: 'relative' }}>
              <Mail size={18} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                className="login-input"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div style={{ position: 'relative' }}>
              <Lock size={18} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                className="login-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ paddingRight: '48px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', display: 'flex', padding: '0' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div style={{ textAlign: 'right', marginTop: '-4px' }}>
              <button type="button" className="text-link" onClick={() => switchMode('forgot')}>
                Forgot Password?
              </button>
            </div>

            <button type="submit" className="login-btn-primary" disabled={loading}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Signing in...
                </span>
                : 'Sign In'
              }
            </button>

            <div className="divider-text">OR</div>

            <button type="button" className="google-btn" onClick={handleGoogleSignIn} disabled={googleLoading}>
              {googleLoading
                ? <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                : <GoogleIcon />
              }
              {googleLoading ? 'Connecting...' : 'Use Google instead'}
            </button>

            <button type="button" onClick={() => switchMode('main')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, marginTop: '4px', fontFamily: 'inherit' }}>
              <ArrowLeft size={14} /> Back to sign-in options
            </button>
          </form>
        )}

        {/* ── FORGOT PASSWORD MODE ── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.3s ease' }}>
            <p style={{ margin: '0 0 4px 0', color: 'rgba(255,255,255,0.55)', fontSize: '14px', lineHeight: 1.6, textAlign: 'center' }}>
              Enter your email address and we'll send you a password reset link.
            </p>

            <div style={{ position: 'relative' }}>
              <Mail size={18} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                className="login-input"
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button type="submit" className="login-btn-primary" disabled={loading}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Sending Reset Link...
                </span>
                : 'Send Password Reset Email'
              }
            </button>

            <button type="button" onClick={() => switchMode('email')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit' }}>
              <ArrowLeft size={14} /> Back to sign in
            </button>
          </form>
        )}

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: '28px', marginBottom: 0, fontSize: '11px', color: 'rgba(255,255,255,0.2)', fontWeight: 500, letterSpacing: '0.04em' }}>
          EVORISE WORKSPACE • SECURE SESSION
        </p>
      </div>
    </div>
  );
};

export default Login;
