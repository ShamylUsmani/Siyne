'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  doc, getDoc, setDoc,
  collection, query, where, orderBy, getDocs,
  updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import PostCard, { Post } from '@/components/PostCard';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; });
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => { if (blob) resolve(blob); else reject(new Error('Canvas empty')); }, 'image/jpeg', 0.92);
  });
}

interface WorkExp {
  id: string;
  title: string;
  company: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  current: boolean;
  description: string;
}

interface UserProfile {
  name:           string;
  email:          string;
  jobTitle:       string;
  company:        string;
  bio:            string;
  photoURL:       string;
  coverURL:       string;
  workExperience: WorkExp[];
  verified?:      boolean;
}

const EMPTY: UserProfile = {
  name: '', email: '', jobTitle: '', company: '', bio: '',
  photoURL: '', coverURL: '', workExperience: [],
};

const EMPTY_EXP: Omit<WorkExp, 'id'> = {
  title: '', company: '', startMonth: '', startYear: '', endMonth: '', endYear: '', current: false, description: '',
};

function formatExpDate(month: string, year: string) {
  return month && year ? `${month} ${year}` : year || month || '';
}

async function uploadImage(file: File, path: string): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const profileUid = params.uid as string;

  const [profile, setProfile]     = useState<UserProfile>(EMPTY);
  const [posts, setPosts]         = useState<Post[]>([]);
  const [editing, setEditing]     = useState(false);
  const [form, setForm]           = useState<UserProfile>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [fetching, setFetching]   = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover]   = useState(false);
  const [addingExp, setAddingExp] = useState(false);
  const [expForm, setExpForm]     = useState<Omit<WorkExp, 'id'>>(EMPTY_EXP);
  const [savingExp, setSavingExp] = useState(false);
  const [imgError, setImgError]   = useState('');
  const [isFollowing, setIsFollowing] = useState(false);

  /* crop modal state */
  const [cropSrc, setCropSrc]           = useState<string | null>(null);
  const [crop, setCrop]                 = useState({ x: 0, y: 0 });
  const [zoom, setZoom]                 = useState(1);
  const [croppedArea, setCroppedArea]   = useState<Area | null>(null);
  const cropFileNameRef                 = useRef('avatar.jpg');
  const onCropComplete = useCallback((_: Area, pixels: Area) => setCroppedArea(pixels), []);
  const [followBusy, setFollowBusy]   = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const isOwn = user?.uid === profileUid;

  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [user, loading, router]);

  useEffect(() => {
    if (!profileUid) return;
    async function load() {
      setFetching(true);
      const snap = await getDoc(doc(db, 'users', profileUid));
      if (snap.exists()) {
        const data = { ...EMPTY, ...snap.data() } as UserProfile;
        setProfile(data);
        setForm(data);
      }
      const q = query(
        collection(db, 'posts'),
        where('uid', '==', profileUid),
        orderBy('createdAt', 'desc')
      );
      const postSnap = await getDocs(q);
      setPosts(postSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));

      // check if current user follows this profile
      if (user && user.uid !== profileUid) {
        const myDoc = await getDoc(doc(db, 'users', user.uid));
        const myFollowing: string[] = myDoc.data()?.following ?? [];
        setIsFollowing(myFollowing.includes(profileUid));
      }
      setFetching(false);
    }
    load();
  }, [profileUid, user]);

  /* open crop modal when file is selected */
  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    cropFileNameRef.current = file.name;
    const objectUrl = URL.createObjectURL(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setCropSrc(objectUrl);
    e.target.value = '';
  }

  /* called when user clicks Apply in the crop modal */
  async function applyCrop() {
    if (!cropSrc || !croppedArea || !user) return;
    setCropSrc(null);
    setImgError('');
    setUploadingAvatar(true);
    try {
      const blob = await getCroppedImg(cropSrc, croppedArea);
      const croppedFile = new File([blob], cropFileNameRef.current, { type: 'image/jpeg' });
      const localPreview = URL.createObjectURL(blob);
      setProfile(prev => ({ ...prev, photoURL: localPreview }));
      const url = await uploadImage(croppedFile, `users/${user.uid}/profile-picture`);
      setProfile(prev => ({ ...prev, photoURL: url }));
      try {
        await setDoc(doc(db, 'users', user.uid), { photoURL: url }, { merge: true });
        await updateProfile(user, { photoURL: url }).catch(() => {});
      } catch {
        setImgError('Photo saved to Storage but could not update your profile. Check Firestore rules.');
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      setImgError('Upload failed. Check Firebase Storage rules allow writes to users/{userId}/*');
      setProfile(prev => ({ ...prev, photoURL: '' }));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImgError('');
    setUploadingCover(true);
    const localPreview = URL.createObjectURL(file);
    setProfile(prev => ({ ...prev, coverURL: localPreview }));
    try {
      const url = await uploadImage(file, `users/${user.uid}/cover`);
      setProfile(prev => ({ ...prev, coverURL: url }));
      try {
        await setDoc(doc(db, 'users', user.uid), { coverURL: url }, { merge: true });
      } catch (fsErr) {
        console.error('Firestore save failed:', fsErr);
        setImgError('Cover uploaded but could not be saved. Check Firestore rules.');
      }
    } catch (err) {
      console.error('Cover upload failed:', err);
      setImgError('Cover upload failed. Check that Firebase Storage is enabled and rules allow writes.');
      setProfile(prev => ({ ...prev, coverURL: '' }));
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !isOwn) return;
    setSaving(true);
    const updated = { ...form, email: user.email ?? '', workExperience: profile.workExperience };
    await setDoc(doc(db, 'users', user.uid), updated, { merge: true });
    setProfile(prev => ({ ...prev, ...form }));
    setSaving(false);
    setEditing(false);
  }

  async function handleAddExp(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !isOwn) return;
    setSavingExp(true);
    const newExp: WorkExp = {
      ...expForm,
      id: Date.now().toString(),
      endMonth: expForm.current ? '' : expForm.endMonth,
      endYear: expForm.current ? '' : expForm.endYear,
    };
    const updated = [...profile.workExperience, newExp];
    await setDoc(doc(db, 'users', user.uid), { workExperience: updated }, { merge: true });
    setProfile(prev => ({ ...prev, workExperience: updated }));
    setExpForm(EMPTY_EXP);
    setAddingExp(false);
    setSavingExp(false);
  }

  async function handleDeleteExp(id: string) {
    if (!user || !isOwn) return;
    const updated = profile.workExperience.filter(e => e.id !== id);
    await setDoc(doc(db, 'users', user.uid), { workExperience: updated }, { merge: true });
    setProfile(prev => ({ ...prev, workExperience: updated }));
  }

  async function handleFollowToggle() {
    if (!user || isOwn) return;
    setFollowBusy(true);
    const ref = doc(db, 'users', user.uid);
    try {
      if (isFollowing) {
        await updateDoc(ref, { following: arrayRemove(profileUid) });
        setIsFollowing(false);
      } else {
        await updateDoc(ref, { following: arrayUnion(profileUid) });
        setIsFollowing(true);
        await addDoc(collection(db, 'notifications', profileUid, 'items'), {
          type: 'follow', fromUid: user.uid,
          fromName: user.displayName ?? 'Someone',
          text: 'started following you',
          read: false, createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    } catch {}
    setFollowBusy(false);
  }

  function removePost(id: string) {
    setPosts(prev => prev.filter(p => p.id !== id));
  }

  if (loading || !user) return null;

  const displayName = profile.name || user.displayName || 'Unnamed User';
  const initials = displayName[0].toUpperCase();

  const lbl = { color: 'var(--fg3)', fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '6px' };
  const lblXs = { color: 'var(--fg3)', fontSize: '0.75rem', fontWeight: 500, display: 'block', marginBottom: '4px' };

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* ── crop modal ─────────────────────────────── */}
      {cropSrc && (
        <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: 'rgba(0,0,0,0.95)' }}>
          {/* header */}
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
            <h2 className="font-semibold text-base" style={{ color: 'var(--fg1)' }}>Adjust photo</h2>
            <button onClick={() => setCropSrc(null)} className="text-sm px-4 py-1.5 rounded-lg"
              style={{ color: 'var(--fg3)', border: '1px solid var(--fg5)' }}>
              Cancel
            </button>
          </div>

          {/* crop area */}
          <div className="relative flex-1">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* controls */}
          <div className="px-6 py-5 flex-shrink-0 space-y-4">
            <div className="flex items-center gap-4">
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--fg4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="range" min={1} max={3} step={0.05} value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-[#D63A52]"
                style={{ background: `linear-gradient(to right, #D63A52 ${((zoom - 1) / 2) * 100}%, var(--fg5) 0%)` }} />
              <svg className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--fg4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--fg4)' }}>Drag to reposition · Pinch or slide to zoom</p>
            <button onClick={applyCrop} className="btn-primary w-full py-3 text-base font-semibold">
              {uploadingAvatar ? 'Uploading…' : 'Apply'}
            </button>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8">
        {fetching ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--fg4)' }}>Loading profile…</div>
        ) : (
          <>
            {imgError && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm"
                style={{ background: 'rgba(220,38,38,0.18)', border: '1px solid rgba(220,38,38,0.28)', color: '#fca5a5' }}>
                {imgError}
              </div>
            )}

            {/* Profile header card */}
            <div className="card overflow-hidden p-0 mb-4">
              {/* Cover */}
              <div className="relative h-44 overflow-hidden"
                style={profile.coverURL
                  ? { backgroundImage: `url(${profile.coverURL})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: 'linear-gradient(135deg, #8A1228 0%, #4A0818 60%, #2A0510 100%)' }}>
                {isOwn && (
                  <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}
                    className="upload-hover absolute inset-0 w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 bg-black/30 transition-opacity cursor-pointer">
                    <span className="text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {uploadingCover ? 'Uploading…' : 'Change cover'}
                    </span>
                  </button>
                )}
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
              </div>

              {/* Avatar + info */}
              <div className="px-4 sm:px-6 pb-6 relative z-10">
                <div className="flex items-end justify-between -mt-10 mb-4">
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <div className="w-20 h-20 rounded-full border-[3px] flex items-center justify-center font-bold text-2xl overflow-hidden shadow-md"
                      style={{ borderColor: 'var(--fg5)', background: 'var(--fg5)', color: 'var(--fg1)' }}>
                      {profile.photoURL
                        ? <img src={profile.photoURL} alt={displayName} className="w-full h-full object-cover" />
                        : <span>{initials}</span>}
                    </div>
                    {isOwn && (
                      <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
                        className="upload-hover absolute inset-0 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 transition-opacity cursor-pointer">
                        {uploadingAvatar
                          ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>}
                      </button>
                    )}
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </div>
                  <div className="flex gap-2">
                    {isOwn && !editing && (
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => setEditing(true)} className="btn-outline text-sm py-1.5 px-4">Edit profile</button>
                      <Link href="/companies/new"
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        style={{ border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
                        + Company page
                      </Link>
                    </div>
                  )}
                    {!isOwn && !editing && (
                      <>
                        <button onClick={handleFollowToggle} disabled={followBusy}
                          className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-all"
                          style={isFollowing
                            ? { background: 'var(--fg5)', color: 'var(--fg2)', border: '1px solid var(--fg5)' }
                            : { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                          {followBusy ? '…' : isFollowing ? 'Following' : 'Follow'}
                        </button>
                        <Link href={`/messages/${[user.uid, profileUid].sort().join('_')}`}
                          className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors btn-outline">
                          Message
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                {!editing ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl font-bold" style={{ color: 'var(--fg1)' }}>{displayName}</h1>
                      {profile.verified && (
                        <svg className="w-5 h-5 flex-shrink-0" style={{ color: '#60a5fa' }} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    {profile.jobTitle && (
                      <p className="text-sm mt-0.5" style={{ color: 'var(--fg2)' }}>
                        {profile.jobTitle}
                        {profile.company && <span style={{ color: 'var(--fg4)' }}> · {profile.company}</span>}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: 'var(--fg4)' }}>{profile.email || user.email}</p>
                    {isOwn && !profile.jobTitle && !profile.bio && (
                      <p className="mt-3 text-sm italic" style={{ color: 'var(--fg4)' }}>
                        Add your job title and bio to complete your profile.
                      </p>
                    )}
                  </>
                ) : (
                  <form onSubmit={handleSave} className="space-y-4 mt-2">
                    <h2 className="font-semibold" style={{ color: 'var(--fg1)' }}>Edit Profile</h2>
                    <div><label style={lbl}>Full name</label>
                      <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Jane Smith" /></div>
                    <div><label style={lbl}>Job title</label>
                      <input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} className="input-field" placeholder="Senior Product Designer" /></div>
                    <div><label style={lbl}>Company</label>
                      <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="input-field" placeholder="Acme Inc." /></div>
                    <div><label style={lbl}>Bio</label>
                      <textarea rows={3} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} className="input-field resize-none" placeholder="A short bio about yourself…" /></div>
                    <div className="flex gap-3 pt-1">
                      <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-5">{saving ? 'Saving…' : 'Save changes'}</button>
                      <button type="button" onClick={() => setEditing(false)} className="text-sm py-2 px-3" style={{ color: 'var(--fg3)' }}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* About */}
            {profile.bio && !editing && (
              <div className="card mb-4">
                <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--fg1)' }}>About</h2>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--fg2)' }}>{profile.bio}</p>
              </div>
            )}

            {/* Work Experience */}
            <div className="card mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--fg1)' }}>Experience</h2>
                {isOwn && !addingExp && (
                  <button onClick={() => setAddingExp(true)} title="Add experience"
                    className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                    style={{ border: '1px solid var(--fg5)', color: 'rgba(255,255,255,0.48)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                )}
              </div>

              {profile.workExperience.length === 0 && !addingExp && (
                <p className="text-sm italic" style={{ color: 'var(--fg4)' }}>
                  {isOwn ? 'Add your work experience.' : 'No experience listed yet.'}
                </p>
              )}

              <div className="space-y-5">
                {profile.workExperience.map((exp, i) => (
                  <div key={exp.id} className="flex gap-3"
                    style={i > 0 ? { paddingTop: '20px', borderTop: '1px solid var(--sur)' } : {}}>
                    <div className="w-10 h-10 rounded-md flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: 'var(--fg5)', border: '1px solid var(--fg5)', color: 'var(--fg2)' }}>
                      {exp.company?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--fg1)' }}>{exp.title}</p>
                          <p className="text-sm" style={{ color: 'var(--fg2)' }}>{exp.company}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--fg4)' }}>
                            {formatExpDate(exp.startMonth, exp.startYear)} – {exp.current ? 'Present' : formatExpDate(exp.endMonth, exp.endYear)}
                          </p>
                        </div>
                        {isOwn && (
                          <button onClick={() => handleDeleteExp(exp.id)}
                            className="text-xs flex-shrink-0 transition-colors" style={{ color: 'var(--fg4)' }}>
                            Remove
                          </button>
                        )}
                      </div>
                      {exp.description && (
                        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--fg3)' }}>{exp.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {addingExp && (
                <form onSubmit={handleAddExp} className="mt-4 space-y-3"
                  style={{ paddingTop: '16px', borderTop: '1px solid var(--fg5)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--fg1)' }}>Add experience</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label style={lblXs}>Job title *</label>
                      <input required value={expForm.title} onChange={e => setExpForm({ ...expForm, title: e.target.value })} className="input-field text-sm" placeholder="Software Engineer" /></div>
                    <div><label style={lblXs}>Company *</label>
                      <input required value={expForm.company} onChange={e => setExpForm({ ...expForm, company: e.target.value })} className="input-field text-sm" placeholder="Google" /></div>
                    <div><label style={lblXs}>Start month</label>
                      <select value={expForm.startMonth} onChange={e => setExpForm({ ...expForm, startMonth: e.target.value })} className="input-field text-sm">
                        {['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
                          <option key={m} value={m}>{m || 'Month'}</option>
                        ))}
                      </select></div>
                    <div><label style={lblXs}>Start year *</label>
                      <input required value={expForm.startYear} onChange={e => setExpForm({ ...expForm, startYear: e.target.value })} className="input-field text-sm" placeholder="2020" /></div>
                    <div><label style={lblXs}>End month</label>
                      <select disabled={expForm.current} value={expForm.endMonth} onChange={e => setExpForm({ ...expForm, endMonth: e.target.value })} className="input-field text-sm disabled:opacity-40">
                        {['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
                          <option key={m} value={m}>{m || 'Month'}</option>
                        ))}
                      </select></div>
                    <div><label style={lblXs}>End year</label>
                      <input disabled={expForm.current} value={expForm.endYear} onChange={e => setExpForm({ ...expForm, endYear: e.target.value })} className="input-field text-sm disabled:opacity-40" placeholder="2023" /></div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: 'var(--fg2)' }}>
                    <input type="checkbox" checked={expForm.current} onChange={e => setExpForm({ ...expForm, current: e.target.checked, endMonth: '', endYear: '' })} className="accent-navy-600 rounded" />
                    I currently work here
                  </label>
                  <div><label style={lblXs}>Description</label>
                    <textarea rows={2} value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} className="input-field text-sm resize-none" placeholder="Brief description of your role…" /></div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={savingExp} className="btn-primary text-sm py-2 px-4">{savingExp ? 'Saving…' : 'Add'}</button>
                    <button type="button" onClick={() => { setAddingExp(false); setExpForm(EMPTY_EXP); }}
                      className="text-sm py-2 px-3" style={{ color: 'var(--fg3)' }}>Cancel</button>
                  </div>
                </form>
              )}
            </div>

            {/* Posts */}
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--fg4)' }}>
              Posts · {posts.length}
            </h2>
            {posts.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--fg4)' }}>
                <p className="text-sm">{isOwn ? "You haven't posted anything yet." : 'No posts yet.'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map(post => <PostCard key={post.id} post={post} onDelete={removePost} />)}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
