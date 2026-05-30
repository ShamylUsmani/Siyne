'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

interface Star { x: number; y: number; r: number; phase: number; sparkle: boolean; }

export default function DesertCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0, frame = 0;
    let duneY = 0;
    const stars: Star[] = [];
    const activeMeteors: { x: number; y: number; vx: number; vy: number; life: number; max: number }[] = [];
    const sandParticles: { x: number; y: number; vx: number; size: number }[] = [];
    let meteorTimer = 0, moonPulse = 0;

    interface Dune { points: { x: number; y: number }[]; col: string; }
    const dunes: Dune[] = [];

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      duneY = H * 0.5;
      stars.length = 0; dunes.length = 0; sandParticles.length = 0; activeMeteors.length = 0;

      for (let i = 0; i < 200; i++) {
        stars.push({ x: rand(0, W), y: rand(0, duneY * 0.9), r: rand(0.3, 2.2), phase: rand(0, Math.PI * 2), sparkle: Math.random() > 0.7 });
      }

      // Dune layers (back to front)
      const duneConfigs = [
        { yBase: H * 0.52, amplitude: 0.22, freq: 0.006, col: '#150a03' },
        { yBase: H * 0.62, amplitude: 0.28, freq: 0.008, col: '#1c0e04' },
        { yBase: H * 0.72, amplitude: 0.32, freq: 0.010, col: '#221205' },
        { yBase: H * 0.82, amplitude: 0.22, freq: 0.014, col: '#281508' },
      ];
      for (const dc of duneConfigs) {
        const pts: { x: number; y: number }[] = [];
        for (let x = 0; x <= W; x += 20) {
          const y = dc.yBase - H * dc.amplitude * Math.max(0, Math.sin(x * dc.freq) * 0.5 + 0.5 + Math.sin(x * dc.freq * 2.3) * 0.25);
          pts.push({ x, y });
        }
        dunes.push({ points: pts, col: dc.col });
      }

      for (let i = 0; i < 25; i++) {
        sandParticles.push({ x: rand(0, W), y: rand(H * 0.55, H * 0.85), vx: rand(0.3, 1.2), size: rand(0.5, 1.5) });
      }
    }

    function drawCactus(x: number, y: number, scale: number) {
      const col = '#0d1a06';
      // Main trunk
      ctx.fillStyle = col;
      ctx.fillRect(x - 4 * scale, y - 50 * scale, 8 * scale, 50 * scale);
      // Left arm
      ctx.fillRect(x - 18 * scale, y - 30 * scale, 8 * scale, 20 * scale);
      ctx.fillRect(x - 22 * scale, y - 42 * scale, 8 * scale, 15 * scale);
      // Right arm
      ctx.fillRect(x + 10 * scale, y - 25 * scale, 8 * scale, 18 * scale);
      ctx.fillRect(x + 14 * scale, y - 38 * scale, 8 * scale, 15 * scale);
    }

    function loop() {
      frame++; meteorTimer++; moonPulse += 0.015;

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, duneY);
      sky.addColorStop(0, '#020408'); sky.addColorStop(0.4, '#06050f'); sky.addColorStop(1, '#0c080a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, duneY);

      // Milky Way band
      const mwAngle = Math.PI * 0.3;
      const mwGrad = ctx.createLinearGradient(W * 0.2, 0, W * 0.6, duneY);
      mwGrad.addColorStop(0, 'transparent'); mwGrad.addColorStop(0.5, 'rgba(200,180,255,0.06)'); mwGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = mwGrad; ctx.fillRect(0, 0, W, duneY);
      void mwAngle;

      // Stars
      for (const s of stars) {
        s.phase += s.sparkle ? 0.04 : 0.008;
        const b = 0.5 + Math.sin(s.phase) * 0.5;
        ctx.globalAlpha = b * 0.92;
        if (s.sparkle && s.r > 1.5) {
          // 4-point sparkle
          ctx.strokeStyle = '#fffee8'; ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(s.x - s.r * 3, s.y); ctx.lineTo(s.x + s.r * 3, s.y);
          ctx.moveTo(s.x, s.y - s.r * 3); ctx.lineTo(s.x, s.y + s.r * 3);
          ctx.stroke();
        }
        ctx.fillStyle = s.r > 1.2 ? '#fffde0' : '#d8d0ff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Moon with warm glow
      const moonX = W * 0.72, moonY = H * 0.14;
      const moonPulseR = 50 + Math.sin(moonPulse) * 4;
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonPulseR * 2.5);
      moonGlow.addColorStop(0, 'rgba(255,240,180,0.25)'); moonGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = moonGlow; ctx.beginPath(); ctx.arc(moonX, moonY, moonPulseR * 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fffad0';
      const moonG = ctx.createRadialGradient(moonX - 5, moonY - 5, 0, moonX, moonY, moonPulseR * 0.45);
      moonG.addColorStop(0, '#fffce8'); moonG.addColorStop(1, '#e8d8a0');
      ctx.fillStyle = moonG; ctx.beginPath(); ctx.arc(moonX, moonY, moonPulseR * 0.45, 0, Math.PI * 2); ctx.fill();

      // Meteors
      if (meteorTimer > 280 && Math.random() < 0.05) {
        activeMeteors.push({ x: rand(W * 0.1, W * 0.8), y: rand(5, duneY * 0.35), vx: rand(4, 8), vy: rand(2, 4), life: 0, max: rand(20, 40) });
        meteorTimer = 0;
      }
      for (let i = activeMeteors.length - 1; i >= 0; i--) {
        const m = activeMeteors[i];
        m.x += m.vx; m.y += m.vy; m.life++;
        if (m.life >= m.max) { activeMeteors.splice(i, 1); continue; }
        const p = 1 - m.life / m.max;
        ctx.strokeStyle = `rgba(255,255,220,${p * 0.9})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 5, m.y - m.vy * 5); ctx.stroke();
      }

      // Dune layers
      for (const d of dunes) {
        ctx.fillStyle = d.col;
        ctx.beginPath(); ctx.moveTo(0, H);
        for (const p of d.points) ctx.lineTo(p.x, p.y);
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
        // Rim light on top edge
        const rimGrad = ctx.createLinearGradient(0, 0, 0, 6);
        rimGrad.addColorStop(0, 'rgba(255,180,80,0.12)'); rimGrad.addColorStop(1, 'transparent');
        ctx.strokeStyle = 'rgba(255,180,80,0.10)'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let j = 0; j < d.points.length; j++) { j === 0 ? ctx.moveTo(d.points[j].x, d.points[j].y) : ctx.lineTo(d.points[j].x, d.points[j].y); }
        ctx.stroke();
      }

      // Cacti
      for (const [cx, cy, sc] of [[W*0.12, H*0.78, 0.9],[W*0.3, H*0.82, 0.7],[W*0.55, H*0.76, 1.0],[W*0.72, H*0.80, 0.75],[W*0.88, H*0.79, 0.85]] as [number,number,number][]) {
        drawCactus(cx, cy, sc);
      }

      // Rocks
      ctx.fillStyle = '#1a0d06';
      for (const [rx,ry,rw,rh] of [[W*0.05,H*0.83,45,22],[W*0.42,H*0.86,60,28],[W*0.82,H*0.84,50,24]] as [number,number,number,number][]) {
        ctx.beginPath(); ctx.ellipse(rx, ry, rw/2, rh/2, 0, 0, Math.PI*2); ctx.fill();
      }

      // Sand particles
      ctx.fillStyle = 'rgba(200,150,80,0.4)';
      for (const p of sandParticles) {
        p.x += p.vx;
        if (p.x > W + 10) p.x = -10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
