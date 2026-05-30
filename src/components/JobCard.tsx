'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface Job {
  id:           string;
  uid:          string;
  title:        string;
  company:      string;
  location:     string;
  type:         string;
  arrangement:  string;
  salary:       string;
  description:  string;
  reason:       string;
  createdAt:    { seconds: number } | null;
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'Full-time':   { bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6' },
  'Part-time':   { bg: 'rgba(139,92,246,0.15)',  text: '#8b5cf6' },
  'Contract':    { bg: 'rgba(245,158,11,0.15)',  text: '#d97706' },
  'Internship':  { bg: 'rgba(16,185,129,0.15)',  text: '#10b981' },
};

const ARR_COLORS: Record<string, { bg: string; text: string }> = {
  'Remote':  { bg: 'rgba(99,102,241,0.15)',  text: '#6366f1' },
  'Hybrid':  { bg: 'rgba(236,72,153,0.15)',  text: '#ec4899' },
  'On-site': { bg: 'rgba(245,158,11,0.15)',  text: '#d97706' },
};

export default function JobCard({ job }: { job: Job }) {
  const router = useRouter();
  const [hov, setHov] = useState(false);

  const tc = TYPE_COLORS[job.type]        ?? { bg: 'var(--fg5)', text: 'var(--fg2)' };
  const ac = ARR_COLORS[job.arrangement]  ?? null;

  return (
    <div
      onClick={() => router.push(`/jobs/${job.id}`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="card cursor-pointer"
      style={{
        transform:  hov ? 'translateY(-6px)' : 'translateY(0)',
        boxShadow:  hov
          ? '0 20px 56px rgba(0,0,0,0.55), 0 4px 16px rgba(149,0,0,0.18)'
          : '0 4px 24px rgba(0,0,0,0.35)',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease',
        borderColor: hov ? 'var(--fg5)' : undefined,
      }}
    >
      {/* header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base leading-snug" style={{ color: 'var(--fg1)' }}>
            {job.title}
          </h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--fg3)' }}>{job.company}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 flex-shrink-0 justify-end">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ background: tc.bg, color: tc.text }}>
            {job.type}
          </span>
          {ac && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{ background: ac.bg, color: ac.text }}>
              {job.arrangement}
            </span>
          )}
        </div>
      </div>

      {/* meta */}
      <div className="flex flex-wrap gap-3 text-xs mb-3" style={{ color: 'var(--fg3)' }}>
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {job.location}
        </span>
        {job.salary && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            {job.salary}
          </span>
        )}
      </div>

      {/* description preview — expands on hover */}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--fg3)', transition: 'all 0.2s ease' }}>
        {hov
          ? (job.description?.slice(0, 200) ?? '') + (job.description?.length > 200 ? '…' : '')
          : (job.description?.slice(0, 90) ?? '')  + (job.description?.length > 90  ? '…' : '')}
      </p>

      {/* hover-only extra detail */}
      <div style={{
        maxHeight:  hov ? '150px' : '0',
        opacity:    hov ? 1 : 0,
        overflow:   'hidden',
        transition: 'max-height 0.25s ease, opacity 0.2s ease, margin-top 0.2s ease',
        marginTop:  hov ? '14px' : '0',
      }}>
        {job.reason && (
          <div className="mb-3 pb-3" style={{ borderBottom: '1px solid var(--sur)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1"
              style={{ color: 'var(--fg4)' }}>
              Why this role was created
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--fg2)' }}>
              {job.reason.slice(0, 160)}{job.reason.length > 160 ? '…' : ''}
            </p>
          </div>
        )}
        <p className="text-xs flex items-center gap-1" style={{ color: 'var(--fg4)' }}>
          Click to view full listing
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </p>
      </div>
    </div>
  );
}
