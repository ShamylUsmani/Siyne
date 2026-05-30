'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

interface StarDot { x: number; y: number; r: number; phase: number; sparkle: boolean; }
interface NebulaCloud { cx: number; cy: number; r: number; r2: number; col: [number, number, number]; alpha: number; phase: number; }

interface GasGiant {
  x: number; y: number; radius: number;
  bandColors: string[];
  stormAngle: number; stormSpeed: number;
  rotOffset: number; rotSpeed: number;
}

interface RingedPlanet {
  x: number; y: number; radius: number;
  col1: string; col2: string;
  ring1Alpha: number; ring2Alpha: number; ring3Alpha: number;
  rotOffset: number; rotSpeed: number;
}

interface IceGiant {
  x: number; y: number; radius: number;
  glowPhase: number;
}

interface EarthLike {
  x: number; y: number; radius: number;
  rotOffset: number; rotSpeed: number;
}

export default function SolarSystemCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0, frame = 0;

    const stars: StarDot[] = [];
    const nebulae: NebulaCloud[] = [];

    let gasGiant: GasGiant | null = null;
    let ringedPlanet: RingedPlanet | null = null;
    let iceGiant: IceGiant | null = null;
    let earthLike: EarthLike | null = null;

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      stars.length = 0; nebulae.length = 0;
      frame = 0;

      // 300+ stars, varied sizes and brightnesses
      for (let i = 0; i < 340; i++) {
        stars.push({
          x: rand(0, W), y: rand(0, H),
          r: rand(0.5, 2.5),
          phase: rand(0, Math.PI * 2),
          sparkle: Math.random() > 0.88,
        });
      }

      // Milky Way density band — diagonal strip with extra stars
      for (let i = 0; i < 180; i++) {
        const t = rand(0, 1);
        const bx = t * W * 1.3 - W * 0.15;
        const by = H * 0.2 + t * H * 0.6 + rand(-60, 60);
        if (by >= 0 && by <= H) {
          stars.push({ x: bx, y: by, r: rand(0.4, 1.5), phase: rand(0, Math.PI * 2), sparkle: false });
        }
      }

      // 3 massive nebula clouds
      nebulae.push({ cx: W * 0.30, cy: H * 0.35, r: Math.min(W, H) * 0.72, r2: Math.min(W, H) * 0.50, col: [80, 20, 120], alpha: 0.35, phase: rand(0, Math.PI * 2) });
      nebulae.push({ cx: W * 0.65, cy: H * 0.55, r: Math.min(W, H) * 0.65, r2: Math.min(W, H) * 0.40, col: [0, 100, 140], alpha: 0.25, phase: rand(0, Math.PI * 2) });
      nebulae.push({ cx: W * 0.50, cy: H * 0.20, r: Math.min(W, H) * 0.55, r2: Math.min(W, H) * 0.30, col: [160, 40, 80], alpha: 0.20, phase: rand(0, Math.PI * 2) });

      // Gas giant (Jupiter-like) — ~30% from left, ~40% from top
      gasGiant = {
        x: W * 0.30, y: H * 0.40,
        radius: Math.min(W, H) * 0.088,
        bandColors: ['#c87840', '#d09060', '#a05828', '#e0b080', '#7a4020', '#b86830'],
        stormAngle: 0, stormSpeed: 0.004,
        rotOffset: 0, rotSpeed: 0.0008,
      };

      // Ringed planet (Saturn-like) — upper right
      ringedPlanet = {
        x: W * 0.75, y: H * 0.22,
        radius: Math.min(W, H) * 0.058,
        col1: '#d4b058', col2: '#a88038',
        ring1Alpha: 0.72, ring2Alpha: 0.48, ring3Alpha: 0.28,
        rotOffset: 0, rotSpeed: 0.0006,
      };

      // Ice giant (Uranus-like) — middle area
      iceGiant = {
        x: W * 0.60, y: H * 0.68,
        radius: Math.min(W, H) * 0.038,
        glowPhase: rand(0, Math.PI * 2),
      };

      // Earth-like — lower left
      earthLike = {
        x: W * 0.15, y: H * 0.72,
        radius: Math.min(W, H) * 0.027,
        rotOffset: 0, rotSpeed: 0.0010,
      };
    }

    function drawBackground() {
      ctx.fillStyle = '#000008';
      ctx.fillRect(0, 0, W, H);
    }

    function drawNebulae() {
      for (const n of nebulae) {
        n.phase += 0.002;
        const pulse = Math.sin(n.phase) * 0.05;
        const [r, g, b] = n.col;
        const alpha = Math.max(0, n.alpha + pulse);

        const ng = ctx.createRadialGradient(n.cx, n.cy, 0, n.cx, n.cy, n.r);
        ng.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
        ng.addColorStop(0.45, `rgba(${r},${g},${b},${alpha * 0.65})`);
        ng.addColorStop(0.75, `rgba(${r},${g},${b},${alpha * 0.25})`);
        ng.addColorStop(1, 'transparent');
        ctx.fillStyle = ng;
        ctx.beginPath(); ctx.arc(n.cx, n.cy, n.r, 0, Math.PI * 2); ctx.fill();

        // Inner brighter core
        const ng2 = ctx.createRadialGradient(n.cx + n.r * 0.1, n.cy - n.r * 0.1, 0, n.cx, n.cy, n.r2);
        ng2.addColorStop(0, `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 40)},${Math.min(255, b + 40)},${alpha * 0.7})`);
        ng2.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.3})`);
        ng2.addColorStop(1, 'transparent');
        ctx.fillStyle = ng2;
        ctx.beginPath(); ctx.arc(n.cx, n.cy, n.r2, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawStars() {
      for (const s of stars) {
        s.phase += 0.005;
        const b = 0.4 + Math.sin(s.phase) * 0.4;
        ctx.globalAlpha = b * 0.9;

        if (s.sparkle && s.r > 1.8) {
          // 4-point sparkle (Hubble cross)
          ctx.strokeStyle = '#f0f4ff'; ctx.lineWidth = 0.5;
          ctx.globalAlpha = b * 0.6;
          ctx.beginPath();
          ctx.moveTo(s.x - s.r * 4, s.y); ctx.lineTo(s.x + s.r * 4, s.y);
          ctx.moveTo(s.x, s.y - s.r * 4); ctx.lineTo(s.x, s.y + s.r * 4);
          ctx.stroke();
          ctx.globalAlpha = b * 0.9;
        }

        // Star colour based on size (larger = warmer/brighter)
        if (s.r > 2) ctx.fillStyle = '#fffef0';
        else if (s.r > 1.5) ctx.fillStyle = '#f0f8ff';
        else if (s.r > 1) ctx.fillStyle = '#d8e8ff';
        else ctx.fillStyle = '#b0c4ff';

        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawGasGiant(g: GasGiant) {
      const { x, y, radius } = g;
      g.stormAngle += g.stormSpeed;
      g.rotOffset += g.rotSpeed;

      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();

      // Base gradient — warm brown-orange
      const baseG = ctx.createRadialGradient(x - radius * 0.25, y - radius * 0.25, 0, x, y, radius);
      baseG.addColorStop(0, '#e8b060');
      baseG.addColorStop(0.5, '#c07838');
      baseG.addColorStop(1, '#6a3818');
      ctx.fillStyle = baseG;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

      // Horizontal bands
      const bandCount = g.bandColors.length;
      for (let i = 0; i < bandCount; i++) {
        const bandY = y - radius + (i / bandCount) * radius * 2;
        const bandH = (radius * 2) / bandCount;
        const offX = Math.sin(g.rotOffset + i * 0.8) * radius * 0.05;
        ctx.fillStyle = g.bandColors[i];
        ctx.globalAlpha = 0.45;
        ctx.fillRect(x - radius + offX, bandY, radius * 2, bandH * 0.6);
      }
      ctx.globalAlpha = 1;

      // Great Red Spot
      const spotX = x + Math.cos(g.stormAngle) * radius * 0.4;
      const spotY = y + radius * 0.15;
      const spotG = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, radius * 0.22);
      spotG.addColorStop(0, 'rgba(200,60,30,0.85)');
      spotG.addColorStop(0.5, 'rgba(180,50,20,0.55)');
      spotG.addColorStop(1, 'transparent');
      ctx.fillStyle = spotG;
      ctx.beginPath(); ctx.ellipse(spotX, spotY, radius * 0.22, radius * 0.13, 0, 0, Math.PI * 2); ctx.fill();

      ctx.restore();

      // Planet sphere shadow
      const shadow = ctx.createRadialGradient(x + radius * 0.3, y + radius * 0.3, radius * 0.1, x, y, radius);
      shadow.addColorStop(0, 'transparent');
      shadow.addColorStop(0.7, 'transparent');
      shadow.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = shadow;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();

      // Atmospheric glow
      const atmG = ctx.createRadialGradient(x, y, radius * 0.9, x, y, radius * 1.15);
      atmG.addColorStop(0, 'transparent');
      atmG.addColorStop(0.5, 'rgba(200,140,60,0.12)');
      atmG.addColorStop(1, 'transparent');
      ctx.fillStyle = atmG;
      ctx.beginPath(); ctx.arc(x, y, radius * 1.15, 0, Math.PI * 2); ctx.fill();
    }

    function drawRingedPlanet(p: RingedPlanet) {
      const { x, y, radius } = p;
      p.rotOffset += p.rotSpeed;

      // Back ring halves (behind planet)
      ctx.save();
      ctx.translate(x, y);

      // Ring 1 (outer, faint)
      ctx.strokeStyle = `rgba(200,175,90,${p.ring3Alpha})`;
      ctx.lineWidth = radius * 0.18;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 3.2, radius * 0.55, 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      // Ring 2 (mid)
      ctx.strokeStyle = `rgba(210,185,95,${p.ring2Alpha})`;
      ctx.lineWidth = radius * 0.22;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 2.5, radius * 0.43, 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      // Ring 3 (inner, brightest)
      ctx.strokeStyle = `rgba(225,200,100,${p.ring1Alpha})`;
      ctx.lineWidth = radius * 0.15;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.85, radius * 0.32, 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      // Planet body
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
      const bodyG = ctx.createRadialGradient(x - radius * 0.28, y - radius * 0.28, 0, x, y, radius);
      bodyG.addColorStop(0, '#ece0a0');
      bodyG.addColorStop(0.4, p.col1);
      bodyG.addColorStop(1, p.col2);
      ctx.fillStyle = bodyG;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

      // Subtle bands
      ctx.fillStyle = 'rgba(160,130,50,0.25)';
      ctx.fillRect(x - radius, y - radius * 0.25, radius * 2, radius * 0.18);
      ctx.fillRect(x - radius, y + radius * 0.15, radius * 2, radius * 0.14);
      ctx.restore();

      // Shadow
      const shadow = ctx.createRadialGradient(x + radius * 0.35, y + radius * 0.35, 0, x, y, radius);
      shadow.addColorStop(0, 'transparent');
      shadow.addColorStop(0.65, 'transparent');
      shadow.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = shadow;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();

      // Front ring halves (in front of planet)
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = `rgba(225,200,100,${p.ring1Alpha})`;
      ctx.lineWidth = radius * 0.15;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.85, radius * 0.32, 0, 0, Math.PI);
      ctx.stroke();
      ctx.strokeStyle = `rgba(210,185,95,${p.ring2Alpha})`;
      ctx.lineWidth = radius * 0.22;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 2.5, radius * 0.43, 0, 0, Math.PI);
      ctx.stroke();
      ctx.strokeStyle = `rgba(200,175,90,${p.ring3Alpha})`;
      ctx.lineWidth = radius * 0.18;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 3.2, radius * 0.55, 0, 0, Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    function drawIceGiant(ig: IceGiant) {
      const { x, y, radius } = ig;
      ig.glowPhase += 0.008;

      // Atmospheric glow
      const glowAlpha = 0.15 + Math.sin(ig.glowPhase) * 0.05;
      const atmG = ctx.createRadialGradient(x, y, radius * 0.7, x, y, radius * 1.6);
      atmG.addColorStop(0, `rgba(100,220,220,${glowAlpha})`);
      atmG.addColorStop(1, 'transparent');
      ctx.fillStyle = atmG;
      ctx.beginPath(); ctx.arc(x, y, radius * 1.6, 0, Math.PI * 2); ctx.fill();

      // Planet body
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
      const bodyG = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
      bodyG.addColorStop(0, '#a8f0f0');
      bodyG.addColorStop(0.4, '#50c0c8');
      bodyG.addColorStop(1, '#208888');
      ctx.fillStyle = bodyG;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

      // Subtle haze bands
      ctx.fillStyle = 'rgba(180,240,240,0.2)';
      ctx.fillRect(x - radius, y - radius * 0.3, radius * 2, radius * 0.2);
      ctx.restore();

      // Shadow
      const shadow = ctx.createRadialGradient(x + radius * 0.35, y + radius * 0.35, 0, x, y, radius);
      shadow.addColorStop(0, 'transparent');
      shadow.addColorStop(0.6, 'transparent');
      shadow.addColorStop(1, 'rgba(0,0,20,0.55)');
      ctx.fillStyle = shadow;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    }

    function drawEarthLike(e: EarthLike) {
      const { x, y, radius } = e;
      e.rotOffset += e.rotSpeed;

      // Atmospheric glow
      const atmG = ctx.createRadialGradient(x, y, radius * 0.85, x, y, radius * 1.5);
      atmG.addColorStop(0, 'rgba(80,140,255,0.20)');
      atmG.addColorStop(0.5, 'rgba(60,120,200,0.08)');
      atmG.addColorStop(1, 'transparent');
      ctx.fillStyle = atmG;
      ctx.beginPath(); ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2); ctx.fill();

      // Planet body
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
      const bodyG = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
      bodyG.addColorStop(0, '#4090e0');
      bodyG.addColorStop(0.5, '#2060c0');
      bodyG.addColorStop(1, '#103080');
      ctx.fillStyle = bodyG;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

      // Continents
      const rotOff = e.rotOffset;
      ctx.fillStyle = 'rgba(50,160,60,0.82)';
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(rotOff) * radius * 0.25, y - radius * 0.1, radius * 0.30, radius * 0.42, rotOff * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(rotOff + 2.0) * radius * 0.3, y + radius * 0.15, radius * 0.22, radius * 0.30, rotOff * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Ice caps
      ctx.fillStyle = 'rgba(240,248,255,0.65)';
      ctx.beginPath(); ctx.arc(x, y - radius * 0.82, radius * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y + radius * 0.85, radius * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Shadow
      const shadow = ctx.createRadialGradient(x + radius * 0.35, y + radius * 0.3, 0, x, y, radius);
      shadow.addColorStop(0, 'transparent');
      shadow.addColorStop(0.55, 'transparent');
      shadow.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = shadow;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    }

    function drawSunCorner() {
      // Massive star glow from top-right corner (off-canvas)
      const sx = W + W * 0.05;
      const sy = -H * 0.08;
      const coronaR = W * 0.60;

      const corona = ctx.createRadialGradient(sx, sy, 0, sx, sy, coronaR);
      corona.addColorStop(0, 'rgba(255,250,200,0.55)');
      corona.addColorStop(0.08, 'rgba(255,220,100,0.35)');
      corona.addColorStop(0.20, 'rgba(255,160,40,0.18)');
      corona.addColorStop(0.40, 'rgba(200,80,10,0.08)');
      corona.addColorStop(0.70, 'rgba(160,40,5,0.03)');
      corona.addColorStop(1, 'transparent');
      ctx.fillStyle = corona;
      ctx.fillRect(0, 0, W, H);

      // Rays emanating from the corner
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = 'rgba(255,240,160,1)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 0.6) + (i / 8) * (Math.PI * 0.4);
        const len = coronaR * (0.5 + Math.random() * 0.5);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
        ctx.stroke();
      }
      ctx.restore();
    }

    function loop() {
      frame++;

      drawBackground();
      drawNebulae();
      drawStars();
      drawSunCorner();

      if (earthLike) drawEarthLike(earthLike);
      if (iceGiant) drawIceGiant(iceGiant);
      if (ringedPlanet) drawRingedPlanet(ringedPlanet);
      if (gasGiant) drawGasGiant(gasGiant);

      raf = requestAnimationFrame(loop);
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
