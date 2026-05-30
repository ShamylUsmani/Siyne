'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import JobCard, { Job } from '@/components/JobCard';

/* ── types ──────────────────────────────────────────── */
interface AdzunaJob {
  id:           string;
  title:        string;
  company:      { display_name: string };
  location:     { display_name: string };
  salary_min?:  number;
  salary_max?:  number;
  created:      string;
  redirect_url: string;
  description:  string;
}

/* ── Australian location list for autocomplete ───────── */
const AU_LOCATIONS = [
  'Sydney', 'Sydney CBD', 'Sydney North Shore', 'Sydney Inner West',
  'Sydney Eastern Suburbs', 'Parramatta', 'Penrith', 'Blacktown',
  'Melbourne', 'Melbourne CBD', 'Melbourne Eastern Suburbs',
  'Melbourne South-East', 'Melbourne North', 'Melbourne West',
  'Geelong', 'Ballarat', 'Bendigo',
  'Brisbane', 'Brisbane CBD', 'Brisbane North', 'Brisbane South',
  'Gold Coast', 'Sunshine Coast', 'Toowoomba', 'Townsville', 'Cairns',
  'Rockhampton', 'Mackay', 'Bundaberg',
  'Perth', 'Perth CBD', 'Perth Northern Suburbs', 'Perth Southern Suburbs',
  'Fremantle', 'Mandurah', 'Geraldton', 'Bunbury',
  'Adelaide', 'Adelaide CBD', 'Adelaide Northern Suburbs', 'Adelaide Southern Suburbs',
  'Canberra', 'ACT',
  'Darwin', 'Alice Springs',
  'Hobart', 'Launceston', 'Devonport',
  'Newcastle', 'Wollongong', 'Central Coast NSW',
  'Coffs Harbour', 'Port Macquarie', 'Tamworth', 'Dubbo',
  'Orange NSW', 'Albury', 'Wagga Wagga', 'Bathurst',
  'New South Wales', 'Victoria', 'Queensland',
  'Western Australia', 'South Australia', 'Tasmania',
  'Northern Territory', 'Remote', 'Australia',
].sort();

/* ── salary presets ──────────────────────────────────── */
const SAL_PRESETS = [
  { label: 'Any',    min: '',      max: '' },
  { label: '$50k+',  min: '50000', max: '' },
  { label: '$80k+',  min: '80000', max: '' },
  { label: '$100k+', min: '100000',max: '' },
  { label: '$120k+', min: '120000',max: '' },
  { label: '$150k+', min: '150000',max: '' },
];

const DATE_OPTS = [
  { label: 'Any time', value: '' },
  { label: 'Today',    value: '1' },
  { label: '3 days',   value: '3' },
  { label: 'This week',value: '7' },
  { label: '2 weeks',  value: '14' },
  { label: 'Month',    value: '30' },
];

const TYPE_OPTS = [
  { label: 'Any type',   value: '' },
  { label: 'Full-time',  value: 'full_time' },
  { label: 'Part-time',  value: 'part_time' },
  { label: 'Contract',   value: 'contract' },
];

const SORT_OPTS = [
  { label: 'Relevance',   value: 'relevance' },
  { label: 'Most recent', value: 'date' },
  { label: 'Salary ↑',    value: 'salary' },
];

/* ── Siyne job form helpers ─────────────────────────── */
const JOB_TYPES    = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const ARRANGEMENTS = ['On-site', 'Hybrid', 'Remote'];
const EMPTY_FORM   = {
  title: '', company: '', location: '',
  type: 'Full-time', arrangement: 'On-site',
  salary: '', description: '', reason: '',
};

/* ── util ────────────────────────────────────────────── */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').trim();
}

function fmtSalary(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const f = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max && min !== max) return `${f(min)} – ${f(max)}`;
  if (min) return `From ${f(min)}`;
  if (max) return `Up to ${f(max)}`;
  return null;
}

function fmtDate(iso: string): string {
  const d = new Date(iso), days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)   return `${days}d ago`;
  if (days < 30)  return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── pill group ─────────────────────────────────────── */
