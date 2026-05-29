'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  collection, addDoc, query, where, getDocs,
  doc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

const INDUSTRIES = [
  'Technology', 'Finance & Banking', 'Healthcare', 'Education',
  'Retail & E-commerce', 'Manufacturing', 'Real Estate', 'Media & Entertainment',
  'Transportation & Logistics', 'Energy & Resources', 'Legal & Professional Services',
  'Consulting', 'Marketing & Advertising', 'Non-profit', 'Government',
  'Hospitality & Tourism', 'Construction', 'Agriculture', 'Other',
];
const SIZES = ['1–10', '11–50', '51–200', '201–500', '501–1,000', '1,001–5,000', '5,000+'];

export default function NewCompanyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    name: '', industry: 'Technology', size: '11–50',
    founded: '', location: '', website: '', description: '',
  });
  const [logoFile,    setLogoFile]    = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [saving,     setSaving]       = useState(false);
  const [checking,   setChecking]     = useState(false);
  const [duplicate,  setDuplicate]    = useState<{ id: string; name: string } | null>(null);
  const [error,      setError]        = useState('');
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!loading && !user) router.replace('/auth'); }, [user, loading, router]);

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function checkDuplicate(name: string) {
    if (!name.trim()) { setDuplicate(null); return; }
    setChecking(true);
    const q    = query(collection(db, 'companies'), where('nameLower', '==', name.trim().toLowerCase()));
    const snap = await getDocs(q);
    setDuplicate(snap.empty ? null : { id: snap.docs[0].id, name: snap.docs[0].data().name });
    setChecking(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || duplicate) return;
    setSaving(true);
    setError('');
    try {
      let logoUrl = '';
      if (logoFile) {
        const sRef = ref(storage, `companies/logos/${Date.now()}_${logoFile.name}`);
        await uploadBytes(sRef, logoFile);
        logoUrl = await getDownloadURL(sRef);
      }

      const companyRef = await addDoc(collection(db, 'companies'), {
        ...form,
        nameLower:     form.name.trim().toLowerCase(),
        logoUrl,
        photoUrls:     [],
        socialLinks:   { linkedin: '', instagram: '', facebook: '', website: form.website },
        followerCount: 0,
        verified:      false,
        createdBy:     user.uid,
        createdAt:     serverTimestamp(),
      });

      await setDoc(doc(db, 'companyAdmins', `${companyRef.id}_${user.uid}`), {
        companyId:  companyRef.id,
        userId:     user.uid,
        role:       'superadmin',
        assignedAt: serverTimestamp(),
        assignedBy: user.uid,
      });

      router.push(`/companies/${companyRef.id}`);
    } catch {
      setError('Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  if (loading || !user) return null;

  const lbl: React.CSSProperties = { color: 'var(--fg2)', fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '6px' };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link href={`/profile/${user.uid}`}
          className="inline-flex items-center gap-2 text-sm mb-6"
          style={{ color: 'var(--fg4)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to profile
        </Link>

        <div className="card">
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--fg1)' }}>Create a Company Page</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--fg4)' }}>
            You will be the Super Admin of this page. No one can remove you.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* logo */}
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => logoRef.current?.click()}
                className="w-20 h-20 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden relative group"
                style={{ background: logoPreview ? 'transparent' : 'var(--sur)', border: '2px dashed var(--fg5)' }}>
                {logoPreview
                  ? <img src={logoPreview} className="w-full h-full object-cover" alt="logo" />
                  : <svg className="w-7 h-7" style={{ color: 'var(--fg5)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>}
                {logoPreview && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-white text-xs font-medium">Change</span>
                  </div>
                )}
              </button>
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--fg2)' }}>Company logo</p>
                <p className="text-xs" style={{ color: 'var(--fg4)' }}>PNG or JPG, recommended 200×200px</p>
              </div>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            </div>

            {/* name */}
            <div>
              <label style={lbl}>Company name *</label>
              <input required value={form.name}
                onChange={e => { setForm({ ...form, name: e.target.value }); setDuplicate(null); }}
                onBlur={e => checkDuplicate(e.target.value)}
                placeholder="Acme Corporation" className="input-field" />
              {checking && <p className="text-xs mt-1.5" style={{ color: 'var(--fg4)' }}>Checking for existing pages…</p>}
              {duplicate && (
                <p className="text-xs mt-1.5" style={{ color: '#fca5a5' }}>
                  A page for this company already exists.{' '}
                  <Link href={`/companies/${duplicate.id}`} className="underline" style={{ color: '#ff4545' }}>
                    View {duplicate.name}
                  </Link>
                </p>
              )}
            </div>

            {/* industry + size */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label style={lbl}>Industry *</label>
                <select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} className="input-field">
                  {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Company size *</label>
                <select value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} className="input-field">
                  {SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                </select>
              </div>
            </div>

            {/* founded + location */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label style={lbl}>Founded year</label>
                <input value={form.founded} onChange={e => setForm({ ...form, founded: e.target.value })}
                  placeholder="2015" type="number" min="1800" max={new Date().getFullYear()} className="input-field" />
              </div>
              <div>
                <label style={lbl}>Headquarters *</label>
                <input required value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="Sydney, NSW" className="input-field" />
              </div>
            </div>

            {/* website */}
            <div>
              <label style={lbl}>Website</label>
              <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                placeholder="https://yourcompany.com" type="url" className="input-field" />
            </div>

            {/* description */}
            <div>
              <label style={lbl}>Company description *</label>
              <textarea required rows={5} value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Tell people about your company — what you do, your mission, your culture…"
                className="input-field resize-none" />
            </div>

            {error && (
              <p className="text-sm px-4 py-3 rounded-lg" style={{ background: 'rgba(220,38,38,0.15)', color: '#fca5a5' }}>
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving || !!duplicate || !form.name.trim()} className="btn-primary py-3 px-8">
                {saving ? 'Creating…' : 'Create company page'}
              </button>
              <Link href={`/profile/${user.uid}`} className="py-3 px-4 text-sm" style={{ color: 'var(--fg4)' }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
