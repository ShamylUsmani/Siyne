'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

/* ── hero phrases — "done right" always first ─────── */
const PHRASES = [
  'done right',
  'without toxic content',
  'without fake jobs',
  'without hidden salaries',
  'with verified identities',
];

const TICKER = [
  'Verified identities', 'Salary on every job', 'Zero toxic content',
  'Real job listings only', 'Company accountability', 'No fake credentials',
  'Transparent job reasons', '$0 hidden salaries', 'No ghost jobs', 'No engagement bait',
];

const RULES = [
  'Every employment claim is verified against real records. No exceptions, no self-reporting.',
  'Every job posting must include a full, honest salary range.',
  'Every job opening must explain why the role exists: growth, backfill, restructure, or new function.',
  'Companies that post fake or misleading job listings are permanently flagged on their public profile.',
  'Toxic, offensive, or misleading content is removed immediately and without negotiation.',
  'No engagement bait. No outrage content. No posts designed to provoke rather than inform.',
];

const PRO_POINTS = [
  { title: 'See the salary upfront',   desc: "Every listing shows the real pay range before you click apply. No more wasting time to find out it pays peanuts." },
  { title: 'Trust what you read',      desc: "Titles and employers are verified. The person calling themselves VP of Engineering actually is one." },
  { title: 'Know why the role is open', desc: "Growth hire, backfill, or restructure? You find out at the listing, not in round 3 of interviews." },
  { title: 'No noise, just signal',    desc: "No engagement bait, no toxic threads. Just professional content that respects your time." },
];

const CO_POINTS = [
  { title: 'Attract candidates who trust you', desc: "Verified listings signal you're a legitimate employer. Top talent chooses companies that operate with integrity." },
  { title: 'Every listing is verified',        desc: "We confirm the role is real before it goes live. This protects your brand and the candidates applying to it." },
  { title: 'Fake jobs get your profile flagged', desc: "Post a listing for a role that doesn't exist? Your company profile is flagged publicly and permanently for every candidate to see." },
  { title: 'Salary and rationale required',    desc: "Mandatory transparency reduces wasted interviews and brings you applicants who are genuinely aligned with the role." },
];

