'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

interface Star { x: number; y: number; r: number; phase: number; }
interface Cloud { x: number; y: number; w: number; h: number; phase: number; }
interface ShimmerLine { x: number; y: number; len: number; vx: number; opacity: number; }
interface PineTree { x: number; h: number; w: number; }
interface MountainPoint { x: number; y: number; }

export default function NatureCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0;
    let mountainY = 0, lakeY = 0;
    const stars: Star[] = [];
    const clouds: Cloud[] = [];
    const shimmerLines: ShimmerLine[] = [];
    const pineTrees: PineTree[] = [];
    const distPeaks: MountainPoint[] = [];
    const midPeaks: MountainPoint[] = [];
    const closePeaks: MountainPoint[] = [];

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      mountainY = H * 0.52; lakeY = H * 0.75;
      stars.length = 0; clouds.length = 0; shimmerLines.length = 0;
      pineTrees.length = 0; distPeaks.length = 0; midPeaks.length = 0; closePeaks.length = 0;

      // Stars — upper third
      for (let i = 0; i < 180; i++) {
        stars.push({ x: rand(0, W), y: rand(0, mountainY * 0.75), r: rand(0.4, 2.2), phase: rand(0, Math.PI * 2) });
      }

      // Wispy clouds
      for (let i = 0; i < 3; i++) {
        clouds.push({ x: rand(0, W), y: rand(mountainY * 0.1, mountainY * 0.45), w: rand(W * 0.18, W * 0.32), h: rand(20, 40), phase: rand(0, Math.PI * 2) });
      }

      // Distant mountain peaks
      for (let x = 0; x <= W; x += 45) {
        const t = x / W;
        const py = mountainY - (mountainY * 0.52) * Math.max(0, Math.sin(t * Math.PI * 3.8 + 0.3) * 0.55 + Math.sin(t * Math.PI * 7.2 + 1.2) * 0.25 + 0.12);
        distPeaks.push({ x, y: py });
      }

      // Mid mountain peaks
      for (let x = 0; x <= W; x += 38) {
        const t = x / W;
        const py = mountainY - (mountainY * 0.62) * Math.max(0, Math.sin(t * Math.PI * 3.1 + 1.0) * 0.52 + Math.sin(t * Math.PI * 5.8 + 2.1) * 0.22 + 0.15);
        midPeaks.push({ x, y: py });
      }

      // Close mountain peaks (largest, most imposing)
      for (let x = 0; x <= W; x += 32) {
        const t = x / W;
        const py = mountainY - (mountainY * 0.75) * Math.max(0, Math.sin(t * Math.PI * 2.6 + 0.6) * 0.48 + Math.sin(t * Math.PI * 4.8 + 1.8) * 0.18 + 0.2);
        closePeaks.push({ x, y: py });
      }

      // Pine trees at base of mountains
      let tx = -15;
      while (tx < W + 15) {
        const th = rand(30, 65);
        const tw = th * 0.36;
        pineTrees.push({ x: tx, h: th, w: tw });
        tx += rand(12, 22);
      }

      // Lake shimmer lines
      for (let i = 0; i < 12; i++) {
        shimmerLines.push({
          x: rand(0, W),
          y: lakeY + rand(8, (H - lakeY) * 0.92),
          len: rand(30, 120),
          vx: rand(-0.15, 0.15),
          opacity: rand(0.04, 0.12),
        });
      }
    }

    function drawSky() {
      // Vivid aurora/sunset sky: deep purple top → golden horizon
      const sky = ctx.createLinearGradient(0, 0, 0, mountainY);
      sky.addColorStop(0, '#1a0a30');
      sky.addColorStop(0.18, '#3d1878');
      sky.addColorStop(0.40, '#8040c8');
      sky.addColorStop(0.60, '#c86090');
      sky.addColorStop(0.80, '#f09050');
      sky.addColorStop(1, '#f8c858');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, mountainY);
    }

    function drawStars() {
      for (const s of stars) {
        s.phase += 0.006;
        ctx.globalAlpha = (0.35 + Math.sin(s.phase) * 0.35) * 0.9;
        ctx.fillStyle = s.r > 1.4 ? '#fff8e0' : '#d0c8ff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawClouds() {
      for (const c of clouds) {
        c.x += 0.1;
        if (c.x - c.w * 0.5 > W + 100) c.x = -c.w * 0.5 - 100;
        c.phase += 0.003;
        ctx.globalAlpha = 0.18 + Math.sin(c.phase) * 0.06;
        const cg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.w * 0.5);
        cg.addColorStop(0, 'rgba(255,210,160,0.7)');
        cg.addColorStop(0.6, 'rgba(255,200,150,0.3)');
        cg.addColorStop(1, 'transparent');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.w * 0.5, c.h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawMountains() {
      // Distant peaks: pale purple-pink
      ctx.fillStyle = '#8060a0';
      ctx.beginPath(); ctx.moveTo(0, mountainY);
      for (const p of distPeaks) ctx.lineTo(p.x, p.y);
      ctx.lineTo(W, mountainY); ctx.closePath(); ctx.fill();

      // Snow caps on distant peaks
      ctx.fillStyle = 'rgba(240,235,255,0.75)';
      for (let i = 1; i < distPeaks.length - 1; i++) {
        const p = distPeaks[i];
        if (p.y < mountainY * 0.38) {
          const capH = (mountainY * 0.38 - p.y) * 0.55;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + 12, p.y + capH);
          ctx.lineTo(p.x - 12, p.y + capH);
          ctx.closePath(); ctx.fill();
        }
      }

      // Mid mountains: vivid purple
      ctx.fillStyle = '#503878';
      ctx.beginPath(); ctx.moveTo(0, mountainY);
      for (const p of midPeaks) ctx.lineTo(p.x, p.y);
      ctx.lineTo(W, mountainY); ctx.closePath(); ctx.fill();

      // Snow caps on mid peaks
      ctx.fillStyle = 'rgba(240,238,255,0.88)';
      for (let i = 1; i < midPeaks.length - 1; i++) {
        const p = midPeaks[i];
        if (p.y < mountainY * 0.28) {
          const capH = (mountainY * 0.28 - p.y) * 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + 16, p.y + capH);
          ctx.lineTo(p.x - 16, p.y + capH);
          ctx.closePath(); ctx.fill();
        }
      }

      // Close peaks: darkest, most imposing
      ctx.fillStyle = '#2a1848';
      ctx.beginPath(); ctx.moveTo(0, mountainY);
      for (const p of closePeaks) ctx.lineTo(p.x, p.y);
      ctx.lineTo(W, mountainY); ctx.closePath(); ctx.fill();

      // Heavy snow caps on close peaks
      ctx.fillStyle = 'rgba(248,248,255,0.96)';
      for (let i = 1; i < closePeaks.length - 1; i++) {
        const p = closePeaks[i];
        if (p.y < mountainY * 0.22) {
          const capH = (mountainY * 0.22 - p.y) * 0.65;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + 22, p.y + capH);
          ctx.lineTo(p.x - 22, p.y + capH);
          ctx.closePath(); ctx.fill();
        }
      }
    }

    function drawPineForest() {
      const treeBaseY = mountainY * 0.98;
      for (const t of pineTrees) {
        ctx.fillStyle = '#0a1a10';
        ctx.beginPath();
        ctx.moveTo(t.x, treeBaseY);
        ctx.lineTo(t.x - t.w, treeBaseY);
        ctx.lineTo(t.x, treeBaseY - t.h);
        ctx.lineTo(t.x + t.w, treeBaseY);
        ctx.closePath(); ctx.fill();
      }
    }

    function drawGround() {
      ctx.fillStyle = '#0e0818';
      ctx.fillRect(0, mountainY, W, lakeY - mountainY);
    }

    function drawLake() {
      // Mirror reflection of sky (inverted gradient)
      const lake = ctx.createLinearGradient(0, lakeY, 0, H);
      lake.addColorStop(0, '#f8c858');
      lake.addColorStop(0.15, '#f09050');
      lake.addColorStop(0.35, '#c86090');
      lake.addColorStop(0.58, '#8040c8');
      lake.addColorStop(0.80, '#3d1878');
      lake.addColorStop(1, '#1a0a30');

      // Apply as dark mirror (multiply down opacity)
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = lake;
      ctx.fillRect(0, lakeY, W, H - lakeY);
      ctx.globalAlpha = 1;

      // Dark overlay to darken reflection naturally
      const darkOverlay = ctx.createLinearGradient(0, lakeY, 0, H);
      darkOverlay.addColorStop(0, 'rgba(0,0,0,0.35)');
      darkOverlay.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = darkOverlay;
      ctx.fillRect(0, lakeY, W, H - lakeY);

      // Pine tree reflections — inverted dark shapes at top of lake
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#060c08';
      for (const t of pineTrees) {
        const refY = lakeY;
        ctx.beginPath();
        ctx.moveTo(t.x, refY);
        ctx.lineTo(t.x - t.w, refY);
        ctx.lineTo(t.x, refY + t.h * 0.5);
        ctx.lineTo(t.x + t.w, refY);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawShimmer() {
      for (const s of shimmerLines) {
        s.x += s.vx;
        if (s.x > W + s.len) s.x = -s.len;
        if (s.x < -s.len) s.x = W + s.len;
        ctx.globalAlpha = s.opacity;
        ctx.strokeStyle = 'rgba(255,220,160,1)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.len, s.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function loop() {
      drawSky();
      drawStars();
      drawClouds();
      drawMountains();
      drawPineForest();
      drawGround();
      drawLake();
      drawShimmer();

      raf = requestAnimationFrame(loop);
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
