'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  doc, getDoc, setDoc, deleteDoc, addDoc, updateDoc,
  collection, query, where, orderBy, getDocs, onSnapshot,
  serverTimestamp, increment, deleteField,
} from 'firebase/firestore';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import JobCard from '@/components/JobCard';
import { type Job } from '@/components/JobCard';

/* ── types ──────────────────────────────────────────── */
interface Company {
  id:            string;
  name:          string;
  industry:      string;
  size:          string;
  founded:       string;
  location:      string;
  website:       string;
  description:   string;
  logoUrl:       string;
  photoUrls:     string[];
  socialLinks:   Record<string, string>;
  followerCount: number;
  verified:      boolean;
  createdBy:     string;
}

interface CompanyPost {
  id:          string;
  companyId:   string;
  content:     string;
  createdBy:   string;
  createdAt:   { seconds: number } | null;
  likes:       number;
  reactions:   Record<string, string>;
  commentCount: number;
}

interface Review {
  id:              string;
  overall:         number;
  management:      number;
  workLifeBalance: number;
  culture:         number;
  salary:          number;
  careerGrowth:    number;
  jobTitle:        string;
  comment?:        string;
  createdAt:       { seconds: number } | null;
}

const REVIEW_CATS = [
  { key: 'overall',         label: 'Overall' },
  { key: 'management',      label: 'Management' },
  { key: 'workLifeBalance', label: 'Work / Life Balance' },
  { key: 'culture',         label: 'Culture & Values' },
  { key: 'salary',          label: 'Salary & Benefits' },
  { key: 'careerGrowth',    label: 'Career Growth' },
] as const;
type ReviewKey = typeof REVIEW_CATS[number]['key'];

/* ── star component ─────────────────────────────────── */
function Stars({ value, onChange, size = 5 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hov, setHov] = useState(0);
  return (
    <div className="flex gap-0.5" onMouseLeave={() => setHov(0)}>
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button"
          disabled={!onChange}
          onClick={() => onChange?.(s)}
          onMouseEnter={() => setHov(s)}
          className="transition-transform hover:scale-110 disabled:cursor-default"
          style={{ fontSize: `${size * 4}px`, color: s <= (hov || value) ? '#fbbf24' : 'var(--fg5)', lineHeight: 1 }}>
          ★
        </button>
      ))}
    </div>
  );
}

/* ── rating bar ─────────────────────────────────────── */
function RatingBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--fg5)' }}>
        <div className="h-full rounded-full" style={{ width: `${(score/5)*100}%`, background: 'linear-gradient(90deg,#f59e0b,#fbbf24)' }} />
      </div>
      <span className="text-sm font-semibold w-7 text-right" style={{ color: 'var(--fg2)' }}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

/* ── page ───────────────────────────────────────────── */
type Tab = 'about' | 'updates' | 'jobs' | 'reviews';

