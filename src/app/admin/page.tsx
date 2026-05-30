'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  collection, doc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

const ADMIN_EMAIL = 'usmani.shamyl@gmail.com';

type Tab = 'home' | 'reports' | 'job-reports' | 'users' | 'companies' | 'pitches';

/* ── types ──────────────────────────────────────────── */
interface Stats {
  totalUsers:       number;
  newUsersThisWeek: number;
  postsToday:       number;
  pendingReports:   number;
  totalCompanies:   number;
  totalJobs:        number;
}

interface ReportRow {
  postId:     string;
  content:    string;
  mediaUrl?:  string;
  authorName: string;
  authorUid:  string;
  count:      number;
  reasons:    string[];
  latestAt:   { seconds: number } | null;
}

interface PostComment {
  id:         string;
  authorName: string;
  text:       string;
  mediaUrl?:  string;
  createdAt:  { seconds: number } | null;
}

interface PostDetail {
  content:    string;
  mediaUrl?:  string;
  authorName: string;
  authorUid:  string;
  createdAt:  { seconds: number } | null;
  comments:   PostComment[];
}

interface UserRow {
  uid:            string;
  name:           string;
  email:          string;
  jobTitle:       string;
  createdAt:      { seconds: number } | null;
  banned:         boolean;
  suspended:      boolean;
  suspendedUntil: { seconds: number } | null;
  verified:       boolean;
}

interface CompanyRow {
  id:            string;
  name:          string;
  industry:      string;
  location:      string;
  logoUrl:       string;
  followerCount: number;
  verified:      boolean;
}

/* ── helpers ─────────────────────────────────────────── */
function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card text-center">
      <p className="text-3xl font-black mb-1" style={{ color: 'var(--fg1)' }}>{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--fg3)' }}>{label}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--fg4)' }}>{sub}</p>}
    </div>
  );
}

