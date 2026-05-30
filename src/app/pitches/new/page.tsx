'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

/* ── constants ───────────────────────────────────────── */
const INDUSTRIES = ['Tech', 'Health', 'Finance', 'Education', 'Retail', 'Food', 'Property', 'Other'] as const;
const STAGES     = ['Just an Idea', 'Building', 'Launching', 'Growing', 'Scaling'] as const;
const AU_STATES  = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'] as const;
const LOOKING_FOR = ['Funding', 'Mentorship', 'Both'] as const;
type LookingFor = typeof LOOKING_FOR[number];

/* ── form state ──────────────────────────────────────── */
interface FormState {
  companyName:   string;
  oneLiner:      string;
  industry:      string;
  stage:         string;
  location:      string;
  teamSize:      string;
  problem:       string;
  solution:      string;
  targetMarket:  string;
  businessModel: string;
  traction:      string;
  fundingAmount: string;
  equity:        string;
  lookingFor:    LookingFor;
  website:       string;
  pitchDeckUrl:  string;
}

const EMPTY: FormState = {
  companyName:   '',
  oneLiner:      '',
  industry:      '',
  stage:         '',
  location:      '',
  teamSize:      '',
  problem:       '',
  solution:      '',
  targetMarket:  '',
  businessModel: '',
  traction:      '',
  fundingAmount: '',
  equity:        '',
  lookingFor:    'Funding',
  website:       '',
  pitchDeckUrl:  '',
};

/* ── helper components ───────────────────────────────── */
function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--fg4)' }}>{children}</label>;
}

function CharCounter({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span className="text-xs ml-2" style={{ color: over ? '#f87171' : 'var(--fg4)' }}>
      {value.length}/{max}
    </span>
  );
}