export default function CompanyPage() {
  const { user, loading: authLoading } = useAuth();
  const router  = useRouter();
  const params  = useParams();
  const cid     = params.companyId as string;

  const [company,     setCompany]     = useState<Company | null>(null);
  const [tab,         setTab]         = useState<Tab>('about');
  const [isAdmin,     setIsAdmin]     = useState(false);
  const [adminRole,   setAdminRole]   = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy,  setFollowBusy]  = useState(false);
  const [fetching,    setFetching]    = useState(true);

  /* ─ Updates tab ─ */
  const [posts,        setPosts]       = useState<CompanyPost[]>([]);
  const [postContent,  setPostContent] = useState('');
  const [posting,      setPosting]     = useState(false);

  /* ─ Jobs tab ─ */
  const [siynJobs,     setSiynJobs]    = useState<Job[]>([]);
  const [extJobs,      setExtJobs]     = useState<{ id: string; title: string; company: { display_name: string }; location: { display_name: string }; salary_min?: number; salary_max?: number; created: string; redirect_url: string }[]>([]);
  const [loadingExt,   setLoadingExt]  = useState(false);
  const [showJobForm,  setShowJobForm] = useState(false);

  /* ─ Reviews tab ─ */
  const [reviews,      setReviews]     = useState<Review[]>([]);
  const [myReview,     setMyReview]    = useState<Partial<Record<ReviewKey, number>> & { jobTitle?: string; comment?: string } | null>(null);
  const [reviewForm,   setReviewForm]  = useState<Record<ReviewKey, number>>({ overall:0,management:0,workLifeBalance:0,culture:0,salary:0,careerGrowth:0 });
  const [reviewTitle,  setReviewTitle] = useState('');
  const [reviewComment,setReviewComment] = useState('');
  const [reviewBusy,   setReviewBusy]  = useState(false);
  const [reviewError,  setReviewError] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);

  /* ─ Edit modal ─ */
  const [editing,      setEditing]     = useState(false);
  const [editForm,     setEditForm]    = useState<Partial<Company>>({});

  /* photo upload */
  const photoRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  /* ── fetch on mount ── */
  useEffect(() => {
    if (!cid) return;
    async function load() {
      const [cDoc, followDoc] = await Promise.all([
        getDoc(doc(db, 'companies', cid)),
        user ? getDoc(doc(db, 'companyFollowers', `${cid}_${user.uid}`)) : Promise.resolve(null),
      ]);
      if (!cDoc.exists()) { setFetching(false); return; }
      const c = { id: cDoc.id, ...cDoc.data() } as Company;
      setCompany(c);
      setEditForm(c);
      if (followDoc?.exists()) setIsFollowing(true);

      if (user) {
        const adminDoc = await getDoc(doc(db, 'companyAdmins', `${cid}_${user.uid}`));
        if (adminDoc.exists()) { setIsAdmin(true); setAdminRole(adminDoc.data().role); }
      }
      setFetching(false);
    }
    load();
  }, [cid, user]);

  /* ── real-time posts ── */
  useEffect(() => {
    if (tab !== 'updates') return;
    const q = query(collection(db, 'companyPosts'), where('companyId','==',cid), orderBy('createdAt','desc'));
    return onSnapshot(q, snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyPost))));
  }, [cid, tab]);

  /* ── load jobs ── */
  useEffect(() => {
    if (tab !== 'jobs' || !company) return;
    getDocs(query(collection(db, 'jobs'), where('company','==',company.name), orderBy('createdAt','desc')))
      .then(snap => setSiynJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Job))));
    /* Adzuna */
    setLoadingExt(true);
    fetch(`/api/adzuna?what=${encodeURIComponent(company.name)}&where=au`)
      .then(r => r.json())
      .then(d => setExtJobs(d.results ?? []))
      .catch(() => {})
      .finally(() => setLoadingExt(false));
  }, [tab, company]);

  /* ── load reviews ── */
  useEffect(() => {
    if (tab !== 'reviews') return;
    /* no orderBy — avoids composite index requirement; sort client-side instead */
    getDocs(query(collection(db, 'companyReviews'), where('companyId','==',cid)))
      .then(snap => {
        const all: Review[] = snap.docs.map(d => ({
          id: d.id,
          overall: d.data().overall, management: d.data().management,
          workLifeBalance: d.data().workLifeBalance, culture: d.data().culture,
          salary: d.data().salary, careerGrowth: d.data().careerGrowth,
          jobTitle: d.data().jobTitle ?? '',
          comment:  d.data().comment ?? '',
          createdAt: d.data().createdAt,
        }));
        all.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setReviews(all);
      })
      .catch(err => console.error('Reviews load failed:', err));
    if (user) {
      getDoc(doc(db, 'companyReviews', `${cid}_${user.uid}`)).then(d => {
        if (d.exists()) {
          setMyReview(d.data() as typeof myReview);
          setReviewForm({
            overall: d.data().overall ?? 0,
            management: d.data().management ?? 0,
            workLifeBalance: d.data().workLifeBalance ?? 0,
            culture: d.data().culture ?? 0,
            salary: d.data().salary ?? 0,
            careerGrowth: d.data().careerGrowth ?? 0,
          });
          setReviewTitle(d.data().jobTitle ?? '');
          setReviewComment(d.data().comment ?? '');
        }
      });
    }
  }, [tab, cid, user]);

  /* ── follow ── */
  async function toggleFollow() {
    if (!user) { router.push('/auth'); return; }
    setFollowBusy(true);
    const fid = `${cid}_${user.uid}`;
    try {
      if (isFollowing) {
        await deleteDoc(doc(db, 'companyFollowers', fid));
        await updateDoc(doc(db, 'companies', cid), { followerCount: increment(-1) });
        setIsFollowing(false);
        setCompany(c => c ? { ...c, followerCount: c.followerCount - 1 } : c);
      } else {
        await setDoc(doc(db, 'companyFollowers', fid), { companyId: cid, userId: user.uid, followedAt: serverTimestamp() });
        await updateDoc(doc(db, 'companies', cid), { followerCount: increment(1) });
        setIsFollowing(true);
        setCompany(c => c ? { ...c, followerCount: c.followerCount + 1 } : c);
      }
    } catch {}
    setFollowBusy(false);
  }

  /* ── post update ── */
  async function handlePost() {
    if (!user || !postContent.trim() || !company) return;
    setPosting(true);
    try {
      const postRef = await addDoc(collection(db, 'companyPosts'), {
        companyId: cid, content: postContent.trim(),
        createdBy: user.uid, createdAt: serverTimestamp(),
        likes: 0, reactions: {}, commentCount: 0,
      });
      /* notify followers */
      const followers = await getDocs(query(collection(db, 'companyFollowers'), where('companyId','==',cid)));
      await Promise.all(followers.docs.filter(d => d.data().userId !== user.uid).map(d =>
        addDoc(collection(db, 'notifications', d.data().userId, 'items'), {
          type: 'company_post', fromUid: cid, fromName: company.name,
          postId: postRef.id, text: `posted a new update`,
          read: false, createdAt: serverTimestamp(),
        }).catch(() => {})
      ));
      setPostContent('');
    } finally { setPosting(false); }
  }

  /* ── delete post ── */
  async function deletePost(postId: string) {
    await deleteDoc(doc(db, 'companyPosts', postId));
  }

  /* ── like post ── */
  async function likePost(post: CompanyPost) {
    if (!user) return;
    const ref = doc(db, 'companyPosts', post.id);
    const rx  = post.reactions ?? {};
    if (rx[user.uid]) {
      const nx = { ...rx }; delete nx[user.uid];
      await updateDoc(ref, { [`reactions.${user.uid}`]: deleteField(), likes: increment(-1) });
    } else {
      await updateDoc(ref, { [`reactions.${user.uid}`]: 'like', likes: increment(1) });
    }
  }

  /* ── upload culture photo ── */
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !company) return;
    setUploadingPhoto(true);
    try {
      const r = sRef(storage, `companies/${cid}/photos/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      const newUrls = [...(company.photoUrls ?? []), url];
      await updateDoc(doc(db, 'companies', cid), { photoUrls: newUrls });
      setCompany(c => c ? { ...c, photoUrls: newUrls } : c);
    } catch {}
    setUploadingPhoto(false);
  }

  /* ── save edits ── */
  async function saveEdits() {
    if (!company) return;
    await updateDoc(doc(db, 'companies', cid), {
      description: editForm.description ?? company.description,
      website:     editForm.website     ?? company.website,
      location:    editForm.location    ?? company.location,
      size:        editForm.size        ?? company.size,
      socialLinks: editForm.socialLinks ?? company.socialLinks,
    });
    setCompany(c => c ? { ...c, ...editForm } : c);
    setEditing(false);
  }

  /* ── submit review ── */
  async function submitReview() {
    if (!user) return;
    if (!reviewForm.overall) { setReviewError('Please rate Overall at minimum.'); return; }
    setReviewBusy(true);
    setReviewError('');
    try {
      const docId = `${cid}_${user.uid}`;
      const existing = await getDoc(doc(db, 'companyReviews', docId));
      await setDoc(doc(db, 'companyReviews', docId), {
        companyId: cid,
        userId:    user.uid,
        ...reviewForm,
        jobTitle:  reviewTitle,
        comment:   reviewComment.trim(),
        createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setMyReview({ ...reviewForm, jobTitle: reviewTitle, comment: reviewComment.trim() });
      setShowReviewForm(false);
      /* refresh reviews */
      getDocs(query(collection(db, 'companyReviews'), where('companyId','==',cid)))
        .then(snap => {
          const all: Review[] = snap.docs.map(d => ({
            id: d.id,
            overall: d.data().overall, management: d.data().management,
            workLifeBalance: d.data().workLifeBalance, culture: d.data().culture,
            salary: d.data().salary, careerGrowth: d.data().careerGrowth,
            jobTitle: d.data().jobTitle ?? '', comment: d.data().comment ?? '',
            createdAt: d.data().createdAt,
          }));
          all.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
          setReviews(all);
        }).catch(() => {});
    } catch (err: unknown) {
      console.error('Review submission failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
        setReviewError('Permission denied. Add this rule to Firebase Console → Firestore → Rules:\n  match /companyReviews/{docId} { allow read, write: if request.auth != null; }');
      } else {
        setReviewError(`Failed to submit: ${msg}`);
      }
    }
    setReviewBusy(false);
  }

  /* ── helpers ── */
  function avg(key: ReviewKey): number {
    const vals = reviews.map(r => r[key]).filter(Boolean) as number[];
    return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : 0;
  }
  function dist(ratings: number[]) {
    const counts = [0,0,0,0,0];
    ratings.forEach(r => { if (r>=1&&r<=5) counts[r-1]++; });
    return counts.reverse(); // [5,4,3,2,1]
  }
  function fmtSalary(min?: number, max?: number): string | null {
    if (!min && !max) return null;
    const f = (n: number) => n>=1000 ? `$${Math.round(n/1000)}k` : `$${n}`;
    if (min && max && min!==max) return `${f(min)} – ${f(max)}`;
    return min ? `From ${f(min)}` : `Up to ${f(max!)}`;
  }
  function fmtDate(iso: string) {
    const d = new Date(iso), days = Math.floor((Date.now()-d.getTime())/86400000);
    if (days===0) return 'Today'; if (days===1) return 'Yesterday';
    if (days<7) return `${days}d ago`; if (days<30) return `${Math.floor(days/7)}w ago`;
    return d.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
  }
  function timeAgo(s: number) {
    const m=Math.floor((Date.now()-s*1000)/60000);
    if(m<1) return 'just now'; if(m<60) return `${m}m`;
    const h=Math.floor(m/60); if(h<24) return `${h}h`;
    return `${Math.floor(h/24)}d`;
  }

  if (authLoading || fetching) return <div className="min-h-screen"><Navbar /></div>;
  if (!company) return (
    <div className="min-h-screen"><Navbar />
      <div className="text-center py-24" style={{color:'var(--fg4)'}}>
        <p className="text-xl font-bold mb-2">Company not found</p>
        <Link href="/search" style={{color:'#D63A52'}} className="text-sm hover:underline">Browse companies</Link>
      </div>
    </div>
  );

  /* ── render ── */
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* ─── HEADER ─── */}
        <div className="card mb-6">
          {/* cover strip */}
          <div className="rounded-t-xl -mx-6 -mt-6 mb-5 h-28 overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#4A0818 0%,#8A1228 60%,#B01E36 100%)' }} />

          <div className="flex items-start gap-4 -mt-14 mb-4 relative">
            {/* logo */}
            <div className="w-20 h-20 rounded-xl border-4 flex-shrink-0 flex items-center justify-center font-bold text-2xl overflow-hidden"
              style={{ borderColor: 'rgba(8,4,4,0.80)', background: company.logoUrl ? 'transparent' : 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
              {company.logoUrl ? <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" /> : company.name[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 pt-10">
              {/* spacer */}
            </div>
            <div className="flex gap-2 pt-10">
              {isAdmin && (
                <>
                  <Link href={`/companies/${cid}/manage`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ border: '1px solid var(--fg5)', color: 'var(--fg2)' }}>
                    Manage
                  </Link>
                  <button onClick={() => setEditing(true)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ border: '1px solid var(--fg5)', color: 'var(--fg2)' }}>
                    Edit
                  </button>
                </>
              )}
              <button onClick={toggleFollow} disabled={followBusy}
                className="text-sm font-semibold px-5 py-1.5 rounded-lg transition-all"
                style={isFollowing
                  ? { background: 'var(--fg5)', color: 'var(--fg2)', border: '1px solid var(--fg5)' }
                  : { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                {followBusy ? '…' : isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>

          {/* company name + info */}
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--fg1)' }}>{company.name}</h1>
            {company.verified && (
              <svg className="w-5 h-5" style={{ color: '#60a5fa' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <p className="text-sm mb-2" style={{ color: 'var(--fg3)' }}>
            {company.industry}
            {company.location ? ` · ${company.location}` : ''}
            {company.founded  ? ` · Founded ${company.founded}` : ''}
          </p>
          <div className="flex items-center gap-4 flex-wrap text-xs" style={{ color: 'var(--fg4)' }}>
            <span>{company.followerCount.toLocaleString()} followers</span>
            {company.size    && <span>{company.size} employees</span>}
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer"
                className="hover:underline flex items-center gap-1" style={{ color: '#93c5fd' }}>
                {company.website.replace(/^https?:\/\//,'')}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* ─── TABS ─── */}
        <div className="flex rounded-xl p-1 mb-6" style={{ background: 'var(--sur)' }}>
          {(['about','updates','jobs','reviews'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 text-sm font-semibold rounded-lg capitalize transition-all"
              style={tab === t
                ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
                : { color: 'var(--fg3)' }}>
              {t}
            </button>
          ))}
        </div>

        {/* ══ ABOUT TAB ══ */}
        {tab === 'about' && (
          <div className="space-y-5">
            {/* description */}
            <div className="card">
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--fg4)' }}>About</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--fg2)' }}>
                {company.description}
              </p>
            </div>

            {/* details grid */}
            <div className="card">
              <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--fg4)' }}>Details</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: 'Industry',     value: company.industry },
                  { label: 'Company size', value: company.size ? `${company.size} employees` : null },
                  { label: 'Headquarters', value: company.location },
                  { label: 'Founded',      value: company.founded ? `${company.founded}` : null },
                ].filter(x => x.value).map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--fg4)' }}>{label}</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--fg2)' }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* culture photos */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--fg4)' }}>Culture</h2>
                {isAdmin && (
                  <button onClick={() => photoRef.current?.click()} disabled={uploadingPhoto}
                    className="text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
                    {uploadingPhoto ? 'Uploading…' : '+ Add photo'}
                  </button>
                )}
              </div>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              {company.photoUrls && company.photoUrls.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {company.photoUrls.map((url, i) => (
                    <img key={i} src={url} alt={`Culture ${i+1}`} className="rounded-lg w-full aspect-square object-cover" />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-center py-6" style={{ color: 'var(--fg4)' }}>
                  {isAdmin ? 'Add photos to show your workplace culture.' : 'No culture photos yet.'}
                </p>
              )}
            </div>

            {/* social links */}
            {(company.socialLinks?.linkedin || company.socialLinks?.instagram || company.socialLinks?.facebook) && (
              <div className="card">
                <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--fg4)' }}>Links</h2>
                <div className="flex flex-wrap gap-3">
                  {company.socialLinks.linkedin && (
                    <a href={company.socialLinks.linkedin} target="_blank" rel="noopener noreferrer"
                      className="text-sm px-4 py-2 rounded-lg flex items-center gap-2" style={{ background: 'rgba(10,102,194,0.20)', color: '#93c5fd', border: '1px solid rgba(10,102,194,0.30)' }}>
                      LinkedIn ↗
                    </a>
                  )}
                  {company.socialLinks.instagram && (
                    <a href={company.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                      className="text-sm px-4 py-2 rounded-lg" style={{ background: 'rgba(195,42,163,0.15)', color: '#f0abfc', border: '1px solid rgba(195,42,163,0.25)' }}>
                      Instagram ↗
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ UPDATES TAB ══ */}
        {tab === 'updates' && (
          <div className="space-y-4">
            {isAdmin && (
              <div className="card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm overflow-hidden"
                    style={{ background: company.logoUrl ? 'transparent' : 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                    {company.logoUrl ? <img src={company.logoUrl} className="w-full h-full object-cover" alt="" /> : company.name[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--fg2)' }}>Post as {company.name}</span>
                </div>
                <textarea value={postContent} onChange={e => setPostContent(e.target.value)}
                  rows={3} placeholder="Share a company update, news, or announcement…"
                  className="input-field resize-none text-sm mb-3" />
                <div className="flex justify-end">
                  <button onClick={handlePost} disabled={posting || !postContent.trim()} className="btn-primary text-sm py-2 px-5">
                    {posting ? 'Posting…' : 'Post update'}
                  </button>
                </div>
              </div>
            )}

            {posts.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--fg4)' }}>
                <p className="text-sm">{isAdmin ? 'No updates yet. Post your first one.' : 'No updates from this company yet.'}</p>
              </div>
            ) : posts.map(post => {
              const liked = user ? !!(post.reactions?.[user.uid]) : false;
              return (
                <div key={post.id} className="card">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm overflow-hidden"
                      style={{ background: company.logoUrl ? 'transparent' : 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                      {company.logoUrl ? <img src={company.logoUrl} className="w-full h-full object-cover" alt="" /> : company.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: 'var(--fg1)' }}>{company.name}</p>
                      <p className="text-xs" style={{ color: 'var(--fg4)' }}>
                        {post.createdAt ? timeAgo(post.createdAt.seconds) : ''}
                      </p>
                    </div>
                    {isAdmin && (
                      <button onClick={() => deletePost(post.id)} className="text-xs transition-colors"
                        style={{ color: 'var(--fg4)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg4)')}>
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-line mb-4" style={{ color: 'var(--fg2)' }}>
                    {post.content}
                  </p>
                  <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--sur)' }}>
                    <button onClick={() => likePost(post)} disabled={!user}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                      style={{
                        color: liked ? '#D63A52' : 'var(--fg4)',
                        background: liked ? 'rgba(224,0,0,0.12)' : 'transparent',
                        border: liked ? '1px solid rgba(224,0,0,0.20)' : '1px solid transparent',
                      }}>
                      <svg className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7}
                          d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                      {Object.keys(post.reactions ?? {}).length > 0 ? Object.keys(post.reactions ?? {}).length : 'Like'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ JOBS TAB ══ */}
        {tab === 'jobs' && (
          <div className="space-y-6">
            {/* siyne jobs */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--fg4)' }}>
                  Siyne listings · {siynJobs.length}
                </h2>
                {isAdmin && (
                  <Link href="/jobs" className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
                    + Post job
                  </Link>
                )}
              </div>
              {siynJobs.length === 0
                ? <p className="text-sm py-4" style={{ color: 'var(--fg4)' }}>No Siyne job listings for this company.</p>
                : <div className="space-y-4">{siynJobs.map(j => <JobCard key={j.id} job={j} />)}</div>}
            </div>

            {/* external jobs */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--fg4)' }}>
                External listings (Adzuna)
              </h2>
              {loadingExt ? (
                <div className="space-y-3">
                  {[1,2].map(i => <div key={i} className="card animate-pulse h-24" style={{ background: 'var(--sur)' }} />)}
                </div>
              ) : extJobs.length === 0 ? (
                <p className="text-sm py-4" style={{ color: 'var(--fg4)' }}>No external listings found.</p>
              ) : (
                <div className="space-y-3">
                  {extJobs.map(j => (
                    <div key={j.id} className="card flex items-center gap-4" style={{ position: 'relative' }}>
                      <div className="absolute top-3 right-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                          External
                        </span>
                      </div>
                      <div className="flex-1 pr-20 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: 'var(--fg1)' }}>{j.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--fg3)' }}>{j.location.display_name}</p>
                        {fmtSalary(j.salary_min, j.salary_max) && (
                          <p className="text-xs mt-0.5 font-medium" style={{ color: '#86efac' }}>{fmtSalary(j.salary_min, j.salary_max)}</p>
                        )}
                        <p className="text-xs mt-0.5" style={{ color: 'var(--fg4)' }}>{fmtDate(j.created)}</p>
                      </div>
                      <a href={j.redirect_url} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg"
                        style={{ border: '1px solid var(--fg5)', color: 'var(--fg2)' }}>
                        View ↗
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ REVIEWS TAB ══ */}
        {tab === 'reviews' && (
          <div className="space-y-5">
            {reviews.length > 0 && (
              <div className="card">
                {/* big average */}
                <div className="text-center mb-6">
                  <div className="text-5xl font-black mb-1" style={{ color: '#fbbf24' }}>
                    {avg('overall').toFixed(1)}
                  </div>
                  <Stars value={Math.round(avg('overall'))} size={5} />
                  <p className="text-xs mt-2" style={{ color: 'var(--fg4)' }}>
                    Based on {reviews.length} rating{reviews.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* category averages */}
                <div className="space-y-3 mb-6">
                  {REVIEW_CATS.filter(c => c.key !== 'overall').map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs w-36 flex-shrink-0" style={{ color: 'var(--fg3)' }}>{label}</span>
                      <RatingBar score={avg(key)} />
                    </div>
                  ))}
                </div>

                {/* distribution */}
                <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--fg4)' }}>
                  Rating distribution
                </h3>
                {dist(reviews.map(r => r.overall)).map((count, i) => {
                  const star = 5 - i;
                  const pct  = reviews.length ? Math.round((count/reviews.length)*100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs w-5 text-right flex-shrink-0" style={{ color: 'var(--fg3)' }}>{star}</span>
                      <span style={{ color: '#fbbf24', fontSize: '10px' }}>★</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--fg5)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', transition: 'width 0.5s ease' }} />
                      </div>
                      <span className="text-xs w-8 text-right flex-shrink-0" style={{ color: 'var(--fg4)' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* leave/edit review */}
            {user && !isAdmin && (
              <div className="card">
                {myReview ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--fg2)' }}>Your review</p>
                      <Stars value={myReview.overall ?? 0} />
                      {myReview.jobTitle && (
                        <p className="text-xs mt-1" style={{ color: 'var(--fg4)' }}>as {myReview.jobTitle}</p>
                      )}
                    </div>
                    <button onClick={() => setShowReviewForm(v => !v)}
                      className="text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--fg5)', color: 'var(--fg3)' }}>
                      Edit review
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowReviewForm(v => !v)}
                    className="w-full text-sm font-semibold py-3 rounded-lg text-center"
                    style={{ background: 'rgba(251,191,36,0.10)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.20)' }}>
                    Rate this company
                  </button>
                )}

                {showReviewForm && (
                  <div className="mt-5 pt-5 space-y-4" style={{ borderTop: '1px solid var(--sur)' }}>
                    {REVIEW_CATS.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between gap-4">
                        <span className="text-sm" style={{ color: 'var(--fg2)' }}>{label}</span>
                        <Stars value={reviewForm[key]} onChange={v => setReviewForm(f => ({ ...f, [key]: v }))} size={4} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--fg3)' }}>
                        Your job title at this company (optional — shown anonymously)
                      </label>
                      <input value={reviewTitle} onChange={e => setReviewTitle(e.target.value)}
                        placeholder="e.g. Software Engineer" className="input-field text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--fg3)' }}>
                        Write a review (optional)
                      </label>
                      <textarea
                        value={reviewComment}
                        onChange={e => setReviewComment(e.target.value)}
                        rows={4}
                        placeholder="Share your experience — culture, management, growth opportunities, work-life balance…"
                        className="input-field text-sm resize-none"
                      />
                    </div>
                    {reviewError && (
                      <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.15)', color: '#fca5a5' }}>
                        {reviewError}
                      </p>
                    )}
                    <button onClick={submitReview} disabled={reviewBusy || !reviewForm.overall} className="btn-primary text-sm py-2.5 px-6 w-full">
                      {reviewBusy ? 'Saving…' : myReview ? 'Update review' : 'Submit review'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {reviews.length === 0 && (
              <div className="text-center py-12" style={{ color: 'var(--fg4)' }}>
                <p className="text-sm">No reviews yet. Be the first to rate this company.</p>
              </div>
            )}

            {/* review list */}
            {reviews.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--fg4)' }}>
                  Ratings · {reviews.length}
                </h2>
                {reviews.map(r => (
                  <div key={r.id} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <Stars value={r.overall} />
                      {r.jobTitle && (
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--fg4)' }}>
                          as {r.jobTitle}
                        </span>
                      )}
                    </div>
                    {r.comment && (
                      <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--fg2)' }}>
                        {r.comment}
                      </p>
                    )}
                    {r.createdAt && (
                      <p className="text-xs mt-2" style={{ color: 'var(--fg4)' }}>
                        {new Date(r.createdAt.seconds * 1000).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── EDIT MODAL ─── */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) setEditing(false); }}>
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6"
              style={{ background: 'var(--drop-bg)', border: '1px solid var(--fg5)' }}>
              <h2 className="text-lg font-bold mb-5" style={{ color: 'var(--fg1)' }}>Edit company page</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg3)' }}>Description</label>
                  <textarea rows={5} value={editForm.description ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    className="input-field resize-none text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg3)' }}>Headquarters</label>
                    <input value={editForm.location ?? ''} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                      className="input-field text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg3)' }}>Website</label>
                    <input value={editForm.website ?? ''} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))}
                      type="url" className="input-field text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg3)' }}>LinkedIn URL</label>
                  <input value={editForm.socialLinks?.linkedin ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, socialLinks: { ...(f.socialLinks ?? {}), linkedin: e.target.value } }))}
                    placeholder="https://linkedin.com/company/…" type="url" className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg3)' }}>Instagram URL</label>
                  <input value={editForm.socialLinks?.instagram ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, socialLinks: { ...(f.socialLinks ?? {}), instagram: e.target.value } }))}
                    placeholder="https://instagram.com/…" type="url" className="input-field text-sm" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={saveEdits} className="btn-primary text-sm py-2.5 px-6">Save changes</button>
                <button onClick={() => setEditing(false)} className="text-sm py-2.5 px-4" style={{ color: 'var(--fg3)' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
