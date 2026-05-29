'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  collection, getDocs, doc, getDoc, setDoc, deleteDoc,
  updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp,
  query, where, increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import CompanyCard, { CompanySummary } from '@/components/CompanyCard';

type FilterTab = 'all' | 'people' | 'companies' | 'pages';
type CompanyFollowMap = Record<string, boolean>;

interface UserResult {
  uid:      string;
  name:     string;
  jobTitle: string;
  company:  string;
  bio:      string;
  photoURL?: string;
}

function SearchResults() {
  const { user, loading } = useAuth();
  const router            = useRouter();
  const params            = useSearchParams();
  const initialQ          = params.get('q') ?? '';

  const [q, setQ]               = useState(initialQ);
  const [allUsers, setAllUsers] = useState<UserResult[]>([]);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [compFollowing, setCompFollowing] = useState<CompanyFollowMap>({});
  const [tab, setTab]           = useState<FilterTab>('all');
  const [busy, setBusy]         = useState<string | null>(null);
  const [compBusy, setCompBusy] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) router.replace('/auth'); }, [user, loading, router]);

  useEffect(() => {
    setQ(params.get('q') ?? '');
  }, [params]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getDocs(collection(db, 'users')),
      getDoc(doc(db, 'users', user.uid)),
      getDocs(collection(db, 'companies')),
      getDocs(query(collection(db, 'companyFollowers'), where('userId', '==', user.uid))),
    ]).then(([usersSnap, myDoc, compSnap, followSnap]) => {
      setAllUsers(
        usersSnap.docs.filter(d => d.id !== user.uid).map(d => ({
          uid: d.id, name: d.data().name ?? '', jobTitle: d.data().jobTitle ?? '',
          company: d.data().company ?? '', bio: d.data().bio ?? '', photoURL: d.data().photoURL,
        }))
      );
      setFollowing(myDoc.data()?.following ?? []);
      setCompanies(compSnap.docs.map(d => ({
        id: d.id, name: d.data().name ?? '', industry: d.data().industry ?? '',
        location: d.data().location ?? '', logoUrl: d.data().logoUrl ?? '',
        followerCount: d.data().followerCount ?? 0, verified: d.data().verified ?? false,
      })));
      const fm: CompanyFollowMap = {};
      followSnap.docs.forEach(d => { fm[d.data().companyId] = true; });
      setCompFollowing(fm);
    });
  }, [user]);

  async function toggleFollow(targetUid: string) {
    if (!user) return;
    setBusy(targetUid);
    const ref = doc(db, 'users', user.uid);
    const isF = following.includes(targetUid);
    try {
      if (isF) {
        await updateDoc(ref, { following: arrayRemove(targetUid) });
        setFollowing(f => f.filter(id => id !== targetUid));
      } else {
        await updateDoc(ref, { following: arrayUnion(targetUid) });
        setFollowing(f => [...f, targetUid]);
        await addDoc(collection(db, 'notifications', targetUid, 'items'), {
          type: 'follow', fromUid: user.uid,
          fromName: user.displayName ?? 'Someone',
          text: 'started following you',
          read: false, createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    } catch {}
    setBusy(null);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  async function toggleCompanyFollow(companyId: string) {
    if (!user) return;
    setCompBusy(companyId);
    const fid = `${companyId}_${user.uid}`;
    const isF = !!compFollowing[companyId];
    try {
      if (isF) {
        await deleteDoc(doc(db, 'companyFollowers', fid));
        await updateDoc(doc(db, 'companies', companyId), { followerCount: increment(-1) });
        setCompFollowing(m => { const n = { ...m }; delete n[companyId]; return n; });
      } else {
        await setDoc(doc(db, 'companyFollowers', fid), { companyId, userId: user.uid, followedAt: serverTimestamp() });
        await updateDoc(doc(db, 'companies', companyId), { followerCount: increment(1) });
        setCompFollowing(m => ({ ...m, [companyId]: true }));
      }
    } catch {}
    setCompBusy(null);
  }

  const lc = q.toLowerCase().trim();

  const filtered = allUsers.filter(u => {
    if (tab === 'companies' || tab === 'pages') return false;
    if (!lc) return tab === 'people';
    const matchName    = u.name.toLowerCase().includes(lc);
    const matchJob     = u.jobTitle.toLowerCase().includes(lc);
    const matchCompany = u.company.toLowerCase().includes(lc);
    const matchBio     = u.bio.toLowerCase().includes(lc);
    if (tab === 'people') return matchName || matchJob;
    return matchName || matchJob || matchCompany || matchBio;
  });

  const filteredCompanies = companies.filter(c => {
    if (tab === 'people') return false;
    if (!lc) return tab === 'companies' || tab === 'pages';
    return c.name.toLowerCase().includes(lc) || c.industry.toLowerCase().includes(lc) || c.location.toLowerCase().includes(lc);
  });

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'people',    label: 'People' },
    { key: 'companies', label: 'Companies' },
    { key: 'pages',     label: 'Pages' },
  ];

  if (loading || !user) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* search input */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--fg4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={q} onChange={e => setQ(e.target.value)} autoFocus
              placeholder="Search by name, job title, or company…"
              className="input-field pl-11 text-sm" />
          </div>
        </form>

        {/* filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={tab === t.key
                ? { background: 'linear-gradient(135deg,#b80000,#5c0000)', color: 'white' }
                : { background: 'var(--sur)', color: 'var(--fg3)', border: '1px solid var(--fg5)' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* result count */}
        {lc && (
          <p className="text-xs mb-4" style={{ color: 'var(--fg4)' }}>
            {filtered.length + filteredCompanies.length} result{filtered.length + filteredCompanies.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
          </p>
        )}

        {/* results */}
        {filtered.length === 0 && filteredCompanies.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--fg4)' }}>
            <p className="text-sm">{lc ? `No results for "${q}"` : 'Start typing to search.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* people results */}
            {filtered.map(u => (
              <div key={u.uid} className="card flex items-center gap-4">
                <Link href={`/profile/${u.uid}`} className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base overflow-hidden"
                    style={{ background: u.photoURL ? 'transparent' : 'linear-gradient(135deg,#b80000,#5c0000)', color: 'white' }}>
                    {u.photoURL
                      ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                      : u.name[0]?.toUpperCase() ?? '?'}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${u.uid}`} className="font-semibold text-sm hover:underline"
                    style={{ color: 'var(--fg1)' }}>
                    {u.name || 'Unnamed'}
                  </Link>
                  {(u.jobTitle || u.company) && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--fg3)' }}>
                      {u.jobTitle}{u.jobTitle && u.company ? ' · ' : ''}{u.company}
                    </p>
                  )}
                  {u.bio && (
                    <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--fg4)' }}>{u.bio}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link href={`/messages/${[user.uid, u.uid].sort().join('_')}`}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                    style={{ border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </Link>
                  <button onClick={() => toggleFollow(u.uid)} disabled={busy === u.uid}
                    className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-all"
                    style={following.includes(u.uid)
                      ? { background: 'var(--fg5)', color: 'var(--fg2)', border: '1px solid var(--fg5)' }
                      : { background: 'linear-gradient(135deg,#b80000,#5c0000)', color: 'white' }}>
                    {busy === u.uid ? '…' : following.includes(u.uid) ? 'Following' : 'Follow'}
                  </button>
                </div>
              </div>
            ))}

            {/* company page results */}
            {filteredCompanies.length > 0 && (
              <>
                {filtered.length > 0 && (
                  <p className="text-xs pt-2 pb-1" style={{ color: 'var(--fg5)' }}>Company pages</p>
                )}
                {filteredCompanies.map(c => (
                  <CompanyCard
                    key={c.id}
                    company={c}
                    followed={!!compFollowing[c.id]}
                    onFollow={() => toggleCompanyFollow(c.id)}
                    busy={compBusy === c.id}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return <Suspense><SearchResults /></Suspense>;
}
