'use client';

/**
 * EmojiPickerPortal
 *
 * Renders an emoji reaction picker anchored to a DOM element,
 * positioned via getBoundingClientRect() and rendered through
 * a React portal at document.body — completely outside any
 * backdrop-filter ancestor (which would corrupt position:fixed).
 *
 * Auto-flips above/below based on available viewport space.
 * Stays aligned on scroll/resize via event listeners.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface EmojiPickerPortalProps {
  /** The button element the picker should be anchored to */
  anchor: HTMLElement | null;
  /** Emoji characters to show */
  emojis: string[];
  /** Optional labels to display above each emoji on hover */
  labels?: Record<string, string>;
  /** The currently active/selected emoji (highlighted) */
  activeEmoji?: string;
  /** Called when an emoji is selected */
  onSelect: (emoji: string) => void;
  /** Called when the picker should close (outside click, selection, Escape) */
  onClose: () => void;
  /** Stagger animation delay on each emoji */
  animateIn?: boolean;
  /** Extra horizontal offset in px (default 0) */
  offsetX?: number;
}

export default function EmojiPickerPortal({
  anchor,
  emojis,
  labels,
  activeEmoji,
  onSelect,
  onClose,
  animateIn = true,
  offsetX = 0,
}: EmojiPickerPortalProps) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [ready, setReady] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Ensure we only render on the client (portal needs document)
  useEffect(() => { setMounted(true); }, []);

  // Recalculate position whenever anchor changes or on scroll/resize
  useLayoutEffect(() => {
    if (!anchor || !mounted) return;
    setReady(false);

    function calculate() {
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const pw = emojis.length * 52 + 16;  // approximate picker width
      const ph = pickerRef.current?.offsetHeight ?? 56; // real or estimated picker height

      // Flip: show above if there's enough room, otherwise below
      const spaceAbove = r.top;
      const spaceBelow = window.innerHeight - r.bottom;
      const above = spaceAbove >= ph + 12 || spaceAbove >= spaceBelow;

      // Center on button, clamp to viewport edges
      const idealLeft = r.left + r.width / 2 - pw / 2 + offsetX;
      const left = Math.max(8, Math.min(idealLeft, window.innerWidth - pw - 8));
      const top = above ? r.top - ph - 8 : r.bottom + 8;

      setPos({ top, left });
      setReady(true);
    }

    calculate();
    window.addEventListener('scroll', calculate, { passive: true, capture: true });
    window.addEventListener('resize', calculate, { passive: true });
    return () => {
      window.removeEventListener('scroll', calculate, true);
      window.removeEventListener('resize', calculate);
    };
  }, [anchor, mounted, emojis.length, offsetX]);

  // Close on Escape key
  useEffect(() => {
    if (!anchor) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [anchor, onClose]);

  if (!mounted || !anchor) return null;

  return createPortal(
    <>
      {/* Invisible full-screen backdrop — closes picker on outside click */}
      <div
        className="fixed inset-0 z-[298]"
        onClick={onClose}
        aria-hidden
      />

      {/* The picker itself */}
      <div
        ref={pickerRef}
        className="reaction-picker fixed z-[299] flex items-center gap-0.5 px-2 py-2 rounded-full shadow-2xl"
        style={{
          top: pos.top,
          left: pos.left,
          // Invisible until position is calculated to avoid flash
          opacity: ready ? 1 : 0,
          pointerEvents: ready ? undefined : 'none',
          background: 'var(--drop-bg)',
          border: '1px solid var(--fg5)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {emojis.map((emoji, i) => (
          <div
            key={emoji}
            className="relative flex flex-col items-center group/emoji"
            style={animateIn ? { animationDelay: `${i * 0.04}s` } : undefined}
          >
            {/* Hover label */}
            {labels && (
              <div
                className="absolute bottom-full mb-1.5 px-2 py-0.5 rounded-full text-[10px]
                  font-semibold whitespace-nowrap pointer-events-none select-none
                  opacity-0 group-hover/emoji:opacity-100 transition-opacity duration-100"
                style={{ background: 'rgba(0,0,0,0.78)', color: 'white' }}
              >
                {labels[emoji] ?? emoji}
              </div>
            )}

            <button
              onClick={() => { onSelect(emoji); onClose(); }}
              className="flex items-center justify-center rounded-full select-none
                transition-all duration-150
                group-hover/emoji:scale-[1.42] group-hover/emoji:-translate-y-2
                active:scale-90"
              style={{
                width: 44,
                height: 44,
                fontSize: 26,
                touchAction: 'manipulation',
                background: activeEmoji === emoji
                  ? 'rgba(176,30,54,0.20)'
                  : 'transparent',
              }}
            >
              {emoji}
            </button>
          </div>
        ))}
      </div>
    </>,
    document.body
  );
}
