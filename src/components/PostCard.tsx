'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  doc, getDoc, updateDoc, deleteDoc, addDoc, increment,
  collection, query, orderBy, onSnapshot,
  serverTimestamp, deleteField,
} from 'firebase/firestore';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import GifPicker from '@/components/GifPicker';

/* ── types ──────────────────────────────────────────── */
export interface Post {
  id:              string;
  uid:             string;
  authorName:      string;
  authorTitle:     string;
  authorPhotoURL?: string;
  content:         string;
  createdAt:       { seconds: number } | null;
  likes:           number;
  likedBy?:        string[];
  reactions?:      Record<string, 'like' | 'love' | 'laugh' | 'sad'>;
  commentCount?:   number;
  mediaUrl?:       string;
  mediaType?:      'image' | 'gif';
}

interface Comment {
  id:         string;
  uid:        string;
  authorName: string;
  text:       string;
  createdAt:  { seconds: number } | null;
  mediaUrl?:  string;
}

/* ── reaction icons ─────────────────────────────────── */
type ReactionType = 'like' | 'love' | 'laugh' | 'sad';

function RxIcon({ type, active }: { type: string; active: boolean }) {
  const fill = active ? 'currentColor' : 'none';
  const sw   = 1.7;
  if (type === 'like') return (
    <path fill={fill} strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw}
      d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
  );
  if (type === 'love') return (
    <path fill={fill} strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw}
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  );
  if (type === 'laugh') return (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={sw} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw}
        fill={active ? 'var(--fg5)' : 'none'}
        d="M8 14.5c.6 2 2.2 3.2 4 3.2s3.4-1.2 4-3.2H8z" />
      <circle cx="9.5" cy="9.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="9.5" r="0.8" fill="currentColor" stroke="none" />
    </>
  );
  if (type === 'sad') return (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={sw} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw}
        d="M8.5 17c.6-1.8 2-3 3.5-3s2.9 1.2 3.5 3" />
      <circle cx="9.5" cy="9.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="9.5" r="0.8" fill="currentColor" stroke="none" />
    </>
  );
  return null;
}

const REACTION_TYPES: ReactionType[] = ['like', 'love', 'laugh', 'sad'];

const REPORT_REASONS = [
  'Toxic or offensive language',
  'Spam, self-promotion, or misleading content',
  'Harassment or targeted bullying',
  'False credentials or fabricated professional claims',
  'This post belongs on LinkedIn, not Siyne',
];

