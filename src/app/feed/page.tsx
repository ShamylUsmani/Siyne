'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  collection, addDoc, getDoc, doc,
  query, orderBy, where, onSnapshot, getDocs, limit,
  serverTimestamp, setDoc, deleteDoc, updateDoc, increment,
} from 'firebase/firestore';
import { ref as sRef, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
  const [myPhotoURL, setMyPhotoURL] = useState('');
  const [tab, setTab]             = useState<'all' | 'following'>('all');
  const [following, setFollowing] = useState<string[]>([]);
  const textareaRef               = useRef<HTMLTextAreaElement>(null);

  /* post media */
  const [postMedia,     setPostMedia]     = useState('');
  const [postMediaType, setPostMediaType] = useState<'image' | 'gif' | 'video'>('image');
  const [uploadingImg,  setUploadingImg]  = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const postImgRef = useRef<HTMLInputElement>(null);

  // video upload
  const [postVideo, setPostVideo]           = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoProgress, setVideoProgress]   = useState<number | null>(null);
  const postVideoRef = useRef<HTMLInputElement>(null);

  // poll creation
  const [showPoll, setShowPoll]             = useState(false);
  const [pollQuestion, setPollQuestion]     = useState('');
  const [pollOptions, setPollOptions]       = useState(['', '']);

  // camera
  const [showCamera, setShowCamera]         = useState(false);
  const [cameraStream, setCameraStream]     = useState<MediaStream | null>(null);
  const [cameraMode, setCameraMode]         = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording]       = useState(false);
  const [capturedMedia, setCapturedMedia]   = useState<{ url: string; type: 'photo' | 'video'; blob: Blob } | null>(null);
  const cameraVideoRef  = useRef<HTMLVideoElement>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks   = useRef<BlobPart[]>([]);

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
        setMyPhotoURL((snap.data().photoURL as string) ?? '');
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

  async function handlePostVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 100 * 1024 * 1024) { alert('Video must be under 100MB.'); return; }
    setUploadingVideo(true); setVideoProgress(0);
    try {
      const path = `posts/videos/${user.uid}/${Date.now()}_${file.name}`;
      const vRef = sRef(storage, path);
      const task = uploadBytesResumable(vRef, file);
      task.on('state_changed',
        s => setVideoProgress(Math.round(s.bytesTransferred / s.totalBytes * 100)),
        err => { console.error(err); setUploadingVideo(false); setVideoProgress(null); },
        async () => { setPostVideo(await getDownloadURL(task.snapshot.ref)); setUploadingVideo(false); setVideoProgress(null); }
      );
    } catch { setUploadingVideo(false); setVideoProgress(null); }
    e.target.value = '';
  }

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
      setCameraStream(stream);
      setShowCamera(true);
      setCapturedMedia(null);
      setTimeout(() => {
        if (cameraVideoRef.current) { cameraVideoRef.current.srcObject = stream; cameraVideoRef.current.play(); }
      }, 100);
    } catch {
      alert('Camera not available. Please allow camera access.');
    }
  }

  function closeCamera() {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null); setShowCamera(false); setCapturedMedia(null); setIsRecording(false);
  }

  function capturePhoto() {
    const video = cameraVideoRef.current; const canvas = cameraCanvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      setCapturedMedia({ url: URL.createObjectURL(blob), type: 'photo', blob });
    }, 'image/jpeg', 0.92);
  }

  function startRecording() {
    if (!cameraStream) return;
    recordedChunks.current = [];
    const mr = new MediaRecorder(cameraStream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
    mr.ondataavailable = e => { if (e.data.size > 0) recordedChunks.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
      setCapturedMedia({ url: URL.createObjectURL(blob), type: 'video', blob });
    };
    mediaRecorderRef.current = mr; mr.start(); setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop(); setIsRecording(false);
  }

  async function useCapturedMedia() {
    if (!capturedMedia || !user) return;
    closeCamera();
    const ext = capturedMedia.type === 'photo' ? 'jpg' : 'webm';
    const mimeType = capturedMedia.type === 'photo' ? 'image/jpeg' : 'video/webm';
    const path = `posts/${capturedMedia.type === 'photo' ? 'images' : 'videos'}/${user.uid}/${Date.now()}.${ext}`;
    try {
      const snap = await uploadBytes(sRef(storage, path), capturedMedia.blob, { contentType: mimeType });
      const url = await getDownloadURL(snap.ref);
      if (capturedMedia.type === 'photo') {
        setPostMedia(url); setPostMediaType('image');
      } else {
        setPostVideo(url);
      }
    } catch (err) { console.error(err); alert('Upload failed.'); }
  }

  async function handlePost() {
    if (!user || (!content.trim() && !postMedia && !postVideo && !(showPoll && pollQuestion.trim()))) return;
    setPosting(true);
    try {
      const payload: Record<string, unknown> = {
        uid: user.uid, authorName: user.displayName ?? 'Anonymous',
        authorTitle: jobTitle, authorPhotoURL: myPhotoURL,
        content: content.trim(), likes: 0, likedBy: [], createdAt: serverTimestamp(),
      };
      if (postMedia)  { payload.mediaUrl = postMedia;  payload.mediaType = postMediaType; }
      if (postVideo)  { payload.mediaUrl = postVideo;  payload.mediaType = 'video'; }
      if (showPoll && pollQuestion.trim()) {
        const validOptions = pollOptions.filter(o => o.trim());
        if (validOptions.length >= 2) {
          payload.poll = {
            question: pollQuestion.trim(),
            options: validOptions.map((text, i) => ({ id: `opt_${i}`, text: text.trim() })),
          };
          payload.pollVotes = {};
          payload.pollVoteCounts = {};
        }
      }
      await addDoc(collection(db, 'posts'), payload);
      setContent(''); setPostMedia(''); setPostVideo('');
      setShowPoll(false); setPollQuestion(''); setPollOptions(['', '']);
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
                  {(postMedia || postVideo) && (
                    <div className="relative mt-2 inline-block max-w-full">
                      {postVideo ? (
                        <video src={postVideo} className="rounded-xl max-h-48" controls playsInline />
                      ) : (
                        <img src={postMedia} alt="" className="rounded-xl max-h-48 object-cover" />
                      )}
                      <button
                        onClick={() => { setPostMedia(''); setPostVideo(''); }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: '#B01E36', color: 'white' }}>
                        ×
                      </button>
                    </div>
                  )}

                  {/* video upload progress */}
                  {videoProgress !== null && (
                    <div className="mt-2 rounded-full overflow-hidden h-1.5" style={{ background: 'var(--fg5)' }}>
                      <div className="h-full transition-all" style={{ width: `${videoProgress}%`, background: 'linear-gradient(90deg,#B01E36,#D63A52)' }} />
                    </div>
                  )}

                  {/* poll creation form */}
                  {showPoll && (
                    <div className="mt-3 p-3 rounded-xl space-y-2" style={{ background: 'var(--sur)', border: '1px solid var(--fg5)' }}>
                      <input
                        value={pollQuestion}
                        onChange={e => setPollQuestion(e.target.value)}
                        placeholder="Ask a question…"
                        className="input-field text-sm"
                      />
                      {pollOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            value={opt}
                            onChange={e => {
                              const next = [...pollOptions];
                              next[i] = e.target.value;
                              setPollOptions(next);
                            }}
                            placeholder={`Option ${i + 1}`}
                            className="input-field text-sm flex-1"
                          />
                          {pollOptions.length > 2 && (
                            <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))}
                              className="text-xs" style={{ color: 'var(--fg4)' }}>✕</button>
                          )}
                        </div>
                      ))}
                      {pollOptions.length < 4 && (
                        <button onClick={() => setPollOptions(prev => [...prev, ''])}
                          className="text-xs" style={{ color: '#B01E36' }}>
                          + Add option
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    {/* media buttons */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {/* Photo */}
                      <button onClick={() => postImgRef.current?.click()} disabled={uploadingImg || !!postVideo}
                        title="Add photo"
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--fg3)', border: '1px solid var(--fg5)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
                        {uploadingImg
                          ? <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>}
                        Photo
                      </button>
                      <input ref={postImgRef} type="file" accept="image/*" className="hidden" onChange={handlePostImage} />

                      {/* Video */}
                      <button onClick={() => postVideoRef.current?.click()} disabled={uploadingVideo || !!postMedia}
                        title="Add video"
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--fg3)', border: '1px solid var(--fg5)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
                        {uploadingVideo
                          ? <span className="text-[10px]">{videoProgress}%</span>
                          : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.693v6.614a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>}
                        Video
                      </button>
                      <input ref={postVideoRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/mov" className="hidden" onChange={handlePostVideo} />

                      {/* Camera */}
                      <button onClick={openCamera}
                        title="Use camera"
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--fg3)', border: '1px solid var(--fg5)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Camera
                      </button>

                      {/* GIF */}
                      <button onClick={() => setShowGifPicker(true)}
                        title="Add GIF"
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors font-bold"
                        style={{ color: 'var(--fg3)', border: '1px solid var(--fg5)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
                        GIF
                      </button>

                      {/* Poll */}
                      <button onClick={() => setShowPoll(v => !v)}
                        title="Create poll"
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                        style={{
                          color: showPoll ? '#B01E36' : 'var(--fg3)',
                          border: showPoll ? '1px solid #B01E36' : '1px solid var(--fg5)',
                          background: showPoll ? 'rgba(176,30,54,0.08)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (!showPoll) e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={e => { if (!showPoll) e.currentTarget.style.color = 'var(--fg3)'; }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Poll
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs hidden sm:block" style={{ color: 'var(--fg4)' }}>Ctrl+Enter</span>
                      <button onClick={handlePost} disabled={posting || (!content.trim() && !postMedia && !postVideo && !(showPoll && pollQuestion.trim()))} className="btn-primary text-sm py-2 px-5">
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

      {/* Camera modal */}
      {showCamera && (
        <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#000' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <button onClick={closeCamera} className="text-white/70 hover:text-white text-sm">Cancel</button>
            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
              {(['photo', 'video'] as const).map(m => (
                <button key={m} onClick={() => { setCameraMode(m); if (isRecording) stopRecording(); }}
                  className="px-4 py-1.5 text-sm font-medium transition-colors"
                  style={{ background: cameraMode === m ? 'rgba(255,255,255,0.25)' : 'transparent', color: 'white' }}>
                  {m === 'photo' ? '📷 Photo' : '🎬 Video'}
                </button>
              ))}
            </div>
            <div className="w-16" />
          </div>

          {/* Camera preview or captured preview */}
          <div className="flex-1 relative overflow-hidden flex items-center justify-center">
            {capturedMedia ? (
              capturedMedia.type === 'photo'
                ? <img src={capturedMedia.url} alt="captured" className="max-w-full max-h-full object-contain" />
                : <video src={capturedMedia.url} controls playsInline className="max-w-full max-h-full" />
            ) : (
              <video ref={cameraVideoRef} playsInline muted autoPlay className="max-w-full max-h-full" />
            )}
            {isRecording && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full"
                style={{ background: 'rgba(176,30,54,0.85)' }}>
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-white text-xs font-semibold">Recording</span>
              </div>
            )}
          </div>

          {/* Hidden canvas for photo capture */}
          <canvas ref={cameraCanvasRef} className="hidden" />

          {/* Controls */}
          <div className="flex items-center justify-center gap-8 px-8 py-6 flex-shrink-0">
            {capturedMedia ? (
              <>
                <button onClick={() => setCapturedMedia(null)}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
                  Retake
                </button>
                <button onClick={useCapturedMedia}
                  className="px-8 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                  Use this
                </button>
              </>
            ) : (
              <button
                onClick={cameraMode === 'photo' ? capturePhoto : isRecording ? stopRecording : startRecording}
                className="w-16 h-16 rounded-full flex items-center justify-center transition-transform active:scale-95"
                style={{
                  background: isRecording ? '#B01E36' : 'white',
                  border: '3px solid rgba(255,255,255,0.5)',
                }}>
                {cameraMode === 'video' && isRecording
                  ? <div className="w-5 h-5 rounded-sm" style={{ background: 'white' }} />
                  : <div className="w-10 h-10 rounded-full" style={{ background: isRecording ? 'white' : '#1a0a0a' }} />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
