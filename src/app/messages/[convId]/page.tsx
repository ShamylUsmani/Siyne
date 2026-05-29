'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  doc, getDoc, onSnapshot, setDoc, updateDoc,
  increment, serverTimestamp, arrayUnion, addDoc, collection,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

interface Msg {
  id:   string;
  from: string;
  text: string;
  at:   number;
}

interface OtherUser {
  name:     string;
  jobTitle: string;
  photoURL?: string;
  uid:      string;
}

export default function ConvPage() {
  const { user, loading } = useAuth();
  const router   = useRouter();
  const params   = useParams();
  const convId   = params.convId as string;

  const [msgs, setMsgs]               = useState<Msg[]>([]);
  const [text, setText]               = useState('');
  const [sending, setSending]         = useState(false);
  const [other, setOther]             = useState<OtherUser | null>(null);
  const [msgsLoading, setMsgsLoading] = useState(true);
  const [msgsError, setMsgsError]     = useState('');
  const bottomRef                     = useRef<HTMLDivElement>(null);
  const inputRef                      = useRef<HTMLInputElement>(null);

  const otherUid = convId.split('_').find(id => id !== user?.uid) ?? '';

  useEffect(() => { if (!loading && !user) router.replace('/auth'); }, [user, loading, router]);

  /* fetch other user's profile */
  useEffect(() => {
    if (!otherUid) return;
    getDoc(doc(db, 'users', otherUid)).then(snap => {
      if (snap.exists()) {
        setOther({
          uid: otherUid,
          name: snap.data().name ?? '',
          jobTitle: snap.data().jobTitle ?? '',
          photoURL: snap.data().photoURL,
        });
      }
    }).catch(() => {});
  }, [otherUid]);

  /* listen on the conversation document — messages stored in docs as array, no subcollection needed */
  useEffect(() => {
    if (!convId) return;
    setMsgsLoading(true);
    setMsgsError('');
    return onSnapshot(
      doc(db, 'conversations', convId),
      snap => {
        const raw = (snap.data()?.msgs ?? []) as Msg[];
        setMsgs([...raw].sort((a, b) => (a.at ?? 0) - (b.at ?? 0)));
        setMsgsLoading(false);
      },
      err => {
        console.error('Conversation failed to load:', err);
        setMsgsError('Could not load messages. Check your internet connection.');
        setMsgsLoading(false);
      }
    );
  }, [convId]);

  /* mark unread = 0 when viewing */
  useEffect(() => {
    if (!user || !convId) return;
    updateDoc(doc(db, 'conversations', convId), { [`unread.${user.uid}`]: 0 }).catch(() => {});
  }, [user, convId, msgs.length]);

  /* scroll to bottom */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  async function send() {
    if (!user || !text.trim() || !other) return;
    setSending(true);
    const t = text.trim();
    setText('');
    const newMsg: Msg = {
      id:   `${user.uid}_${Date.now()}`,
      from: user.uid,
      text: t,
      at:   Date.now(),
    };
    try {
      await setDoc(doc(db, 'conversations', convId), {
        participants: [user.uid, otherUid],
        names: { [user.uid]: user.displayName ?? '', [otherUid]: other.name },
        msgs: arrayUnion(newMsg),
        lastMsg: t,
        lastAt: serverTimestamp(),
      }, { merge: true });
      await updateDoc(doc(db, 'conversations', convId), {
        [`unread.${otherUid}`]: increment(1),
      }).catch(() => {});
      await addDoc(collection(db, 'notifications', otherUid, 'items'), {
        type: 'message', fromUid: user.uid,
        fromName: user.displayName ?? 'Someone',
        text: 'sent you a message', convId,
        read: false, createdAt: serverTimestamp(),
      }).catch(() => {});
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* conversation header */}
      <div className="sticky top-16 z-40 px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgba(6,0,0,0.90)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--sur)' }}>
        <Link href="/messages" className="p-1 rounded-lg transition-colors" style={{ color: 'var(--fg3)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        {other ? (
          <Link href={`/profile/${other.uid}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
              {other.photoURL
                ? <img src={other.photoURL} alt="" className="w-full h-full object-cover" />
                : other.name[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--fg1)' }}>{other.name}</p>
              {other.jobTitle && <p className="text-xs" style={{ color: 'var(--fg3)' }}>{other.jobTitle}</p>}
            </div>
          </Link>
        ) : (
          <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: 'var(--fg5)' }} />
        )}
      </div>

      {/* messages */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-3">
        {msgsLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: '#B01E36', borderTopColor: 'transparent' }} />
          </div>
        )}
        {msgsError && (
          <p className="text-center py-8 text-sm px-4 rounded-lg"
            style={{ color: '#fca5a5', background: 'rgba(220,38,38,0.12)' }}>
            {msgsError}
          </p>
        )}
        {!msgsLoading && !msgsError && msgs.length === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--fg4)' }}>
            No messages yet. Say hello.
          </p>
        )}
        {msgs.map(m => {
          const mine = m.from === user.uid;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                style={mine
                  ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white', borderBottomRightRadius: '4px' }
                  : { background: 'var(--fg5)', color: 'var(--fg1)', border: '1px solid var(--fg5)', borderBottomLeftRadius: '4px' }}>
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* input */}
      <div className="sticky bottom-0 px-4 py-3 max-w-2xl mx-auto w-full"
        style={{ background: 'rgba(6,0,0,0.88)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--sur)' }}>
        <div className="flex gap-2 items-center">
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Write a message…" className="input-field text-sm flex-1" />
          <button onClick={send} disabled={sending || !text.trim() || !other}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all disabled:opacity-40 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