function PillGroup({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg2)' }}>{label}</label>
      <div className="flex gap-2 flex-wrap">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className="text-sm px-4 py-1.5 rounded-lg font-medium transition-all"
            style={value === opt
              ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
              : { background: 'var(--sur)', border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── filter pill ─────────────────────────────────────── */
function FilterPill<T extends string>({
  options, value, onChange,
}: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
          style={value === o.value
            ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
            : { background: 'var(--sur)', border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── location autocomplete ───────────────────────────── */
function LocationInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState(value);
  const ref               = useRef<HTMLDivElement>(null);

  const suggestions = query.trim().length >= 1
    ? AU_LOCATIONS.filter(l => l.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function pick(loc: string) {
    setQuery(loc);
    onChange(loc);
    setOpen(false);
  }

  function handleChange(v: string) {
    setQuery(v);
    onChange(v);
    setOpen(true);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Enter' && suggestions.length > 0 && open) {
      e.preventDefault();
      pick(suggestions[0]);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10"
        style={{ color: 'var(--fg4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <input
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => query.length >= 1 && setOpen(true)}
        onKeyDown={handleKey}
        placeholder="City, suburb or state…"
        className="input-field pl-9 text-sm"
        autoComplete="off"
      />
      {value && (
        <button
          onClick={() => { setQuery(''); onChange(''); setOpen(false); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center"
          style={{ color: 'var(--fg4)' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl overflow-hidden"
          style={{ background: 'var(--drop-bg)', border: '1px solid var(--fg5)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
          {suggestions.map((s, i) => (
            <button key={s} onClick={() => pick(s)}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2"
              style={{ borderTop: i > 0 ? '1px solid var(--sur)' : 'none', color: 'var(--fg2)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--sur)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--fg4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {/* bold the matching part */}
              {highlightMatch(s, query)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-bold" style={{ color: 'var(--fg1)' }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

/* ── pagination ─────────────────────────────────────── */
function Pagination({ page, totalPages, onPage, loading }: {
  page: number; totalPages: number; onPage: (p: number) => void; loading: boolean;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  const btn = (label: React.ReactNode, p: number, disabled: boolean, active = false) => (
    <button key={String(p) + String(label)} onClick={() => !disabled && onPage(p)} disabled={disabled || loading}
      className="min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
      style={active
        ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
        : { background: 'var(--sur)', color: 'var(--fg3)', border: '1px solid var(--fg5)' }}>
      {label}
    </button>
  );

  return (
    <div className="flex items-center justify-center gap-1.5 mt-8 flex-wrap">
      {btn('←', page - 1, page === 1)}
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`dots-${i}`} className="px-1 text-sm" style={{ color: 'var(--fg4)' }}>…</span>
          : btn(p, p as number, false, p === page)
      )}
      {btn('→', page + 1, page >= totalPages)}
    </div>
  );
}

/* ── Adzuna job card ─────────────────────────────────── */
function AdzunaCard({ job }: { job: AdzunaJob }) {
  const salary  = fmtSalary(job.salary_min, job.salary_max);
  const preview = stripHtml(job.description).slice(0, 180);

  return (
    <div className="card" style={{ position: 'relative' }}>
      <div className="absolute top-4 right-4">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
          style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
          External
        </span>
      </div>

      <div className="pr-24 mb-3">
        <h3 className="font-semibold text-base leading-snug" style={{ color: 'var(--fg1)' }}>{job.title}</h3>
        <p className="text-sm mt-0.5" style={{ color: 'var(--fg3)' }}>{job.company.display_name}</p>
      </div>

      <div className="flex flex-wrap gap-3 text-xs mb-3" style={{ color: 'var(--fg3)' }}>
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {job.location.display_name}
        </span>
        {salary && (
          <span className="flex items-center gap-1 font-semibold" style={{ color: '#86efac' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            {salary}
          </span>
        )}
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {fmtDate(job.created)}
        </span>
      </div>

      {preview && (
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--fg3)' }}>
          {preview}{job.description.length > 180 ? '…' : ''}
        </p>
      )}

      <a href={job.redirect_url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-lg transition-all"
        style={{ background: 'var(--sur)', color: 'var(--fg2)', border: '1px solid var(--fg5)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#B01E36,#4A0818)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'transparent'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--sur)'; e.currentTarget.style.color = 'var(--fg2)'; e.currentTarget.style.borderColor = 'var(--fg5)'; }}>
        Apply / View Job ↗
      </a>
    </div>
  );
}

/* ── skeleton ────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="card animate-pulse">
          <div className="h-4 rounded mb-2" style={{ background: 'var(--fg5)', width: '55%' }} />
          <div className="h-3 rounded mb-4" style={{ background: 'var(--sur)', width: '35%' }} />
          <div className="h-3 rounded mb-1.5" style={{ background: 'var(--sur)', width: '80%' }} />
          <div className="h-3 rounded mb-4" style={{ background: 'var(--sur)', width: '65%' }} />
          <div className="h-8 rounded w-32" style={{ background: 'var(--sur)' }} />
        </div>
      ))}
    </div>
  );
}

/* ── Australian jobs panel ──────────────────────────── */
function AustralianJobs() {
  /* search */
  const [keyword,  setKeyword]  = useState('');
  const [location, setLocation] = useState('');

  /* filters */
  const [sortBy,   setSortBy]   = useState('relevance');
  const [dateFilter,setDateFilter]=useState('');
  const [jobType,  setJobType]  = useState('');
  const [salPreset,setSalPreset]=useState(0);        // index into SAL_PRESETS
  const [filtersOpen,setFiltersOpen]=useState(false);

  /* results */
  const [jobs,    setJobs]    = useState<AdzunaJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [count,   setCount]   = useState<number | null>(null);
  const [page,    setPage]    = useState(1);
  const PER_PAGE = 20;
  const totalPages = count ? Math.ceil(count / PER_PAGE) : 0;

  const fetchJobs = useCallback(async (
    kw: string, loc: string, pg: number,
    sort: string, days: string, type: string, salIdx: number,
  ) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (kw.trim())  params.set('what', kw.trim());
      if (loc.trim()) params.set('where', loc.trim());
      params.set('page', String(pg));
      if (sort)  params.set('sort_by', sort);
      if (days)  params.set('max_days_old', days);
      if (type)  params.set('job_type', type);
      const sal = SAL_PRESETS[salIdx];
      if (sal.min) params.set('salary_min', sal.min);
      if (sal.max) params.set('salary_max', sal.max);

      const res  = await fetch(`/api/adzuna?${params}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJobs(data.results ?? []);
      setCount(data.count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load jobs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  /* initial load */
  useEffect(() => {
    fetchJobs('', '', 1, 'relevance', '', '', 0);
  }, [fetchJobs]);

  function search(pg = 1) {
    setPage(pg);
    fetchJobs(keyword, location, pg, sortBy, dateFilter, jobType, salPreset);
  }

  function handleSearch(e: React.FormEvent) { e.preventDefault(); search(1); }

  /* when a filter changes, reset to page 1 and re-fetch */
  function changeFilter<T>(setter: (v: T) => void, val: T, fetchFn: () => void) {
    setter(val);
    // We must wait for state to settle, so we pass the value directly
    fetchFn();
  }

  /* active filter count for badge */
  const activeFilters = [
    sortBy !== 'relevance', dateFilter !== '', jobType !== '', salPreset !== 0,
  ].filter(Boolean).length;

  return (
    <div>
      {/* ── compact search bar — no labels, tight padding ── */}
      <form onSubmit={handleSearch} className="rounded-xl mb-3"
        style={{
          background: 'var(--card-bg)', border: '1px solid var(--fg5)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          padding: '10px 12px', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        }}>
        <div className="flex flex-col sm:flex-row gap-2">
          {/* keyword */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--fg4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={keyword} onChange={e => setKeyword(e.target.value)}
              placeholder="Job title, skills, company…" className="input-field pl-9 text-sm" />
          </div>

          {/* vertical divider — desktop only */}
          <div className="hidden sm:block w-px self-stretch rounded-full" style={{ background: 'var(--fg5)' }} />

          {/* location autocomplete */}
          <div className="flex-1">
            <LocationInput value={location} onChange={setLocation} />
          </div>

          <button type="submit" disabled={loading}
            className="btn-primary text-sm px-6 flex-shrink-0 flex items-center gap-2">
            {loading
              ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>Searching…</>
              : 'Search'}
          </button>
        </div>
      </form>

      {/* ── filter toggle + result count in one row ── */}
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => setFiltersOpen(v => !v)}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'var(--sur)', border: '1px solid var(--fg5)', color: 'var(--fg2)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filters
            {activeFilters > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#B01E36', color: 'white' }}>{activeFilters}</span>
            )}
            <svg className={`w-3 h-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {activeFilters > 0 && (
            <button onClick={() => {
              setSortBy('relevance'); setDateFilter(''); setJobType(''); setSalPreset(0); setPage(1);
              fetchJobs(keyword, location, 1, 'relevance', '', '', 0);
            }}
              className="text-xs font-medium" style={{ color: '#D63A52' }}>
              Clear filters
            </button>
          )}
        </div>

        {/* result count + page — right side */}
        {count !== null && !loading && !error && (
          <p className="text-sm" style={{ color: 'var(--fg4)' }}>
            <span style={{ color: 'var(--fg2)', fontWeight: 600 }}>{count.toLocaleString()}</span> jobs
            {location && <> in <span style={{ color: 'var(--fg2)', fontWeight: 600 }}>{location}</span></>}
            {keyword  && <> · &ldquo;{keyword}&rdquo;</>}
            {totalPages > 1 && <span style={{ color: 'var(--fg5)' }}> · p.{page}/{totalPages}</span>}
          </p>
        )}
      </div>

      {/* ── filter dropdown (when open) ── */}
      {filtersOpen && (
        <div className="card mb-3 space-y-4" style={{ padding: '14px 16px' }}>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--fg4)' }}>Sort by</p>
              <FilterPill options={SORT_OPTS} value={sortBy}
                onChange={v => { setSortBy(v); setPage(1); fetchJobs(keyword, location, 1, v, dateFilter, jobType, salPreset); }} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--fg4)' }}>Date posted</p>
              <FilterPill options={DATE_OPTS} value={dateFilter}
                onChange={v => { setDateFilter(v); setPage(1); fetchJobs(keyword, location, 1, sortBy, v, jobType, salPreset); }} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--fg4)' }}>Job type</p>
              <FilterPill options={TYPE_OPTS} value={jobType}
                onChange={v => { setJobType(v); setPage(1); fetchJobs(keyword, location, 1, sortBy, dateFilter, v, salPreset); }} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--fg4)' }}>Minimum salary</p>
              <div className="flex gap-1.5 flex-wrap">
                {SAL_PRESETS.map((s, i) => (
                  <button key={s.label} onClick={() => { setSalPreset(i); setPage(1); fetchJobs(keyword, location, 1, sortBy, dateFilter, jobType, i); }}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                    style={salPreset === i
                      ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
                      : { background: 'var(--sur)', border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── states ── */}
      {loading && <Skeleton />}

      {!loading && error && (
        <div className="text-center py-16">
          <p className="text-sm mb-3" style={{ color: 'var(--fg4)' }}>{error}</p>
          <button onClick={() => search(page)}
            className="text-xs px-4 py-2 rounded-lg transition-colors"
            style={{ border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && jobs.length === 0 && count !== null && (
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: 'var(--fg4)' }}>No jobs found. Try adjusting your search or filters.</p>
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <>
          <div className="space-y-4">
            {jobs.map(job => <AdzunaCard key={job.id} job={job} />)}
          </div>

          {/* ── pagination ── */}
          <Pagination page={page} totalPages={Math.min(totalPages, 50)} loading={loading}
            onPage={p => { setPage(p); fetchJobs(keyword, location, p, sortBy, dateFilter, jobType, salPreset); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />

          <p className="text-center text-xs mt-4" style={{ color: 'var(--fg5)' }}>
            Powered by Adzuna · {count?.toLocaleString()} total results
          </p>
        </>
      )}
    </div>
  );
}

/* ── main jobs page ──────────────────────────────────── */
export default function JobsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [mainTab,  setMainTab]  = useState<'siyne' | 'aus'>('siyne');
  const [jobs,     setJobs]     = useState<Job[]>([]);
  const [filter,   setFilter]   = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { if (!loading && !user) router.replace('/auth'); }, [user, loading, router]);

  useEffect(() => {
    const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Job))));
  }, []);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'jobs'), { ...form, uid: user.uid, createdAt: serverTimestamp() });
      setForm(EMPTY_FORM);
      setShowForm(false);
    } finally { setSaving(false); }
  }

  const displayed = filter === 'All' ? jobs : jobs.filter(j => j.type === filter);
  const lbl: React.CSSProperties = {
    color: 'var(--fg3)', fontSize: '0.875rem', fontWeight: 500,
    display: 'block', marginBottom: '6px',
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--fg1)' }}>Jobs</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--fg4)' }}>Siyne verified listings and live Australian jobs</p>
          </div>
          {mainTab === 'siyne' && (
            <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm py-2 px-4">
              {showForm ? 'Cancel' : '+ Post a job'}
            </button>
          )}
        </div>

        {/* main tabs */}
        <div className="flex rounded-xl p-1 mb-6" style={{ background: 'var(--sur)' }}>
          {([['siyne', 'Siyne Jobs'], ['aus', 'All Australian Jobs']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setMainTab(key)}
              className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all"
              style={mainTab === key
                ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
                : { color: 'var(--fg3)' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── SIYNE JOBS ── */}
        {mainTab === 'siyne' && (
          <>
            {showForm && (
              <form onSubmit={handlePost} className="card mb-6 space-y-5">
                <h2 className="font-semibold text-base" style={{ color: 'var(--fg1)' }}>Post a Job</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label style={lbl}>Job title *</label>
                    <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                      placeholder="Senior Product Designer" className="input-field" /></div>
                  <div><label style={lbl}>Company *</label>
                    <input required value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
                      placeholder="Acme Inc." className="input-field" /></div>
                  <div className="sm:col-span-2"><label style={lbl}>Location *</label>
                    <input required value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                      placeholder="Sydney, NSW" className="input-field" /></div>
                </div>
                <PillGroup label="Job type"         options={JOB_TYPES}   value={form.type}        onChange={v => setForm({ ...form, type: v })} />
                <PillGroup label="Work arrangement" options={ARRANGEMENTS} value={form.arrangement} onChange={v => setForm({ ...form, arrangement: v })} />
                <div><label style={lbl}>Salary range *</label>
                  <input required value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })}
                    placeholder="$80,000 – $110,000" className="input-field" /></div>
                <div><label style={lbl}>Why is this role open? *</label>
                  <textarea required rows={2} value={form.reason}
                    onChange={e => setForm({ ...form, reason: e.target.value })}
                    placeholder="e.g. Team growth, replacing a departure…" className="input-field resize-none" /></div>
                <div><label style={lbl}>Role description *</label>
                  <textarea required rows={4} value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="What does this role involve?" className="input-field resize-none" /></div>
                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-5">
                    {saving ? 'Posting…' : 'Post job'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="text-sm py-2 px-3" style={{ color: 'var(--fg3)' }}>Cancel</button>
                </div>
              </form>
            )}

            <div className="flex gap-2 flex-wrap mb-6">
              {['All', ...JOB_TYPES].map(t => (
                <button key={t} onClick={() => setFilter(t)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full transition-all"
                  style={filter === t
                    ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
                    : { background: 'var(--fg5)', border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
                  {t}
                </button>
              ))}
            </div>

            {displayed.length === 0 ? (
              <div className="text-center py-20" style={{ color: 'var(--fg4)' }}>
                <p className="text-lg font-medium mb-1">No jobs here yet.</p>
                <p className="text-sm">Be the first to post an opportunity.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayed.map(job => <JobCard key={job.id} job={job} />)}
              </div>
            )}
          </>
        )}

        {/* ── AUSTRALIAN JOBS ── */}
        {mainTab === 'aus' && <AustralianJobs />}
      </main>
    </div>
  );
}
