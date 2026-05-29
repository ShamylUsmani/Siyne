'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  collection, query, where, onSnapshot,
  getDocs, doc, setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import ConvPanel from '@/components/ConvPanel';

interface Conv {
  id:           string;
  participants: string[];
  names:        Record<string, string>;
  photos?:      Record<string, string>;
  lastMsg:      string;
  lastAt:       { seconds: number } | null;
  unread:       Record<string, number>;
}

function timeAgo(ms: number) {
  const d = Date.now() - ms, m = Math.floor(d / 60000);
  if (m < 1) return 'now'; if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/* silently migrate one conversation's old subcollection messages into the
   conversation document's msgs array — runs once per user via localStorage flag */
async function migrateConv(convDoc: { id: string; data: () => Record<string, unknown> }) {
  const convId = convDoc.id;
  try {
    const msgsSnap = await getDocs(collection(db, 'conversations', convId, 'messages'));
    if (msgsSnap.empty) return;

    const converted = msgsSnap.docs.map(d => {
      const data = d.data();
      const rawAt = data.at as { seconds?: number } | null;
      const at = rawAt?.seconds ? rawAt.seconds * 1000 : Date.now();
      return { id: d.id, from: (data.from as string) ?? '', text: (data.text as string) ?? '', at };
    });

    const existing = ((convDoc.data().msgs ?? []) as { id: string }[]);
    const existingIds = new Set(existing.map(m => m.id));
    const newOnly = converted.filter(m => !existingIds.has(m.id));
    if (newOnly.length === 0) return;

    type AnyMsg = { id: string; at?: number };
    const merged = ([...existing, ...newOnly] as AnyMsg[]).sort(
      (a, b) => (a.at ?? 0) - (b.at ?? 0),
    );
    await setDoc(doc(db, 'conversations', convId), { msgs: merged }, { merge: true });
  } catch {
    /* subcollection unreadable (rules not yet updated) — skip silently */
  }
}

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) router.replace('/auth'); }, [user, loading, router]);

  /* load conversation list — no orderBy to avoid composite index requirement, sort client-side */
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
    );
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Conv));
      list.sort((a, b) => (b.lastAt?.seconds ?? 0) - (a.lastAt?.seconds ?? 0));
      setConvs(list);
    });
  }, [user]);

  /* one-time silent migration of old subcollection messages for this user */
  useEffect(() => {
    if (!user) return;
    const flag = `siyne_migrated_${user.uid}`;
    if (localStorage.getItem(flag)) return;

    async function autoMigrate() {
      try {
        const snap = await getDocs(query(
          collection(db, 'conversations'),
          where('participants', 'array-contains', user!.uid),
        ));
        await Promise.allSettled(
          snap.docs.map(d => migrateConv({ id: d.id, data: () => d.data() as Record<string, unknown> })),
        );
        localStorage.setItem(flag, '1');
      } catch {
        /* will retry on next visit */
      }
    }

    autoMigrate();
  }, [user]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
        {/* Left list panel — hidden on mobile when conv selected */}
        <div
          className={`${selectedConvId ? 'hidden md:flex' : 'flex'} md:w-80 lg:w-96 flex-col flex-shrink-0 overflow-y-auto`}
          style={{ borderRight: '1px solid var(--fg5)' }}
        >
          {/* header */}
          <div className="px-4 py-4 flex items-center justify-between flex-shrink-0"
            style={{ borderBottom: '1px solid var(--fg5)' }}>
            <h1 className="text-lg font-bold" style={{ color: 'var(--fg1)' }}>Messages</h1>
            <Link href="/connect" className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
              + New message
            </Link>
          </div>

          {/* conversation list */}
          {convs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 px-4" style={{ color: 'var(--fg4)' }}>
              <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">No messages yet.</p>
              <p className="text-xs mt-1 text-center">
                <Link href="/connect" className="hover:underline" style={{ color: '#D63A52' }}>Follow people</Link> to start a conversation.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {convs.map(c => {
                const otherUid   = c.participants.find(p => p !== user.uid) ?? '';
                const otherName  = c.names?.[otherUid] ?? 'Unknown';
                const otherPhoto = c.photos?.[otherUid] ?? '';
                const unread     = c.unread?.[user.uid] ?? 0;
                const isActive   = selectedConvId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConvId(c.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left"
                    style={{
                      borderBottom: '1px solid var(--sur)',
                      background: isActive ? 'var(--sur)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--sur)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* avatar */}
                    <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm overflow-hidden"
                      style={{ background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                      {otherPhoto
                        ? <img src={otherPhoto} alt={otherName} className="w-full h-full object-cover" />
                        : otherName[0]?.toUpperCase() ?? '?'}
                    </div>

                    {/* name — left fixed column */}
                    <div className="w-28 flex-shrink-0 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--fg1)' }}>
                        {otherName}
                      </p>
                      {c.lastAt && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--fg4)' }}>
                          {timeAgo(c.lastAt.seconds * 1000)}
                        </p>
                      )}
                    </div>

                    {/* message preview — right fills remaining space */}
                    <p className="flex-1 text-sm truncate min-w-0"
                      style={{ color: unread > 0 ? 'var(--fg2)' : 'var(--fg4)', fontWeight: unread > 0 ? 500 : 400 }}>
                      {c.lastMsg || 'No messages yet'}
                    </p>

                    {/* unread badge */}
                    {unread > 0 && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ background: '#B01E36' }}>
                        {unread > 9 ? '9+' : unread}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        {selectedConvId ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <ConvPanel convId={selectedConvId} embedded onBack={() => setSelectedConvId(null)} />
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center flex-col gap-3">
            <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--fg4)' }}>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
