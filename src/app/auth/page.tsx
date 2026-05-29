'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

function AuthForm() {
  const searchParams      = useSearchParams();
  const router            = useRouter();
  const { user, loading } = useAuth();

  const [tab, setTab]     = useState<'login' | 'signup'>(
    searchParams.get('tab') === 'signup' ? 'signup' : 'login'
  );
  const [name, setName]   = useState('');
  const [email, setEmail] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('siyne-saved-email') ?? '';
    return '';
  });
  const [password, setPass]     = useState('');
  const [rememberEmail, setRememberEmail] = useState(() => {
    if (typeof window !== 'undefined') return !!localStorage.getItem('siyne-saved-email');
    return false;
  });
  const [error, setError]   = useState('');
  const [busy, setBusy]     = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/feed');
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (tab === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, 'users', cred.user.uid), {
          name, email, jobTitle: '', company: '', bio: '', createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      if (rememberEmail) {
        localStorage.setItem('siyne-saved-email', email);
      } else {
        localStorage.removeItem('siyne-saved-email');
      }
      router.push('/feed');
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Something went wrong.';
      setError(raw.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim());
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  const labelStyle = { color: 'var(--fg2)', fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '6px' };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="siyne-logo text-3xl">Siyne</Link>
          <p className="text-sm mt-2" style={{ color: 'var(--fg4)' }}>
            Professional networking, without the noise.
          </p>
        </div>

        <div className="card">
          {/* tab switcher */}
          <div className="flex rounded-lg p-1 mb-6" style={{ background: 'var(--sur)' }}>
            {(['login', 'signup'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); }}
                className="flex-1 py-2 text-sm font-medium rounded-md transition-all"
                style={tab === t
                  ? { background: 'var(--fg5)', color: 'white' }
                  : { color: 'var(--fg3)' }}>
                {t === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'signup' && (
              <div>
                <label style={labelStyle}>Full name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith" required className="input-field" />
              </div>
            )}
            <div>
              <label style={labelStyle}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com" required className="input-field" />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={e => setPass(e.target.value)}
                placeholder={tab === 'signup' ? 'At least 6 characters' : '••••••••'}
                required minLength={6} className="input-field" />
            </div>

            {tab === 'login' && (
              <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none"
                style={{ color: 'var(--fg3)' }}>
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={e => setRememberEmail(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer accent-[#B01E36]"
                />
                Remember my email
              </label>
            )}

            {error && (
              <p className="text-sm rounded-lg px-4 py-2.5"
                style={{ background: 'rgba(220,38,38,0.18)', border: '1px solid rgba(220,38,38,0.30)', color: '#fca5a5' }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm mt-5" style={{ color: 'var(--fg4)' }}>
            {tab === 'login' ? (
              <>Don&apos;t have an account?{' '}
                <button onClick={() => setTab('signup')}
                  className="font-medium hover:underline" style={{ color: '#D63A52' }}>Sign up</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => setTab('login')}
                  className="font-medium hover:underline" style={{ color: '#D63A52' }}>Log in</button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return <Suspense><AuthForm /></Suspense>;
}
