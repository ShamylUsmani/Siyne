'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

interface Conv {
  id:          string;
  participants: string[];
  names:       Record<string, string>;
  lastMsg:     string;
  lastAt:      { seconds: number } | null;
  unread:      Record<string, number>;
}

function timeAgo(ms: number) {
  const d = Date.now() - ms, m = Math.floor(d / 60000);
  if (m < 1) return 'now'; if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [convs, setConvs] = useState<Conv[]>([]);

  useEffect(() => { if (!loading && !user) router.replace('/auth'); }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastAt', 'desc')
    );
    return onSnapshot(q, snap => {
      setConvs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Conv)));
    });
  }, [user]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--fg1)' }}>Messages</h1>
          <Link href="/connect" className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
            + New message
          </Link>
        </div>

        {convs.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--fg4)' }}>
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1">
              <Link href="/connect" className="hover:underline" style={{ color: '#ff4545' }}>Follow people</Link> to start a conversation.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {convs.map(c => {
              const otherUid  = c.participants.find(p => p !== user.uid) ?? '';
              const otherName = c.names?.[otherUid] ?? 'Unknown';
              const unread    = c.unread?.[user.uid] ?? 0;
              return (
                <Link key={c.id} href={`/messages/${c.id}`}
                  className="card flex items-center gap-4 hover:border-white/20 transition-colors block">
                  <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm"
                    style={{ background: 'linear-gradient(135deg,#b80000,#5c0000)', color: 'white' }}>
                    {otherName[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--fg1)' }}>{otherName}</p>
                      {c.lastAt && (
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--fg4)' }}>
                          {timeAgo(c.lastAt.seconds * 1000)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--fg3)' }}>
                      {c.lastMsg || 'No messages yet'}
                    </p>
                  </div>
                  {unread > 0 && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: '#e00000' }}>
                      {unread > 9 ? '9+' : unread}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
