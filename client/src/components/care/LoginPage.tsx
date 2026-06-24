import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../lib/apiClient';
import { CompactDarkLogo, AppIconLogo } from '../logos/CarelaneLogos';

interface LoginResult {
  ok: boolean;
  error?: string;
  next?: string;
}

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.post<LoginResult>('/care/api/auth/login/', { username, password });
      if (result.ok) {
        const params = new URLSearchParams(window.location.search);
        window.location.href = params.get('next') || result.next || '/dashboard/';
      } else {
        setError(result.error || 'Inloggen mislukt.');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Try to extract server-side error message from ApiRequestError body
        const bodyText = (err as { bodyText?: string }).bodyText || '';
        try {
          const parsed = JSON.parse(bodyText) as { error?: string };
          setError(parsed.error || err.message);
        } catch {
          setError(err.message);
        }
      } else {
        setError('Inloggen mislukt.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sa-shell" style={{ display: 'grid', gridTemplateColumns: '1fr', height: '100dvh', overflow: 'hidden', background: '#070b12', color: '#f1f5f9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Left brand panel */}
      <aside style={{ display: 'none' }} className="sa-brand-lg">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 20, position: 'relative', zIndex: 1 }}>
          <CompactDarkLogo width={200} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6366f1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 16, height: 2, background: '#6366f1', borderRadius: 2 }} />
              Zorgcoördinatie
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(24px, 2.4vw, 36px)', fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.03em', color: '#f1f5f9' }}>
              Operationele regie<br />voor gemeenten en<br /><span style={{ color: '#a5b4fc' }}>zorgaanbieders</span>
            </h1>
          </div>
        </div>
      </aside>

      {/* Right form panel */}
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 32px', background: '#070b12', height: '100%', overflowY: 'auto' }}>
        {/* Mobile logo */}
        <div style={{ marginBottom: 40 }}>
          <AppIconLogo width={44} />
        </div>

        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6366f1' }}>Beveiligde toegang</div>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', color: '#f1f5f9', margin: 0 }}>Welkom terug</h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Log in om verder te gaan met openstaande casussen en plaatsingen.
            </p>
          </div>

          {error && (
            <div role="alert" style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="login-username" style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>
                Gebruikersnaam
              </label>
              <input
                ref={usernameRef}
                id="login-username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Jouw gebruikersnaam"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label htmlFor="login-password" style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>
                  Wachtwoord
                </label>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 4 }}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              style={{ width: '100%', padding: '11px 16px', borderRadius: 10, border: 'none', background: loading ? '#4547b0' : '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: (!username.trim() || !password) ? 0.55 : 1, letterSpacing: '-0.01em', transition: 'background 0.15s, opacity 0.15s' }}
            >
              {loading ? 'Inloggen…' : 'Inloggen'}
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 4 }}>
            <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
              Geen account?{' '}
              <a href="/register/" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>Account aanmaken</a>
            </p>
            <a href="/" style={{ fontSize: 12, color: '#334155', textDecoration: 'none' }}>← Terug naar Carelane</a>
          </div>
        </div>
      </main>

      <style>{`
        @media (min-width: 1024px) {
          .sa-shell { grid-template-columns: 1.1fr 0.9fr !important; }
          .sa-brand-lg { display: flex !important; flex-direction: column; padding: 40px 60px; background: linear-gradient(160deg, #0d1424 0%, #080e1c 100%); border-right: 1px solid rgba(51,65,85,0.35); position: relative; overflow: hidden; }
        }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px #0f172a inset !important; -webkit-text-fill-color: #f1f5f9 !important; }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 9,
  border: '1px solid rgba(51,65,85,0.7)',
  background: 'rgba(15,23,42,0.8)',
  color: '#f1f5f9',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

function EyeIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-7.25 9.75-7.25S21.75 12 21.75 12s-3.75 7.25-9.75 7.25S2.25 12 2.25 12z" />
      <circle cx="12" cy="12" r="3.25" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.58 10.58A3 3 0 0012 15a3 3 0 003-3 2.99 2.99 0 00-.42-1.5M8.82 8.82A8.3 8.3 0 002.25 12s3.75 7.25 9.75 7.25c1.36 0 2.65-.24 3.82-.68m2.12-1.32A16.18 16.18 0 0021.75 12s-3.75-7.25-9.75-7.25a12.2 12.2 0 00-2.03.17" />
    </svg>
  );
}
