'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc,
  increment, serverTimestamp, arrayUnion, arrayRemove, addDoc, collection,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

interface Msg {
  id:        string;
  from:      string;
  text:      string;
  at:        number;
  type?:     'text' | 'gif' | 'image' | 'file';
  gifUrl?:   string;
  imageUrl?: string;
  fileUrl?:  string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
}

interface OtherUser {
  name:      string;
  jobTitle:  string;
  photoURL?: string;
  uid:       string;
}

interface GifResult {
  id: string;
  images: {
    fixed_height_small: { url: string };
    fixed_height: { url: string };
  };
  title: string;
}

function formatFileSize(b: number) {
  if (b < 1024) return b + 'B';
  if (b < 1048576) return (b / 1024).toFixed(1) + 'KB';
  return (b / 1048576).toFixed(1) + 'MB';
}

function ReadTick({ read }: { read: boolean }) {
  return read ? (
    <svg width="18" height="11" viewBox="0 0 18 11" fill="none" className="inline-block ml-1 flex-shrink-0">
      <path d="M1 5.5L4.5 9L10 1" stroke="#60a5fa" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 5.5L10.5 9L16 1" stroke="#60a5fa" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="inline-block ml-1 flex-shrink-0">
      <path d="M1 5.5L4.5 9L10 1" stroke="rgba(255,255,255,0.45)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😢'];

interface ConvPanelProps {
  convId: string;
  embedded?: boolean;
  onBack?: () => void;
}

export default function ConvPanel({ convId, embedded = false, onBack }: ConvPanelProps) {
  const { user } = useAuth();

  const [msgs, setMsgs]               = useState<Msg[]>([]);
  const [text, setText]               = useState('');
  const [sending, setSending]         = useState(false);
  const [other, setOther]             = useState<OtherUser | null>(null);
  const [msgsLoading, setMsgsLoading] = useState(true);
  const [msgsError, setMsgsError]     = useState('');
  const [lastSeen, setLastSeen]       = useState<Record<string, number>>({});
  const [reactions, setReactions]     = useState<Record<string, Record<string, string[]>>>({});
  const bottomRef                     = useRef<HTMLDivElement>(null);
  const inputRef                      = useRef<HTMLInputElement>(null);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  // GIF state
  const [showGifPicker, setShowGifPicker]   = useState(false);
  const [gifSearch, setGifSearch]           = useState('');
  const [gifs, setGifs]                     = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading]         = useState(false);
  const gifSearchRef                        = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Emoji picker state
  const [openPickerMsgId, setOpenPickerMsgId] = useState<string | null>(null);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const otherUid = convId.split('_').find(id => id !== user?.uid) ?? '';
  const convRef  = doc(db, 'conversations', convId);
  const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? '';

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

  /* one-time migration: copy old subcollection messages into the conversation doc's msgs array */
  useEffect(() => {
    if (!convId || !user) return;
    const flag = `siyne_conv_migrated_${convId}`;
    if (localStorage.getItem(flag)) return;

    async function migrate() {
      try {
        const msgsSnap = await getDocs(collection(db, 'conversations', convId, 'messages'));
        if (msgsSnap.empty) { localStorage.setItem(flag, '1'); return; }

        const converted = msgsSnap.docs.map(d => {
          const data = d.data();
          const rawAt = data.at as { seconds?: number } | null;
          const at = rawAt?.seconds ? rawAt.seconds * 1000 : Date.now();
          return { id: d.id, from: (data.from as string) ?? '', text: (data.text as string) ?? '', at };
        });

        const convSnap = await getDoc(doc(db, 'conversations', convId));
        const existing = ((convSnap.data()?.msgs ?? []) as { id: string; at?: number }[]);
        const existingIds = new Set(existing.map(m => m.id));
        const newOnly = converted.filter(m => !existingIds.has(m.id));

        if (newOnly.length > 0) {
          const merged = [...existing, ...newOnly].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
          await setDoc(doc(db, 'conversations', convId), { msgs: merged }, { merge: true });
        }
        localStorage.setItem(flag, '1');
      } catch {
        /* subcollection not accessible — skip */
      }
    }

    migrate();
  }, [convId, user]);

  /* listen on the conversation document — messages stored in docs as array, no subcollection needed */
  useEffect(() => {
    if (!convId) return;
    setMsgsLoading(true);
    setMsgsError('');
    return onSnapshot(
      convRef,
      snap => {
        const data = snap.data() ?? {};
        const raw = (data.msgs ?? []) as Msg[];
        setMsgs([...raw].sort((a, b) => (a.at ?? 0) - (b.at ?? 0)));
        setLastSeen((data.lastSeen as Record<string, number>) ?? {});
        setReactions((data.reactions as Record<string, Record<string, string[]>>) ?? {});
        setMsgsLoading(false);
      },
      err => {
        console.error('Conversation failed to load:', err);
        setMsgsError('Could not load messages. Check your internet connection.');
        setMsgsLoading(false);
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  /* mark unread = 0 and update lastSeen when viewing / new message arrives */
  useEffect(() => {
    if (!user || !convId) return;
    const now = Date.now();
    updateDoc(convRef, {
      [`unread.${user.uid}`]: 0,
      [`lastSeen.${user.uid}`]: now,
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, convId, msgs.length]);

  /* scroll to bottom */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  /* close emoji picker when clicking outside */
  useEffect(() => {
    if (!openPickerMsgId) return;
    function handleClick() { setOpenPickerMsgId(null); }
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [openPickerMsgId]);

  /* GIF: load trending on mount */
  useEffect(() => {
    if (!showGifPicker) return;
    if (!GIPHY_KEY) { setGifs([]); return; }
    setGifLoading(true);
    fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`)
      .then(r => r.json())
      .then(d => { setGifs(d.data ?? []); setGifLoading(false); })
      .catch(() => setGifLoading(false));
  }, [showGifPicker, GIPHY_KEY]);

  /* GIF: debounced search */
  useEffect(() => {
    if (!showGifPicker || !GIPHY_KEY) return;
    if (gifSearchRef.current) clearTimeout(gifSearchRef.current);
    if (!gifSearch.trim()) {
      // reload trending
      setGifLoading(true);
      fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`)
        .then(r => r.json())
        .then(d => { setGifs(d.data ?? []); setGifLoading(false); })
        .catch(() => setGifLoading(false));
      return;
    }
    const q = encodeURIComponent(gifSearch.trim());
    gifSearchRef.current = setTimeout(() => {
      setGifLoading(true);
      fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${q}&limit=18&rating=g`)
        .then(r => r.json())
        .then(d => { setGifs(d.data ?? []); setGifLoading(false); })
        .catch(() => setGifLoading(false));
    }, 400);
    return () => { if (gifSearchRef.current) clearTimeout(gifSearchRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gifSearch, showGifPicker, GIPHY_KEY]);

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
      type: 'text',
    };
    try {
      await setDoc(convRef, {
        participants: [user.uid, otherUid],
        names: { [user.uid]: user.displayName ?? '', [otherUid]: other.name },
        photos: { [user.uid]: user.photoURL ?? '', [otherUid]: other.photoURL ?? '' },
        msgs: arrayUnion(newMsg),
        lastMsg: t,
        lastAt: serverTimestamp(),
      }, { merge: true });
      await updateDoc(convRef, {
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

  async function sendGif(gifUrl: string) {
    if (!user || !other) return;
    setShowGifPicker(false);
    setGifSearch('');
    const newMsg: Msg = {
      id:     `${user.uid}_${Date.now()}`,
      from:   user.uid,
      text:   '',
      at:     Date.now(),
      type:   'gif',
      gifUrl,
    };
    await setDoc(convRef, {
      participants: [user.uid, otherUid],
      names: { [user.uid]: user.displayName ?? '', [otherUid]: other.name },
      msgs: arrayUnion(newMsg),
      lastMsg: '🎞️ GIF',
      lastAt: serverTimestamp(),
    }, { merge: true });
    await updateDoc(convRef, { [`unread.${otherUid}`]: increment(1) }).catch(() => {});
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !other) return;
    e.target.value = '';

    if (file.size > 10 * 1024 * 1024) {
      alert('File is too large. Maximum size is 10MB.');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const path = `conversations/${convId}/files/${Date.now()}_${file.name}`;
    const sRef = storageRef(storage, path);
    const task = uploadBytesResumable(sRef, file);

    setUploadProgress(0);

    task.on('state_changed',
      snapshot => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(pct);
      },
      err => {
        console.error('File upload error:', err);
        setUploadProgress(null);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setUploadProgress(null);

        let newMsg: Msg;
        let lastMsgText: string;

        if (isImage) {
          newMsg = {
            id:        `${user.uid}_${Date.now()}`,
            from:      user.uid,
            text:      '',
            at:        Date.now(),
            type:      'image',
            imageUrl:  url,
            fileName:  file.name,
            fileSize:  file.size,
          };
          lastMsgText = '📷 Image';
        } else {
          newMsg = {
            id:       `${user.uid}_${Date.now()}`,
            from:     user.uid,
            text:     '',
            at:       Date.now(),
            type:     'file',
            fileUrl:  url,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          };
          lastMsgText = `📎 ${file.name}`;
        }

        await setDoc(convRef, {
          participants: [user.uid, otherUid],
          names: { [user.uid]: user.displayName ?? '', [otherUid]: other.name },
          photos: { [user.uid]: user.photoURL ?? '', [otherUid]: other.photoURL ?? '' },
          msgs: arrayUnion(newMsg),
          lastMsg: lastMsgText,
          lastAt: serverTimestamp(),
        }, { merge: true });
        await updateDoc(convRef, { [`unread.${otherUid}`]: increment(1) }).catch(() => {});
      }
    );
  }

  async function toggleReaction(msgId: string, emoji: string) {
    if (!user) return;
    const msgReactions = reactions[msgId] ?? {};
    const emojiUsers   = msgReactions[emoji] ?? [];
    const hasReacted   = emojiUsers.includes(user.uid);
    await updateDoc(convRef, {
      [`reactions.${msgId}.${emoji}`]: hasReacted
        ? arrayRemove(user.uid)
        : arrayUnion(user.uid),
    }).catch(() => {});
  }

  const handleEmojiPickerOpen = useCallback((e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    setOpenPickerMsgId(prev => (prev === msgId ? null : msgId));
  }, []);

  if (!user) return null;

  const otherLastSeen = lastSeen[otherUid] ?? 0;

  const headerTop = embedded ? 'top-0' : 'top-16';
  const progressTop = embedded ? 'top-[57px]' : 'top-[calc(4rem+57px)]';
  const mainMaxWidth = embedded ? 'w-full' : 'max-w-2xl mx-auto';
  const inputMaxWidth = embedded ? 'w-full' : 'max-w-2xl mx-auto';
  const gifPanelMaxWidth = embedded ? 'w-full' : 'max-w-2xl mx-auto';

  return (
    <div className={embedded ? 'flex flex-col h-full overflow-hidden' : 'min-h-screen flex flex-col'}>
      {/* conversation header */}
      <div className={`sticky ${headerTop} z-40 px-4 py-3 flex items-center gap-3 flex-shrink-0`}
        style={{ background: 'rgba(6,0,0,0.90)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--sur)' }}>
        {onBack ? (
          <button onClick={onBack} className="p-1 rounded-lg transition-colors" style={{ color: 'var(--fg3)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : (
          <Link href="/messages" className="p-1 rounded-lg transition-colors" style={{ color: 'var(--fg3)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        )}
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

      {/* upload progress bar */}
      {uploadProgress !== null && (
        <div className={`sticky ${progressTop} z-30 w-full h-1.5 flex-shrink-0`} style={{ background: 'var(--fg5)' }}>
          <div
            className="h-full transition-all duration-200"
            style={{
              width: `${uploadProgress}%`,
              background: 'linear-gradient(90deg,#B01E36,#D63A52)',
            }}
          />
          <p className="text-xs text-center py-0.5" style={{ color: 'var(--fg3)' }}>
            Uploading… {uploadProgress}%
          </p>
        </div>
      )}

      {/* messages */}
      <main className={`flex-1 ${mainMaxWidth} px-4 py-6 space-y-3 ${embedded ? 'overflow-y-auto' : ''}`}>
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
          const msgReactions = reactions[m.id] ?? {};
          const hasReactionsToShow = Object.entries(msgReactions).some(([, uids]) => uids.length > 0);
          const isRead = mine && m.at <= otherLastSeen;

          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div className={`group relative flex items-end gap-1 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>

                {/* Smiley reaction button */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={e => handleEmojiPickerOpen(e, m.id)}
                    className="upload-hover w-6 h-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    style={{ background: 'var(--fg5)', color: 'var(--fg3)' }}
                    title="React"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>

                  {/* Emoji picker */}
                  {openPickerMsgId === m.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenPickerMsgId(null)} />
                      <div
                        className={`absolute z-50 bottom-8 ${mine ? 'right-0' : 'left-0'} flex gap-1 px-2 py-1.5 rounded-full shadow-lg`}
                        style={{ background: 'var(--drop-bg)', border: '1px solid var(--fg5)' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {EMOJI_OPTIONS.map(emoji => {
                          const emojiUsers = msgReactions[emoji] ?? [];
                          const selected = user ? emojiUsers.includes(user.uid) : false;
                          return (
                            <button
                              key={emoji}
                              onClick={() => { toggleReaction(m.id, emoji); setOpenPickerMsgId(null); }}
                              className="w-8 h-8 flex items-center justify-center rounded-full text-base transition-colors"
                              style={selected ? { background: 'rgba(176,30,54,0.30)' } : { background: 'transparent' }}
                              title={emoji}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Message bubble / content */}
                <div>
                  {/* GIF message */}
                  {m.type === 'gif' && m.gifUrl && (
                    <img
                      src={m.gifUrl}
                      alt="GIF"
                      className="rounded-xl"
                      style={{ maxWidth: '240px', display: 'block' }}
                    />
                  )}

                  {/* Image message */}
                  {m.type === 'image' && m.imageUrl && (
                    <a href={m.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={m.imageUrl}
                        alt={m.fileName ?? 'Image'}
                        className="rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ maxWidth: '240px', display: 'block' }}
                      />
                    </a>
                  )}

                  {/* File message */}
                  {m.type === 'file' && m.fileUrl && (
                    <a
                      href={m.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 no-underline hover:opacity-90 transition-opacity"
                      style={mine
                        ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white', maxWidth: '280px' }
                        : { background: 'var(--fg5)', color: 'var(--fg1)', border: '1px solid var(--fg5)', maxWidth: '280px' }}
                    >
                      <svg className="w-8 h-8 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.fileName}</p>
                        {m.fileSize != null && (
                          <p className="text-xs opacity-70">{formatFileSize(m.fileSize)}</p>
                        )}
                      </div>
                      <svg className="w-4 h-4 flex-shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  )}

                  {/* Text message */}
                  {(!m.type || m.type === 'text') && (
                    <div
                      className="max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed flex items-end gap-1"
                      style={mine
                        ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white', borderBottomRightRadius: '4px' }
                        : { background: 'var(--fg5)', color: 'var(--fg1)', border: '1px solid var(--fg5)', borderBottomLeftRadius: '4px' }}>
                      <span>{m.text}</span>
                      {mine && <ReadTick read={isRead} />}
                    </div>
                  )}

                  {/* Read tick for non-text messages (show below) */}
                  {mine && m.type && m.type !== 'text' && (
                    <div className={`flex mt-0.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                      <ReadTick read={isRead} />
                    </div>
                  )}
                </div>
              </div>

              {/* Reactions row */}
              {hasReactionsToShow && (
                <div className={`flex flex-wrap gap-1 mt-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {Object.entries(msgReactions).map(([emoji, uids]) => {
                    if (uids.length === 0) return null;
                    const iReacted = user ? uids.includes(user.uid) : false;
                    return (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(m.id, emoji)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors"
                        style={iReacted
                          ? { background: 'rgba(176,30,54,0.25)', border: '1px solid rgba(176,30,54,0.50)', color: 'var(--fg1)' }
                          : { background: 'var(--fg5)', border: '1px solid var(--fg5)', color: 'var(--fg2)' }}
                      >
                        <span>{emoji}</span>
                        <span>{uids.length}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* GIF picker panel */}
      {showGifPicker && (
        <div className={`sticky bottom-[72px] z-30 ${gifPanelMaxWidth} px-4 flex-shrink-0`}>
          <div
            className="rounded-xl overflow-hidden shadow-xl"
            style={{ background: 'var(--drop-bg)', border: '1px solid var(--fg5)' }}
          >
            <div className="p-3 border-b" style={{ borderColor: 'var(--fg5)' }}>
              <input
                value={gifSearch}
                onChange={e => setGifSearch(e.target.value)}
                placeholder="Search GIFs…"
                className="input-field text-sm"
                autoFocus
              />
            </div>
            <div className="p-3 max-h-64 overflow-y-auto">
              {!GIPHY_KEY ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-20 rounded-lg flex items-center justify-center text-xs text-center p-2"
                      style={{ background: 'var(--fg5)', color: 'var(--fg4)' }}
                    >
                      {i === 0 ? 'Add NEXT_PUBLIC_GIPHY_API_KEY to .env.local to enable GIFs' : ''}
                    </div>
                  ))}
                </div>
              ) : gifLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: '#B01E36', borderTopColor: 'transparent' }} />
                </div>
              ) : gifs.length === 0 ? (
                <p className="text-center py-6 text-sm" style={{ color: 'var(--fg4)' }}>No GIFs found.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {gifs.map(g => (
                    <button
                      key={g.id}
                      onClick={() => sendGif(g.images.fixed_height.url)}
                      className="rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={g.images.fixed_height_small.url}
                        alt={g.title}
                        className="w-full h-20 object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* input bar */}
      <div className={`sticky bottom-0 px-4 py-3 ${inputMaxWidth} flex-shrink-0`}
        style={{ background: 'rgba(6,0,0,0.88)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--sur)' }}>
        <div className="flex gap-2 items-center">

          {/* Paperclip / file button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors"
            style={{ background: 'var(--fg5)', color: 'var(--fg3)' }}
            title="Attach file"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* GIF button */}
          <button
            onClick={() => setShowGifPicker(prev => !prev)}
            className="h-9 px-2.5 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors text-xs font-bold"
            style={showGifPicker
              ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
              : { background: 'var(--fg5)', color: 'var(--fg3)' }}
            title="Send GIF"
          >
            GIF
          </button>

          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Write a message…"
            className="input-field text-sm flex-1"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim() || !other}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all disabled:opacity-40 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
