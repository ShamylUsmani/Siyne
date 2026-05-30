'use client';

import { useState } from 'react';
import {
  doc, updateDoc, setDoc, addDoc, collection,
  serverTimestamp, getDoc, increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

/* ── Pitch type ──────────────────────────────────────── */
export interface Pitch {
  id: string;
  uid: string;
  founderName: string;
  founderPhotoURL?: string;
  companyName: string;
  oneLiner: string;
  problem: string;
  solution: string;
  targetMarket: string;
  businessModel: string;
  traction: string;
  fundingAmount: number;
  equity: number;
  stage: 'Just an Idea' | 'Building' | 'Launching' | 'Growing' | 'Scaling';
  industry: 'Tech' | 'Health' | 'Finance' | 'Education' | 'Retail' | 'Food' | 'Property' | 'Other';
  location: string;
  teamSize: number;
  website?: string;
  pitchDeckUrl?: string;
  lookingFor: 'Funding' | 'Mentorship' | 'Both';
  status: 'active' | 'closed' | 'funded';
  featured: boolean;
  viewCount: number;
  interestedCount: number;
  savedCount: number;
  createdAt: { seconds: number } | null;
  updatedAt: { seconds: number } | null;
}

/* ── colour maps ─────────────────────────────────────── */
export const INDUSTRY_COLORS: Record<string, string> = {
  Tech: '#3b82f6', Health: '#10b981', Finance: '#f59e0b',
  Education: '#8b5cf6', Retail: '#ec4899', Food: '#f97316',
  Property: '#6366f1', Other: '#6b7280',
};

const STAGE_COLORS: Record<string, string> = {
  'Just an Idea': '#6b7280',
  'Building':     '#8b5cf6',
  'Launching':    '#3b82f6',
  'Growing':      '#10b981',
  'Scaling':      '#f59e0b',
};

/* ── helpers ─────────────────────────────────────────── */
function daysAgo(ts: { seconds: number } | null) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts.seconds * 1000) / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return '1 day ago';
  return `${d} days ago`;
}

function fmtAUD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

