'use client';
import { useEffect, useRef } from 'react';

interface Drop   { x: number; y: number; spd: number; len: number; op: number; }
interface Fly    { x: number; y: number; vx: number; vy: number; phase: number; }
interface Leaf   { x: number; y: number; vx: number; vy: number; rot: number; rs: number; sz: number; col: string; }
interface Bird   { x: number; y: number; spd: number; flap: number; group: number; lane: number; }
interface Ripple { x: number; y: number; r: number; maxR: number; op: number; }
interface Trunk  { x: number; tw: number; th: number; }
interface Canopy { x: number; y: number; r: number; col: string; }

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

const GREENS = ['#2db02d','#25a025','#1d8c1d','#15781a','#0d641a','#228b22','#32cd32','#3cb371'];
const DARK_GREENS = ['#0a4010','#0c5015','#0e601a','#104010','#082808'];

export default function RainforestCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, riverY = 0, riverH = 0;
    let raf = 0, frame = 0;
    const drops: Drop[] = []; const flies: Fly[] = []; const leaves: Leaf[] = [];
    const birds: Bird[] = []; const ripples: Ripple[] = [];
    const trunks: Trunk[] = []; const canopy: Canopy[] = []; const fgLeaves: Canopy[] = [];
    let shimmerOffset = 0;

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      riverY = H * 0.45; riverH = H * 0.14;
      drops.length = 0; flies.length = 0; leaves.length = 0;
      birds.length = 0; ripples.length = 0; trunks.length = 0;
      canopy.length = 0; fgLeaves.length = 0;

      // Rain (light drizzle)
      for (let i = 0; i < 80; i++) drops.push({
        x: rand(0, W), y: rand(0, H), spd: rand(4, 8), len: rand(8, 18), op: rand(0.08, 0.22),
      });

      // Fireflies
      for (let i = 0; i < 30; i++) flies.push({
        x: rand(0, W), y: rand(riverY + riverH, H),
        vx: rand(-0.2, 0.2), vy: rand(-0.1, 0.1), phase: rand(0, Math.PI * 2),
      });

      // Leaves
      for (let i = 0; i < 22; i++) leaves.push({
        x: rand(0, W), y: rand(-60, H), vx: rand(-0.5, 0.2), vy: rand(0.6, 1.4),
        rot: rand(0, Math.PI * 2), rs: rand(-0.03, 0.03),
        sz: rand(4, 14), col: pick(GREENS),
      });

      // Birds (groups of 2-4)
      for (let g = 0; g < 4; g++) {
        const lane = rand(riverY * 0.1, riverY * 0.85);
        const spd = rand(1.2, 2.5);
        const count = Math.floor(rand(2, 5));
        for (let i = 0; i < count; i++) {
          birds.push({ x: -rand(0, 300) - i * rand(20, 50), y: lane + rand(-15, 15), spd, flap: rand(0, Math.PI * 2), group: g, lane });
        }
      }

      // Tree trunks
      let tx = rand(10, 40);
      while (tx < W) {
        trunks.push({ x: tx, tw: rand(12, 32), th: rand(H * 0.3, H * 0.65) });
        tx += rand(60, 180);
      }

      // Mid canopy blobs
      for (let x = -40; x < W + 40; x += rand(30, 65)) {
        const y = rand(riverY * 0.05, riverY * 0.55);
        canopy.push({ x, y, r: rand(40, 95), col: pick(GREENS) });
      }

      // Foreground leaf clusters (bottom)
      for (let i = 0; i < 35; i++) {
        fgLeaves.push({
          x: rand(-20, W + 20), y: rand(riverY + riverH + 10, H + 20),
          r: rand(20, 70), col: pick([...GREENS, ...GREENS, ...DARK_GREENS]),
        });
      }
    }

    function drawBg() {
      // Sky / canopy gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0,    '#061a08');
      sky.addColorStop(0.35, '#0d3010');
      sky.addColorStop(riverY / H, '#0a2808');
      sky.addColorStop((riverY + riverH) / H, '#082010');
      sky.addColorStop(1, '#040e05');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // Canopy blobs (mid-layer)
      for (const c of canopy) {
        ctx.globalAlpha = 0.88;
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        g.addColorStop(0, c.col); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // River
      ctx.fillStyle = '#1a6040';
      ctx.fillRect(0, riverY, W, riverH);

      // River shimmer streaks
      shimmerOffset = (shimmerOffset + 0.4) % W;
      for (let i = 0; i < 18; i++) {
        const lx = ((i * 67 + shimmerOffset) % (W + 60)) - 30;
        const ly = riverY + riverH * rand(0.15, 0.85);
        const len = rand(30, 100);
        ctx.strokeStyle = `rgba(60,180,120,0.18)`;
        ctx.lineWidth = rand(1, 2.5);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + len, ly); ctx.stroke();
      }

      // River shore (irregular green edges)
      ctx.fillStyle = '#0c3818';
      ctx.beginPath(); ctx.moveTo(0, riverY);
      for (let x = 0; x <= W; x += 40) {
        ctx.lineTo(x, riverY - rand(0, 12));
      }
      ctx.lineTo(W, riverY); ctx.lineTo(0, riverY); ctx.closePath(); ctx.fill();

      ctx.beginPath(); ctx.moveTo(0, riverY + riverH);
      for (let x = 0; x <= W; x += 40) {
        ctx.lineTo(x, riverY + riverH + rand(0, 12));
      }
      ctx.lineTo(W, riverY + riverH); ctx.closePath(); ctx.fill();

      // River ambient glow
      const rg = ctx.createLinearGradient(0, riverY, 0, riverY + riverH);
      rg.addColorStop(0, 'rgba(20,120,70,0.25)');
      rg.addColorStop(0.5, 'rgba(30,140,80,0.15)');
      rg.addColorStop(1, 'rgba(20,120,70,0.25)');
      ctx.fillStyle = rg; ctx.fillRect(0, riverY, W, riverH);

      // Tree trunks
      for (const t of trunks) {
        const g = ctx.createLinearGradient(t.x - t.tw / 2, 0, t.x + t.tw / 2, 0);
        g.addColorStop(0, '#050f05'); g.addColorStop(0.5, '#0a1e08'); g.addColorStop(1, '#050f05');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.roundRect(t.x - t.tw / 2, H - t.th, t.tw, t.th, [2, 2, 0, 0]); ctx.fill();
      }

      // Foreground leaf clusters
      for (const f of fgLeaves) {
        ctx.globalAlpha = 0.9;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, f.col); g.addColorStop(0.7, f.col + 'aa'); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Ground mist near river
      for (let side = 0; side < 2; side++) {
        const my = side === 0 ? riverY : riverY + riverH;
        const mg = ctx.createLinearGradient(0, my - 20, 0, my + 30);
        mg.addColorStop(0, 'transparent');
        mg.addColorStop(0.5, 'rgba(40,100,50,0.18)');
        mg.addColorStop(1, 'transparent');
        ctx.fillStyle = mg; ctx.fillRect(0, my - 20, W, 50);
      }
    }

    function loop() {
      frame++;
      drawBg();

      // Ripple spawn
      if (frame % 45 === 0) {
        ripples.push({ x: rand(0, W), y: rand(riverY + 4, riverY + riverH - 4), r: 0, maxR: rand(8, 20), op: 0.5 });
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.r += 0.3; rp.op -= 0.008;
        if (rp.op <= 0) { ripples.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(80,200,130,${rp.op})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
      }

      // Rain
      ctx.lineWidth = 0.6;
      for (const d of drops) {
        d.x -= d.spd * 0.12; d.y += d.spd;
        if (d.y > H + 15) { d.y = -15; d.x = rand(0, W); }
        if (d.x < -10) { d.x = W + 10; d.y = rand(0, H); }
        ctx.strokeStyle = `rgba(100,200,140,${d.op})`;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * 0.12, d.y + d.len); ctx.stroke();
      }

      // Birds — V-shape silhouettes
      for (const b of birds) {
        b.x += b.spd; b.flap += 0.12;
        if (b.x > W + 60) { b.x = -rand(20, 120); b.y = b.lane + rand(-20, 20); }
        const flapY = Math.sin(b.flap) * 3;
        const s = 7;
        ctx.strokeStyle = 'rgba(4,12,4,0.88)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x - s, b.y - flapY);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(b.x + s, b.y - flapY);
        ctx.stroke();
      }

      // Leaves
      for (const l of leaves) {
        l.x += l.vx; l.y += l.vy; l.rot += l.rs;
        if (l.y > H + 30) { l.y = -30; l.x = rand(0, W); }
        ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rot);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = l.col;
        ctx.beginPath(); ctx.ellipse(0, 0, l.sz, l.sz * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // Fireflies
      for (const f of flies) {
        f.phase += 0.04; f.vx += rand(-0.01, 0.01); f.vy += rand(-0.006, 0.006);
        f.vx *= 0.99; f.vy *= 0.99; f.x += f.vx; f.y += f.vy;
        if (f.x < 0) f.x = W; if (f.x > W) f.x = 0;
        if (f.y < riverY + riverH) f.vy += 0.01; if (f.y > H - 20) f.vy -= 0.01;
        const b = (Math.sin(f.phase) * 0.5 + 0.5);
        if (b > 0.2) {
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
          g.addColorStop(0, `rgba(200,255,100,${b * 0.9})`);
          g.addColorStop(0.5, `rgba(100,210,50,${b * 0.35})`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, 9, 0, Math.PI * 2); ctx.fill();
        }
      }

      raf = requestAnimationFrame(loop);
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
