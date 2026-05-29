'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  doc, getDoc, getDocs, collection, query, where,
  setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

/* ── role config — extend here to add more levels ──── */
const ROLES = [
  { value: 'admin',      label: 'Admin',       desc: 'Can edit page, post updates, manage jobs' },
  { value: 'superadmin', label: 'Super Admin',  desc: 'Full control. Cannot be removed.' },
] as const;

type Role = (typeof ROLES)[number]['value'];

interface AdminEntry {
  userId:    string;
  role:      Role;
  name:      string;
  email:     string;
  jobTitle:  string;
  assignedAt: { seconds: number } | null;
}

export default function ManagePage() {
  const { user, loading } = useAuth();
  const router  = useRouter();
  const params  = useParams();
  const cid     = params.companyId as string;

  const [company,    setCompany]    = useState<{ name: string } | null>(null);
  const [admins,     setAdmins]     = useState<AdminEntry[]>([]);
  const [myRole,     setMyRole]     = useState<Role | null>(null);
  const [fetching,   setFetching]   = useState(true);

  /* add admin */
  const [searchQ,    setSearchQ]    = useState('');
  const [searchRes,  setSearchRes]  = useState<{ uid: string; name: string; email: string; jobTitle: string }[]>([]);
  const [searching,  setSearching]  = useState(false);
  const [addBusy,    setAddBusy]    = useState<string | null>(null);

  const [removeBusy, setRemoveBusy] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) router.replace('/auth'); }, [user, loading, router]);

  useEffect(() => {
    if (!cid || !user) return;
    async function load() {
      /* check caller is admin */
      const myDoc = await getDoc(doc(db, 'companyAdmins', `${cid}_${user!.uid}`));
      if (!myDoc.exists()) { router.replace(`/companies/${cid}`); return; }
      setMyRole(myDoc.data().role as Role);

      /* fetch company name */
      const cDoc = await getDoc(doc(db, 'companies', cid));
      if (cDoc.exists()) setCompany({ name: cDoc.data().name });

      /* fetch all admins */
      const snap = await getDocs(query(collection(db, 'companyAdmins'), where('companyId', '==', cid)));
      const entries: AdminEntry[] = await Promise.all(
        snap.docs.map(async d => {
          const uDoc = await getDoc(doc(db, 'users', d.data().userId));
          return {
            userId:     d.data().userId,
            role:       d.data().role as Role,
            name:       uDoc.exists() ? uDoc.data()!.name    : 'Unknown',
            email:      uDoc.exists() ? uDoc.data()!.email   : '',
            jobTitle:   uDoc.exists() ? uDoc.data()!.jobTitle : '',
            assignedAt: d.data().assignedAt,
          };
        })
      );
      setAdmins(entries.sort((a, b) => (a.role === 'superadmin' ? -1 : 1)));
      setFetching(false);
    }
    load();
  }, [cid, user, router]);

  async function searchUsers() {
    if (!searchQ.trim()) return;
    setSearching(true);
    const q = searchQ.toLowerCase();
    const snap = await getDocs(collection(db, 'users'));
    const results = snap.docs
      .filter(d => {
        const name  = (d.data().name  ?? '').toLowerCase();
        const email = (d.data().email ?? '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .filter(d => !admins.find(a => a.userId === d.id))
      .map(d => ({ uid: d.id, name: d.data().name ?? '', email: d.data().email ?? '', jobTitle: d.data().jobTitle ?? '' }))
      .slice(0, 8);
    setSearchRes(results);
    setSearching(false);
  }

  async function addAdmin(uid: string) {
    setAddBusy(uid);
    try {
      await setDoc(doc(db, 'companyAdmins', `${cid}_${uid}`), {
        companyId: cid, userId: uid, role: 'admin',
        assignedAt: serverTimestamp(), assignedBy: user!.uid,
      });
      /* refresh */
      const uDoc = await getDoc(doc(db, 'users', uid));
      setAdmins(prev => [...prev, {
        userId: uid, role: 'admin',
        name:     uDoc.exists() ? uDoc.data()!.name    : 'Unknown',
        email:    uDoc.exists() ? uDoc.data()!.email   : '',
        jobTitle: uDoc.exists() ? uDoc.data()!.jobTitle : '',
        assignedAt: null,
      }]);
      setSearchRes(prev => prev.filter(r => r.uid !== uid));
    } catch {}
    setAddBusy(null);
  }

  async function removeAdmin(uid: string) {
    if (uid === user!.uid) return; // can't remove yourself
    setRemoveBusy(uid);
    try {
      await deleteDoc(doc(db, 'companyAdmins', `${cid}_${uid}`));
      setAdmins(prev => prev.filter(a => a.userId !== uid));
    } catch {}
    setRemoveBusy(null);
  }

  if (loading || !user || fetching) return null;

  const roleBadge = (role: Role) => (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={role === 'superadmin'
        ? { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }
        : { background: 'rgba(149,0,0,0.20)', color: '#ff8888', border: '1px solid rgba(149,0,0,0.30)' }}>
      {role === 'superadmin' ? 'Super Admin' : 'Admin'}
    </span>
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link href={`/companies/${cid}`} className="inline-flex items-center gap-2 text-sm mb-6"
          style={{ color: 'var(--fg4)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {company?.name ?? 'company page'}
        </Link>

        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--fg1)' }}>Manage Admins</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--fg4)' }}>
          {company?.name} · You are {myRole === 'superadmin' ? 'the Super Admin' : 'an Admin'}
        </p>

        {/* current admins */}
        <div className="card mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--fg4)' }}>
            Current admins · {admins.length}
          </h2>
          <div className="space-y-4">
            {admins.map(a => (
              <div key={a.userId} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#b80000,#5c0000)', color: 'white' }}>
                  {a.name[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--fg1)' }}>{a.name}</p>
                    {roleBadge(a.role)}
                    {a.userId === user.uid && (
                      <span className="text-[10px]" style={{ color: 'var(--fg4)' }}>(you)</span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--fg4)' }}>
                    {a.email}{a.jobTitle ? ` · ${a.jobTitle}` : ''}
                  </p>
                </div>
                {/* super admin can remove admins, admins cannot remove anyone */}
                {myRole === 'superadmin' && a.role !== 'superadmin' && a.userId !== user.uid && (
                  <button onClick={() => removeAdmin(a.userId)} disabled={removeBusy === a.userId}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
                    {removeBusy === a.userId ? '…' : 'Remove'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* add admin (super admin only) */}
        {myRole === 'superadmin' && (
          <div className="card">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--fg4)' }}>
              Add an admin
            </h2>
            <div className="flex gap-2 mb-4">
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchUsers(); } }}
                placeholder="Search by name or email…" className="input-field text-sm flex-1" />
              <button onClick={searchUsers} disabled={searching || !searchQ.trim()}
                className="btn-primary text-sm py-2 px-5">
                {searching ? '…' : 'Search'}
              </button>
            </div>

            {searchRes.length > 0 && (
              <div className="space-y-2">
                {searchRes.map(r => (
                  <div key={r.uid} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                    style={{ background: 'var(--sur)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'var(--fg5)', color: 'var(--fg2)' }}>
                      {r.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--fg1)' }}>{r.name}</p>
                      <p className="text-xs" style={{ color: 'var(--fg4)' }}>
                        {r.email}{r.jobTitle ? ` · ${r.jobTitle}` : ''}
                      </p>
                    </div>
                    <button onClick={() => addAdmin(r.uid)} disabled={addBusy === r.uid}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#b80000,#5c0000)', color: 'white' }}>
                      {addBusy === r.uid ? '…' : 'Add as admin'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchRes.length === 0 && searchQ && !searching && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--fg4)' }}>
                No matching users found.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
