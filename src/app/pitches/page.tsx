'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  collection, query, where, orderBy, getDocs,
  doc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import PitchCard, { Pitch, INDUSTRY_COLORS } from '@/components/PitchCard';

/* ── types ──────────────────────────────────────────── */
type InvestorType = 'Angel' | 'VC' | 'Family Office' | 'Corporate' | 'Accelerator';

interface InvestorProfile {
  id: string;
  uid: string;
  name: string;
  type: InvestorType;
  industries: string[];
  stages: string[];
  minCheque: number;
  maxCheque: number;
  location: string;
  bio: string;
  portfolio?: string;
  verified: boolean;
}

/* ── constants ───────────────────────────────────────── */
const INDUSTRIES = ['Tech', 'Health', 'Finance', 'Education', 'Retail', 'Food', 'Property', 'Other'] as const;
const STAGES     = ['Pre-idea', 'Pre-seed', 'Seed', 'Series A', 'Series B'] as const;
const AU_STATES  = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'] as const;
const LOOKING    = ['Funding', 'Mentorship', 'Both'] as const;
const SORT_OPTS  = [
  { value: 'newest',     label: 'Newest' },
  { value: 'mostViewed', label: 'Most Viewed' },
  { value: 'mostInterested', label: 'Most Interested' },
] as const;
type SortOpt = typeof SORT_OPTS[number]['value'];

const INV_TYPES: InvestorType[] = ['Angel', 'VC', 'Family Office', 'Corporate', 'Accelerator'];

/* ── investor form default ────────────────────────────── */
const EMPTY_FORM = {
  type: 'Angel' as InvestorType,
  industries: [] as string[],
  stages: [] as string[],
  minCheque: 0,
  maxCheque: 0,
  location: '',
  bio: '',
  portfolio: '',
};

