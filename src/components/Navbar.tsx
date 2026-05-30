'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import {
  collection, query, where, orderBy, limit,
  onSnapshot, writeBatch, doc, getDocs,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

/* ── notification type ──────────────────────────────── */
interface Notif {
  id:        string;
  type:      string;
  fromUid:   string;
  fromName:  string;
  text:      string;
  read:      boolean;
  createdAt: { seconds: number } | null;
}

function timeAgo(ms: number) {
  const d = Date.now() - ms, m = Math.floor(d / 60000);
  if (m < 1) return 'now'; if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function typeIcon(type: string) {
  if (type === 'reaction')     return '👍';
  if (type === 'comment')      return '💬';
  if (type === 'follow')       return '👤';
  if (type === 'message')      return '✉️';
  if (type === 'company_post') return '🏢';
  return '🔔';
}

/* ── notifications dropdown ─────────────────────────── */
function NotifDropdown({ onClose }: { onClose: () => void }) {
  const { user }  = useAuth();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications', user.uid, 'items'),
      orderBy('createdAt', 'desc'), limit(25)
    );
    return onSnapshot(q, snap => {
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notif)));
    });
  }, [user]);

  /* mark all read when opened */
  useEffect(() => {
    if (!user || notifs.length === 0) return;
    const unread = notifs.filter(n => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'notifications', user.uid, 'items', n.id), { read: true }));
    batch.commit().catch(() => {});
  }, [notifs, user]);

  /* close on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-80 rounded-xl overflow-hidden z-50"
      style={{ background: 'var(--drop-bg)', border: '1px solid var(--fg5)', backdropFilter: 'blur(16px)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--sur)' }}>
        <p className="font-semibold text-sm" style={{ color: 'var(--fg1)' }}>Notifications</p>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifs.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs" style={{ color: 'var(--fg4)' }}>No notifications yet.</p>
        ) : notifs.map(n => (
          <div key={n.id} className="px-4 py-3 flex items-start gap-3 transition-colors"
            style={{
              borderBottom: '1px solid var(--sur)',
              background: n.read ? 'transparent' : 'rgba(149,0,0,0.08)',
            }}>
            <span className="text-lg flex-shrink-0 mt-0.5">{typeIcon(n.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug" style={{ color: 'var(--fg2)' }}>
                {n.fromUid ? (
                  <Link href={`/profile/${n.fromUid}`} onClick={onClose}
                    className="font-semibold hover:underline" style={{ color: 'var(--fg1)' }}>
                    {n.fromName}
                  </Link>
                ) : (
                  <span className="font-semibold" style={{ color: 'var(--fg1)' }}>{n.fromName}</span>
                )}{' '}{n.text}
              </p>
              {n.createdAt && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--fg4)' }}>
                  {timeAgo(n.createdAt.seconds * 1000)}
                </p>
              )}
            </div>
            {!n.read && <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#B01E36' }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── navbar ─────────────────────────────────────────── */
