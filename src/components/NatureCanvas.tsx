'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

interface Star   { x: number; y: number; r: number; phase: number; }
interface Aurora { bands: { x: number; width: number; col: string; phase: number; amp: number; }[]; }

export default function NatureCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0, frame = 0;
    let mountainY = 0, lakeY = 0;
    const stars: Star[] = []; const aurora: Aurora = { bands: [] };
    let meteorTimer = 0;
    const activeMeteors: { x: number; y: number; vx: number; vy: number; life: number; max: number }[] = [];

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      mountainY = H * 0.55; lakeY = H * 0.78;
      stars.length = 0; aurora.bands = []; activeMeteors.length = 0;

      for (let i = 0; i < 160; i++) stars.push({ x: rand(0, W), y: rand(0, mountainY * 0.9), r: rand(0.4, 2), phase: rand(0, Math.PI * 2) });

      const auroraColors = [
        'rgba(0,220,100,0.28)', 'rgba(0,180,220,0.22)', 'rgba(120,0,220,0.18)',
        'rgba(0,240,120,0.24)', 'rgba(50,150,255,0.20)',
      ];
      for (let i = 0; i < 5; i++) {
        aurora.bands.push({
          x: rand(-W * 0.3, W * 1.3), width: rand(W * 0.2, W * 0.5),
          col: auroraColors[i], phase: rand(0, Math.PI * 2), amp: rand(15, 35),
        });
      }
    }

    function loop() {
      frame++; meteorTimer++;

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, mountainY);
      sky.addColorStop(0, '#010308'); sky.addColorStop(0.5, '#020510'); sky.addColorStop(1, '#030812');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, mountainY);

      // Stars
      for (const s of stars) {
        s.phase += 0.008;
        ctx.globalAlpha = (0.5 + Math.sin(s.phase) * 0.5) * 0.88;
        ctx.fillStyle = s.r > 1.2 ? '#fffde8' : '#c8d4ff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Aurora
      for (const b of aurora.bands) {
        b.phase += 0.008;
        const opacity = 0.6 + Math.sin(b.phase) * 0.4;
        // Draw a vertical gradient band with wave
        for (let y = 0; y < mountainY * 0.75; y += 3) {
          const wave = Math.sin(y * 0.03 + b.phase) * b.amp;
          const xPos = b.x + wave;
          const alpha = opacity * Math.sin((y / (mountainY * 0.75)) * Math.PI) * 0.7;
          const parts = b.col.match(/[\d.]+/g);
          if (!parts) continue;
          ctx.fillStyle = `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha * parseFloat(parts[3])})`;
          ctx.fillRect(xPos, y, b.width, 3);
        }
      }

      // Meteors
      if (meteorTimer > 340 && Math.random() < 0.04) {
        activeMeteors.push({ x: rand(W * 0.1, W * 0.9), y: rand(5, mountainY * 0.3), vx: rand(-4, -2), vy: rand(2, 4), life: 0, max: rand(20, 35) });
        meteorTimer = 0;
      }
      for (let i = activeMeteors.length - 1; i >= 0; i--) {
        const m = activeMeteors[i];
        m.x += m.vx; m.y += m.vy; m.life++;
        if (m.life >= m.max) { activeMeteors.splice(i, 1); continue; }
        const p = 1 - m.life / m.max;
        ctx.strokeStyle = `rgba(255,255,240,${p * 0.9})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 5, m.y - m.vy * 5); ctx.stroke();
      }

      // Back mountains
      ctx.fillStyle = '#18152a';
      ctx.beginPath(); ctx.moveTo(0, mountainY);
      for (let x = 0; x <= W; x += 50) {
        const peak = Math.sin(x * 0.009) * 0.38 + Math.sin(x * 0.022) * 0.18;
        ctx.lineTo(x, mountainY - (mountainY * 0.55) * Math.max(0, peak + 0.2));
      }
      ctx.lineTo(W, mountainY); ctx.closePath(); ctx.fill();

      // Mid mountains
      ctx.fillStyle = '#0e0c1c';
      ctx.beginPath(); ctx.moveTo(0, mountainY);
      for (let x = 0; x <= W; x += 40) {
        const peak = Math.sin(x * 0.013 + 1) * 0.35 + Math.sin(x * 0.031 + 2) * 0.15;
        ctx.lineTo(x, mountainY - (mountainY * 0.45) * Math.max(0, peak + 0.25));
      }
      ctx.lineTo(W, mountainY); ctx.closePath(); ctx.fill();

      // Front mountains with snow caps
      ctx.fillStyle = '#080810';
      ctx.beginPath(); ctx.moveTo(0, mountainY);
      const peakData: { x: number; y: number }[] = [];
      for (let x = 0; x <= W; x += 35) {
        const peak = Math.sin(x * 0.018 + 0.5) * 0.32 + Math.sin(x * 0.04 + 1.5) * 0.12;
        const py = mountainY - (mountainY * 0.4) * Math.max(0, peak + 0.3);
        peakData.push({ x, y: py });
        ctx.lineTo(x, py);
      }
      ctx.lineTo(W, mountainY); ctx.closePath(); ctx.fill();

      // Snow caps
      ctx.fillStyle = 'rgba(220,230,255,0.5)';
      for (let i = 0; i < peakData.length - 1; i++) {
        const p = peakData[i];
        if (p.y < mountainY * 0.35) {
          const capH = (mountainY * 0.35 - p.y) * 0.6;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 15, p.y + capH); ctx.lineTo(p.x - 15, p.y + capH); ctx.closePath(); ctx.fill();
        }
      }

      // Pine tree forest (row of triangles)
      const treeY = mountainY * 0.98;
      ctx.fillStyle = '#050c08';
      for (let tx = -15; tx < W + 15; tx += rand(18, 30)) {
        const th = rand(35, 65); const tw = th * 0.38;
        ctx.beginPath(); ctx.moveTo(tx, treeY); ctx.lineTo(tx - tw, treeY); ctx.lineTo(tx, treeY - th); ctx.lineTo(tx + tw, treeY); ctx.closePath(); ctx.fill();
      }

      // Ground below mountains
      ctx.fillStyle = '#030508';
      ctx.fillRect(0, mountainY, W, lakeY - mountainY);

      // Lake
      const lake = ctx.createLinearGradient(0, lakeY, 0, H);
      lake.addColorStop(0, '#040a14'); lake.addColorStop(1, '#020508');
      ctx.fillStyle = lake; ctx.fillRect(0, lakeY, W, H - lakeY);

      // Ice cracks
      ctx.strokeStyle = 'rgba(80,100,180,0.15)'; ctx.lineWidth = 0.6;
      for (let i = 0; i < 12; i++) {
        const sx = rand(0, W), sy = rand(lakeY + 5, H - 10);
        ctx.beginPath(); ctx.moveTo(sx, sy);
        for (let j = 0; j < 4; j++) ctx.lineTo(sx + rand(-30, 30), sy + rand(-8, 8));
        ctx.stroke();
      }

      // Aurora reflection in lake
      for (const b of aurora.bands) {
        const alpha = (0.4 + Math.sin(b.phase) * 0.3) * 0.3;
        const parts = b.col.match(/[\d.]+/g);
        if (!parts) continue;
        ctx.fillStyle = `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
        ctx.fillRect(0, lakeY, W, H - lakeY);
      }

      raf = requestAnimationFrame(loop);
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