const FEATURES = [
  {
    tag: 'Trust', title: 'Verified identities',
    desc: "Every member's job title and employer is verified. No inflated titles. No fake credentials. What you see is what they actually are.",
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  },
  {
    tag: 'Safety', title: 'Zero toxicity',
    desc: 'Toxic posts, offensive content, and engagement bait are flagged and removed instantly. The community reports what slips through. No exceptions.',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  },
  {
    tag: 'Accountability', title: 'Real jobs. Real companies.',
    desc: "Companies must verify every listing before it goes live. Post a fake job? Your company profile is permanently and publicly flagged. Every candidate will see it.",
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
  {
    tag: 'Transparency', title: 'Salary is not optional',
    desc: "Every job must display a full salary range. Companies must also state why the role is open: growth, backfill, or new function. \"Competitive compensation\" is not an answer.",
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
];

/* ── rules carousel ──────────────────────────────────*/
function RulesCarousel() {
  const [idx, setIdx]         = useState(0);
  const [visible, setVisible] = useState(true);
  const touchX                = useRef(0);

  const navigate = useCallback((dir: 'prev' | 'next') => {
    setVisible(false);
    setTimeout(() => {
      setIdx(i => dir === 'next' ? (i + 1) % RULES.length : (i - 1 + RULES.length) % RULES.length);
      setVisible(true);
    }, 220);
  }, []);

  useEffect(() => {
    const t = setInterval(() => navigate('next'), 5500);
    return () => clearInterval(t);
  }, [navigate]);

  return (
    <section className="py-24 bg-[#080808] overflow-hidden">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-navy-500 mb-4 block">Our manifesto</span>
          <h2 className="text-4xl font-bold text-white mb-2">Six rules. No exceptions.</h2>
          <p className="text-white/30 text-base">Swipe or click to read each one.</p>
        </div>

        {/* carousel */}
        <div className="relative">
          {/* prev */}
          <button
            onClick={() => navigate('prev')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center text-white/25 hover:text-white/80 transition-colors"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* card */}
          <div
            className="mx-12 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-8 sm:px-14 py-12 text-center cursor-default"
            style={{
              opacity:    visible ? 1 : 0,
              transform:  visible ? 'scale(1)' : 'scale(0.96)',
              transition: 'opacity 0.22s ease, transform 0.22s ease',
              minHeight:  '220px',
              display:    'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}
            onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              const diff = touchX.current - e.changedTouches[0].clientX;
              if (Math.abs(diff) > 50) navigate(diff > 0 ? 'next' : 'prev');
            }}
          >
            <div
              className="text-7xl sm:text-8xl font-black leading-none mb-6 select-none"
              style={{
                background: 'linear-gradient(135deg, #ff4545, #950000)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {idx + 1}
            </div>
            <p className="text-lg sm:text-xl text-white/80 leading-relaxed font-medium max-w-lg">
              {RULES[idx]}
            </p>
          </div>

          {/* next */}
          <button
            onClick={() => navigate('next')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center text-white/25 hover:text-white/80 transition-colors"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* dot nav */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {RULES.map((_, i) => (
            <button
              key={i}
              onClick={() => { setVisible(false); setTimeout(() => { setIdx(i); setVisible(true); }, 220); }}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-7 bg-navy-600' : 'w-1.5 bg-white/20 hover:bg-white/40'}`}
            />
          ))}
        </div>

        {/* rule counter */}
        <p className="text-center text-white/20 text-xs mt-4 font-medium tracking-widest uppercase">
          {idx + 1} / {RULES.length}
        </p>
      </div>
    </section>
  );
}

/* ── deleted post card ───────────────────────────────*/
function DeletedPost({ name, role, text }: { name: string; role: string; text: string }) {
  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-5 overflow-hidden select-none">
      <div className="absolute inset-0 bg-white/30 pointer-events-none" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ transform: 'rotate(-15deg)' }}>
        <div className="border-[3px] border-red-600 rounded px-3 py-0.5">
          <span className="text-red-600 font-black text-xl tracking-[0.16em] opacity-80">REMOVED</span>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-3 relative">
        <div className="w-9 h-9 rounded-full bg-slate-200 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-500">{name}</p>
          <p className="text-xs text-slate-400">{role}</p>
        </div>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed relative">{text}</p>
      <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-200 relative">
        <span>Like</span><span>Comment</span><span>Repost</span>
      </div>
    </div>
  );
}

/* ── scroll reveal ───────────────────────────────────*/
function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold: 0.08 }
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateY(28px)',
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

/* ── 3D tilt ─────────────────────────────────────────*/
function onTilt(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget, r = el.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width  - 0.5) *  9;
  const y = ((e.clientY - r.top)  / r.height - 0.5) * -9;
  el.style.transition = 'transform 0.08s ease';
  el.style.transform  = `perspective(900px) rotateX(${y}deg) rotateY(${x}deg) translateY(-6px)`;
}
function offTilt(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  el.style.transition = 'transform 0.5s ease';
  el.style.transform  = '';
}