/* ── helpers ─────────────────────────────────────────── */
function fmtAUD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function ChipBtn({
  label, active, color, onClick,
}: {
  label: string; active: boolean; color?: string; onClick: () => void;
}) {
  const base = { borderRadius: '9999px', fontSize: '12px', fontWeight: 600, padding: '4px 12px', cursor: 'pointer', transition: 'all 0.15s', border: '1px solid', display: 'inline-block' };
  if (active && color) return <button style={{ ...base, background: `${color}22`, color, borderColor: `${color}55` }} onClick={onClick}>{label}</button>;
  if (active)         return <button style={{ ...base, background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white', borderColor: 'transparent' }} onClick={onClick}>{label}</button>;
  return <button style={{ ...base, background: 'var(--sur)', color: 'var(--fg3)', borderColor: 'var(--fg5)' }} onClick={onClick}>{label}</button>;
}

/* ── main page ───────────────────────────────────────── */
export default function PitchesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'browse' | 'investors'>('browse');

  /* pitch filters */
  const [pitches,      setPitches]      = useState<Pitch[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [searchQ,      setSearchQ]      = useState('');
  const [filterIndustries, setFilterIndustries] = useState<string[]>([]);
  const [filterStages,     setFilterStages]     = useState<string[]>([]);
  const [filterLocation,   setFilterLocation]   = useState('');
  const [filterLooking,    setFilterLooking]     = useState('');
  const [minFunding,   setMinFunding]   = useState('');
  const [maxFunding,   setMaxFunding]   = useState('');
  const [sortBy,       setSortBy]       = useState<SortOpt>('newest');

  /* investor tab */
  const [investors,    setInvestors]    = useState<InvestorProfile[]>([]);
  const [invLoading,   setInvLoading]   = useState(false);
  const [showInvForm,  setShowInvForm]  = useState(false);
  const [invForm,      setInvForm]      = useState({ ...EMPTY_FORM });
  const [invSaving,    setInvSaving]    = useState(false);

  /* load pitches */
  useEffect(() => {
    async function load() {
      setLoading(true);
      const snap = await getDocs(
        query(collection(db, 'pitches'), orderBy('createdAt', 'desc'))
      );
      setPitches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pitch)));
      setLoading(false);
    }
    load();
  }, []);

  /* load investors */
  useEffect(() => {
    if (activeTab !== 'investors') return;
    async function load() {
      setInvLoading(true);
      const snap = await getDocs(
        query(collection(db, 'investorProfiles'), where('verified', '==', true))
      );
      setInvestors(snap.docs.map(d => ({ id: d.id, ...d.data() } as InvestorProfile)));
      setInvLoading(false);
    }
    load();
  }, [activeTab]);

  /* load existing investor profile */
  useEffect(() => {
    if (!user || !showInvForm) return;
    (async () => {
      const snap = await getDocs(query(collection(db, 'investorProfiles'), where('uid', '==', user.uid)));
      if (!snap.empty) {
        const d = snap.docs[0].data();
        setInvForm({
          type:       d.type        ?? 'Angel',
          industries: d.industries  ?? [],
          stages:     d.stages      ?? [],
          minCheque:  d.minCheque   ?? 0,
          maxCheque:  d.maxCheque   ?? 0,
          location:   d.location    ?? '',
          bio:        d.bio         ?? '',
          portfolio:  d.portfolio   ?? '',
        });
      }
    })();
  }, [user, showInvForm]);

  /* save investor profile */
  async function saveInvestorProfile() {
    if (!user) return;
    setInvSaving(true);
    await setDoc(doc(db, 'investorProfiles', user.uid), {
      uid:       user.uid,
      name:      user.displayName ?? '',
      verified:  false,
      createdAt: serverTimestamp(),
      ...invForm,
    }, { merge: true });
    setInvSaving(false);
    setShowInvForm(false);
  }

  /* filtering + sorting */
  const displayed = pitches
    .filter(p => {
      if (p.status === 'closed') return false;
      const q = searchQ.trim().toLowerCase();
      if (q && !p.companyName.toLowerCase().includes(q) && !p.oneLiner.toLowerCase().includes(q) && !p.problem.toLowerCase().includes(q)) return false;
      if (filterIndustries.length && !filterIndustries.includes(p.industry)) return false;
      if (filterStages.length     && !filterStages.includes(p.stage))         return false;
      if (filterLocation          && p.location !== filterLocation)            return false;
      if (filterLooking           && p.lookingFor !== filterLooking)           return false;
      if (minFunding && p.fundingAmount < Number(minFunding)) return false;
      if (maxFunding && p.fundingAmount > Number(maxFunding)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'mostViewed')     return (b.viewCount ?? 0) - (a.viewCount ?? 0);
      if (sortBy === 'mostInterested') return (b.interestedCount ?? 0) - (a.interestedCount ?? 0);
      return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
    });

  function toggleChip<T extends string>(arr: T[], val: T, set: (v: T[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  const hasFilters = filterIndustries.length || filterStages.length || filterLocation || filterLooking || minFunding || maxFunding;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* page header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--fg1)' }}>Pitches</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--fg4)' }}>
              Startup funding marketplace for founders and investors
            </p>
          </div>
          {user && (
            <Link href="/pitches/new" className="btn-primary text-sm py-2 px-5 whitespace-nowrap">
              + Submit Your Pitch
            </Link>
          )}
        </div>

        {/* tabs */}
        <div className="flex gap-1 mb-6">
          {(['browse', 'investors'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className="text-sm font-semibold px-5 py-2 rounded-lg transition-all"
              style={activeTab === t
                ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
                : { background: 'var(--sur)', color: 'var(--fg3)' }}>
              {t === 'browse' ? 'Browse Pitches' : 'Investor Network'}
            </button>
          ))}
        </div>

        {/* ══ BROWSE TAB ══ */}
        {activeTab === 'browse' && (
          <div>
            {/* search + sort bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: 'var(--fg4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search company, one-liner, problem…"
                  className="input-field pl-10 text-sm"
                />
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOpt)}
                className="input-field select text-sm sm:w-44">
                {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* filter chips */}
            <div className="card mb-6 p-4 space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--fg4)' }}>Industry</p>
                <div className="flex flex-wrap gap-1.5">
                  {INDUSTRIES.map(ind => (
                    <ChipBtn key={ind} label={ind} active={filterIndustries.includes(ind)}
                      color={INDUSTRY_COLORS[ind]}
                      onClick={() => toggleChip(filterIndustries, ind, setFilterIndustries)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--fg4)' }}>Stage</p>
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.map(s => (
                    <ChipBtn key={s} label={s} active={filterStages.includes(s)}
                      onClick={() => toggleChip(filterStages, s, setFilterStages)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--fg4)' }}>Looking For</p>
                <div className="flex flex-wrap gap-1.5">
                  {LOOKING.map(l => (
                    <ChipBtn key={l} label={l} active={filterLooking === l}
                      onClick={() => setFilterLooking(filterLooking === l ? '' : l)} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--fg4)' }}>Location</p>
                  <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)}
                    className="input-field select text-sm">
                    <option value="">All states</option>
                    {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--fg4)' }}>Funding Range (AUD)</p>
                  <div className="flex items-center gap-2">
                    <input type="number" value={minFunding} onChange={e => setMinFunding(e.target.value)}
                      placeholder="Min" className="input-field text-sm flex-1" />
                    <span style={{ color: 'var(--fg4)' }}>–</span>
                    <input type="number" value={maxFunding} onChange={e => setMaxFunding(e.target.value)}
                      placeholder="Max" className="input-field text-sm flex-1" />
                  </div>
                </div>
              </div>
              {!!hasFilters && (
                <button
                  onClick={() => {
                    setFilterIndustries([]); setFilterStages([]); setFilterLocation('');
                    setFilterLooking(''); setMinFunding(''); setMaxFunding('');
                  }}
                  className="text-xs font-medium"
                  style={{ color: '#B01E36' }}>
                  Clear all filters
                </button>
              )}
            </div>

            {/* grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="card h-52 animate-pulse" style={{ background: 'var(--sur)' }} />
                ))}
              </div>
            ) : displayed.length === 0 ? (
              <div className="card text-center py-16">
                <p className="text-4xl mb-3">🚀</p>
                <p className="text-base font-semibold mb-1" style={{ color: 'var(--fg2)' }}>No pitches found</p>
                <p className="text-sm mb-5" style={{ color: 'var(--fg4)' }}>
                  {hasFilters || searchQ ? 'Try adjusting your filters.' : 'Be the first to submit a pitch!'}
                </p>
                {user && (
                  <Link href="/pitches/new" className="btn-primary text-sm py-2 px-5">
                    Submit Your Pitch
                  </Link>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs mb-3" style={{ color: 'var(--fg4)' }}>{displayed.length} pitch{displayed.length !== 1 ? 'es' : ''}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayed.map(p => <PitchCard key={p.id} pitch={p} />)}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ INVESTOR NETWORK TAB ══ */}
        {activeTab === 'investors' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm" style={{ color: 'var(--fg4)' }}>Verified investors active on Siyne</p>
              {user && (
                <button onClick={() => setShowInvForm(v => !v)} className="btn-outline text-sm py-2 px-4">
                  {showInvForm ? 'Cancel' : 'Become an Investor'}
                </button>
              )}
            </div>

            {/* investor profile form */}
            {showInvForm && (
              <div className="card mb-6">
                <h2 className="text-base font-bold mb-4" style={{ color: 'var(--fg1)' }}>Investor Profile</h2>
                <p className="text-xs mb-4" style={{ color: 'var(--fg4)' }}>
                  Submit your profile for admin approval. Once verified you will appear in the investor network.
                </p>
                <div className="space-y-4">
                  {/* type */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--fg4)' }}>Investor Type</label>
                    <div className="flex flex-wrap gap-2">
                      {INV_TYPES.map(t => (
                        <ChipBtn key={t} label={t} active={invForm.type === t}
                          onClick={() => setInvForm(f => ({ ...f, type: t }))} />
                      ))}
                    </div>
                  </div>
                  {/* industries */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--fg4)' }}>Industries of Interest</label>
                    <div className="flex flex-wrap gap-2">
                      {INDUSTRIES.map(ind => (
                        <ChipBtn key={ind} label={ind} active={invForm.industries.includes(ind)}
                          color={INDUSTRY_COLORS[ind]}
                          onClick={() => setInvForm(f => ({
                            ...f,
                            industries: f.industries.includes(ind)
                              ? f.industries.filter(x => x !== ind)
                              : [...f.industries, ind],
                          }))} />
                      ))}
                    </div>
                  </div>
                  {/* stages */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--fg4)' }}>Investment Stages</label>
                    <div className="flex flex-wrap gap-2">
                      {STAGES.map(s => (
                        <ChipBtn key={s} label={s} active={invForm.stages.includes(s)}
                          onClick={() => setInvForm(f => ({
                            ...f,
                            stages: f.stages.includes(s)
                              ? f.stages.filter(x => x !== s)
                              : [...f.stages, s],
                          }))} />
                      ))}
                    </div>
                  </div>
                  {/* cheque range */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--fg4)' }}>Min Cheque (AUD)</label>
                      <input type="number" value={invForm.minCheque || ''} onChange={e => setInvForm(f => ({ ...f, minCheque: Number(e.target.value) }))}
                        className="input-field text-sm" placeholder="e.g. 25000" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--fg4)' }}>Max Cheque (AUD)</label>
                      <input type="number" value={invForm.maxCheque || ''} onChange={e => setInvForm(f => ({ ...f, maxCheque: Number(e.target.value) }))}
                        className="input-field text-sm" placeholder="e.g. 500000" />
                    </div>
                  </div>
                  {/* location */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--fg4)' }}>Location</label>
                    <select value={invForm.location} onChange={e => setInvForm(f => ({ ...f, location: e.target.value }))}
                      className="input-field select text-sm">
                      <option value="">Select state</option>
                      {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {/* bio */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--fg4)' }}>Bio</label>
                    <textarea value={invForm.bio} onChange={e => setInvForm(f => ({ ...f, bio: e.target.value }))}
                      className="input-field text-sm resize-none" rows={4}
                      placeholder="Tell founders about your investment background…" />
                  </div>
                  {/* portfolio */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--fg4)' }}>Portfolio URL (optional)</label>
                    <input type="url" value={invForm.portfolio} onChange={e => setInvForm(f => ({ ...f, portfolio: e.target.value }))}
                      className="input-field text-sm" placeholder="https://…" />
                  </div>
                  <button onClick={saveInvestorProfile} disabled={invSaving || !invForm.bio.trim()}
                    className="btn-primary text-sm py-2 px-6">
                    {invSaving ? 'Saving…' : 'Submit for Approval'}
                  </button>
                </div>
              </div>
            )}

            {/* investor list */}
            {invLoading ? (
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => <div key={i} className="card h-32 animate-pulse" style={{ background: 'var(--sur)' }} />)}
              </div>
            ) : investors.length === 0 ? (
              <div className="card text-center py-16">
                <p className="text-4xl mb-3">💼</p>
                <p className="text-base font-semibold mb-1" style={{ color: 'var(--fg2)' }}>No verified investors yet</p>
                <p className="text-sm" style={{ color: 'var(--fg4)' }}>Be the first to join the investor network.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {investors.map(inv => (
                  <div key={inv.id} className="card">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-lg font-bold"
                        style={{ background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                        {inv.name[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-base" style={{ color: 'var(--fg1)' }}>{inv.name}</p>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(176,30,54,0.15)', color: '#B01E36', border: '1px solid rgba(176,30,54,0.25)' }}>
                            {inv.type}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--sur)', color: 'var(--fg3)' }}>
                            🇦🇺 {inv.location}
                          </span>
                        </div>
                        <p className="text-sm mb-2 leading-relaxed" style={{ color: 'var(--fg3)' }}>{inv.bio}</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {inv.industries.map(ind => (
                            <span key={ind} className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: `${INDUSTRY_COLORS[ind] ?? '#6b7280'}22`, color: INDUSTRY_COLORS[ind] ?? '#6b7280' }}>
                              {ind}
                            </span>
                          ))}
                          {inv.stages.map(s => (
                            <span key={s} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--sur)', color: 'var(--fg4)' }}>{s}</span>
                          ))}
                        </div>
                        <p className="text-xs" style={{ color: 'var(--fg4)' }}>
                          Typical cheque: {fmtAUD(inv.minCheque)} – {fmtAUD(inv.maxCheque)} AUD
                          {inv.portfolio && (
                            <>
                              {' · '}
                              <a href={inv.portfolio} target="_blank" rel="noopener noreferrer"
                                className="hover:underline" style={{ color: '#3b82f6' }}>
                                Portfolio
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
