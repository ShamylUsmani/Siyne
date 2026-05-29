'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  updateProfile,
  updateEmail,
  updatePassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import Navbar from '@/components/Navbar';

const INDUSTRIES = [
  'Technology', 'Finance & Banking', 'Healthcare', 'Education',
  'Retail & E-commerce', 'Manufacturing', 'Real Estate', 'Media & Entertainment',
  'Transportation & Logistics', 'Energy & Resources', 'Legal & Professional Services',
  'Consulting', 'Marketing & Advertising', 'Non-profit', 'Government',
  'Hospitality & Tourism', 'Construction', 'Agriculture', 'Other',
];

/* ── small shared components ─────────────────────────── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
      style={{ background: checked ? '#b80000' : 'var(--fg5)' }}>
      <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
        style={{ left: '4px', transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
    </button>
  );
}

function SavedBadge({ show }: { show: boolean }) {
  return (
    <span className="text-xs font-medium transition-opacity duration-300 ml-2"
      style={{ color: '#4ade80', opacity: show ? 1 : 0 }}>
      ✓ Saved
    </span>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-bold" style={{ color: 'var(--fg1)' }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--fg4)' }}>{subtitle}</p>}
    </div>
  );
}

const lbl = { color: 'var(--fg3)', fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '5px' };

/* ── page ────────────────────────────────────────────── */
function SettingsContent() {
  const { user, loading } = useAuth();
  const { setTheme: applyTheme } = useTheme();
  const router = useRouter();
  const params = useSearchParams();
  const sectionFromUrl = params.get('s');

  /* refs for scroll-to-section */
  const profileRef  = useRef<HTMLDivElement>(null);
  const accountRef  = useRef<HTMLDivElement>(null);
  const notifRef    = useRef<HTMLDivElement>(null);
  const privacyRef  = useRef<HTMLDivElement>(null);
  const appearRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [user, loading, router]);

  /* scroll to section from URL param */
  useEffect(() => {
    if (!sectionFromUrl) return;
    const map: Record<string, React.RefObject<HTMLDivElement>> = {
      profile: profileRef, account: accountRef, notif: notifRef,
      privacy: privacyRef, appear: appearRef,
    };
    setTimeout(() => map[sectionFromUrl]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }, [sectionFromUrl]);

  /* ─ "saved" flash state ─ */
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  function flash(key: string) {
    setSaved(s => ({ ...s, [key]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2200);
  }

  /* ─ profile fields ─ */
  const [photoURL,  setPhotoURL]  = useState('');
  const [jobTitle,  setJobTitle]  = useState('');
  const [company,   setCompany]   = useState('');
  const [location,  setLocation]  = useState('');
  const [bio,       setBio]       = useState('');
  const [industry,  setIndustry]  = useState('Technology');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  /* ─ account fields ─ */
  const [newName,          setNewName]          = useState('');
  const [newEmail,         setNewEmail]         = useState('');
  const [emailPassword,    setEmailPassword]    = useState('');
  const [oldPassword,      setOldPassword]      = useState('');
  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [deleteConfirm,    setDeleteConfirm]    = useState('');
  const [deletePassword,   setDeletePassword]   = useState('');

  /* ─ status ─ */
  const [emailErr,    setEmailErr]    = useState('');
  const [pwErr,       setPwErr]       = useState('');
  const [deleteErr,   setDeleteErr]   = useState('');
  const [busyEmail,   setBusyEmail]   = useState(false);
  const [busyPw,      setBusyPw]      = useState(false);
  const [busyDelete,  setBusyDelete]  = useState(false);
  const [busyProfile, setBusyProfile] = useState(false);
  const [busyName,    setBusyName]    = useState(false);

  /* ─ notification settings ─ */
  const [notif, setNotif] = useState({
    follows:      true,
    reactions:    true,
    comments:     true,
    companyPosts: true,
    jobMatches:   true,
    weeklyDigest: false,
  });

  /* ─ privacy settings ─ */
  const [privacy, setPrivacy] = useState({
    publicProfile: true,
    showEmail:     false,
    showCompany:   true,
    allowMessages: true,
  });

  /* ─ appearance ─ */
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  /* ─ load settings on mount ─ */
  useEffect(() => {
    if (!user) return;
    setNewName(user.displayName ?? '');
    setNewEmail(user.email ?? '');
    getDoc(doc(db, 'users', user!.uid)).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setJobTitle(d.jobTitle  ?? '');
      setCompany( d.company   ?? '');
      setLocation(d.location  ?? '');
      setBio(     d.bio       ?? '');
      setIndustry(d.industry  ?? 'Technology');
      setPhotoURL(d.photoURL  ?? '');
      if (d.notifSettings)   setNotif(  n => ({ ...n, ...d.notifSettings }));
      if (d.privacySettings) setPrivacy(p => ({ ...p, ...d.privacySettings }));
      if (d.appearance)      setTheme(d.appearance);
    });
  }, [user]);

  if (loading || !user) return null;

  /* ── handlers ─────────────────────────────────────── */

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const r = sRef(storage, `users/${user!.uid}/avatar`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await updateDoc(doc(db, 'users', user!.uid), { photoURL: url });
      setPhotoURL(url);
      flash('photo');
    } catch {}
    setUploadingPhoto(false);
    e.target.value = '';
  }

  async function saveProfile() {
    setBusyProfile(true);
    await updateDoc(doc(db, 'users', user!.uid), { jobTitle, company, location, bio, industry });
    flash('profile');
    setBusyProfile(false);
  }

  async function changeName() {
    if (!newName.trim()) return;
    setBusyName(true);
    await Promise.all([
      updateDoc(doc(db, 'users', user!.uid), { name: newName.trim() }),
      updateProfile(auth.currentUser!, { displayName: newName.trim() }),
    ]);
    flash('name');
    setBusyName(false);
  }

  async function changeEmail() {
    setEmailErr(''); setBusyEmail(true);
    try {
      const cred = EmailAuthProvider.credential(user!.email!, emailPassword);
      await reauthenticateWithCredential(auth.currentUser!, cred);
      await updateEmail(auth.currentUser!, newEmail.trim());
      await updateDoc(doc(db, 'users', user!.uid), { email: newEmail.trim() });
      setEmailPassword('');
      flash('email');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setEmailErr(msg.includes('wrong-password') || msg.includes('invalid-credential')
        ? 'Incorrect password.' : 'Could not update email. Try again.');
    }
    setBusyEmail(false);
  }

  async function changePassword() {
    setPwErr('');
    if (newPassword !== confirmPassword) { setPwErr('Passwords do not match.'); return; }
    if (newPassword.length < 6)          { setPwErr('Must be at least 6 characters.'); return; }
    setBusyPw(true);
    try {
      const cred = EmailAuthProvider.credential(user!.email!, oldPassword);
      await reauthenticateWithCredential(auth.currentUser!, cred);
      await updatePassword(auth.currentUser!, newPassword);
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      flash('password');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setPwErr(msg.includes('wrong-password') || msg.includes('invalid-credential')
        ? 'Incorrect current password.' : 'Could not update password. Try again.');
    }
    setBusyPw(false);
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE' || !deletePassword) return;
    setDeleteErr(''); setBusyDelete(true);
    try {
      const cred = EmailAuthProvider.credential(user!.email!, deletePassword);
      await reauthenticateWithCredential(auth.currentUser!, cred);
      await deleteUser(auth.currentUser!);
      router.push('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setDeleteErr(msg.includes('wrong-password') || msg.includes('invalid-credential')
        ? 'Incorrect password.' : 'Could not delete account. Try again.');
      setBusyDelete(false);
    }
  }

  async function toggleNotif(key: keyof typeof notif, value: boolean) {
    setNotif(n => ({ ...n, [key]: value }));
    await updateDoc(doc(db, 'users', user!.uid), { [`notifSettings.${key}`]: value });
    flash('notif');
  }

  async function togglePrivacy(key: keyof typeof privacy, value: boolean) {
    setPrivacy(p => ({ ...p, [key]: value }));
    await updateDoc(doc(db, 'users', user!.uid), { [`privacySettings.${key}`]: value });
    flash('privacy');
  }

  async function changeTheme(t: 'dark' | 'light') {
    setTheme(t);         // local state for the toggle UI
    applyTheme(t);       // apply immediately via ThemeContext + localStorage
    await updateDoc(doc(db, 'users', user!.uid), { appearance: t });
    flash('theme');
  }

  /* ── render ───────────────────────────────────────── */
  const divider = <div className="my-4" style={{ borderTop: '1px solid var(--sur)' }} />;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10">

        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--fg1)' }}>Settings</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg4)' }}>Manage your account and preferences</p>
        </div>

        <div className="space-y-6">

          {/* ══ PROFILE SETTINGS ══ */}
          <div className="card" ref={profileRef}>
            <SectionHeading title="Profile" subtitle="How you appear to others on Siyne" />

            {/* photo */}
            <div className="flex items-center gap-4 mb-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center font-bold text-xl"
                  style={{ background: photoURL ? 'transparent' : 'linear-gradient(135deg,#b80000,#5c0000)', color: 'white' }}>
                  {photoURL
                    ? <img src={photoURL} alt="avatar" className="w-full h-full object-cover" />
                    : (user.displayName?.[0]?.toUpperCase() ?? '?')}
                </div>
                <button onClick={() => photoInputRef.current?.click()}
                  className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.50)' }}>
                  {uploadingPhoto
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>}
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--fg2)' }}>Profile photo</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--fg4)' }}>Click to change · JPG or PNG</p>
                <SavedBadge show={!!saved.photo} />
              </div>
            </div>

            {divider}

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label style={lbl}>Job title</label>
                <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Software Engineer" className="input-field text-sm" />
              </div>
              <div>
                <label style={lbl}>Company</label>
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Inc." className="input-field text-sm" />
              </div>
              <div>
                <label style={lbl}>Location</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Sydney, NSW" className="input-field text-sm" />
              </div>
              <div>
                <label style={lbl}>Industry</label>
                <select value={industry} onChange={e => setIndustry(e.target.value)} className="input-field text-sm">
                  {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-5">
              <label style={lbl}>Bio</label>
              <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)}
                placeholder="A short bio about yourself…" className="input-field text-sm resize-none" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={saveProfile} disabled={busyProfile} className="btn-primary text-sm py-2 px-5">
                {busyProfile ? 'Saving…' : 'Save profile'}
              </button>
              <SavedBadge show={!!saved.profile} />
            </div>
          </div>

          {/* ══ ACCOUNT SETTINGS ══ */}
          <div className="card" ref={accountRef}>
            <SectionHeading title="Account" subtitle="Manage your login details" />

            {/* change name */}
            <div className="mb-5">
              <label style={lbl}>Display name</label>
              <div className="flex gap-2">
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Your name" className="input-field text-sm flex-1" />
                <button onClick={changeName} disabled={busyName || !newName.trim()} className="btn-primary text-sm py-2 px-4 whitespace-nowrap">
                  {busyName ? '…' : 'Update'}
                </button>
              </div>
              <SavedBadge show={!!saved.name} />
            </div>

            {divider}

            {/* change email */}
            <div className="mb-5">
              <label style={lbl}>Email address</label>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" placeholder="you@example.com" className="input-field text-sm mb-2" />
              <label style={lbl}>Current password (required to change email)</label>
              <div className="flex gap-2">
                <input value={emailPassword} onChange={e => setEmailPassword(e.target.value)} type="password" placeholder="Current password" className="input-field text-sm flex-1" />
                <button onClick={changeEmail} disabled={busyEmail || !emailPassword || !newEmail.trim()} className="btn-primary text-sm py-2 px-4 whitespace-nowrap">
                  {busyEmail ? '…' : 'Update'}
                </button>
              </div>
              {emailErr && <p className="text-xs mt-1.5 px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.14)', color: '#fca5a5' }}>{emailErr}</p>}
              <SavedBadge show={!!saved.email} />
            </div>

            {divider}

            {/* change password */}
            <div className="mb-5">
              <p className="text-sm font-semibold mb-3" style={{ color: 'var(--fg2)' }}>Change password</p>
              <div className="space-y-2">
                <input value={oldPassword} onChange={e => setOldPassword(e.target.value)} type="password" placeholder="Current password" className="input-field text-sm" />
                <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="New password" className="input-field text-sm" />
                <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm new password" className="input-field text-sm" />
              </div>
              {pwErr && <p className="text-xs mt-1.5 px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.14)', color: '#fca5a5' }}>{pwErr}</p>}
              <div className="flex items-center gap-3 mt-3">
                <button onClick={changePassword} disabled={busyPw || !oldPassword || !newPassword || !confirmPassword} className="btn-primary text-sm py-2 px-5">
                  {busyPw ? 'Updating…' : 'Change password'}
                </button>
                <SavedBadge show={!!saved.password} />
              </div>
            </div>

            {divider}

            {/* delete account */}
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#f87171' }}>Delete account</p>
              <p className="text-xs mb-3" style={{ color: 'var(--fg4)' }}>
                This permanently deletes your account. This action cannot be undone.
              </p>
              <div className="space-y-2">
                <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder='Type "DELETE" to confirm' className="input-field text-sm" />
                <input value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
                  type="password" placeholder="Your password" className="input-field text-sm" />
              </div>
              {deleteErr && <p className="text-xs mt-1.5 px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.14)', color: '#fca5a5' }}>{deleteErr}</p>}
              <button
                onClick={handleDeleteAccount}
                disabled={busyDelete || deleteConfirm !== 'DELETE' || !deletePassword}
                className="mt-3 text-sm px-5 py-2 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(220,38,38,0.15)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)' }}>
                {busyDelete ? 'Deleting…' : 'Delete my account'}
              </button>
            </div>
          </div>

          {/* ══ NOTIFICATION SETTINGS ══ */}
          <div className="card" ref={notifRef}>
            <div className="flex items-center gap-2 mb-1">
              <SectionHeading title="Notifications" />
              <SavedBadge show={!!saved.notif} />
            </div>
            <div className="space-y-4">
              {([
                { key: 'follows',      label: 'Someone follows me' },
                { key: 'reactions',    label: 'Someone likes my post' },
                { key: 'comments',     label: 'Someone comments on my post' },
                { key: 'companyPosts', label: 'A company I follow posts an update' },
                { key: 'jobMatches',   label: 'New job matches my profile' },
                { key: 'weeklyDigest', label: 'Weekly digest email' },
              ] as { key: keyof typeof notif; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--fg2)' }}>{label}</span>
                  <Toggle checked={notif[key]} onChange={v => toggleNotif(key, v)} />
                </div>
              ))}
            </div>
          </div>

          {/* ══ PRIVACY SETTINGS ══ */}
          <div className="card" ref={privacyRef}>
            <div className="flex items-center gap-2 mb-1">
              <SectionHeading title="Privacy" />
              <SavedBadge show={!!saved.privacy} />
            </div>
            <div className="space-y-4">
              {([
                { key: 'publicProfile', label: 'Show my profile to non logged-in users' },
                { key: 'showEmail',     label: 'Show my email on my profile' },
                { key: 'showCompany',   label: 'Show my current company on my profile' },
                { key: 'allowMessages', label: 'Allow others to send me direct messages' },
              ] as { key: keyof typeof privacy; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--fg2)' }}>{label}</span>
                  <Toggle checked={privacy[key]} onChange={v => togglePrivacy(key, v)} />
                </div>
              ))}
            </div>
          </div>

          {/* ══ APPEARANCE ══ */}
          <div className="card" ref={appearRef}>
            <SectionHeading title="Appearance" />
            <div className="flex gap-3">
              {(['dark', 'light'] as const).map(t => (
                <button key={t} onClick={() => changeTheme(t)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex flex-col items-center gap-2"
                  style={theme === t
                    ? { background: 'linear-gradient(135deg,#b80000,#5c0000)', color: 'white', border: '1px solid #b80000' }
                    : { background: 'var(--sur)', color: 'var(--fg3)', border: '1px solid var(--fg5)' }}>
                  <span className="text-xl">{t === 'dark' ? '🌙' : '☀️'}</span>
                  <span className="capitalize">{t} mode</span>
                </button>
              ))}
            </div>
            <SavedBadge show={!!saved.theme} />
          </div>

          {/* ══ CONNECTED ACCOUNTS ══ */}
          <div className="card">
            <SectionHeading title="Connected accounts" subtitle="Link external accounts for faster sign-in" />
            <div className="space-y-3">
              {[
                { name: 'Google', icon: 'G', color: '#4285f4' },
                { name: 'Apple',  icon: '', color: 'white' },
              ].map(({ name, icon, color }) => (
                <div key={name} className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: 'var(--sur)', border: '1px solid var(--sur)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                      style={{ background: 'var(--fg5)', color }}>
                      {icon}
                    </div>
                    <span className="text-sm" style={{ color: 'var(--fg2)' }}>{name}</span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: 'var(--sur)', color: 'var(--fg4)' }}>
                    Coming soon
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        <p className="text-center text-xs mt-8" style={{ color: 'var(--fg5)' }}>
          <Link href="/feed" className="hover:underline">← Back to feed</Link>
        </p>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return <Suspense><SettingsContent /></Suspense>;
}
