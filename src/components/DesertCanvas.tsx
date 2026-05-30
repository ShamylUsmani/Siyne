'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

interface Star { x: number; y: number; r: number; phase: number; sparkle: boolean; }
interface DustParticle { x: number; y: number; vx: number; vy: number; size: number; opacity: number; }
interface HeatLine { y: number; phase: number; amp: number; freq: number; }
interface CactusData { x: number; y: number; scale: number; }

function darken(col: string, amt: number): string {
  const m = col.match(/\d+/g);
  if (!m) return col;
  return `rgb(${Math.max(0, +m[0] - amt)},${Math.max(0, +m[1] - amt)},${Math.max(0, +m[2] - amt)})`;
}

export default function DesertCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0, frame = 0;

    const stars: Star[] = [];
    const dustParticles: DustParticle[] = [];
    const heatLines: HeatLine[] = [];
    const cacti: CactusData[] = [];

    let sunPulsePhase = 0;
    let skylineY = 0;

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      skylineY = H * 0.48;
      stars.length = 0; dustParticles.length = 0; heatLines.length = 0;
      cacti.length = 0;
      frame = 0;

      // Stars — sparse, vary sizes more
      for (let i = 0; i < 38; i++) {
        stars.push({
          x: rand(0, W),
          y: rand(0, skylineY * 0.55),
          r: rand(0.3, 2.5),
          phase: rand(0, Math.PI * 2),
          sparkle: Math.random() > 0.55,
        });
      }
      // A couple of large glowing stars
      for (let i = 0; i < 2; i++) {
        stars.push({
          x: rand(W * 0.1, W * 0.9),
          y: rand(0, skylineY * 0.4),
          r: 3.5 + rand(0, 1.5),
          phase: rand(0, Math.PI * 2),
          sparkle: true,
        });
      }

      // Cacti positions
      cacti.push({ x: W * 0.10, y: H * 0.80, scale: 0.88 });
      cacti.push({ x: W * 0.28, y: H * 0.84, scale: 0.72 });
      cacti.push({ x: W * 0.52, y: H * 0.78, scale: 1.0 });
      cacti.push({ x: W * 0.70, y: H * 0.82, scale: 0.76 });
      cacti.push({ x: W * 0.88, y: H * 0.80, scale: 0.84 });

      // Dust particles
      const mobile = W < 600;
      const dustCount = mobile ? 18 : 30;
      for (let i = 0; i < dustCount; i++) {
        dustParticles.push({
          x: rand(0, W),
          y: rand(H * 0.58, H * 0.88),
          vx: rand(0.2, 1.0),
          vy: rand(-0.05, 0.05),
          size: rand(0.5, 1.8),
          opacity: rand(0.08, 0.28),
        });
      }

      // Heat shimmer lines
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
      // 8+ color stops for smooth crimson-to-gold transition
      const sky = ctx.createLinearGradient(0, 0, 0, skylineY);
      sky.addColorStop(0,    '#030110');
      sky.addColorStop(0.08, '#0d0620');
      sky.addColorStop(0.18, '#2a0815');
      sky.addColorStop(0.28, '#5a0c18');
      sky.addColorStop(0.38, '#8a1520');
      sky.addColorStop(0.50, '#b83018');
      sky.addColorStop(0.62, '#d85020');
      sky.addColorStop(0.74, '#ec7828');
      sky.addColorStop(0.86, '#f5a030');
      sky.addColorStop(1,    '#ffd050');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, skylineY);
    }

    function drawSun() {
      const sunX = W * 0.5;
      const sunY = skylineY;
      const baseR = 60;
      const pulseR = baseR + Math.sin(sunPulsePhase) * 2;

      const glowG = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * 0.45);
      glowG.addColorStop(0, 'rgba(255,220,80,0.60)');
      glowG.addColorStop(0.08, 'rgba(255,180,40,0.40)');
      glowG.addColorStop(0.2, 'rgba(230,100,20,0.20)');
      glowG.addColorStop(0.45, 'rgba(200,60,10,0.08)');
      glowG.addColorStop(1, 'transparent');
      ctx.fillStyle = glowG;
      ctx.fillRect(0, 0, W, skylineY);

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

        // Large stars get a soft radial glow
        if (s.r > 2.5) {
          const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
          glow.addColorStop(0, 'rgba(255,250,220,0.4)');
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 5, 0, Math.PI * 2); ctx.fill();
        }

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

    // Smooth bezier dune
    function drawDune(baseY: number, col: string, rimLight: string) {
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, baseY);

      const step = W / 8;
      let prevY = baseY;
      for (let i = 0; i <= 8; i++) {
        const x = i * step;
        const y = baseY - (H * 0.15) * Math.max(0, Math.sin(i * 0.9) * 0.6 + Math.cos(i * 0.5) * 0.4);
        if (i === 0) { ctx.lineTo(x, y); }
        else { ctx.quadraticCurveTo(x - step * 0.5, (prevY + y) / 2 - 10, x, y); }
        prevY = y;
      }

      ctx.lineTo(W, H);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, baseY - H * 0.15, 0, H);
      grad.addColorStop(0, rimLight);
      grad.addColorStop(0.15, col);
      grad.addColorStop(1, darken(col, 20));
      ctx.fillStyle = grad;
      ctx.fill();
    }

    function drawDunes() {
      // Back dunes — distant
      drawDune(H * 0.52, '#3a1808', 'rgba(255,180,60,0.60)');
      // Rim light stroke on back dune
      ctx.strokeStyle = 'rgba(255,180,60,0.22)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      const step0 = W / 8;
      let py0 = H * 0.52;
      ctx.moveTo(0, py0);
      for (let i = 0; i <= 8; i++) {
        const x = i * step0;
        const y = H * 0.52 - (H * 0.15) * Math.max(0, Math.sin(i * 0.9) * 0.6 + Math.cos(i * 0.5) * 0.4);
        if (i === 0) ctx.lineTo(x, y);
        else ctx.quadraticCurveTo(x - step0 * 0.5, (py0 + y) / 2 - 10, x, y);
        py0 = y;
      }
      ctx.stroke();

      // Mid dunes
      drawDune(H * 0.62, '#5a2810', 'rgba(255,165,55,0.55)');

      // Front dunes — richest colour
      drawDune(H * 0.72, '#8a4018', 'rgba(255,185,65,0.75)');

      // Shadow overlay on front dunes (far side)
      ctx.globalAlpha = 0.30;
      const shadowG = ctx.createLinearGradient(0, H * 0.72, 0, H);
      shadowG.addColorStop(0, '#3a1808');
      shadowG.addColorStop(1, '#1a0c04');
      ctx.fillStyle = shadowG;
      drawDune(H * 0.72, '#8a4018', 'rgba(255,185,65,0.75)');
      ctx.globalAlpha = 1;
    }

    function drawCactus(x: number, y: number, scale: number) {
      const s = scale;
      const trunkCol = '#150a04';

      // Main trunk with slight taper (wider at base)
      ctx.fillStyle = trunkCol;
      ctx.beginPath();
      ctx.moveTo(x - 6 * s, y);             // base left
      ctx.lineTo(x - 5 * s, y - 58 * s);    // top left (narrower)
      ctx.lineTo(x + 5 * s, y - 58 * s);    // top right
      ctx.lineTo(x + 6 * s, y);             // base right
      ctx.closePath();
      ctx.fill();

      // Left arm — curved upward using bezier
      ctx.beginPath();
      ctx.moveTo(x - 5 * s, y - 30 * s);    // start on trunk left
      ctx.bezierCurveTo(
        x - 20 * s, y - 30 * s,             // curve out left
        x - 22 * s, y - 48 * s,             // curve up
        x - 20 * s, y - 52 * s              // arm tip
      );
      ctx.bezierCurveTo(
        x - 16 * s, y - 56 * s,
        x - 12 * s, y - 54 * s,
        x - 12 * s, y - 48 * s             // bottom of arm
      );
      ctx.bezierCurveTo(
        x - 12 * s, y - 34 * s,
        x - 5 * s, y - 34 * s,
        x - 5 * s, y - 30 * s
      );
      ctx.closePath();
      ctx.fill();

      // Right arm — curved upward
      ctx.beginPath();
      ctx.moveTo(x + 5 * s, y - 24 * s);
      ctx.bezierCurveTo(
        x + 18 * s, y - 24 * s,
        x + 22 * s, y - 40 * s,
        x + 20 * s, y - 46 * s
      );
      ctx.bezierCurveTo(
        x + 16 * s, y - 50 * s,
        x + 12 * s, y - 48 * s,
        x + 12 * s, y - 42 * s
      );
      ctx.bezierCurveTo(
        x + 12 * s, y - 30 * s,
        x + 5 * s, y - 28 * s,
        x + 5 * s, y - 24 * s
      );
      ctx.closePath();
      ctx.fill();

      // Sun rim glow on right side of cactus
      ctx.globalAlpha = 0.28;
      const rimG = ctx.createLinearGradient(x + 4 * s, 0, x + 18 * s, 0);
      rimG.addColorStop(0, 'transparent');
      rimG.addColorStop(1, 'rgba(255,160,50,0.7)');
      ctx.fillStyle = rimG;
      ctx.beginPath();
      ctx.moveTo(x - 5 * s, y);
      ctx.lineTo(x - 5 * s, y - 58 * s);
      ctx.lineTo(x + 5 * s, y - 58 * s);
      ctx.lineTo(x + 6 * s, y);
      ctx.closePath();
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