/* ── page ────────────────────────────────────────────── */
export default function NewPitchPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm]   = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  /* guard — redirect if not logged in */
  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [loading, user, router]);

  function set(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    /* validation */
    if (!form.companyName.trim()) { setError('Company name is required.'); return; }
    if (!form.oneLiner.trim())    { setError('One-liner is required.'); return; }
    if (!form.industry)           { setError('Industry is required.'); return; }
    if (!form.stage)              { setError('Stage is required.'); return; }
    if (!form.problem.trim())     { setError('Problem description is required.'); return; }
    if (!form.solution.trim())    { setError('Solution description is required.'); return; }
    if (!form.location)           { setError('Location is required.'); return; }
    if (form.oneLiner.length > 100)  { setError('One-liner must be 100 characters or fewer.'); return; }
    if (form.problem.length > 300)   { setError('Problem must be 300 characters or fewer.'); return; }
    if (form.solution.length > 300)  { setError('Solution must be 300 characters or fewer.'); return; }

    setError('');
    setSaving(true);

    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const uData = userSnap.data();

      await addDoc(collection(db, 'pitches'), {
        uid:            user.uid,
        founderName:    user.displayName ?? uData?.name ?? 'Founder',
        founderPhotoURL: uData?.photoURL ?? user.photoURL ?? '',
        companyName:    form.companyName.trim(),
        oneLiner:       form.oneLiner.trim(),
        problem:        form.problem.trim(),
        solution:       form.solution.trim(),
        targetMarket:   form.targetMarket.trim(),
        businessModel:  form.businessModel.trim(),
        traction:       form.traction.trim(),
        fundingAmount:  Number(form.fundingAmount) || 0,
        equity:         Number(form.equity) || 0,
        stage:          form.stage,
        industry:       form.industry,
        location:       form.location,
        teamSize:       Number(form.teamSize) || 1,
        website:        form.website.trim(),
        pitchDeckUrl:   form.pitchDeckUrl.trim(),
        lookingFor:     form.lookingFor,
        status:         'active',
        featured:       false,
        viewCount:      0,
        interestedCount: 0,
        savedCount:     0,
        createdAt:      serverTimestamp(),
        updatedAt:      serverTimestamp(),
      });

      router.replace('/pitches?success=1');
    } catch (err: unknown) {
      console.error('Pitch submit failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
        setError('Permission denied. Add this to your Firestore rules:\n  match /pitches/{id} { allow read, write: if request.auth != null; }');
      } else {
        setError(`Failed: ${msg}`);
      }
    }
    setSaving(false);
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--fg1)' }}>Submit Your Pitch</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg4)' }}>
            Tell investors about your startup. All fields marked * are required.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Company Name ── */}
          <div className="card">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--fg2)' }}>Company Details</h2>
            <div className="space-y-4">
              <div>
                <Label>Company Name *</Label>
                <input value={form.companyName} onChange={e => set('companyName', e.target.value)}
                  className="input-field text-sm" placeholder="e.g. Canva, Atlassian…" required />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>One-liner *</Label>
                  <CharCounter value={form.oneLiner} max={100} />
                </div>
                <input value={form.oneLiner} onChange={e => set('oneLiner', e.target.value)}
                  className="input-field text-sm"
                  placeholder="Describe your startup in one sentence…"
                  maxLength={120} required />
              </div>

              {/* industry + stage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Industry *</Label>
                  <select value={form.industry} onChange={e => set('industry', e.target.value)}
                    className="input-field select text-sm" required>
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Stage *</Label>
                  <select value={form.stage} onChange={e => set('stage', e.target.value)}
                    className="input-field select text-sm" required>
                    <option value="">Select stage</option>
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* location + team size */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Location *</Label>
                  <select value={form.location} onChange={e => set('location', e.target.value)}
                    className="input-field select text-sm" required>
                    <option value="">Select state</option>
                    {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Team Size</Label>
                  <input type="number" value={form.teamSize} onChange={e => set('teamSize', e.target.value)}
                    min={1} className="input-field text-sm" placeholder="e.g. 3" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Problem + Solution ── */}
          <div className="card">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--fg2)' }}>Problem & Solution</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Problem *</Label>
                  <CharCounter value={form.problem} max={300} />
                </div>
                <textarea value={form.problem} onChange={e => set('problem', e.target.value)}
                  className="input-field text-sm resize-none"
                  placeholder="What problem are you solving? Who has this problem?"
                  rows={4} maxLength={320} required />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Solution *</Label>
                  <CharCounter value={form.solution} max={300} />
                </div>
                <textarea value={form.solution} onChange={e => set('solution', e.target.value)}
                  className="input-field text-sm resize-none"
                  placeholder="How does your product/service solve it?"
                  rows={4} maxLength={320} required />
              </div>
              <div>
                <Label>Target Market</Label>
                <textarea value={form.targetMarket} onChange={e => set('targetMarket', e.target.value)}
                  className="input-field text-sm resize-none"
                  placeholder="Who are your target customers? Market size?"
                  rows={3} />
              </div>
            </div>
          </div>

          {/* ── Business Model + Traction ── */}
          <div className="card">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--fg2)' }}>Business Model & Traction</h2>
            <div className="space-y-4">
              <div>
                <Label>Business Model</Label>
                <textarea value={form.businessModel} onChange={e => set('businessModel', e.target.value)}
                  className="input-field text-sm resize-none"
                  placeholder="How do you make money? Revenue model, pricing…"
                  rows={3} />
              </div>
              <div>
                <Label>Current Traction</Label>
                <textarea value={form.traction} onChange={e => set('traction', e.target.value)}
                  className="input-field text-sm resize-none"
                  placeholder="Users, revenue, partnerships, growth metrics…"
                  rows={3} />
              </div>
            </div>
          </div>

          {/* ── Funding details ── */}
          <div className="card">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--fg2)' }}>Funding Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Funding Amount (AUD)</Label>
                  <input type="number" value={form.fundingAmount} onChange={e => set('fundingAmount', e.target.value)}
                    min={0} className="input-field text-sm" placeholder="e.g. 500000" />
                </div>
                <div>
                  <Label>Equity Offered (%)</Label>
                  <input type="number" value={form.equity} onChange={e => set('equity', e.target.value)}
                    min={0} max={100} step={0.1} className="input-field text-sm" placeholder="e.g. 10" />
                </div>
              </div>

              {/* looking for */}
              <div>
                <Label>Looking For</Label>
                <div className="grid grid-cols-3 gap-3 mt-1">
                  {LOOKING_FOR.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => set('lookingFor', opt)}
                      className="py-3 px-4 rounded-xl text-sm font-semibold transition-all"
                      style={form.lookingFor === opt
                        ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white', border: '1px solid transparent' }
                        : { background: 'var(--sur)', color: 'var(--fg3)', border: '1px solid var(--fg5)' }}>
                      {opt === 'Funding' && '💰 '}
                      {opt === 'Mentorship' && '🧠 '}
                      {opt === 'Both' && '🤝 '}
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Links ── */}
          <div className="card">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--fg2)' }}>Links (optional)</h2>
            <div className="space-y-4">
              <div>
                <Label>Website URL</Label>
                <input type="url" value={form.website} onChange={e => set('website', e.target.value)}
                  className="input-field text-sm" placeholder="https://yourcompany.com" />
              </div>
              <div>
                <Label>Pitch Deck URL</Label>
                <input type="url" value={form.pitchDeckUrl} onChange={e => set('pitchDeckUrl', e.target.value)}
                  className="input-field text-sm" placeholder="https://docsend.com/…" />
              </div>
            </div>
          </div>

          {/* error */}
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)' }}>
              {error}
            </div>
          )}

          {/* submit */}
          <div className="flex gap-3 pb-8">
            <button type="submit" disabled={saving} className="btn-primary text-sm py-2.5 px-8">
              {saving ? 'Publishing…' : 'Publish Pitch'}
            </button>
            <button type="button" onClick={() => router.back()} className="btn-outline text-sm py-2.5 px-6">
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
