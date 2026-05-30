'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

interface Building { x: number; w: number; h: number; col: string; windows: { r: number; c: number; on: boolean }[]; }
interface Star { x: number; y: number; r: number; phase: number; }

export default function CitySkylineCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0, frame = 0;
    let skylineY = 0, waterY = 0;
    const buildings: Building[] = []; const stars: Star[] = [];

    const BLDG_COLS = ['#0e1e42','#121c3a','#0c1830','#142040','#101835'];

    function makeBuilding(x: number, w: number, h: number): Building {
      const rows = Math.floor(h / 14); const cols = Math.floor(w / 11);
      const windows: { r: number; c: number; on: boolean }[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          windows.push({ r, c, on: Math.random() > 0.30 });
        }
      }
      return { x, w, h, col: BLDG_COLS[Math.floor(Math.random() * BLDG_COLS.length)], windows };
    }

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      skylineY = H * 0.55; waterY = H * 0.75;
      buildings.length = 0; stars.length = 0;

      let bx = 0;
      while (bx < W + 50) {
        const bw = rand(35, 90); const bh = rand(skylineY * 0.25, skylineY * 0.92);
        buildings.push(makeBuilding(bx, bw, bh));
        bx += bw + rand(2, 8);
      }

      for (let i = 0; i < 80; i++) stars.push({ x: rand(0, W), y: rand(0, skylineY * 0.7), r: rand(0.4, 1.8), phase: rand(0, Math.PI * 2) });
    }

    function loop() {
      frame++;
      if (frame % 160 === 0) {
        // Randomly toggle some windows
        for (const b of buildings) {
          const count = Math.floor(rand(1, 5));
          for (let i = 0; i < count; i++) {
            const w = b.windows[Math.floor(Math.random() * b.windows.length)];
            if (w) w.on = !w.on;
          }
        }
      }

      // Sky gradient (deep night — lighter for contrast)
      const sky = ctx.createLinearGradient(0, 0, 0, skylineY);
      sky.addColorStop(0, '#0d1840'); sky.addColorStop(0.6, '#111e48'); sky.addColorStop(1, '#1a2a60');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, skylineY);

      // Stars
      for (const s of stars) {
        s.phase += 0.008;
        const b = 0.5 + Math.sin(s.phase) * 0.5;
        ctx.globalAlpha = b * 0.9;
        ctx.fillStyle = '#d8e0ff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Moon
      const moonX = W * 0.78, moonY = H * 0.12;
      const mg = ctx.createRadialGradient(moonX - 6, moonY - 6, 0, moonX, moonY, 20);
      mg.addColorStop(0, '#fffce0'); mg.addColorStop(1, '#c8c0a0');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(moonX, moonY, 20, 0, Math.PI * 2); ctx.fill();
      // Moon glow
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 60);
      moonGlow.addColorStop(0, 'rgba(200,200,120,0.08)'); moonGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = moonGlow; ctx.beginPath(); ctx.arc(moonX, moonY, 60, 0, Math.PI * 2); ctx.fill();

      // Horizon glow (more prominent)
      const hg = ctx.createLinearGradient(0, skylineY - 100, 0, skylineY);
      hg.addColorStop(0, 'transparent'); hg.addColorStop(1, 'rgba(100,130,255,0.35)');
      ctx.fillStyle = hg; ctx.fillRect(0, skylineY - 100, W, 100);

      // Buildings
      for (const b of buildings) {
        const by = skylineY - b.h;
        ctx.fillStyle = b.col;
        ctx.fillRect(b.x, by, b.w, b.h);

        // Roof detail
        ctx.fillStyle = '#0c1438';
        ctx.fillRect(b.x + b.w * 0.35, by - rand(5, 12), b.w * 0.08, rand(5, 12));

        // Windows
        for (const win of b.windows) {
          const wx = b.x + win.c * 11 + 3;
          const wy = by + win.r * 14 + 5;
          if (wx + 7 > b.x + b.w) continue;
          ctx.fillStyle = win.on ? 'rgba(255,245,120,0.95)' : 'rgba(20,30,60,0.4)';
          ctx.fillRect(wx, wy, 7, 8);
        }

        // Subtle top/left edge highlight for depth
        ctx.strokeStyle = 'rgba(80,100,180,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x, by + b.h); ctx.lineTo(b.x, by); ctx.lineTo(b.x + b.w, by);
        ctx.stroke();
      }

      // Water / reflection
      const water = ctx.createLinearGradient(0, waterY, 0, H);
      water.addColorStop(0, '#040818'); water.addColorStop(1, '#020510');
      ctx.fillStyle = water; ctx.fillRect(0, waterY, W, H - waterY);

      // Reflection ripple lines
      ctx.strokeStyle = 'rgba(255,240,140,0.12)'; ctx.lineWidth = 0.7;
      for (let i = 0; i < 8; i++) {
        const ly = waterY + (H - waterY) * (i / 8) + rand(0, 3);
        const lw = rand(20, 80);
        const lx = rand(0, W);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + lw, ly); ctx.stroke();
      }

      // Ground fill between skyline and water
      ctx.fillStyle = '#04080c';
      ctx.fillRect(0, skylineY, W, waterY - skylineY);

      raf = requestAnimationFrame(loop);
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
