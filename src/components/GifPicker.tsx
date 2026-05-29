'use client';

import { useEffect, useRef, useState } from 'react';

interface GifResult {
  id:      string;
  url:     string;
  preview: string;
  title:   string;
}

export default function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [query,   setQuery]   = useState('');
  const [gifs,    setGifs]    = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const key = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

  async function fetchGifs(q: string) {
    if (!key) { setLoading(false); return; }
    setLoading(true);
    try {
      const endpoint = q.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q.trim())}&limit=24&rating=g&lang=en`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=24&rating=g`;
      const data = await fetch(endpoint).then(r => r.json());
      type GiphyItem = {
        id: string;
        title?: string;
        images: {
          original:          { url: string };
          fixed_width_small?: { url: string };
          downsized?:         { url: string };
        };
      };
      setGifs((data.data ?? []).map((g: GiphyItem) => ({
        id:      g.id,
        url:     g.images.original.url,
        preview: g.images.fixed_width_small?.url ?? g.images.downsized?.url ?? g.images.original.url,
        title:   g.title ?? '',
      })));
    } catch {}
    setLoading(false);
  }

  useEffect(() => { fetchGifs(''); }, []);

  function handleSearch(q: string) {
    setQuery(q);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchGifs(q), 350);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'var(--drop-bg)', border: '1px solid var(--fg5)', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>

        {/* search bar */}
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid var(--sur)' }}>
          <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--fg4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search GIFs…"
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--fg1)' }}
          />
          <button onClick={onClose} className="flex-shrink-0 transition-colors"
            style={{ color: 'var(--fg4)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg4)')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* gif grid */}
        <div className="h-64 overflow-y-auto p-2">
          {!key ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
              <p className="text-sm font-semibold" style={{ color: 'var(--fg2)' }}>GIF key not set</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--fg4)' }}>
                Add <code className="px-1 py-0.5 rounded" style={{ background: 'var(--fg5)' }}>NEXT_PUBLIC_GIPHY_API_KEY</code> to your <code>.env.local</code> file. Free key at developers.giphy.com
              </p>
            </div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--fg5)', borderTopColor: '#B01E36' }} />
            </div>
          ) : gifs.length === 0 ? (
            <p className="text-center text-xs py-10" style={{ color: 'var(--fg4)' }}>
              No GIFs found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {gifs.map(gif => (
                <button
                  key={gif.id}
                  onClick={() => { onSelect(gif.url); onClose(); }}
                  className="relative overflow-hidden rounded-lg transition-opacity"
                  style={{ aspectRatio: '4/3' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.78')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  <img
                    src={gif.preview}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-3 py-2 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--sur)' }}>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--fg5)' }}>
            Powered by GIPHY
          </span>
          {key && !query && (
            <span className="text-[10px]" style={{ color: 'var(--fg5)' }}>Trending</span>
          )}
        </div>
      </div>
    </div>
  );
}