export default function Navbar() {
  const { user } = useAuth();
  const { theme, setTheme, bgTheme, setBgTheme } = useTheme();
  const router   = useRouter();
  const pathname = usePathname();
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [showNotif,   setShowNotif]   = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unreadN,     setUnreadN]     = useState(0);
  const [myPhotoURL,  setMyPhotoURL]  = useState('');
  const [unreadM,   setUnreadM]   = useState(0);

  /* search */
  const [searchQ,        setSearchQ]        = useState('');
  const [dropResults,    setDropResults]    = useState<{ uid: string; name: string; jobTitle: string; company: string }[]>([]);
  const [compDropResults,setCompDropResults]= useState<{ id: string; name: string; industry: string; logoUrl: string }[]>([]);
  const [showDrop,       setShowDrop]       = useState(false);
  const [allUsers,       setAllUsers]       = useState<{ uid: string; name: string; jobTitle: string; company: string }[]>([]);
  const [allCompanies,   setAllCompanies]   = useState<{ id: string; name: string; industry: string; logoUrl: string }[]>([]);
  const [usersLoaded,    setUsersLoaded]    = useState(false);
  const searchRef       = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  async function handleSignOut() {
    await signOut(auth);
    window.location.href = '/';
  }

  /* live photo from Firestore — updates immediately when user uploads new pic */
  useEffect(() => {
    if (!user) { setMyPhotoURL(''); return; }
    return onSnapshot(doc(db, 'users', user.uid), snap => {
      setMyPhotoURL(snap.data()?.photoURL ?? '');
    });
  }, [user]);

  /* unread notifications badge */
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications', user.uid, 'items'),
      where('read', '==', false), limit(99)
    );
    return onSnapshot(q, snap => setUnreadN(snap.size));
  }, [user]);

  /* unread message badge */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid));
    return onSnapshot(q, snap => {
      let total = 0;
      snap.docs.forEach(d => { total += (d.data().unread?.[user.uid] ?? 0); });
      setUnreadM(total);
    });
  }, [user]);

  /* lazy-load all users + companies once on first search focus */
  async function ensureUsers() {
    if (usersLoaded || !user) return;
    const [userSnap, compSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'companies')),
    ]);
    setAllUsers(userSnap.docs.filter(d => d.id !== user.uid).map(d => ({
      uid: d.id, name: d.data().name ?? '', jobTitle: d.data().jobTitle ?? '', company: d.data().company ?? '',
    })));
    setAllCompanies(compSnap.docs.map(d => ({
      id: d.id, name: d.data().name ?? '', industry: d.data().industry ?? '', logoUrl: d.data().logoUrl ?? '',
    })));
    setUsersLoaded(true);
  }

  /* filter dropdown as user types */
  useEffect(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) { setDropResults([]); setCompDropResults([]); setShowDrop(false); return; }
    const userMatches = allUsers
      .filter(u => u.name.toLowerCase().includes(q) || u.company.toLowerCase().includes(q) || u.jobTitle.toLowerCase().includes(q))
      .slice(0, 4);
    const compMatches = allCompanies
      .filter(c => c.name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q))
      .slice(0, 2);
    setDropResults(userMatches);
    setCompDropResults(compMatches);
    setShowDrop(userMatches.length > 0 || compMatches.length > 0);
  }, [searchQ, allUsers, allCompanies]);

  /* close dropdowns on outside click */
  useEffect(() => {
    function h(e: MouseEvent) {
      const inDesktop = searchRef.current?.contains(e.target as Node);
      const inMobile  = mobileSearchRef.current?.contains(e.target as Node);
      if (!inDesktop && !inMobile) setShowDrop(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setShowDrop(false);
    if (searchQ.trim()) router.push(`/search?q=${encodeURIComponent(searchQ.trim())}`);
  }

  function handleDropClick(uid: string) {
    setShowDrop(false);
    setSearchQ('');
    router.push(`/profile/${uid}`);
  }

  const IconBtn = ({ href, badge, title, children }: { href?: string; badge?: number; title: string; children: React.ReactNode }) => {
    const inner = (
      <div className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
        style={{ color: 'var(--fg3)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg1)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
        {children}
        {!!badge && (
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
            style={{ background: '#B01E36' }}>
            {badge > 9 ? '9+' : badge}
          </div>
        )}
      </div>
    );
    if (href) return <Link href={href} title={title}>{inner}</Link>;
    return <button title={title} onClick={() => setShowNotif(v => !v)}>{inner}</button>;
  };

  return (
    <nav style={{ background: 'var(--nav-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      className="sticky top-0 z-50 border-b border-white/[0.07]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-4">

        {/* logo */}
        <Link href={user ? '/feed' : '/'} className="siyne-logo text-2xl flex-shrink-0">Siyne</Link>

        {/* search with dropdown */}
        {user && (
          <div ref={searchRef} className="hidden sm:block relative flex-1 max-w-xs">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: 'var(--fg4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  onFocus={() => ensureUsers()}
                  placeholder="Search people, companies…"
                  className="w-full text-sm py-1.5 pl-9 pr-3 rounded-lg"
                  style={{ background: 'var(--sur)', border: '1px solid var(--fg5)', color: 'var(--fg2)', outline: 'none' }}
                  autoComplete="off" />
              </div>
            </form>

            {/* dropdown */}
            {showDrop && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
                style={{ background: 'var(--drop-bg)', border: '1px solid var(--fg5)', backdropFilter: 'blur(20px)', boxShadow: '0 12px 32px rgba(0,0,0,0.6)' }}>
                {dropResults.map((u, i) => (
                  <button key={u.uid} onClick={() => handleDropClick(u.uid)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{ borderTop: i > 0 ? '1px solid var(--sur)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--sur)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                      {u.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--fg1)' }}>{u.name}</p>
                      {(u.jobTitle || u.company) && (
                        <p className="text-xs truncate" style={{ color: 'var(--fg4)' }}>
                          {u.jobTitle}{u.jobTitle && u.company ? ' · ' : ''}{u.company}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
                {compDropResults.map((c, i) => (
                  <button key={c.id}
                    onClick={() => { setShowDrop(false); setSearchQ(''); router.push(`/companies/${c.id}`); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{ borderTop: (dropResults.length > 0 || i > 0) ? '1px solid var(--sur)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--sur)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden"
                      style={{ background: c.logoUrl ? 'transparent' : 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                      {c.logoUrl
                        ? <img src={c.logoUrl} alt={c.name} className="w-full h-full object-cover" />
                        : c.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--fg1)' }}>{c.name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--fg4)' }}>Company · {c.industry}</p>
                    </div>
                  </button>
                ))}
                <button onClick={() => { setShowDrop(false); router.push(`/search?q=${encodeURIComponent(searchQ.trim())}`); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors"
                  style={{ borderTop: '1px solid var(--sur)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--sur)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--fg4)' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="text-xs" style={{ color: 'var(--fg4)' }}>
                    See all results for &ldquo;{searchQ}&rdquo;
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* desktop nav links */}
        {user && (
          <div className="hidden sm:flex items-center gap-1 text-sm font-medium">
            {([
              { href: '/feed',    label: 'Feed' },
              { href: '/jobs',    label: 'Jobs' },
              { href: '/pitches', label: 'Pitches' },
              { href: '/connect', label: 'Connect' },
            ] as const).map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <div key={href} className="relative">
                  <Link href={href}
                    className="block px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: active ? 'var(--fg1)' : 'var(--fg3)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg1)')}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--fg3)'; }}>
                    {label}
                  </Link>
                  {active && (
                    <div className="absolute left-1/2 -translate-x-1/2 h-[3px] w-6 rounded-full"
                      style={{ background: '#B01E36', bottom: '-10px' }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* right icons */}
        <div className="flex items-center gap-1">
          {user ? (
            <>
              {/* messages */}
              <IconBtn href="/messages" badge={unreadM} title="Messages">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </IconBtn>

              {/* notifications */}
              <div className="relative">
                <IconBtn badge={unreadN} title="Notifications">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </IconBtn>
                {showNotif && <NotifDropdown onClose={() => setShowNotif(false)} />}
              </div>

              {/* profile dropdown */}
              <div className="relative ml-1" ref={profileRef}>
                <button onClick={() => setShowProfile(v => !v)} title="Account"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-opacity overflow-hidden"
                  style={{ background: myPhotoURL ? 'transparent' : 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  {myPhotoURL
                    ? <img src={myPhotoURL} alt="" className="w-full h-full object-cover" />
                    : user.displayName?.[0]?.toUpperCase() ?? '?'}
                </button>

                {showProfile && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden z-50"
                    style={{ background: 'var(--drop-bg)', border: '1px solid var(--fg5)', backdropFilter: 'blur(20px)', boxShadow: '0 16px 48px rgba(0,0,0,0.65)' }}>

                    {/* user info */}
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--sur)' }}>
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--fg1)' }}>
                        {user.displayName ?? 'User'}
                      </p>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--fg4)' }}>
                        {user.email}
                      </p>
                    </div>

                    {/* nav items */}
                    <div className="py-1">
                      {([
                        { label: 'View Profile',          href: `/profile/${user.uid}` },
                        { label: 'Edit Profile',          href: '/settings?s=profile' },
                        { label: 'Settings',              href: '/settings' },
                        { label: 'Create a Company Page', href: '/companies/new' },
                      ] as const).map(({ label, href }) => (
                        <Link key={label} href={href} onClick={() => setShowProfile(false)}
                          className="block px-4 py-2 text-sm transition-colors"
                          style={{ color: 'var(--fg2)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--sur)'; e.currentTarget.style.color = 'var(--fg1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg2)'; }}>
                          {label}
                        </Link>
                      ))}
                    </div>

                    {/* admin link — email-gated */}
                    {user.email === 'usmani.shamyl@gmail.com' && (
                      <>
                        <div style={{ borderTop: '1px solid var(--sur)' }} />
                        <div className="py-1">
                          <Link href="/admin" onClick={() => setShowProfile(false)}
                            className="block px-4 py-2 text-sm transition-colors"
                            style={{ color: 'rgba(251,191,36,0.80)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.08)'; e.currentTarget.style.color = '#fbbf24'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(251,191,36,0.80)'; }}>
                            Admin Dashboard
                          </Link>
                        </div>
                      </>
                    )}

                    {/* appearance toggles */}
                    <div style={{ borderTop: '1px solid var(--sur)' }} />
                    <div className="px-4 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--fg4)' }}>Appearance</p>
                      <div className="flex gap-1.5 mb-2">
                        {(['light', 'dark'] as const).map(t => (
                          <button key={t} onClick={() => setTheme(t)}
                            className="flex-1 text-xs py-1.5 rounded-lg font-medium transition-all"
                            style={theme === t
                              ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
                              : { background: 'var(--sur)', color: 'var(--fg3)', border: '1px solid var(--fg5)' }}>
                            {t === 'light' ? '☀️ Light' : '🌙 Dark'}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--fg4)' }}>Live</p>
                      <div className="grid grid-cols-5 gap-1 mb-1.5">
                        {([['city','🏙','City'],['rainforest','🌿','Forest'],['suburban','🏘','Suburb'],['space','🚀','Space'],['alps','🏔','Alps']] as const).map(([bg,icon,label]) => (
                          <button key={bg} onClick={() => setBgTheme(bg)}
                            className="flex flex-col items-center justify-center py-1.5 rounded-lg text-xs transition-all"
                            style={bgTheme === bg ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' } : { background: 'var(--sur)', color: 'var(--fg3)', border: '1px solid var(--fg5)' }}>
                            <span className="text-base leading-none">{icon}</span>
                            <span className="text-[9px] mt-0.5">{label}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--fg4)' }}>Static</p>
                      <div className="grid grid-cols-3 gap-1">
                        {([['skyline','🌆','Skyline'],['nature','🏔','Nature'],['desert','🏜','Desert']] as const).map(([bg,icon,label]) => (
                          <button key={bg} onClick={() => setBgTheme(bg)}
                            className="flex flex-col items-center justify-center py-1.5 rounded-lg text-xs transition-all"
                            style={bgTheme === bg ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' } : { background: 'var(--sur)', color: 'var(--fg3)', border: '1px solid var(--fg5)' }}>
                            <span className="text-base leading-none">{icon}</span>
                            <span className="text-[9px] mt-0.5">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* sign out */}
                    <div style={{ borderTop: '1px solid var(--sur)' }} />
                    <div className="py-1">
                      <button onClick={() => { setShowProfile(false); handleSignOut(); }}
                        className="w-full text-left block px-4 py-2 text-sm transition-colors"
                        style={{ color: '#f87171' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/auth" className="text-sm px-3 py-2 transition-colors" style={{ color: 'var(--fg3)' }}>Log in</Link>
              <Link href="/auth?tab=signup" className="btn-primary text-sm py-2 px-4">Sign up free</Link>
            </>
          )}

          {/* mobile hamburger */}
          {user && (
            <button className="sm:hidden p-2 rounded-md ml-1" style={{ color: 'var(--fg3)' }}
              onClick={() => setMenuOpen(!menuOpen)}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* mobile persistent search row */}
      {user && (
        <div ref={mobileSearchRef} className="sm:hidden px-4 py-2" style={{ borderTop: '1px solid var(--sur)' }}>
          <form onSubmit={handleSearch}>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: 'var(--fg4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                onFocus={() => ensureUsers()}
                placeholder="Search people, companies…"
                className="w-full text-sm py-1.5 pl-9 pr-3 rounded-lg"
                style={{ background: 'var(--sur)', border: '1px solid var(--fg5)', color: 'var(--fg2)', outline: 'none' }}
                autoComplete="off" />
            </div>
          </form>
          {showDrop && (
            <div className="mt-1 rounded-xl overflow-hidden z-50 relative"
              style={{ background: 'var(--drop-bg)', border: '1px solid var(--fg5)', backdropFilter: 'blur(20px)', boxShadow: '0 12px 32px rgba(0,0,0,0.6)' }}>
              {dropResults.map((u, i) => (
                <button key={u.uid} onClick={() => handleDropClick(u.uid)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  style={{ borderTop: i > 0 ? '1px solid var(--sur)' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--sur)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                    {u.name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--fg1)' }}>{u.name}</p>
                    {(u.jobTitle || u.company) && (
                      <p className="text-xs truncate" style={{ color: 'var(--fg4)' }}>
                        {u.jobTitle}{u.jobTitle && u.company ? ' · ' : ''}{u.company}
                      </p>
                    )}
                  </div>
                </button>
              ))}
              {compDropResults.map((c, i) => (
                <button key={c.id}
                  onClick={() => { setShowDrop(false); setSearchQ(''); router.push(`/companies/${c.id}`); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  style={{ borderTop: (dropResults.length > 0 || i > 0) ? '1px solid var(--sur)' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--sur)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden"
                    style={{ background: c.logoUrl ? 'transparent' : 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
                    {c.logoUrl ? <img src={c.logoUrl} alt={c.name} className="w-full h-full object-cover" /> : c.name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--fg1)' }}>{c.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--fg4)' }}>Company · {c.industry}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* mobile hamburger menu */}
      {menuOpen && user && (
        <div className="sm:hidden px-4 py-3 space-y-1 border-t border-white/[0.07]"
          style={{ background: 'var(--nav-bg)' }}>
          {([
            { href: '/feed',               label: 'Feed' },
            { href: '/jobs',               label: 'Jobs' },
            { href: '/pitches',            label: 'Pitches' },
            { href: '/connect',            label: 'Connect' },
            { href: '/messages',           label: 'Messages' },
            { href: `/profile/${user.uid}`, label: 'Profile' },
            { href: '/settings',           label: 'Settings' },
          ] as const).map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 py-2 text-sm transition-colors"
                style={{ color: active ? 'var(--fg1)' : 'var(--fg2)' }}>
                {active && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#B01E36' }} />}
                {label}
              </Link>
            );
          })}
          {/* appearance toggles */}
          <div className="pt-2 pb-1" style={{ borderTop: '1px solid var(--sur)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--fg4)' }}>Appearance</p>
            <div className="flex gap-1.5 mb-2">
              {(['light', 'dark'] as const).map(t => (
                <button key={t} onClick={() => setTheme(t)}
                  className="flex-1 text-xs py-1.5 rounded-lg font-medium transition-all"
                  style={theme === t
                    ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }
                    : { background: 'var(--sur)', color: 'var(--fg3)', border: '1px solid var(--fg5)' }}>
                  {t === 'light' ? '☀️ Light' : '🌙 Dark'}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--fg4)' }}>Live</p>
            <div className="grid grid-cols-5 gap-1 mb-1.5">
              {([['city','🏙','City'],['rainforest','🌿','Forest'],['suburban','🏘','Suburb'],['space','🚀','Space'],['alps','🏔','Alps']] as const).map(([bg,icon,label]) => (
                <button key={bg} onClick={() => setBgTheme(bg)}
                  className="flex flex-col items-center justify-center py-1.5 rounded-lg transition-all"
                  style={bgTheme === bg ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' } : { background: 'var(--sur)', color: 'var(--fg3)', border: '1px solid var(--fg5)' }}>
                  <span className="text-base leading-none">{icon}</span>
                  <span className="text-[9px] mt-0.5">{label}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--fg4)' }}>Static</p>
            <div className="grid grid-cols-4 gap-1">
              {([['skyline','🌆','Skyline'],['nature','🏔','Nature'],['desert','🏜','Desert'],['alps','🏔','Alps']] as const).map(([bg,icon,label]) => (
                <button key={bg} onClick={() => setBgTheme(bg)}
                  className="flex flex-col items-center justify-center py-1.5 rounded-lg transition-all"
                  style={bgTheme === bg ? { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' } : { background: 'var(--sur)', color: 'var(--fg3)', border: '1px solid var(--fg5)' }}>
                  <span className="text-base leading-none">{icon}</span>
                  <span className="text-[9px] mt-0.5">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSignOut} className="block py-2 text-sm" style={{ color: '#f87171' }}>Sign out</button>
        </div>
      )}
    </nav>
  );
}
