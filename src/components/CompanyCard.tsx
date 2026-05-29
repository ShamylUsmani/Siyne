'use client';

import Link from 'next/link';

export interface CompanySummary {
  id:            string;
  name:          string;
  industry:      string;
  location:      string;
  logoUrl?:      string;
  followerCount: number;
  verified:      boolean;
}

export default function CompanyCard({
  company, followed, onFollow, busy, compact,
}: {
  company:   CompanySummary;
  followed?: boolean;
  onFollow?: () => void;
  busy?:     boolean;
  compact?:  boolean;
}) {
  return (
    <div className={`card flex items-center gap-4 ${compact ? 'p-3' : ''}`}>
      <Link href={`/companies/${company.id}`} className="flex-shrink-0">
        <div className={`rounded-xl flex items-center justify-center font-bold overflow-hidden ${compact ? 'w-10 h-10 text-base' : 'w-12 h-12 text-lg'}`}
          style={{ background: company.logoUrl ? 'transparent' : 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
          {company.logoUrl
            ? <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
            : company.name[0]?.toUpperCase() ?? '?'}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/companies/${company.id}`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
          <p className="font-semibold text-sm" style={{ color: 'var(--fg1)' }}>{company.name}</p>
          {company.verified && (
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#60a5fa' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </Link>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--fg3)' }}>
          {company.industry}{company.industry && company.location ? ' · ' : ''}{company.location}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--fg4)' }}>
          {company.followerCount.toLocaleString()} follower{company.followerCount !== 1 ? 's' : ''}
        </p>
      </div>

      {onFollow && (
        <button onClick={e => { e.preventDefault(); onFollow(); }} disabled={busy}
          className={`font-semibold rounded-lg transition-all flex-shrink-0 ${compact ? 'text-xs px-3 py-1' : 'text-xs px-3 py-1.5'}`}
          style={followed
            ? { background: 'var(--fg5)', color: 'var(--fg2)', border: '1px solid var(--fg5)' }
            : { background: 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
          {busy ? '…' : followed ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}