function Btn({ label, onClick, variant = 'default', busy, small }: {
  label: string; onClick: () => void;
  variant?: 'default' | 'danger' | 'warn' | 'amber';
  busy?: boolean; small?: boolean;
}) {
  const px = small ? 'px-2.5 py-1' : 'px-3 py-1.5';
  const styles: Record<string, React.CSSProperties> = {
    default: { background: 'var(--sur)',                color: 'var(--fg2)',  border: '1px solid var(--fg5)' },
    danger:  { background: 'rgba(220,38,38,0.15)',      color: '#f87171',     border: '1px solid rgba(220,38,38,0.25)' },
    warn:    { background: 'rgba(251,146,60,0.15)',     color: '#fb923c',     border: '1px solid rgba(251,146,60,0.25)' },
    amber:   { background: 'rgba(251,191,36,0.12)',     color: '#fbbf24',     border: '1px solid rgba(251,191,36,0.22)' },
  };
  return (
    <button onClick={onClick} disabled={busy}
      className={`text-xs ${px} rounded-lg font-medium transition-all disabled:opacity-50`}
      style={styles[variant]}>
      {busy ? '…' : label}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-center py-12 text-sm" style={{ color: 'var(--fg4)' }}>{text}</p>;
}

function Spinner() {
  return (
    <div className="p-8 text-center">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto"
        style={{ borderColor: 'var(--fg5)', borderTopColor: '#B01E36' }} />
    </div>
  );
}

function fmtDate(s: { seconds: number } | null) {
  if (!s) return '—';
  return new Date(s.seconds * 1000).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(s: { seconds: number } | null) {
  if (!s) return '';
  const m = Math.floor((Date.now() - s.seconds * 1000) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── suspend duration picker ─────────────────────────── */
function SuspendPicker({ onSuspend, busy }: { onSuspend: (days: number) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Btn label={busy ? '…' : 'Suspend ▾'} onClick={() => setOpen(v => !v)} variant="warn" busy={busy} />
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 rounded-xl overflow-hidden w-36"
          style={{ background: 'var(--drop-bg)', border: '1px solid var(--fg5)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
          {[
            { label: '3 days',  days: 3 },
            { label: '7 days',  days: 7 },
            { label: '30 days', days: 30 },
            { label: '90 days', days: 90 },
          ].map(({ label, days }) => (
            <button key={days} onClick={() => { setOpen(false); onSuspend(days); }}
              className="w-full text-left px-3 py-2 text-xs transition-colors"
              style={{ color: 'var(--fg2)', borderBottom: '1px solid var(--sur)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--sur)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── page ────────────────────────────────────────────── */
export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('home');

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) router.replace('/feed');
  }, [user, loading, router]);

  /* stats */
  const [stats,       setStats]      = useState<Stats | null>(null);
  const [statsLoading,setStatsL]     = useState(false);

  /* reports */
  const [reports,     setReports]    = useState<ReportRow[]>([]);
  const [rptLoading,  setRptLoading] = useState(false);
  const [busyPost,    setBusyPost]   = useState<string | null>(null);

  /* post detail modal */
  const [activeReport, setActiveReport] = useState<ReportRow | null>(null);
  const [postDetail,   setPostDetail]   = useState<PostDetail | null>(null);
  const [detailLoading,setDetailLoading]= useState(false);

  /* users */
  const [users,       setUsers]      = useState<UserRow[]>([]);
  const [userQ,       setUserQ]      = useState('');
  const [usrLoading,  setUsrLoading] = useState(false);
  const [busyUser,    setBusyUser]   = useState<string | null>(null);

  /* companies */
  const [companies,   setCompanies]  = useState<CompanyRow[]>([]);
  const [cmpLoading,  setCmpLoading] = useState(false);
  const [busyCmp,     setBusyCmp]    = useState<string | null>(null);

  /* pitches */
  interface AdminPitch {
    id: string; uid: string; companyName: string; founderName: string;
    status: string; featured: boolean; interestedCount: number; viewCount: number;
    createdAt: { seconds: number } | null;
  }
  interface AdminInvestorProfile {
    id: string; uid: string; name: string; type: string; verified: boolean;
  }
  const [adminPitches,    setAdminPitches]    = useState<AdminPitch[]>([]);
  const [pitchLoading,    setPitchLoading]    = useState(false);
  const [busyPitch,       setBusyPitch]       = useState<string | null>(null);
  const [pendingInvestors,setPendingInvestors]= useState<AdminInvestorProfile[]>([]);
  const [busyInv,         setBusyInv]         = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    if (tab === 'home')      loadStats();
    if (tab === 'reports')   loadReports();
    if (tab === 'users')     loadUsers();
    if (tab === 'companies') loadCompanies();
    if (tab === 'pitches')   loadPitches();
  }, [tab, user]);

  /* ── loaders ─────────────────────────────────────── */
  async function loadStats() {
    setStatsL(true);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekAgo    = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const [usersSnap, reportsSnap, postsSnap, companiesSnap, jobsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(query(collection(db, 'reports'), where('status', '==', 'pending'))),
      getDocs(query(collection(db, 'posts'), where('createdAt', '>=', Timestamp.fromDate(todayStart)))),
      getDocs(collection(db, 'companies')),
      getDocs(collection(db, 'jobs')),
    ]);
    const newThisWeek = usersSnap.docs.filter(d => {
      const ts = d.data().createdAt?.toDate?.();
      return ts && ts >= weekAgo;
    }).length;
    setStats({
      totalUsers: usersSnap.size, newUsersThisWeek: newThisWeek,
      postsToday: postsSnap.size, pendingReports: reportsSnap.size,
      totalCompanies: companiesSnap.size, totalJobs: jobsSnap.size,
    });
    setStatsL(false);
  }

  async function loadReports() {
    setRptLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'reports'), where('status', '==', 'pending')));
      if (snap.empty) { setReports([]); setRptLoading(false); return; }

      const allReports = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
      const uniqueIds  = Array.from(new Set(allReports.map(r => r.postId as string)));
      const postDocs   = await Promise.all(uniqueIds.map(pid => getDoc(doc(db, 'posts', pid)).catch(() => null)));

      const postMap: Record<string, { content: string; mediaUrl?: string; authorName: string; authorUid: string }> = {};
      uniqueIds.forEach((pid, i) => {
        const d = postDocs[i];
        if (d?.exists()) {
          postMap[pid] = {
            content:    d.data().content    ?? '',
            mediaUrl:   d.data().mediaUrl,
            authorName: d.data().authorName ?? 'Unknown',
            authorUid:  d.data().uid        ?? '',
          };
        }
      });

      const grouped: Record<string, ReportRow> = {};
      for (const r of allReports) {
        const postId = r.postId as string;
        if (!postMap[postId]) continue;
        if (!grouped[postId]) {
          grouped[postId] = {
            postId,
            content:    postMap[postId].content,
            mediaUrl:   postMap[postId].mediaUrl,
            authorName: postMap[postId].authorName,
            authorUid:  postMap[postId].authorUid,
            count: 0, reasons: [],
            latestAt: (r.createdAt as { seconds: number } | null) ?? null,
          };
        }
        grouped[postId].count++;
        if (r.reason) grouped[postId].reasons.push(r.reason as string);
      }
      setReports(Object.values(grouped).sort((a, b) => b.count - a.count));
    } catch (err) { console.error('loadReports:', err); }
    setRptLoading(false);
  }

  async function loadUsers() {
    setUsrLoading(true);
    const snap = await getDocs(collection(db, 'users'));
    setUsers(snap.docs.map(d => ({
      uid:            d.id,
      name:           d.data().name            ?? '',
      email:          d.data().email           ?? '',
      jobTitle:       d.data().jobTitle        ?? '',
      createdAt:      d.data().createdAt       ?? null,
      banned:         d.data().banned          ?? false,
      suspended:      d.data().suspended       ?? false,
      suspendedUntil: d.data().suspendedUntil  ?? null,
      verified:       d.data().verified        ?? false,
    })));
    setUsrLoading(false);
  }

  async function loadCompanies() {
    setCmpLoading(true);
    const snap = await getDocs(collection(db, 'companies'));
    setCompanies(snap.docs.map(d => ({
      id: d.id, name: d.data().name ?? '', industry: d.data().industry ?? '',
      location: d.data().location ?? '', logoUrl: d.data().logoUrl ?? '',
      followerCount: d.data().followerCount ?? 0, verified: d.data().verified ?? false,
    })));
    setCmpLoading(false);
  }

  async function loadPitches() {
    setPitchLoading(true);
    const [pitchSnap, invSnap] = await Promise.all([
      getDocs(query(collection(db, 'pitches'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'investorProfiles'), where('verified', '==', false))),
    ]);
    setAdminPitches(pitchSnap.docs.map(d => ({
      id: d.id, uid: d.data().uid ?? '',
      companyName: d.data().companyName ?? '', founderName: d.data().founderName ?? '',
      status: d.data().status ?? 'active', featured: d.data().featured ?? false,
      interestedCount: d.data().interestedCount ?? 0, viewCount: d.data().viewCount ?? 0,
      createdAt: d.data().createdAt ?? null,
    })));
    setPendingInvestors(invSnap.docs.map(d => ({
      id: d.id, uid: d.data().uid ?? '', name: d.data().name ?? '',
      type: d.data().type ?? '', verified: false,
    })));
    setPitchLoading(false);
  }

  async function toggleFeatured(id: string, val: boolean) {
    setBusyPitch(id + '_feat');
    await updateDoc(doc(db, 'pitches', id), { featured: val });
    setAdminPitches(prev => prev.map(p => p.id === id ? { ...p, featured: val } : p));
    setBusyPitch(null);
  }

  async function markFunded(id: string) {
    setBusyPitch(id + '_fund');
    await updateDoc(doc(db, 'pitches', id), { status: 'funded' });
    setAdminPitches(prev => prev.map(p => p.id === id ? { ...p, status: 'funded' } : p));
    setBusyPitch(null);
  }

  async function removePitch(id: string) {
    setBusyPitch(id + '_rm');
    await updateDoc(doc(db, 'pitches', id), { status: 'closed' });
    setAdminPitches(prev => prev.map(p => p.id === id ? { ...p, status: 'closed' } : p));
    setBusyPitch(null);
  }

  async function approveInvestor(id: string) {
    setBusyInv(id + '_app');
    await updateDoc(doc(db, 'investorProfiles', id), { verified: true });
    setPendingInvestors(prev => prev.filter(i => i.id !== id));
    setBusyInv(null);
  }

  async function rejectInvestor(id: string) {
    setBusyInv(id + '_rej');
    await deleteDoc(doc(db, 'investorProfiles', id));
    setPendingInvestors(prev => prev.filter(i => i.id !== id));
    setBusyInv(null);
  }

  /* load full post + comments for modal */
  async function openPostDetail(report: ReportRow) {
    setActiveReport(report);
    setPostDetail(null);
    setDetailLoading(true);
    try {
      const [postDoc, commentsSnap] = await Promise.all([
        getDoc(doc(db, 'posts', report.postId)),
        getDocs(query(collection(db, 'posts', report.postId, 'comments'), orderBy('createdAt', 'asc'))),
      ]);
      if (postDoc.exists()) {
        setPostDetail({
          content:    postDoc.data().content    ?? '',
          mediaUrl:   postDoc.data().mediaUrl,
          authorName: postDoc.data().authorName ?? 'Unknown',
          authorUid:  postDoc.data().uid        ?? '',
          createdAt:  postDoc.data().createdAt  ?? null,
          comments:   commentsSnap.docs.map(d => ({
            id:         d.id,
            authorName: d.data().authorName ?? 'Anonymous',
            text:       d.data().text       ?? '',
            mediaUrl:   d.data().mediaUrl,
            createdAt:  d.data().createdAt  ?? null,
          })),
        });
      } else {
        setPostDetail(null); // post was deleted
      }
    } catch (err) { console.error('openPostDetail:', err); }
    setDetailLoading(false);
  }

  /* ── actions ──────────────────────────────────────── */
  async function deletePost(postId: string) {
    setBusyPost(postId + '_del');
    try {
      await deleteDoc(doc(db, 'posts', postId));
      const rSnap = await getDocs(query(collection(db, 'reports'), where('postId', '==', postId)));
      await Promise.all(rSnap.docs.map(d => updateDoc(d.ref, { status: 'deleted' })));
      setReports(prev => prev.filter(r => r.postId !== postId));
      if (activeReport?.postId === postId) setActiveReport(null);
    } catch (err) { console.error('deletePost:', err); }
    setBusyPost(null);
  }

  async function dismissReport(postId: string) {
    setBusyPost(postId + '_dis');
    try {
      // Single-field query — no composite index needed; filter status client-side
      const rSnap = await getDocs(query(collection(db, 'reports'), where('postId', '==', postId)));
      await Promise.all(
        rSnap.docs.filter(d => d.data().status === 'pending')
                  .map(d => updateDoc(d.ref, { status: 'dismissed' }))
      );
      setReports(prev => prev.filter(r => r.postId !== postId));
      if (activeReport?.postId === postId) setActiveReport(null);
    } catch (err) { console.error('dismissReport:', err); }
    setBusyPost(null);
  }

  async function banUser(uid: string) {
    setBusyPost(uid + '_ban');
    try { await updateDoc(doc(db, 'users', uid), { banned: true, suspended: false, suspendedUntil: null }); }
    catch (err) { console.error('banUser:', err); }
    setBusyPost(null);
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, banned: true, suspended: false } : u));
  }

  async function suspendUser(uid: string, days: number) {
    setBusyPost(uid + '_sus');
    const until = new Date(); until.setDate(until.getDate() + days);
    try {
      await updateDoc(doc(db, 'users', uid), {
        suspended: true, suspendedUntil: Timestamp.fromDate(until), suspendedDays: days,
      });
    } catch (err) { console.error('suspendUser:', err); }
    setBusyPost(null);
    setUsers(prev => prev.map(u => u.uid === uid
      ? { ...u, suspended: true, suspendedUntil: { seconds: Math.floor(until.getTime() / 1000) } }
      : u));
  }

  async function toggleBanUser(uid: string, ban: boolean) {
    setBusyUser(uid);
    await updateDoc(doc(db, 'users', uid), ban
      ? { banned: true,  suspended: false, suspendedUntil: null }
      : { banned: false });
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, banned: ban } : u));
    setBusyUser(null);
  }

  async function toggleSuspendUser(uid: string, days: number) {
    setBusyUser(uid + '_sus');
    const until = new Date(); until.setDate(until.getDate() + days);
    await updateDoc(doc(db, 'users', uid), {
      suspended: true, suspendedUntil: Timestamp.fromDate(until), suspendedDays: days,
    });
    setUsers(prev => prev.map(u => u.uid === uid
      ? { ...u, suspended: true, suspendedUntil: { seconds: Math.floor(until.getTime() / 1000) } }
      : u));
    setBusyUser(null);
  }

  async function liftSuspension(uid: string) {
    setBusyUser(uid + '_sus');
    await updateDoc(doc(db, 'users', uid), { suspended: false, suspendedUntil: null });
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, suspended: false, suspendedUntil: null } : u));
    setBusyUser(null);
  }

  async function toggleVerifyUser(uid: string, verify: boolean) {
    setBusyUser(uid + '_v');
    await updateDoc(doc(db, 'users', uid), { verified: verify });
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, verified: verify } : u));
    setBusyUser(null);
  }

  async function toggleVerifyCompany(id: string, verify: boolean) {
    setBusyCmp(id + '_v');
    await updateDoc(doc(db, 'companies', id), { verified: verify });
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, verified: verify } : c));
    setBusyCmp(null);
  }

  async function removeCompany(id: string) {
    setBusyCmp(id + '_rm');
    await deleteDoc(doc(db, 'companies', id));
    setCompanies(prev => prev.filter(c => c.id !== id));
    setBusyCmp(null);
  }

  if (loading || !user) return null;
  if (user.email !== ADMIN_EMAIL) return null;

  const filteredUsers = users.filter(u => {
    const q = userQ.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: 'home',        label: 'Dashboard' },
    { key: 'reports',     label: 'Reported Posts', badge: stats?.pendingReports },
    { key: 'job-reports', label: 'Reported Jobs' },
    { key: 'users',       label: 'Users' },
    { key: 'companies',   label: 'Companies' },
    { key: 'pitches',     label: 'Pitches', badge: pendingInvestors.length || undefined },
  ];

  const THead = (...cols: string[]) => (
    <thead>
      <tr style={{ borderBottom: '1px solid var(--fg5)' }}>
        {cols.map(c => (
          <th key={c} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--fg4)' }}>{c}</th>
        ))}
      </tr>
    </thead>
  );

  /* ── render ───────────────────────────────────────── */
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* header */}
        <div className="mb-8">
          <div className="mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
              Admin
            </span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--fg1)' }}>Admin Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--fg4)' }}>Siyne platform management</p>
        </div>

        {/* tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-lg transition-all whitespace-nowrap"
              style={tab === t.key
                ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
                : { background: 'var(--sur)', color: 'var(--fg3)' }}>
              {t.label}
              {!!t.badge && (
                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: '#B01E36', color: 'white' }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══ DASHBOARD ══ */}
        {tab === 'home' && (
          statsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => <div key={i} className="card h-24 animate-pulse" style={{ background: 'var(--sur)' }} />)}
            </div>
          ) : stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard label="Total users"     value={stats.totalUsers} />
              <StatCard label="New this week"   value={stats.newUsersThisWeek} sub="users with createdAt set" />
              <StatCard label="Posts today"     value={stats.postsToday} />
              <StatCard label="Pending reports" value={stats.pendingReports} />
              <StatCard label="Company pages"   value={stats.totalCompanies} />
              <StatCard label="Job listings"    value={stats.totalJobs} />
            </div>
          )
        )}

        {/* ══ REPORTED POSTS ══ */}
        {tab === 'reports' && (
          <div className="card overflow-hidden p-0">
            {rptLoading ? <Spinner /> : reports.length === 0 ? <Empty text="No pending reports — all clear ✓" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  {THead('Post', 'Author', 'Reports', 'Date', 'Actions')}
                  <tbody>
                    {reports.map(r => (
                      <tr key={r.postId} style={{ borderBottom: '1px solid var(--sur)' }}>
                        {/* clickable post content */}
                        <td className="px-4 py-3 max-w-xs">
                          <button onClick={() => openPostDetail(r)} className="text-left w-full group">
                            <p className="text-sm line-clamp-2 group-hover:underline" style={{ color: 'var(--fg2)' }}>
                              {r.content || <em style={{ color: 'var(--fg4)' }}>No text content</em>}
                            </p>
                            {r.mediaUrl && (
                              <span className="text-xs mt-0.5 inline-block" style={{ color: 'var(--fg4)' }}>📎 Has media</span>
                            )}
                            <p className="text-xs mt-0.5" style={{ color: '#fb923c' }}>
                              {r.reasons.length > 0
                                ? Array.from(new Set(r.reasons)).slice(0, 2).join(' · ')
                                : 'No reason given'}
                            </p>
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link href={`/profile/${r.authorUid}`}
                            className="text-sm hover:underline" style={{ color: 'var(--fg2)' }}>
                            {r.authorName}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                            style={{
                              background: r.count >= 3 ? 'rgba(220,38,38,0.25)' : 'var(--fg5)',
                              color: r.count >= 3 ? '#f87171' : 'var(--fg2)',
                            }}>
                            {r.count}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--fg4)' }}>
                          {fmtDate(r.latestAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            <Btn label="View post"   onClick={() => openPostDetail(r)} />
                            <Btn label="Delete post" onClick={() => deletePost(r.postId)}      variant="danger" busy={busyPost === r.postId + '_del'} />
                            <Btn label="Dismiss"     onClick={() => dismissReport(r.postId)}   busy={busyPost === r.postId + '_dis'} />
                            <Btn label="Ban user"    onClick={() => banUser(r.authorUid)}       variant="danger" busy={busyPost === r.authorUid + '_ban'} />
                            <SuspendPicker onSuspend={d => suspendUser(r.authorUid, d)} busy={busyPost === r.authorUid + '_sus'} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ REPORTED JOBS (placeholder) ══ */}
        {tab === 'job-reports' && (
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--sur)' }}>
                <svg className="w-5 h-5" style={{ color: 'var(--fg4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--fg2)' }}>Job listing reports</p>
                <p className="text-xs" style={{ color: 'var(--fg4)' }}>No job reporting mechanism in the app yet</p>
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--fg4)' }}>
              Once users can report job listings, they will appear here with options to remove, dismiss, or verify.
            </p>
          </div>
        )}

        {/* ══ USER MANAGEMENT ══ */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: 'var(--fg4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={userQ} onChange={e => setUserQ(e.target.value)}
                placeholder="Search by name or email…" className="input-field pl-10 text-sm" />
            </div>

            <div className="card overflow-hidden p-0">
              {usrLoading ? <Spinner /> : filteredUsers.length === 0 ? (
                <Empty text={userQ ? `No users matching "${userQ}"` : 'No users found'} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    {THead('User', 'Email', 'Role / Title', 'Joined', 'Status', 'Actions')}
                    <tbody>
                      {filteredUsers.map(u => {
                        const statusBg   = u.banned ? 'rgba(220,38,38,0.20)' : u.suspended ? 'rgba(251,146,60,0.18)' : 'rgba(74,222,128,0.15)';
                        const statusClr  = u.banned ? '#f87171' : u.suspended ? '#fb923c' : '#4ade80';
                        const statusText = u.banned ? 'Banned' : u.suspended
                          ? `Suspended${u.suspendedUntil ? ` until ${fmtDate(u.suspendedUntil)}` : ''}`
                          : 'Active';
                        return (
                          <tr key={u.uid} style={{ borderBottom: '1px solid var(--sur)' }}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                                  style={{ background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                                  {u.name[0]?.toUpperCase() ?? '?'}
                                </div>
                                <p className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--fg1)' }}>
                                  {u.name || 'Unnamed'}
                                  {u.verified && (
                                    <svg className="w-3.5 h-3.5" style={{ color: '#60a5fa' }} fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg3)' }}>{u.email}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg3)' }}>{u.jobTitle || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--fg4)' }}>{fmtDate(u.createdAt)}</td>
                            <td className="px-4 py-3 min-w-[130px]">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ background: statusBg, color: statusClr }}>
                                {statusText}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5 flex-wrap">
                                <Link href={`/profile/${u.uid}`}>
                                  <Btn label="View" onClick={() => {}} />
                                </Link>
                                <Btn label={u.verified ? 'Unverify' : 'Verify ✓'}
                                  onClick={() => toggleVerifyUser(u.uid, !u.verified)}
                                  busy={busyUser === u.uid + '_v'} />
                                {u.suspended ? (
                                  <Btn label="Lift suspension"
                                    onClick={() => liftSuspension(u.uid)}
                                    busy={busyUser === u.uid + '_sus'} />
                                ) : (
                                  <SuspendPicker onSuspend={d => toggleSuspendUser(u.uid, d)} busy={busyUser === u.uid + '_sus'} />
                                )}
                                <Btn label={u.banned ? 'Unban' : 'Ban'}
                                  variant={u.banned ? 'default' : 'danger'}
                                  onClick={() => toggleBanUser(u.uid, !u.banned)}
                                  busy={busyUser === u.uid} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <p className="text-xs text-right" style={{ color: 'var(--fg4)' }}>
              {filteredUsers.length} of {users.length} users
            </p>
          </div>
        )}

        {/* ══ PITCHES ══ */}
        {tab === 'pitches' && (
          <div className="space-y-6">
            {/* pitch moderation */}
            <div>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--fg2)' }}>Pitch Moderation</h2>
              <div className="card overflow-hidden p-0">
                {pitchLoading ? <Spinner /> : adminPitches.length === 0 ? <Empty text="No pitches yet" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      {THead('Company', 'Founder', 'Status', 'Views', 'Interested', 'Actions')}
                      <tbody>
                        {adminPitches.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--sur)' }}>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium" style={{ color: 'var(--fg1)' }}>{p.companyName}</p>
                              {p.featured && (
                                <span className="text-[10px] font-bold" style={{ color: '#fbbf24' }}>★ Featured</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg3)' }}>{p.founderName}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{
                                  background: p.status === 'funded' ? 'rgba(16,185,129,0.15)'
                                    : p.status === 'closed' ? 'rgba(107,114,128,0.15)'
                                    : 'rgba(59,130,246,0.15)',
                                  color: p.status === 'funded' ? '#10b981'
                                    : p.status === 'closed' ? '#9ca3af'
                                    : '#60a5fa',
                                }}>
                                {p.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--fg3)' }}>{p.viewCount}</td>
                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--fg3)' }}>{p.interestedCount}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5 flex-wrap">
                                <Btn
                                  label={p.featured ? 'Unfeature' : '★ Feature'}
                                  variant="amber"
                                  onClick={() => toggleFeatured(p.id, !p.featured)}
                                  busy={busyPitch === p.id + '_feat'} />
                                {p.status === 'active' && (
                                  <Btn label="Mark Funded" variant="default"
                                    onClick={() => markFunded(p.id)}
                                    busy={busyPitch === p.id + '_fund'} />
                                )}
                                {p.status !== 'closed' && (
                                  <Btn label="Remove" variant="danger"
                                    onClick={() => removePitch(p.id)}
                                    busy={busyPitch === p.id + '_rm'} />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* investor approvals */}
            <div>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--fg2)' }}>
                Pending Investor Profiles
                {pendingInvestors.length > 0 && (
                  <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: '#B01E36', color: 'white' }}>
                    {pendingInvestors.length}
                  </span>
                )}
              </h2>
              <div className="card overflow-hidden p-0">
                {pitchLoading ? <Spinner /> : pendingInvestors.length === 0 ? (
                  <Empty text="No pending investor profiles — all clear ✓" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      {THead('Name', 'Type', 'Actions')}
                      <tbody>
                        {pendingInvestors.map(inv => (
                          <tr key={inv.id} style={{ borderBottom: '1px solid var(--sur)' }}>
                            <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--fg1)' }}>{inv.name}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg3)' }}>{inv.type}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5">
                                <Btn label="Approve ✓" variant="default"
                                  onClick={() => approveInvestor(inv.id)}
                                  busy={busyInv === inv.id + '_app'} />
                                <Btn label="Reject" variant="danger"
                                  onClick={() => rejectInvestor(inv.id)}
                                  busy={busyInv === inv.id + '_rej'} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ COMPANY MANAGEMENT ══ */}
        {tab === 'companies' && (
          <div className="card overflow-hidden p-0">
            {cmpLoading ? <Spinner /> : companies.length === 0 ? <Empty text="No company pages yet" /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  {THead('Company', 'Industry', 'Location', 'Followers', 'Status', 'Actions')}
                  <tbody>
                    {companies.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--sur)' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-sm overflow-hidden"
                              style={{ background: c.logoUrl ? 'transparent' : 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                              {c.logoUrl ? <img src={c.logoUrl} alt={c.name} className="w-full h-full object-cover" /> : c.name[0]?.toUpperCase() ?? '?'}
                            </div>
                            <p className="text-sm font-medium" style={{ color: 'var(--fg1)' }}>
                              {c.name}
                              {c.verified && (
                                <svg className="inline w-3.5 h-3.5 ml-1" style={{ color: '#60a5fa' }} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg3)' }}>{c.industry}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg3)' }}>{c.location || '—'}</td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--fg2)' }}>{c.followerCount.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {c.verified
                            ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>Verified ✓</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--sur)', color: 'var(--fg4)' }}>Unverified</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            <Link href={`/companies/${c.id}`}><Btn label="View" onClick={() => {}} /></Link>
                            <Btn label={c.verified ? 'Remove badge' : 'Verify ✓'}
                              onClick={() => toggleVerifyCompany(c.id, !c.verified)}
                              busy={busyCmp === c.id + '_v'} />
                            <Btn label="Remove page" variant="danger"
                              onClick={() => removeCompany(c.id)}
                              busy={busyCmp === c.id + '_rm'} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ══ POST DETAIL MODAL ══ */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setActiveReport(null); }}>
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background: 'var(--drop-bg)', border: '1px solid var(--fg5)', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>

            {/* modal header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--fg5)' }}>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold" style={{ color: 'var(--fg1)' }}>Reported Post</h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(220,38,38,0.20)', color: '#f87171' }}>
                  {activeReport.count} report{activeReport.count !== 1 ? 's' : ''}
                </span>
              </div>
              <button onClick={() => setActiveReport(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: 'var(--fg4)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sur)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* scrollable body */}
            <div className="overflow-y-auto flex-1">
              {detailLoading ? (
                <Spinner />
              ) : !postDetail ? (
                <div className="p-8 text-center">
                  <p className="text-sm" style={{ color: 'var(--fg4)' }}>This post no longer exists.</p>
                </div>
              ) : (
                <div>
                  {/* post */}
                  <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--fg5)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                        {postDetail.authorName[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <Link href={`/profile/${postDetail.authorUid}`}
                          className="text-sm font-semibold hover:underline" style={{ color: 'var(--fg1)' }}>
                          {postDetail.authorName}
                        </Link>
                        <p className="text-xs" style={{ color: 'var(--fg4)' }}>{timeAgo(postDetail.createdAt)}</p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-line mb-3" style={{ color: 'var(--fg2)' }}>
                      {postDetail.content}
                    </p>
                    {postDetail.mediaUrl && (
                      <div className="rounded-xl overflow-hidden mb-2">
                        <img src={postDetail.mediaUrl} alt="" className="w-full max-h-64 object-cover" />
                      </div>
                    )}
                  </div>

                  {/* report reasons */}
                  {activeReport.reasons.length > 0 && (
                    <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--fg5)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--fg4)' }}>
                        Report reasons ({activeReport.reasons.length})
                      </p>
                      <div className="space-y-1">
                        {Array.from(new Set(activeReport.reasons)).map((reason, i) => {
                          const count = activeReport.reasons.filter(r => r === reason).length;
                          return (
                            <div key={i} className="flex items-center justify-between">
                              <p className="text-sm" style={{ color: 'var(--fg2)' }}>{reason}</p>
                              {count > 1 && (
                                <span className="text-xs font-bold" style={{ color: '#fb923c' }}>×{count}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* comments */}
                  <div className="px-5 py-4">
                    <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--fg4)' }}>
                      Comments ({postDetail.comments.length})
                    </p>
                    {postDetail.comments.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--fg4)' }}>No comments on this post.</p>
                    ) : (
                      <div className="space-y-3">
                        {postDetail.comments.map(c => (
                          <div key={c.id} className="flex gap-2.5">
                            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                              style={{ background: 'var(--fg5)', color: 'var(--fg2)' }}>
                              {c.authorName[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 rounded-xl px-3 py-2" style={{ background: 'var(--sur)' }}>
                              <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--fg2)' }}>
                                {c.authorName}
                                <span className="font-normal ml-2" style={{ color: 'var(--fg4)' }}>{timeAgo(c.createdAt)}</span>
                              </p>
                              {c.text && <p className="text-xs leading-relaxed" style={{ color: 'var(--fg3)' }}>{c.text}</p>}
                              {c.mediaUrl && <img src={c.mediaUrl} alt="" className="mt-1.5 rounded-lg max-h-28 object-cover" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* modal action bar */}
            <div className="flex items-center gap-2 flex-wrap px-5 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid var(--fg5)' }}>
              <Btn label="Delete post"    variant="danger" busy={busyPost === activeReport.postId + '_del'}     onClick={() => deletePost(activeReport.postId)} />
              <Btn label="Dismiss all"    busy={busyPost === activeReport.postId + '_dis'}                      onClick={() => dismissReport(activeReport.postId)} />
              <Btn label="Ban user"       variant="danger" busy={busyPost === activeReport.authorUid + '_ban'}  onClick={() => banUser(activeReport.authorUid)} />
              <SuspendPicker onSuspend={d => suspendUser(activeReport.authorUid, d)} busy={busyPost === activeReport.authorUid + '_sus'} />
              <Link href={`/profile/${activeReport.authorUid}`} target="_blank">
                <Btn label="View profile" onClick={() => {}} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
