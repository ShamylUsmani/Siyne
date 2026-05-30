'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

interface Star { x: number; y: number; r: number; phase: number; sparkle: boolean; }
interface DustParticle { x: number; y: number; vx: number; vy: number; size: number; opacity: number; }
interface HeatLine { y: number; phase: number; amp: number; freq: number; }
interface DunePoint { x: number; y: number; }
interface CactusData { x: number; y: number; scale: number; }

export default function DesertCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0, frame = 0;

    const stars: Star[] = [];
    const dustParticles: DustParticle[] = [];
    const heatLines: HeatLine[] = [];
    const backDunePoints: DunePoint[] = [];
    const midDunePoints: DunePoint[] = [];
    const frontDunePoints: DunePoint[] = [];
    const cacti: CactusData[] = [];

    let sunPulsePhase = 0;
    let skylineY = 0;

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      skylineY = H * 0.48;
      stars.length = 0; dustParticles.length = 0; heatLines.length = 0;
      backDunePoints.length = 0; midDunePoints.length = 0; frontDunePoints.length = 0;
      cacti.length = 0;
      frame = 0;

      // Stars — sparse, low opacity (it's sunset, sky still bright)
      for (let i = 0; i < 38; i++) {
        stars.push({
          x: rand(0, W),
          y: rand(0, skylineY * 0.55),
          r: rand(0.3, 1.8),
          phase: rand(0, Math.PI * 2),
          sparkle: Math.random() > 0.65,
        });
      }

      // Back dunes — smooth, distant
      for (let x = 0; x <= W; x += 18) {
        const t = x / W;
        const y = H * 0.52 - H * 0.18 * Math.max(0, Math.sin(t * Math.PI * 2.4 + 0.5) * 0.6 + Math.sin(t * Math.PI * 5.1 + 1.2) * 0.2 + 0.1);
        backDunePoints.push({ x, y });
      }

      // Mid dunes — more pronounced
      for (let x = 0; x <= W; x += 15) {
        const t = x / W;
        const y = H * 0.62 - H * 0.24 * Math.max(0, Math.sin(t * Math.PI * 2.0 + 1.0) * 0.65 + Math.sin(t * Math.PI * 4.3 + 2.0) * 0.22 + 0.12);
        midDunePoints.push({ x, y });
      }

      // Front dunes — large, prominent
      for (let x = 0; x <= W; x += 12) {
        const t = x / W;
        const y = H * 0.72 - H * 0.30 * Math.max(0, Math.sin(t * Math.PI * 1.7 + 0.2) * 0.70 + Math.sin(t * Math.PI * 3.5 + 1.5) * 0.20 + 0.15);
        frontDunePoints.push({ x, y });
      }

      // Cacti positions
      cacti.push({ x: W * 0.10, y: H * 0.80, scale: 0.88 });
      cacti.push({ x: W * 0.28, y: H * 0.84, scale: 0.72 });
      cacti.push({ x: W * 0.52, y: H * 0.78, scale: 1.0 });
      cacti.push({ x: W * 0.70, y: H * 0.82, scale: 0.76 });
      cacti.push({ x: W * 0.88, y: H * 0.80, scale: 0.84 });

      // Dust particles along dune surface
      for (let i = 0; i < 30; i++) {
        dustParticles.push({
          x: rand(0, W),
          y: rand(H * 0.58, H * 0.88),
          vx: rand(0.2, 1.0),
          vy: rand(-0.05, 0.05),
          size: rand(0.5, 1.8),
          opacity: rand(0.08, 0.28),
        });
      }

      // Heat shimmer lines near horizon
      for (let i = 0; i < 4; i++) {
        heatLines.push({
          y: skylineY + rand(5, 30),
          phase: rand(0, Math.PI * 2),
          amp: rand(1.5, 3.5),
          freq: rand(0.008, 0.018),
        });
      }
    }

    function drawSky() {
      const sky = ctx.createLinearGradient(0, 0, 0, skylineY);
      sky.addColorStop(0, '#050210');
      sky.addColorStop(0.12, '#150828');
      sky.addColorStop(0.28, '#400a18');
      sky.addColorStop(0.45, '#8a1828');
      sky.addColorStop(0.62, '#c84020');
      sky.addColorStop(0.78, '#e86828');
      sky.addColorStop(0.90, '#f5a840');
      sky.addColorStop(1, '#ffd060');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, skylineY);
    }

    function drawSun() {
      const sunX = W * 0.5;
      const sunY = skylineY;
      const baseR = 60;
      const pulseR = baseR + Math.sin(sunPulsePhase) * 2;

      // Large glow corona
      const glowG = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * 0.45);
      glowG.addColorStop(0, 'rgba(255,220,80,0.60)');
      glowG.addColorStop(0.08, 'rgba(255,180,40,0.40)');
      glowG.addColorStop(0.2, 'rgba(230,100,20,0.20)');
      glowG.addColorStop(0.45, 'rgba(200,60,10,0.08)');
      glowG.addColorStop(1, 'transparent');
      ctx.fillStyle = glowG;
      ctx.fillRect(0, 0, W, skylineY);

      // Sun disc (half visible at horizon)
      const sunGrad = ctx.createRadialGradient(sunX - pulseR * 0.2, sunY - pulseR * 0.4, 0, sunX, sunY, pulseR);
      sunGrad.addColorStop(0, '#fff5b0');
      sunGrad.addColorStop(0.4, '#ffdc40');
      sunGrad.addColorStop(0.8, '#ff8c18');
      sunGrad.addColorStop(1, '#e05010');
      ctx.fillStyle = sunGrad;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, skylineY);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(sunX, sunY, pulseR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawStars() {
      for (const s of stars) {
        s.phase += 0.01;
        const b = 0.3 + Math.sin(s.phase) * 0.3;
        ctx.globalAlpha = b * 0.55;
        if (s.sparkle && s.r > 1.3) {
          ctx.strokeStyle = '#fffee8'; ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(s.x - s.r * 3, s.y); ctx.lineTo(s.x + s.r * 3, s.y);
          ctx.moveTo(s.x, s.y - s.r * 3); ctx.lineTo(s.x, s.y + s.r * 3);
          ctx.stroke();
        }
        ctx.fillStyle = s.r > 1.2 ? '#fffde0' : '#e8d8ff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawDunePath(points: DunePoint[]) {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (const p of points) ctx.lineTo(p.x, p.y);
      ctx.lineTo(W, H);
      ctx.closePath();
    }

    function drawDunes() {
      // Back dunes
      ctx.fillStyle = '#3a1808';
      drawDunePath(backDunePoints);
      ctx.fill();

      // Rim light on back dunes
      ctx.strokeStyle = 'rgba(255,180,60,0.25)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < backDunePoints.length; i++) {
        const p = backDunePoints[i];
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // Mid dunes
      ctx.fillStyle = '#5a2810';
      drawDunePath(midDunePoints);
      ctx.fill();

      // Rim light on mid dunes
      ctx.strokeStyle = 'rgba(255,160,50,0.38)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < midDunePoints.length; i++) {
        const p = midDunePoints[i];
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // Shadow fill on mid dunes (away-from-sun side of each curve)
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#1e0804';
      ctx.beginPath();
      for (let i = 0; i < midDunePoints.length; i++) {
        const p = midDunePoints[i];
        if (i === 0) { ctx.moveTo(0, H); ctx.lineTo(p.x, p.y); }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;

      // Front dunes — richest colour
      ctx.fillStyle = '#8a4018';
      drawDunePath(frontDunePoints);
      ctx.fill();

      // Bright rim light on front dune tops
      ctx.strokeStyle = 'rgba(255,180,60,0.60)'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < frontDunePoints.length; i++) {
        const p = frontDunePoints[i];
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // Shadow on the far side of front dunes
      ctx.globalAlpha = 0.30;
      const shadowG = ctx.createLinearGradient(0, H * 0.72, 0, H);
      shadowG.addColorStop(0, '#3a1808');
      shadowG.addColorStop(1, '#1a0c04');
      ctx.fillStyle = shadowG;
      drawDunePath(frontDunePoints);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawCactus(x: number, y: number, scale: number) {
      const s = scale;
      ctx.fillStyle = '#150a04';

      // Main trunk
      ctx.beginPath();
      ctx.roundRect(x - 5 * s, y - 58 * s, 10 * s, 58 * s, 3 * s);
      ctx.fill();

      // Left arm — curved upward
      ctx.beginPath();
      ctx.roundRect(x - 22 * s, y - 38 * s, 10 * s, 22 * s, 3 * s);
      ctx.fill();
      // Left arm vertical
      ctx.beginPath();
      ctx.roundRect(x - 22 * s, y - 52 * s, 10 * s, 18 * s, 3 * s);
      ctx.fill();

      // Right arm
      ctx.beginPath();
      ctx.roundRect(x + 12 * s, y - 32 * s, 10 * s, 20 * s, 3 * s);
      ctx.fill();
      // Right arm vertical
      ctx.beginPath();
      ctx.roundRect(x + 12 * s, y - 46 * s, 10 * s, 18 * s, 3 * s);
      ctx.fill();

      // Sun rim glow on right side of cactus
      ctx.globalAlpha = 0.28;
      const rimG = ctx.createLinearGradient(x + 8 * s, 0, x + 18 * s, 0);
      rimG.addColorStop(0, 'transparent');
      rimG.addColorStop(1, 'rgba(255,160,50,0.7)');
      ctx.fillStyle = rimG;
      ctx.beginPath();
      ctx.roundRect(x - 5 * s, y - 58 * s, 10 * s, 58 * s, 3 * s);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawHeatShimmer() {
      for (const hl of heatLines) {
        hl.phase += 0.025;
        ctx.strokeStyle = 'rgba(255,160,60,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 4) {
          const y = hl.y + Math.sin(x * hl.freq + hl.phase) * hl.amp;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    function drawDust() {
      for (const p of dustParticles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x > W + 10) p.x = -10;
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = 'rgba(210,140,60,1)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function loop() {
      frame++;
      sunPulsePhase += 0.015;

      drawSky();
      drawSun();
      drawStars();
      drawDunes();

      for (const c of cacti) drawCactus(c.x, c.y, c.scale);

      drawHeatShimmer();
      drawDust();

      raf = requestAnimationFrame(loop);
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
