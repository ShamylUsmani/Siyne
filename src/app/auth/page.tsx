'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  linkWithCredential,
  GoogleAuthProvider,
  updateProfile,
  type User,
  type AuthCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

/**
 * Create the Firestore profile doc for a user if it doesn't already exist.
 * Keyed by the Firebase Auth uid, so a given person always maps to exactly
 * one profile regardless of which sign-in method they used.
 */
async function ensureUserDoc(u: User, fallbackName = '') {
  const ref  = doc(db, 'users', u.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    name: u.displayName ?? fallbackName,
    email: u.email ?? '',
    jobTitle: '', company: '', bio: '',
    photoURL: u.photoURL ?? '',
    createdAt: serverTimestamp(),
  });
}

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
  // Set when a Google sign-in is blocked because an email/password account
  // already exists for that email. We hold the Google credential here, ask the
  // user for their password, then link Google onto the existing account so it
  // stays a single account.
  const [pendingGoogleCred, setPendingGoogleCred] = useState<AuthCredential | null>(null);

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
          name, email, jobTitle: '', company: '', bio: '', photoURL: '', createdAt: serverTimestamp(),
        });
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        // If we got here off the back of a blocked Google sign-in, link the
        // Google credential onto this existing account so the user ends up with
        // one account that has both sign-in methods.
        if (pendingGoogleCred) {
          await linkWithCredential(cred.user, pendingGoogleCred);
          setPendingGoogleCred(null);
        }
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

  async function handleGoogle() {
    setError('');
    setBusy(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await ensureUserDoc(cred.user);
      if (rememberEmail && cred.user.email) {
        localStorage.setItem('siyne-saved-email', cred.user.email);
      }
      router.push('/feed');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // User dismissed the popup — nothing to report.
      } else if (code === 'auth/account-exists-with-different-credential') {
        // An email/password account already owns this email. Capture the Google
        // credential, switch to the login tab and have the user confirm their
        // password so we can link the two into one account.
        const pending = GoogleAuthProvider.credentialFromError(
          err as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]
        );
        const existingEmail = (err as { customData?: { email?: string } }).customData?.email;
        setPendingGoogleCred(pending);
        if (existingEmail) setEmail(existingEmail);
        setTab('login');
        setError('You already have an account with this email. Enter your password to log in and connect Google sign-in.');
      } else {
        const raw = err instanceof Error ? err.message : 'Could not sign in with Google.';
        setError(raw.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim());
      }
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

          {/* divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'var(--fg5)' }} />
            <span className="text-xs" style={{ color: 'var(--fg4)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--fg5)' }} />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="w-full py-3 flex items-center justify-center gap-3 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
            style={{ background: 'var(--sur)', border: '1px solid var(--fg5)', color: 'var(--fg2)' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
            </svg>
            {tab === 'login' ? 'Continue with Google' : 'Sign up with Google'}
          </button>

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
