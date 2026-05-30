'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  collection, getDocs, doc, getDoc,
  updateDoc, arrayUnion, arrayRemove, serverTimestamp, addDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

interface Person {
  uid:      string;
  name:     string;
  jobTitle: string;
  company:  string;
  photoURL?: string;
}

function SkeletonPerson() {
  return (
    <div className="card flex items-center gap-4">
      <div className="skeleton w-12 h-12 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton-text w-28" />
        <div className="skeleton-text w-40 h-3" />
      </div>
      <div className="skeleton w-16 h-8 rounded-lg flex-shrink-0" />
    </div>
  );
}

export default function ConnectPage() {
  const { user, loading } = useAuth();
  const router            = useRouter();

  const [people, setPeople]       = useState<Person[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [tab, setTab]             = useState<'discover' | 'following'>('discover');
  const [busy, setBusy]           = useState<string | null>(null);
  const [fetching, setFetching]   = useState(true);

  useEffect(() => { if (!loading && !user) router.replace('/auth'); }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [usersSnap, myDoc] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDoc(doc(db, 'users', user!.uid)),
      ]);
      const myFollowing: string[] = myDoc.data()?.following ?? [];
      setFollowing(myFollowing);
      setPeople(
        usersSnap.docs
          .filter(d => d.id !== user!.uid)
          .map(d => ({
            uid:      d.id,
            name:     d.data().name ?? '',
            jobTitle: d.data().jobTitle ?? '',
            company:  d.data().company ?? '',
            photoURL: d.data().photoURL,
          }))
      );
      setFetching(false);
    }
    load();
  }, [user]);

  async function toggleFollow(targetUid: string, targetName: string) {
    if (!user) return;
    setBusy(targetUid);
    const ref         = doc(db, 'users', user.uid);
    const isFollowing = following.includes(targetUid);
    try {
      if (isFollowing) {
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
        });
      }
    } catch {}
    setBusy(null);
  }

  const displayed = tab === 'discover'
    ? people.filter(p => !following.includes(p.uid))
    : people.filter(p =>  following.includes(p.uid));

  if (loading || !user) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">

        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--fg1)' }}>Connect</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--fg4)' }}>
          Follow people to see their posts in your Following feed.
        </p>

        {/* tab switcher */}
        <div className="flex rounded-xl p-1 mb-6" style={{ background: 'var(--sur)' }}>
          {(['discover', 'following'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all"
              style={tab === t
                ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
                : { color: 'var(--fg3)' }}>
              {t === 'discover' ? 'Discover' : `Following · ${following.length}`}
            </button>
          ))}
        </div>

        {fetching ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <SkeletonPerson key={i} />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="card text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="font-semibold mb-1" style={{ color: 'var(--fg2)' }}>No one to connect with yet</p>
            <p className="text-sm" style={{ color: 'var(--fg4)' }}>Check back soon as more people join Siyne.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(p => {
              const isF = following.includes(p.uid);
              return (
                <div key={p.uid} className="card flex items-center gap-4">
                  <Link href={`/profile/${p.uid}`}>
                    <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-base overflow-hidden"
                      style={{ background: p.photoURL ? 'transparent' : 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                      {p.photoURL
                        ? <img src={p.photoURL} className="w-full h-full object-cover" alt={p.name} />
                        : p.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${p.uid}`} className="font-semibold text-sm hover:underline"
                      style={{ color: 'var(--fg1)' }}>
                      {p.name || 'Unnamed User'}
                    </Link>
                    {(p.jobTitle || p.company) && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--fg3)' }}>
                        {p.jobTitle}{p.jobTitle && p.company ? ' · ' : ''}{p.company}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link href={`/messages/${[user.uid, p.uid].sort().join('_')}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:text-white hover:border-white/40"
                      style={{ border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </Link>
                    <button onClick={() => toggleFollow(p.uid, p.name)} disabled={busy === p.uid}
                      className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-all"
                      style={isF
                        ? { background: 'var(--sur)', color: 'var(--fg2)', border: '1px solid var(--fg5)' }
                        : { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                      {busy === p.uid ? '…' : isF ? 'Unfollow' : 'Follow'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
