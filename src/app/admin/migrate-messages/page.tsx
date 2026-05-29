'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  collection, getDocs, query, orderBy,
  doc, setDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

interface MigratedMsg {
  id:   string;
  from: string;
  text: string;
  at:   number;
}

interface ConvResult {
  convId:  string;
  status:  'success' | 'error' | 'skipped';
  count:   number;
  message: string;
}

export default function MigrateMessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const [results, setResults]   = useState<ConvResult[]>([]);
  const [log, setLog]           = useState<string[]>([]);
  const [totalMoved, setTotalMoved] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
    if (!loading && user && user.email !== 'usmani.shamyl@gmail.com') router.replace('/feed');
  }, [user, loading, router]);

  function addLog(msg: string) {
    setLog(prev => [...prev, msg]);
  }

  async function runMigration() {
    if (!user) return;
    setRunning(true);
    setDone(false);
    setResults([]);
    setLog([]);
    setTotalMoved(0);

    addLog('Starting migration…');

    try {
      /* fetch ALL conversations — requires Firestore rules to allow admin reads */
      const convsSnap = await getDocs(collection(db, 'conversations'));

      if (convsSnap.empty) {
        addLog('No conversations found. Nothing to migrate.');
        setDone(true);
        setRunning(false);
        return;
      }

      addLog(`Found ${convsSnap.docs.length} conversation(s). Processing…`);
      addLog('');

      const convResults: ConvResult[] = [];
      let grandTotal = 0;

      for (const convDoc of convsSnap.docs) {
        const convId = convDoc.id;
        addLog(`Conversation: ${convId}`);

        try {
          const msgsSnap = await getDocs(query(
            collection(db, 'conversations', convId, 'messages'),
            orderBy('at', 'asc'),
          ));

          if (msgsSnap.empty) {
            addLog('  → No old messages found. Skipping.');
            convResults.push({ convId, status: 'skipped', count: 0, message: 'No messages in subcollection.' });
            addLog('');
            continue;
          }

          addLog(`  → Found ${msgsSnap.docs.length} message(s).`);

          const converted: MigratedMsg[] = msgsSnap.docs.map(d => {
            const data = d.data();
            let at: number;
            if (data.at instanceof Timestamp) {
              at = data.at.toMillis();
            } else if (data.at && typeof data.at.seconds === 'number') {
              at = data.at.seconds * 1000;
            } else {
              at = Date.now();
            }
            return { id: d.id, from: data.from ?? '', text: data.text ?? '', at };
          });

          const existing = (convDoc.data().msgs ?? []) as MigratedMsg[];
          const existingIds = new Set(existing.map(m => m.id));
          const newOnly = converted.filter(m => !existingIds.has(m.id));

          if (newOnly.length === 0) {
            addLog('  → Already migrated. Skipping.');
            convResults.push({ convId, status: 'skipped', count: 0, message: 'Already migrated.' });
            addLog('');
            continue;
          }

          const merged = [...existing, ...newOnly].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
          await setDoc(doc(db, 'conversations', convId), { msgs: merged }, { merge: true });

          grandTotal += newOnly.length;
          addLog(`  → Migrated ${newOnly.length} message(s). ✓`);
          convResults.push({ convId, status: 'success', count: newOnly.length, message: `${newOnly.length} message(s) moved.` });

        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          addLog(`  → Error: ${msg}`);
          convResults.push({ convId, status: 'error', count: 0, message: msg });
        }

        addLog('');
      }

      setResults(convResults);
      setTotalMoved(grandTotal);
      addLog('─────────────────────────');
      addLog(`Done. ${grandTotal} message(s) migrated across ${convResults.filter(r => r.status === 'success').length} conversation(s).`);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Fatal error: ${msg}`);
      addLog('Make sure you have added the Firestore rule before running.');
    }

    setRunning(false);
    setDone(true);
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">

        <Link href="/admin"
          className="inline-flex items-center gap-2 text-sm mb-6"
          style={{ color: 'var(--fg4)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Admin
        </Link>

        <div className="card">
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--fg1)' }}>
            Migrate Old Messages
          </h1>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--fg3)' }}>
            Copies messages from the old subcollection format into the new conversation
            document format so they appear in chat. Safe to run multiple times — it
            skips anything already migrated.
          </p>

          {/* Step reminder */}
          {!done && (
            <div className="mb-6 rounded-lg px-4 py-3 text-sm"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)', color: '#fbbf24' }}>
              Make sure you have added the Firestore rule before clicking Start — otherwise
              the migration will get a permission error reading the old messages.
            </div>
          )}

          {!running && !done && (
            <button onClick={runMigration} className="btn-primary">
              Start Migration
            </button>
          )}

          {running && (
            <div className="flex items-center gap-3 mb-2">
              <div className="w-5 h-5 border-2 rounded-full animate-spin flex-shrink-0"
                style={{ borderColor: '#B01E36', borderTopColor: 'transparent' }} />
              <span className="text-sm" style={{ color: 'var(--fg2)' }}>Running — do not close this page…</span>
            </div>
          )}

          {/* Log output */}
          {log.length > 0 && (
            <div className="mt-4 rounded-lg p-4 font-mono text-xs leading-relaxed overflow-auto max-h-72 space-y-0.5"
              style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--fg2)', border: '1px solid var(--fg5)' }}>
              {log.map((line, i) => (
                <div key={i} style={{ color: line.includes('✓') ? '#4ade80' : line.includes('Error') ? '#fca5a5' : 'inherit' }}>
                  {line || <>&nbsp;</>}
                </div>
              ))}
            </div>
          )}

          {/* Per-conversation results */}
          {done && results.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--fg4)' }}>
                Results
              </p>
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                  style={{ background: 'var(--sur)' }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--fg3)' }}>{r.convId}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--fg4)' }}>{r.message}</p>
                  </div>
                  <span className="ml-3 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: r.status === 'success'
                        ? 'rgba(74,222,128,0.15)'
                        : r.status === 'error'
                        ? 'rgba(252,165,165,0.15)'
                        : 'var(--sur)',
                      color: r.status === 'success' ? '#4ade80'
                        : r.status === 'error' ? '#fca5a5'
                        : 'var(--fg4)',
                    }}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Done summary */}
          {done && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>
                {totalMoved > 0 ? `${totalMoved} message(s) successfully migrated.` : 'Nothing new to migrate.'}
              </p>
              <div className="flex gap-3">
                <button onClick={runMigration} className="btn-outline text-sm py-2 px-4">
                  Run Again
                </button>
                <Link href="/messages" className="btn-primary text-sm py-2 px-4">
                  Go to Messages
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