/* ── component ──────────────────────────────────────── */
export default function PostCard({ post, onDelete }: { post: Post; onDelete?: (id: string) => void }) {
  const { user } = useAuth();

  /* reactions */
  const [localRx,   setLocalRx]   = useState<Record<string, string>>(post.reactions ?? {});
  useEffect(() => { setLocalRx(post.reactions ?? {}); }, [post.reactions]);
  const [showPicker, setShowPicker] = useState(false);
  const pickerTimer = useRef<ReturnType<typeof setTimeout>>();

  /* comments */
  const [showComments, setShowComments] = useState(false);
  const [comments,     setComments]     = useState<Comment[]>([]);
  const [commentText,  setCommentText]  = useState('');
  const [commentMedia, setCommentMedia] = useState('');
  const [postingCmt,   setPostingCmt]   = useState(false);
  const [uploadingCmt, setUploadingCmt] = useState(false);
  const [showGifPicker,setShowGifPicker]= useState(false);
  const cmtImgRef = useRef<HTMLInputElement>(null);

  /* report */
  const [showReport,  setShowReport]  = useState(false);
  const [reportReason,setReason]      = useState('');
  const [reported,    setReported]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  const isOwner = user?.uid === post.uid;
  const myRx    = localRx[user?.uid ?? ''] as ReactionType | undefined;
  const totalRx = Object.keys(localRx).length;

  /* fetch live photoURL from Firestore if post doesn't have it stored */
  const [livePhotoURL, setLivePhotoURL] = useState(post.authorPhotoURL ?? '');
  useEffect(() => {
    if (post.authorPhotoURL) { setLivePhotoURL(post.authorPhotoURL); return; }
    getDoc(doc(db, 'users', post.uid)).then(snap => {
      if (snap.exists()) setLivePhotoURL(snap.data().photoURL ?? '');
    }).catch(() => {});
  }, [post.uid, post.authorPhotoURL]);

  /* load comments when section opens */
  useEffect(() => {
    if (!showComments) return;
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)));
    });
  }, [showComments, post.id]);

  /* ── handlers ─────────────────────────────────────── */
  async function handleReact(type: ReactionType) {
    if (!user) return;
    setShowPicker(false);
    const ref = doc(db, 'posts', post.id);
    if (myRx === type) {
      const nx = { ...localRx }; delete nx[user.uid]; setLocalRx(nx);
      await updateDoc(ref, { [`reactions.${user.uid}`]: deleteField() });
    } else {
      setLocalRx({ ...localRx, [user.uid]: type });
      await updateDoc(ref, { [`reactions.${user.uid}`]: type });
      if (user.uid !== post.uid) {
        await addDoc(collection(db, 'notifications', post.uid, 'items'), {
          type: 'reaction', fromUid: user.uid,
          fromName: user.displayName ?? 'Someone',
          postId: post.id, reaction: type,
          text: 'reacted to your post',
          read: false, createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    }
  }

  async function handleDelete() {
    if (!isOwner) return;
    await deleteDoc(doc(db, 'posts', post.id));
    onDelete?.(post.id);
  }

  async function handleCommentImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingCmt(true);
    try {
      const r = sRef(storage, `posts/comments/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      setCommentMedia(await getDownloadURL(r));
    } catch {}
    setUploadingCmt(false);
    e.target.value = '';
  }

  async function addComment() {
    if (!user || (!commentText.trim() && !commentMedia)) return;
    setPostingCmt(true);
    try {
      const payload: Record<string, unknown> = {
        uid: user.uid, authorName: user.displayName ?? 'Anonymous',
        text: commentText.trim(), createdAt: serverTimestamp(),
      };
      if (commentMedia) payload.mediaUrl = commentMedia;
      await addDoc(collection(db, 'posts', post.id, 'comments'), payload);
      await updateDoc(doc(db, 'posts', post.id), { commentCount: increment(1) });
      if (user.uid !== post.uid) {
        await addDoc(collection(db, 'notifications', post.uid, 'items'), {
          type: 'comment', fromUid: user.uid,
          fromName: user.displayName ?? 'Someone',
          postId: post.id, text: 'commented on your post',
          read: false, createdAt: serverTimestamp(),
        }).catch(() => {});
      }
      setCommentText('');
      setCommentMedia('');
    } finally { setPostingCmt(false); }
  }

  async function submitReport() {
    if (!user || !reportReason) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        postId: post.id, postAuthorUid: post.uid,
        reportedBy: user.uid, reason: reportReason,
        status: 'pending', createdAt: serverTimestamp(),
      });
      setReported(true);
      setShowReport(false);
    } finally { setSubmitting(false); }
  }

  const timeAgo = post.createdAt ? formatTimeAgo(post.createdAt.seconds * 1000) : '';

  /* icon button style helper */
  const mediaBtn = {
    color: 'var(--fg4)',
    padding: '4px',
    borderRadius: '6px',
    transition: 'color 0.15s',
  };

  return (
    <div className="card">
      {/* author */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 overflow-hidden"
            style={{ background: 'var(--fg5)', color: 'var(--fg2)' }}>
            {livePhotoURL
              ? <img src={livePhotoURL} alt={post.authorName} className="w-full h-full object-cover" />
              : post.authorName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <Link href={`/profile/${post.uid}`} className="font-medium text-sm hover:underline"
              style={{ color: 'var(--fg1)' }}>
              {post.authorName}
            </Link>
            <p className="text-xs" style={{ color: 'var(--fg4)' }}>
              {post.authorTitle}{post.authorTitle ? ' · ' : ''}{timeAgo}
            </p>
          </div>
        </div>
        {isOwner && (
          <button onClick={handleDelete} className="text-xs transition-colors"
            style={{ color: 'var(--fg4)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg4)')}>
            Delete
          </button>
        )}
      </div>

      {/* content */}
      {post.content && (
        <p className="text-sm leading-relaxed whitespace-pre-line mb-3" style={{ color: 'var(--fg2)' }}>
          {post.content}
        </p>
      )}

      {/* post media */}
      {post.mediaUrl && (
        <div className="mb-4 rounded-xl overflow-hidden">
          <img src={post.mediaUrl} alt="" className="w-full object-cover max-h-96" />
        </div>
      )}

      {/* action bar */}
      <div className="flex items-center gap-1 pt-3 flex-wrap" style={{ borderTop: '1px solid var(--sur)' }}>

        {/* reaction button + picker */}
        <div className="relative"
          onMouseEnter={() => { clearTimeout(pickerTimer.current); setShowPicker(true); }}
          onMouseLeave={() => { pickerTimer.current = setTimeout(() => setShowPicker(false), 200); }}>

          {showPicker && (
            <div className="absolute bottom-full left-0 mb-2 z-20 flex rounded-xl overflow-hidden"
              style={{ background: 'var(--drop-bg)', border: '1px solid var(--fg5)', backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              {REACTION_TYPES.map((type, i) => (
                <button key={type} onClick={() => handleReact(type)}
                  className="flex items-center justify-center w-11 h-11 transition-colors"
                  style={{ borderRight: i < REACTION_TYPES.length - 1 ? '1px solid var(--sur)' : 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--sur)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <svg className="w-5 h-5"
                    style={{ color: myRx === type ? '#B01E36' : 'var(--fg2)' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <RxIcon type={type} active={myRx === type} />
                  </svg>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => myRx ? handleReact(myRx) : handleReact('like')}
            disabled={!user}
            className="flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
            style={{
              color:      myRx ? '#D63A52'                      : 'var(--fg3)',
              background: myRx ? 'rgba(224,0,0,0.12)'           : 'transparent',
              border:     myRx ? '1px solid rgba(224,0,0,0.20)' : '1px solid transparent',
            }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <RxIcon type={myRx ?? 'like'} active={!!myRx} />
            </svg>
            {totalRx > 0 ? totalRx : 'React'}
          </button>
        </div>

        {/* comment button */}
        <button onClick={() => setShowComments(v => !v)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
          style={{ color: showComments ? 'var(--fg2)' : 'var(--fg3)', background: showComments ? 'var(--fg5)' : 'transparent' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {(post.commentCount ?? comments.length) > 0 ? `${post.commentCount ?? comments.length}` : 'Comment'}
        </button>

        {/* report */}
        {!reported ? (
          <button onClick={() => setShowReport(true)} disabled={!user || isOwner}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ml-auto disabled:opacity-20"
            style={{ color: 'var(--fg4)' }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg4)'; }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6H13l-1-1H5a2 2 0 00-2 2z" />
            </svg>
            Report
          </button>
        ) : (
          <span className="text-xs ml-auto" style={{ color: 'var(--fg4)' }}>Reported</span>
        )}
      </div>

      {/* comment section */}
      {showComments && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--sur)' }}>
          <div className="space-y-3 mb-4">
            {comments.length === 0 && (
              <p className="text-xs text-center py-3" style={{ color: 'var(--fg4)' }}>
                No comments yet. Be the first.
              </p>
            )}
            {comments.map(c => (
              <div key={c.id} className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--fg5)', color: 'var(--fg2)' }}>
                  {c.authorName[0]?.toUpperCase()}
                </div>
                <div className="flex-1 rounded-xl px-3 py-2" style={{ background: 'var(--sur)' }}>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--fg2)' }}>{c.authorName}</p>
                  {c.text && <p className="text-xs leading-relaxed" style={{ color: 'var(--fg2)' }}>{c.text}</p>}
                  {c.mediaUrl && (
                    <img src={c.mediaUrl} alt="" className="mt-1.5 rounded-lg max-h-40 object-cover" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {user && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                style={{ background: 'var(--fg5)', color: 'var(--fg2)' }}>
                {user.displayName?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1">
                {/* media preview */}
                {commentMedia && (
                  <div className="relative mb-1.5 inline-block">
                    <img src={commentMedia} alt="" className="rounded-lg max-h-24 max-w-full object-cover" />
                    <button
                      onClick={() => setCommentMedia('')}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: '#B01E36', color: 'white' }}>
                      ×
                    </button>
                  </div>
                )}

                {/* input row */}
                <div className="flex items-center gap-1 rounded-xl px-3 py-2" style={{ background: 'var(--sur)' }}>
                  <input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                    placeholder="Write a comment…"
                    className="flex-1 bg-transparent text-xs outline-none"
                    style={{ color: 'var(--fg2)' }}
                  />

                  {/* image upload */}
                  <button
                    onClick={() => cmtImgRef.current?.click()}
                    disabled={uploadingCmt}
                    title="Add image"
                    style={mediaBtn}
                    onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg4)')}>
                    {uploadingCmt ? (
                      <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                  <input ref={cmtImgRef} type="file" accept="image/*" className="hidden" onChange={handleCommentImage} />

                  {/* GIF picker */}
                  <button
                    onClick={() => setShowGifPicker(true)}
                    title="Add GIF"
                    style={{ ...mediaBtn, fontWeight: 700, fontSize: '10px', letterSpacing: '0.04em' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg4)')}>
                    GIF
                  </button>
                </div>

                {(commentText.trim() || commentMedia) && (
                  <div className="flex justify-end mt-1.5">
                    <button onClick={addComment} disabled={postingCmt} className="btn-primary text-xs py-1 px-3">
                      {postingCmt ? '…' : 'Post'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* report modal */}
      {showReport && (
        <div className="mt-4 p-4 rounded-xl space-y-3" style={{ background: 'var(--sur)', border: '1px solid var(--fg5)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--fg1)' }}>Why are you reporting this post?</p>
          <div className="space-y-2">
            {REPORT_REASONS.map(reason => (
              <label key={reason} className="flex items-start gap-3 cursor-pointer group">
                <div className="w-4 h-4 rounded-full border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors"
                  style={{
                    borderColor: reportReason === reason ? '#B01E36' : 'var(--fg5)',
                    background:  reportReason === reason ? '#B01E36' : 'transparent',
                  }}
                  onClick={() => setReason(reason)}>
                  {reportReason === reason && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className="text-sm leading-snug transition-colors"
                  style={{ color: reportReason === reason ? 'var(--fg1)' : 'var(--fg3)' }}
                  onClick={() => setReason(reason)}>
                  {reason}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={submitReport} disabled={!reportReason || submitting}
              className="btn-primary text-xs py-1.5 px-4">
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
            <button onClick={() => { setShowReport(false); setReason(''); }}
              className="text-xs py-1.5 px-3 transition-colors" style={{ color: 'var(--fg4)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* GIF picker modal (comment) */}
      {showGifPicker && (
        <GifPicker
          onSelect={url => setCommentMedia(url)}
          onClose={() => setShowGifPicker(false)}
        />
      )}
    </div>
  );
}

function formatTimeAgo(ms: number): string {
  const diff = Date.now() - ms, mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
