'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  collection, addDoc, getDoc, doc,
  query, orderBy, where, onSnapshot, getDocs, limit,
  serverTimestamp, setDoc, deleteDoc, updateDoc, increment,
} from 'firebase/firestore';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import PostCard, { Post } from '@/components/PostCard';
import GifPicker from '@/components/GifPicker';

interface CompanyFeedPost {
  id:        string;
  companyId: string;
  content:   string;
  createdAt: { seconds: number } | null;
  likes:     number;
  reactions: Record<string, string>;
}

interface SuggestedCompany {
  id:            string;
  name:          string;
  industry:      string;
  logoUrl:       string;
  followerCount: number;
  verified:      boolean;
}

function timeAgo(s: number) {
  const m = Math.floor((Date.now() - s * 1000) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function FeedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [posts, setPosts]         = useState<Post[]>([]);
  const [content, setContent]     = useState('');
  const [posting, setPosting]     = useState(false);
  const [jobTitle, setJobTitle]   = useState('');
  const [tab, setTab]             = useState<'all' | 'following'>('all');
  const [following, setFollowing] = useState<string[]>([]);
  const textareaRef               = useRef<HTMLTextAreaElement>(null);

  /* post media */
  const [postMedia,     setPostMedia]     = useState('');
  const [postMediaType, setPostMediaType] = useState<'image' | 'gif'>('image');
  const [uploadingImg,  setUploadingImg]  = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const postImgRef = useRef<HTMLInputElement>(null);

  /* company posts for Following tab */
  const [followedCompanyIds, setFollowedCompanyIds]   = useState<string[]>([]);
  const [followedCompanyMap, setFollowedCompanyMap]   = useState<Record<string, { name: string; logoUrl: string }>>({});
  const [companyPosts, setCompanyPosts]               = useState<CompanyFeedPost[]>([]);
  const [followedLoaded, setFollowedLoaded]           = useState(false);

  /* sidebar */
  const [suggestedCompanies, setSuggestedCompanies]   = useState<SuggestedCompany[]>([]);
  const [sideFollowed, setSideFollowed]               = useState<Set<string>>(new Set());
  const [followBusy, setFollowBusy]                   = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [user, loading, router]);

  /* load user profile + followed companies */
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        setJobTitle((snap.data().jobTitle as string) ?? '');
        setFollowing(snap.data().following ?? []);
      }
    });

    getDocs(query(collection(db, 'companyFollowers'), where('userId', '==', user.uid)))
      .then(async snap => {
        const ids = snap.docs.map(d => d.data().companyId as string);
        setFollowedCompanyIds(ids);
        setSideFollowed(new Set(ids));
        if (ids.length > 0) {
          const compDocs = await Promise.all(ids.map(id => getDoc(doc(db, 'companies', id))));
          const map: Record<string, { name: string; logoUrl: string }> = {};
          compDocs.forEach(d => { if (d.exists()) map[d.id] = { name: d.data().name, logoUrl: d.data().logoUrl ?? '' }; });
          setFollowedCompanyMap(map);
        }
        setFollowedLoaded(true);
      });
  }, [user]);

  /* sidebar suggestions — wait until we know which companies user follows */
  useEffect(() => {
    if (!user || !followedLoaded) return;
    getDocs(query(collection(db, 'companies'), orderBy('followerCount', 'desc'), limit(10)))
      .then(snap => {
        const all = snap.docs.map(d => ({
          id: d.id, name: d.data().name ?? '', industry: d.data().industry ?? '',
          logoUrl: d.data().logoUrl ?? '', followerCount: d.data().followerCount ?? 0,
          verified: d.data().verified ?? false,
        }));
        setSuggestedCompanies(all.filter(c => !followedCompanyIds.includes(c.id)).slice(0, 3));
      });
  }, [user, followedLoaded, followedCompanyIds]);

  /* user post subscription */
  useEffect(() => {
    if (tab === 'all') {
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      return onSnapshot(q, snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post))));
    }
    if (following.length === 0) { setPosts([]); return; }
    const ids = following.slice(0, 30);
    const q = query(collection(db, 'posts'), where('uid', 'in', ids), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post))));
  }, [tab, following]);

  /* company post subscription for Following tab */
  useEffect(() => {
    if (tab !== 'following' || followedCompanyIds.length === 0) {
      setCompanyPosts([]);
      return;
    }
    const ids = followedCompanyIds.slice(0, 30);
    const q = query(collection(db, 'companyPosts'), where('companyId', 'in', ids), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setCompanyPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyFeedPost))));
  }, [tab, followedCompanyIds]);

  async function handlePostImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingImg(true);
    try {
      const r = sRef(storage, `posts/images/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      setPostMedia(await getDownloadURL(r));
      setPostMediaType('image');
    } catch {}
    setUploadingImg(false);
    e.target.value = '';
  }

  async function handlePost() {
    if (!user || (!content.trim() && !postMedia)) return;
    setPosting(true);
    try {
      const payload: Record<string, unknown> = {
        uid: user.uid, authorName: user.displayName ?? 'Anonymous',
        authorTitle: jobTitle, content: content.trim(),
        likes: 0, likedBy: [], createdAt: serverTimestamp(),
      };
      if (postMedia) { payload.mediaUrl = postMedia; payload.mediaType = postMediaType; }
      await addDoc(collection(db, 'posts'), payload);
      setContent('');
      setPostMedia('');
    } finally { setPosting(false); }
  }

  function removePost(id: string) { setPosts(prev => prev.filter(p => p.id !== id)); }

  async function followCompany(companyId: string) {
    if (!user) return;
    setFollowBusy(companyId);
    const fid = `${companyId}_${user.uid}`;
    const isF = sideFollowed.has(companyId);
    try {
      if (isF) {
        await deleteDoc(doc(db, 'companyFollowers', fid));
        await updateDoc(doc(db, 'companies', companyId), { followerCount: increment(-1) });
        setSideFollowed(s => { const n = new Set(s); n.delete(companyId); return n; });
      } else {
        await setDoc(doc(db, 'companyFollowers', fid), { companyId, userId: user.uid, followedAt: serverTimestamp() });
        await updateDoc(doc(db, 'companies', companyId), { followerCount: increment(1) });
        setSideFollowed(s => { const n = new Set(s); n.add(companyId); return n; });
        setSuggestedCompanies(prev => prev.filter(c => c.id !== companyId));
      }
    } catch {}
    setFollowBusy(null);
  }

  /* merge user posts + company posts for Following tab, sorted by time */
  function followingFeed() {
    type Item =
      | { kind: 'post';    ts: number; id: string; post: Post }
      | { kind: 'company'; ts: number; id: string; post: CompanyFeedPost };
    const items: Item[] = [
      ...posts.map(p => ({ kind: 'post' as const,    ts: p.createdAt?.seconds ?? 0, id: p.id, post: p })),
      ...companyPosts.map(p => ({ kind: 'company' as const, ts: p.createdAt?.seconds ?? 0, id: p.id, post: p })),
    ];
    return items.sort((a, b) => b.ts - a.ts);
  }

  if (loading || !user) return null;

  const feedItems = tab === 'following' ? followingFeed() : [];
  const isEmpty = tab === 'following'
    ? feedItems.length === 0
    : posts.length === 0;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="lg:grid lg:grid-cols-[1fr_288px] gap-6">

          {/* ── MAIN FEED ── */}
          <div>
            {/* tab switcher */}
            <div className="flex rounded-xl p-1 mb-6" style={{ background: 'var(--sur)' }}>
              {(['all', 'following'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all"
                  style={tab === t
                    ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
                    : { color: 'var(--fg3)' }}>
                  {t === 'all' ? 'For You' : 'Following'}
                </button>
              ))}
            </div>

            {/* create post */}
            <div className="card mb-6">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-semibold text-sm"
                  style={{ background: 'var(--fg5)', color: 'var(--fg2)' }}>
                  {user.displayName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1">
                  <textarea ref={textareaRef} value={content}
                    onChange={e => setContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePost(); }}
                    rows={3} placeholder="Share something with your network…"
                    className="input-field resize-none text-sm" />

                  {/* media preview */}
                  {postMedia && (
                    <div className="relative mt-2 inline-block max-w-full">
                      <img src={postMedia} alt="" className="rounded-xl max-h-48 object-cover" />
                      <button
                        onClick={() => setPostMedia('')}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: '#B01E36', color: 'white' }}>
                        ×
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    {/* media buttons */}
                    <div className="flex items-center gap-1">
                      {/* image upload */}
                      <button
                        onClick={() => postImgRef.current?.click()}
                        disabled={uploadingImg}
                        title="Add image"
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--fg3)', border: '1px solid var(--fg5)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
                        {uploadingImg ? (
                          <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                        Photo
                      </button>
                      <input ref={postImgRef} type="file" accept="image/*" className="hidden" onChange={handlePostImage} />

                      {/* GIF picker */}
                      <button
                        onClick={() => setShowGifPicker(true)}
                        title="Add GIF"
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors font-bold"
                        style={{ color: 'var(--fg3)', border: '1px solid var(--fg5)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
                        GIF
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs hidden sm:block" style={{ color: 'var(--fg4)' }}>Ctrl+Enter</span>
                      <button onClick={handlePost} disabled={posting || (!content.trim() && !postMedia)} className="btn-primary text-sm py-2 px-5">
                        {posting ? 'Posting…' : 'Post'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* GIF picker modal */}
            {showGifPicker && (
              <GifPicker
                onSelect={url => { setPostMedia(url); setPostMediaType('gif'); }}
                onClose={() => setShowGifPicker(false)}
              />
            )}

            {/* For You tab */}
            {tab === 'all' && (
              isEmpty ? (
                <div className="text-center py-20" style={{ color: 'var(--fg4)' }}>
                  <p className="text-lg font-medium mb-1">No posts yet.</p>
                  <p className="text-sm">Be the first to share something.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map(post => <PostCard key={post.id} post={post} onDelete={removePost} />)}
                </div>
              )
            )}

            {/* Following tab */}
            {tab === 'following' && (
              isEmpty ? (
                <div className="text-center py-20" style={{ color: 'var(--fg4)' }}>
                  <p className="text-lg font-medium mb-1">Nothing here yet.</p>
                  <p className="text-sm">
                    Follow people on the{' '}
                    <Link href="/connect" className="hover:underline" style={{ color: '#D63A52' }}>Connect</Link>
                    {' '}page or{' '}
                    <Link href="/search" className="hover:underline" style={{ color: '#D63A52' }}>companies</Link>
                    {' '}to see their posts here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedItems.map(item => {
                    if (item.kind === 'post') {
                      return <PostCard key={`p_${item.id}`} post={item.post} onDelete={removePost} />;
                    }
                    const cp   = item.post;
                    const comp = followedCompanyMap[cp.companyId];
                    if (!comp) return null;
                    return (
                      <div key={`c_${item.id}`} className="card">
                        <div className="flex items-center gap-3 mb-3">
                          <Link href={`/companies/${cp.companyId}`} className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm overflow-hidden"
                              style={{ background: comp.logoUrl ? 'transparent' : 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                              {comp.logoUrl
                                ? <img src={comp.logoUrl} className="w-full h-full object-cover" alt="" />
                                : comp.name[0]?.toUpperCase()}
                            </div>
                          </Link>
                          <div>
                            <Link href={`/companies/${cp.companyId}`}>
                              <p className="font-semibold text-sm hover:underline" style={{ color: 'var(--fg1)' }}>{comp.name}</p>
                            </Link>
                            <p className="text-xs" style={{ color: 'var(--fg4)' }}>
                              {cp.createdAt ? timeAgo(cp.createdAt.seconds) : ''} · Company update
                            </p>
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--fg2)' }}>
                          {cp.content}
                        </p>
                        <div className="mt-3 pt-3 flex items-center gap-3" style={{ borderTop: '1px solid var(--sur)' }}>
                          <span className="text-xs" style={{ color: 'var(--fg4)' }}>
                            {Object.keys(cp.reactions ?? {}).length || cp.likes || 0} likes
                          </span>
                          <Link href={`/companies/${cp.companyId}?tab=updates`}
                            className="text-xs hover:underline" style={{ color: 'var(--fg4)' }}>
                            View on company page →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <aside className="hidden lg:block">
            {suggestedCompanies.length > 0 && (
              <div className="card sticky top-24">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--fg4)' }}>
                    Companies to follow
                  </h3>
                  <Link href="/search" className="text-xs transition-colors"
                    style={{ color: 'var(--fg4)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#D63A52')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg4)')}>
                    See all
                  </Link>
                </div>

                <div className="space-y-4">
                  {suggestedCompanies.map(c => (
                    <div key={c.id} className="flex items-center gap-3">
                      <Link href={`/companies/${c.id}`} className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm overflow-hidden"
                          style={{ background: c.logoUrl ? 'transparent' : 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                          {c.logoUrl
                            ? <img src={c.logoUrl} alt={c.name} className="w-full h-full object-cover" />
                            : c.name[0]?.toUpperCase() ?? '?'}
                        </div>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/companies/${c.id}`} className="flex items-center gap-1 group">
                          <p className="text-sm font-semibold truncate group-hover:underline" style={{ color: 'var(--fg1)' }}>
                            {c.name}
                          </p>
                          {c.verified && (
                            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#60a5fa' }} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </Link>
                        <p className="text-xs truncate" style={{ color: 'var(--fg4)' }}>{c.industry}</p>
                        <p className="text-xs" style={{ color: 'var(--fg5)' }}>
                          {c.followerCount.toLocaleString()} followers
                        </p>
                      </div>
                      <button onClick={() => followCompany(c.id)} disabled={followBusy === c.id}
                        className="text-xs font-semibold px-3 py-1 rounded-lg flex-shrink-0 transition-all"
                        style={sideFollowed.has(c.id)
                          ? { background: 'var(--fg5)', color: 'var(--fg3)', border: '1px solid var(--fg5)' }
                          : { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                        {followBusy === c.id ? '…' : sideFollowed.has(c.id) ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

        </div>
      </main>
    </div>
  );
}
