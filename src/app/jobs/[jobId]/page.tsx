'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { Job } from '@/components/JobCard';

interface Poster {
  uid:      string;
  name:     string;
  jobTitle: string;
  photoURL?: string;
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'Full-time':  { bg: 'rgba(20,80,30,0.45)',  text: '#86efac' },
  'Part-time':  { bg: 'rgba(80,60,10,0.45)',  text: '#fde68a' },
  'Contract':   { bg: 'rgba(60,20,80,0.45)',  text: '#d8b4fe' },
  'Internship': { bg: 'rgba(80,10,50,0.45)',  text: '#f9a8d4' },
};

const ARR_COLORS: Record<string, { bg: string; text: string }> = {
  'Remote':  { bg: 'rgba(10,40,90,0.50)',  text: '#93c5fd' },
  'Hybrid':  { bg: 'rgba(40,70,20,0.50)',  text: '#a7f3d0' },
  'On-site': { bg: 'rgba(80,50,10,0.50)',  text: '#fcd34d' },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="text-xs font-bold uppercase tracking-widest mb-4"
        style={{ color: 'var(--fg4)' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function JobDetailPage() {
  const { user, loading } = useAuth();
  const router   = useRouter();
  const params   = useParams();
  const jobId    = params.jobId as string;

  const [job, setJob]       = useState<Job | null>(null);
  const [poster, setPoster] = useState<Poster | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => { if (!loading && !user) router.replace('/auth'); }, [user, loading, router]);

  useEffect(() => {
    if (!jobId) return;
    getDoc(doc(db, 'jobs', jobId)).then(snap => {
      if (!snap.exists()) { setFetching(false); return; }
      const j = { id: snap.id, ...snap.data() } as Job;
      setJob(j);
      if (j.uid) {
        getDoc(doc(db, 'users', j.uid)).then(uSnap => {
          if (uSnap.exists()) {
            setPoster({
              uid: uSnap.id,
              name: uSnap.data().name ?? '',
              jobTitle: uSnap.data().jobTitle ?? '',
              photoURL: uSnap.data().photoURL,
            });
          }
        });
      }
      setFetching(false);
    });
  }, [jobId]);

  if (loading || !user) return null;

  const tc = job ? (TYPE_COLORS[job.type] ?? { bg: 'var(--fg5)', text: 'var(--fg2)' }) : null;
  const ac = job ? (ARR_COLORS[job.arrangement] ?? null) : null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* back */}
        <Link href="/jobs"
          className="inline-flex items-center gap-2 text-sm mb-6 transition-colors"
          style={{ color: 'var(--fg3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg2)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg3)')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to jobs
        </Link>

        {fetching ? (
          <p className="text-center py-20 text-sm" style={{ color: 'var(--fg4)' }}>Loading…</p>
        ) : !job ? (
          <div className="text-center py-20" style={{ color: 'var(--fg4)' }}>
            <p className="text-lg font-medium">Job not found.</p>
            <Link href="/jobs" className="text-sm mt-2 block hover:underline" style={{ color: '#ff4545' }}>
              Browse all jobs
            </Link>
          </div>
        ) : (
          <div className="space-y-4">

            {/* hero card */}
            <div className="card">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--fg1)' }}>
                    {job.title}
                  </h1>
                  <p className="text-base mt-1" style={{ color: 'var(--fg2)' }}>{job.company}</p>
                </div>
                <div className="flex flex-wrap gap-2 flex-shrink-0 justify-end">
                  {tc && (
                    <span className="text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap"
                      style={{ background: tc.bg, color: tc.text }}>
                      {job.type}
                    </span>
                  )}
                  {ac && (
                    <span className="text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap"
                      style={{ background: ac.bg, color: ac.text }}>
                      {job.arrangement}
                    </span>
                  )}
                </div>
              </div>

              {/* meta row */}
              <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--fg3)' }}>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {job.location}
                </span>
                {job.salary && (
                  <span className="flex items-center gap-1.5 font-semibold" style={{ color: '#86efac' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    {job.salary}
                  </span>
                )}
              </div>

              {/* actions */}
              {poster && user && (
                <div className="flex gap-3 mt-5 pt-4" style={{ borderTop: '1px solid var(--fg5)' }}>
                  <Link href={`/messages/${[user.uid, poster.uid].sort().join('_')}`}
                    className="btn-primary text-sm py-2.5 px-6">
                    Message about this role
                  </Link>
                </div>
              )}
            </div>

            {/* why this role exists */}
            {job.reason && (
              <Section title="Why this role was created">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--fg2)' }}>
                  {job.reason}
                </p>
              </Section>
            )}

            {/* description */}
            {job.description && (
              <Section title="About the role">
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--fg2)' }}>
                  {job.description}
                </p>
              </Section>
            )}

            {/* posted by */}
            {poster && (
              <Section title="Posted by">
                <Link href={`/profile/${poster.uid}`}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm overflow-hidden"
                    style={{ background: poster.photoURL ? 'transparent' : 'linear-gradient(135deg,#b80000,#5c0000)', color: 'white' }}>
                    {poster.photoURL
                      ? <img src={poster.photoURL} alt={poster.name} className="w-full h-full object-cover" />
                      : poster.name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--fg1)' }}>{poster.name}</p>
                    {poster.jobTitle && (
                      <p className="text-xs" style={{ color: 'var(--fg3)' }}>{poster.jobTitle}</p>
                    )}
                  </div>
                </Link>
              </Section>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