/* ── page ────────────────────────────────────────────*/
export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [phraseIdx, setPhraseIdx]         = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);
  const [activeTab, setActiveTab]         = useState<'pro' | 'company'>('pro');
  const [mouse, setMouse]                 = useState({ x: -9999, y: -9999 });

  useEffect(() => {
    if (!loading && user) router.replace('/feed');
  }, [user, loading, router]);

  useEffect(() => {
    const t = setInterval(() => {
      setPhraseVisible(false);
      setTimeout(() => { setPhraseIdx(i => (i + 1) % PHRASES.length); setPhraseVisible(true); }, 350);
    }, 3400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, []);

  if (loading) return null;

  return (
    <div className="min-h-screen overflow-x-hidden">

      {/* cursor glow */}
      <div className="pointer-events-none fixed inset-0 z-[9]" style={{
        background: `radial-gradient(380px circle at ${mouse.x}px ${mouse.y}px, rgba(149,0,0,0.08), transparent 80%)`,
      }} />

      {/* ─── FIXED NAV ─────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#080808]/90 backdrop-blur-md border-b border-white/[0.07]">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <span className="siyne-logo text-2xl">Siyne</span>
          <div className="flex items-center gap-2">
            <Link href="/auth" className="text-white/50 hover:text-white text-sm font-medium transition-colors px-4 py-2">Log in</Link>
            <Link href="/auth?tab=signup" className="btn-primary text-sm py-2 px-5">Sign up free</Link>
          </div>
        </div>
      </header>

      {/* ─── HERO — uses global fixed canvas from layout ── */}
      <section className="relative min-h-screen overflow-hidden pt-16">

        {/* center vignette for text readability */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 90% 70% at 50% 55%, rgba(4,0,0,0.84) 0%, rgba(4,0,0,0.30) 70%, transparent 100%)',
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'linear-gradient(to bottom, rgba(8,8,8,0.55) 0%, transparent 18%, transparent 75%, rgba(8,8,8,0.7) 100%)',
        }} />

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-6">
          <h1 className="text-[clamp(2.8rem,7vw,5.5rem)] font-bold text-white leading-[1.08] tracking-tight mb-5">
            Professional networking
          </h1>

          <div className="h-[clamp(3.2rem,8vw,6rem)] flex items-center justify-center mb-8 overflow-hidden">
            <span
              className="text-[clamp(2.5rem,6.5vw,5rem)] font-bold block"
              style={{
                background: 'linear-gradient(135deg, #ff4545 0%, #b80000 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                opacity:   phraseVisible ? 1 : 0,
                transform: `translateY(${phraseVisible ? '0' : '12px'})`,
                transition: 'opacity 0.3s ease, transform 0.3s ease',
              }}
            >
              {PHRASES[phraseIdx]}
            </span>
          </div>

          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
            Siyne is the only professional network where every identity is verified,
            every job includes a salary, and toxic content simply cannot exist.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth?tab=signup" className="btn-primary px-10 py-4 text-base font-semibold">
              Join Siyne. It&apos;s free.
            </Link>
            <Link href="/auth" className="group flex items-center gap-2 text-white/45 hover:text-white text-base font-medium transition-colors">
              I have an account
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 opacity-25 animate-bounce z-10">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ─── SIX RULES CAROUSEL ─────────────────────── */}
      <RulesCarousel />

      {/* ─── WE CLEANED UP THE FEED ─────────────────── */}
      <section className="py-24 bg-[#0f0f0f]">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-navy-500 mb-5 block">What you will not find here</span>
            <h2 className="text-4xl font-bold text-white mb-4">We cleaned up the feed.</h2>
            <p className="text-white/40 text-lg max-w-2xl mx-auto">
              LinkedIn turned into a platform for people to perform vulnerability in exchange for likes.
              We banned that. If it has nothing to do with your career, it gets removed.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { name: 'Sarah K.',  role: 'Head of Brand Strategy', text: "I just went through a messy divorce. Here's what it taught me about Q4 revenue targets and why vulnerability is actually your greatest marketing asset..." },
              { name: 'Marcus T.', role: 'Founder & CEO',          text: "My dog passed away last Tuesday. It made me realise our onboarding funnel was completely broken. Here are 9 lessons grief taught me about product-market fit." },
              { name: 'Jessica L.', role: 'Growth Hacker',         text: "I failed my driving test 4 times. Nobody believed in me. Here's how that shaped my entire $0 to $1M ARR journey. Thread 🧵" },
              { name: 'David R.',  role: 'Serial Entrepreneur',    text: "Hustle culture is toxic and destroying your mental health. Anyway I worked 90 hours this week and if you're not doing the same you simply don't want it enough." },
            ].map((p, i) => (
              <Reveal key={i} delay={i * 80}><DeletedPost {...p} /></Reveal>
            ))}
          </div>

          <Reveal>
            <p className="text-center text-white/25 text-sm max-w-xl mx-auto">
              Siyne is a professional network. If it doesn&apos;t belong on a resume,
              it doesn&apos;t belong in the feed. Save the life lessons for therapy.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── THE PROBLEM ───────────────────────────── */}
      <section className="py-24" style={{ background: '#f9f7f7' }}>
        <div className="max-w-5xl mx-auto px-6">
          <Reveal className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-widest text-navy-700 bg-navy-50 px-3 py-1 rounded-full">The problem</span>
            <h2 className="text-4xl font-bold text-slate-900 mt-5 mb-3">Professional networks are broken.</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">They were built for engagement metrics, not for your career.</p>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-6">
            <Reveal delay={0}>
              <div className="rounded-2xl border border-slate-200 bg-white p-8 h-full">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">Everywhere else</p>
                <ul className="space-y-3.5">
                  {[
                    'Unverified job titles and inflated credentials',
                    'Salaries hidden behind "competitive package"',
                    'Toxic posts, engagement bait, outrage content',
                    "Ghost jobs that haven't been filled in months",
                    'No explanation for why the role is open',
                    'Zero accountability when companies mislead',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3 text-sm text-slate-500">
                      <svg className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="rounded-2xl p-8 h-full relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #fff1f1 0%, #ffffff 60%)' }}>
                <div className="absolute -top-16 -right-16 w-48 h-48 bg-navy-100 rounded-full blur-3xl opacity-60" />
                <p className="text-navy-700 text-xs font-bold uppercase tracking-widest mb-6 relative">On Siyne</p>
                <ul className="space-y-3.5 relative">
                  {[
                    'Every title verified against real employment records',
                    'Full salary range required, no exceptions',
                    'Toxic content removed immediately, no debate',
                    'All job listings verified before going live',
                    'Job reason required: growth, backfill, or new function',
                    'Fake listings get your company profile permanently flagged',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                      <svg className="w-4 h-4 text-navy-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── FEATURE CARDS ─────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-widest text-navy-700 bg-navy-50 px-3 py-1 rounded-full">How it works</span>
            <h2 className="text-4xl font-bold text-slate-900 mt-5 mb-3">Built different. By design.</h2>
            <p className="text-slate-500 text-lg">Four pillars that make Siyne actually work.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-5">
            {FEATURES.map(({ tag, title, desc, icon }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div onMouseMove={onTilt} onMouseLeave={offTilt}
                  className="group rounded-2xl border border-slate-100 bg-white p-8 hover:border-navy-200 hover:shadow-2xl cursor-default will-change-transform">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center group-hover:bg-navy-100 transition-colors">
                      {icon}
                    </div>
                    <span className="text-xs font-bold text-navy-600 uppercase tracking-wider">{tag}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BUILT FOR BOTH SIDES ───────────────────── */}
      <section className="py-24" style={{ background: '#f9f7f7' }}>
        <div className="max-w-4xl mx-auto px-6">
          <Reveal className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 mb-3">Built for both sides of the table.</h2>
            <p className="text-slate-500 text-lg">Whether you&apos;re hiring or being hired, the rules protect you.</p>
          </Reveal>

          <Reveal delay={80}>
            {/* tab switcher */}
            <div className="flex bg-white border border-slate-200 rounded-xl p-1 max-w-xs mx-auto mb-10">
              {(['pro', 'company'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${activeTab === t ? 'text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  style={activeTab === t ? { background: 'linear-gradient(135deg, #b80000 0%, #5c0000 100%)' } : {}}>
                  {t === 'pro' ? 'Professionals' : 'Companies'}
                </button>
              ))}
            </div>

            {/* content — clean list, no numbers */}
            <div className="grid sm:grid-cols-2 gap-x-10 gap-y-7">
              {(activeTab === 'pro' ? PRO_POINTS : CO_POINTS).map(({ title, desc }) => (
                <div key={title} className="flex gap-4 group">
                  {/* red vertical accent */}
                  <div className="flex-shrink-0 w-[3px] rounded-full self-stretch"
                    style={{ background: 'linear-gradient(to bottom, #b80000, #5c0000)', minHeight: '100%' }} />
                  <div>
                    <h3 className="font-bold text-slate-900 mb-1.5 group-hover:text-navy-800 transition-colors">{title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── CTA ────────────────────────────────────── */}
      <section className="py-24 text-center" style={{ background: 'linear-gradient(135deg, #5c0000 0%, #950000 50%, #b80000 100%)' }}>
        <Reveal className="max-w-xl mx-auto px-6">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">Ready to do this properly?</h2>
          <p className="text-white/60 mb-10 text-lg">Join a network where your career is taken seriously.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth?tab=signup"
              className="bg-white text-navy-900 font-bold px-10 py-4 rounded-lg text-base hover:bg-navy-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
              Sign up free
            </Link>
            <Link href="/auth" className="text-white/55 hover:text-white transition-colors text-base font-medium">Log in</Link>
          </div>
        </Reveal>
      </section>

      {/* ─── FOOTER ─────────────────────────────────── */}
      <footer className="bg-[#080808] border-t border-white/[0.06] py-8 text-center text-xs text-white/20">
        &copy; {new Date().getFullYear()} Siyne. All rights reserved.
      </footer>
    </div>
  );
}