/* ── Modal ───────────────────────────────────────────── */
function PitchModal({
  pitch, onClose, onInterestSent,
}: {
  pitch: Pitch;
  onClose: () => void;
  onInterestSent: () => void;
}) {
  const { user } = useAuth();
  const [interestSent, setInterestSent] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [revealMsg, setRevealMsg] = useState('');
  const [busyInterest, setBusyInterest] = useState(false);
  const [copied, setCopied] = useState(false);

  const isOwner = user?.uid === pitch.uid;
  const industryColor = INDUSTRY_COLORS[pitch.industry] ?? '#6b7280';
  const stageColor    = STAGE_COLORS[pitch.stage]       ?? '#6b7280';

  async function handleInterest() {
    if (!user || isOwner || interestSent) return;
    setBusyInterest(true);
    try {
      const interestId = `${pitch.id}_${user.uid}`;
      const ref = doc(db, 'pitchInterests', interestId);
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        await setDoc(ref, {
          pitchId:    pitch.id,
          investorId: user.uid,
          revealed:   false,
          timestamp:  serverTimestamp(),
        });
        await updateDoc(doc(db, 'pitches', pitch.id), { interestedCount: increment(1) });
        await addDoc(collection(db, 'notifications', pitch.uid, 'items'), {
          type:     'pitch_interest',
          fromUid:  user.uid,
          fromName: user.displayName ?? 'An investor',
          text:     'is interested in your pitch',
          pitchId:  pitch.id,
          read:     false,
          createdAt: serverTimestamp(),
        });
      }
      setInterestSent(true);
      onInterestSent();
      setShowReveal(true);
    } catch (e) { console.error(e); }
    setBusyInterest(false);
  }

  async function handleReveal() {
    if (!user || !revealMsg.trim()) return;
    const interestId = `${pitch.id}_${user.uid}`;
    await updateDoc(doc(db, 'pitchInterests', interestId), {
      revealed: true,
      message:  revealMsg.trim(),
    });
    // open DM
    const convId = [user.uid, pitch.uid].sort().join('_');
    const convRef = doc(db, 'conversations', convId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) {
      await setDoc(convRef, {
        participants:    [user.uid, pitch.uid],
        lastMessage:     revealMsg.trim(),
        lastMessageAt:   serverTimestamp(),
        unread:          { [pitch.uid]: 1 },
        createdAt:       serverTimestamp(),
      });
    }
    await addDoc(collection(db, 'conversations', convId, 'messages'), {
      senderId:  user.uid,
      senderName: user.displayName ?? '',
      text:      revealMsg.trim(),
      createdAt: serverTimestamp(),
    });
    await updateDoc(convRef, {
      lastMessage:   revealMsg.trim(),
      lastMessageAt: serverTimestamp(),
      [`unread.${pitch.uid}`]: increment(1),
    });
    setShowReveal(false);
    onClose();
  }

  async function handleClose() {
    if (!user || !isOwner) return;
    await updateDoc(doc(db, 'pitches', pitch.id), { status: 'closed', updatedAt: serverTimestamp() });
    onClose();
  }

  async function handleMarkFunded() {
    if (!user || !isOwner) return;
    await updateDoc(doc(db, 'pitches', pitch.id), { status: 'funded', updatedAt: serverTimestamp() });
    onClose();
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/pitches?id=${pitch.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const Section = ({ title, body }: { title: string; body: string }) => body ? (
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--fg4)' }}>{title}</p>
      <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--fg2)' }}>{body}</p>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'var(--drop-bg)', border: '1px solid var(--fg5)', boxShadow: '0 24px 60px rgba(0,0,0,0.75)' }}>

        {/* header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--fg5)' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-lg font-bold" style={{ color: 'var(--fg1)' }}>{pitch.companyName}</h2>
              {pitch.featured && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                  ★ Featured
                </span>
              )}
              {pitch.status === 'funded' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                  Funded
                </span>
              )}
              {pitch.status === 'closed' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af' }}>
                  Closed
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: 'var(--fg3)' }}>{pitch.oneLiner}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--fg4)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--sur)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5">
          {/* tag row */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: `${industryColor}22`, color: industryColor, border: `1px solid ${industryColor}44` }}>
              {pitch.industry}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: `${stageColor}22`, color: stageColor, border: `1px solid ${stageColor}44` }}>
              {pitch.stage}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--sur)', color: 'var(--fg3)' }}>
              🇦🇺 {pitch.location}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--sur)', color: 'var(--fg3)' }}>
              {pitch.lookingFor}
            </span>
          </div>

          {/* metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Seeking', value: `${fmtAUD(pitch.fundingAmount)} AUD` },
              { label: 'Equity',  value: `${pitch.equity}%` },
              { label: 'Team',    value: `${pitch.teamSize} people` },
              { label: 'Interested', value: String(pitch.interestedCount) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--sur)' }}>
                <p className="text-base font-bold" style={{ color: 'var(--fg1)' }}>{value}</p>
                <p className="text-xs" style={{ color: 'var(--fg4)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* founder */}
          <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: 'var(--sur)' }}>
            <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold overflow-hidden"
              style={{ background: pitch.founderPhotoURL ? 'transparent' : 'linear-gradient(135deg,#B01E36,#4A0818)', color: 'white' }}>
              {pitch.founderPhotoURL
                ? <img src={pitch.founderPhotoURL} alt={pitch.founderName} className="w-full h-full object-cover" />
                : pitch.founderName[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--fg1)' }}>{pitch.founderName}</p>
              <p className="text-xs" style={{ color: 'var(--fg4)' }}>Founder · {daysAgo(pitch.createdAt)}</p>
            </div>
          </div>

          <Section title="Problem" body={pitch.problem} />
          <Section title="Solution" body={pitch.solution} />
          <Section title="Target Market" body={pitch.targetMarket} />
          <Section title="Business Model" body={pitch.businessModel} />
          <Section title="Current Traction" body={pitch.traction} />

          {/* links */}
          {(pitch.website || pitch.pitchDeckUrl) && (
            <div className="flex flex-wrap gap-3 mb-5">
              {pitch.website && (
                <a href={pitch.website} target="_blank" rel="noopener noreferrer"
                  className="text-sm flex items-center gap-1.5 hover:underline"
                  style={{ color: '#3b82f6' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Website
                </a>
              )}
              {pitch.pitchDeckUrl && (
                <a href={pitch.pitchDeckUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm flex items-center gap-1.5 hover:underline"
                  style={{ color: '#8b5cf6' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Pitch Deck
                </a>
              )}
            </div>
          )}

          {/* reveal message box */}
          {showReveal && (
            <div className="mb-4 rounded-xl p-4" style={{ background: 'rgba(176,30,54,0.08)', border: '1px solid rgba(176,30,54,0.2)' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--fg1)' }}>Interest sent! Introduce yourself to the founder?</p>
              <textarea
                value={revealMsg}
                onChange={e => setRevealMsg(e.target.value)}
                placeholder="Hi, I'm interested in your pitch because…"
                className="input-field text-sm resize-none mb-2"
                rows={3}
              />
              <div className="flex gap-2">
                <button onClick={handleReveal} disabled={!revealMsg.trim()} className="btn-primary text-sm py-2 px-4">
                  Send Message
                </button>
                <button onClick={() => setShowReveal(false)} className="btn-outline text-sm py-2 px-4">
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>

        {/* action footer */}
        <div className="flex items-center gap-2 flex-wrap px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--fg5)' }}>
          {!isOwner && pitch.status === 'active' && (
            <button
              onClick={handleInterest}
              disabled={busyInterest || interestSent}
              className="btn-primary text-sm py-2 px-4"
              style={interestSent ? { background: 'var(--sur)', color: 'var(--fg3)', border: '1px solid var(--fg5)', boxShadow: 'none' } : undefined}>
              {busyInterest ? '…' : interestSent ? 'Interest Sent ✓' : 'Express Interest'}
            </button>
          )}
          {isOwner && (
            <>
              <a href={`/pitches/new?edit=${pitch.id}`} className="btn-outline text-sm py-2 px-4">Edit Pitch</a>
              {pitch.status === 'active' && (
                <>
                  <button onClick={handleMarkFunded} className="text-sm px-3 py-2 rounded-lg font-medium"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                    Mark Funded
                  </button>
                  <button onClick={handleClose} className="text-sm px-3 py-2 rounded-lg font-medium"
                    style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.25)' }}>
                    Close Pitch
                  </button>
                </>
              )}
            </>
          )}
          <button onClick={copyLink} className="btn-outline text-sm py-2 px-3 flex items-center gap-1.5 ml-auto">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── PitchCard ───────────────────────────────────────── */
export default function PitchCard({
  pitch,
  onSave,
  onInterest,
}: {
  pitch: Pitch;
  onSave?: () => void;
  onInterest?: () => void;
}) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [saved, setSaved]         = useState(false);
  const [busySave, setBusySave]   = useState(false);
  const [copied, setCopied]       = useState(false);
  const [interestSent, setInterestSent] = useState(false);

  const industryColor = INDUSTRY_COLORS[pitch.industry] ?? '#6b7280';
  const stageColor    = STAGE_COLORS[pitch.stage]       ?? '#6b7280';
  const isClosed      = pitch.status === 'closed';

  async function openModal() {
    if (isClosed) return;
    setShowModal(true);
    // increment view count
    try {
      await updateDoc(doc(db, 'pitches', pitch.id), { viewCount: increment(1) });
    } catch { /* ignore */ }
  }

  async function toggleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;
    setBusySave(true);
    const saveId = `${pitch.id}_${user.uid}`;
    const ref = doc(db, 'pitchSaves', saveId);
    try {
      if (saved) {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(ref);
        await updateDoc(doc(db, 'pitches', pitch.id), { savedCount: increment(-1) });
        setSaved(false);
      } else {
        await setDoc(ref, { pitchId: pitch.id, userId: user.uid, timestamp: serverTimestamp() });
        await updateDoc(doc(db, 'pitches', pitch.id), { savedCount: increment(1) });
        setSaved(true);
        onSave?.();
      }
    } catch (err) { console.error(err); }
    setBusySave(false);
  }

  async function handleInterest(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user || interestSent || pitch.uid === user.uid) return;
    try {
      const interestId = `${pitch.id}_${user.uid}`;
      const ref = doc(db, 'pitchInterests', interestId);
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        await setDoc(ref, {
          pitchId:    pitch.id,
          investorId: user.uid,
          revealed:   false,
          timestamp:  serverTimestamp(),
        });
        await updateDoc(doc(db, 'pitches', pitch.id), { interestedCount: increment(1) });
        await addDoc(collection(db, 'notifications', pitch.uid, 'items'), {
          type:      'pitch_interest',
          fromUid:   user.uid,
          fromName:  user.displayName ?? 'An investor',
          text:      'is interested in your pitch',
          pitchId:   pitch.id,
          read:      false,
          createdAt: serverTimestamp(),
        });
      }
      setInterestSent(true);
      onInterest?.();
    } catch (err) { console.error(err); }
  }

  function copyLink(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/pitches?id=${pitch.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div
        className="card relative cursor-pointer overflow-hidden"
        onClick={openModal}
        style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
        onMouseEnter={e => {
          if (!isClosed) {
            (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 16px 48px rgba(0,0,0,0.55), 0 4px 16px rgba(149,0,0,0.18)';
          }
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '';
        }}>

        {/* closed overlay */}
        {isClosed && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
            <span className="text-sm font-bold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(107,114,128,0.3)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.4)' }}>
              Closed
            </span>
          </div>
        )}

        {/* header */}
        <div className="mb-2">
          <h3 className="font-bold text-base leading-snug" style={{ color: 'var(--fg1)' }}>{pitch.companyName}</h3>
          <p className="text-sm mt-0.5 line-clamp-2" style={{ color: 'var(--fg3)' }}>{pitch.oneLiner}</p>
        </div>

        {/* tag row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${industryColor}22`, color: industryColor, border: `1px solid ${industryColor}44` }}>
            {pitch.industry}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${stageColor}22`, color: stageColor, border: `1px solid ${stageColor}44` }}>
            {pitch.stage}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--sur)', color: 'var(--fg4)' }}>
            🇦🇺 {pitch.location}
          </span>
          {pitch.featured && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
              ★ Featured
            </span>
          )}
          {pitch.status === 'funded' && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
              Funded
            </span>
          )}
        </div>

        {/* seeking metrics */}
        <p className="text-sm font-medium mb-4" style={{ color: 'var(--fg2)' }}>
          Seeking {fmtAUD(pitch.fundingAmount)} AUD &middot; {pitch.equity}% equity
        </p>

        {/* footer */}
        <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--fg5)' }}
          onClick={e => e.stopPropagation()}>
          <span className="text-xs flex-1" style={{ color: 'var(--fg4)' }}>
            {daysAgo(pitch.createdAt)}
          </span>

          {/* save */}
          <button
            onClick={toggleSave}
            disabled={busySave}
            title={saved ? 'Unsave' : 'Save'}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
            style={{
              background: saved ? 'rgba(176,30,54,0.12)' : 'var(--sur)',
              color: saved ? '#B01E36' : 'var(--fg4)',
              border: `1px solid ${saved ? 'rgba(176,30,54,0.25)' : 'var(--fg5)'}`,
            }}>
            <svg className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            {pitch.savedCount > 0 && <span>{pitch.savedCount}</span>}
          </button>

          {/* interest */}
          {pitch.uid !== user?.uid && pitch.status === 'active' && (
            <button
              onClick={handleInterest}
              disabled={interestSent}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors"
              style={{
                background: interestSent ? 'var(--sur)' : 'rgba(251,191,36,0.12)',
                color:      interestSent ? 'var(--fg4)' : '#fbbf24',
                border:     `1px solid ${interestSent ? 'var(--fg5)' : 'rgba(251,191,36,0.3)'}`,
              }}>
              {interestSent ? 'Sent ✓' : 'Interested'}
              {pitch.interestedCount > 0 && !interestSent && (
                <span className="ml-0.5 opacity-60">{pitch.interestedCount}</span>
              )}
            </button>
          )}

          {/* share */}
          <button
            onClick={copyLink}
            title="Copy link"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ background: 'var(--sur)', color: 'var(--fg4)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg2)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg4)')}>
            {copied
              ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
          </button>
        </div>
      </div>

      {/* detail modal */}
      {showModal && (
        <PitchModal
          pitch={pitch}
          onClose={() => setShowModal(false)}
          onInterestSent={() => setInterestSent(true)}
        />
      )}
    </>
  );
}
