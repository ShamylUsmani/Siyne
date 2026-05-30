'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

interface Window2 { r: number; c: number; on: boolean; }
interface BackBuilding { x: number; w: number; h: number; }
interface MidBuilding { x: number; w: number; h: number; windows: Window2[]; }
interface FrontBuilding { x: number; w: number; h: number; windows: Window2[]; hasSpire: boolean; spireH: number; stepped: boolean; antennaGlow: boolean; }
interface Bokeh { x: number; y: number; r: number; phase: number; vy: number; }
interface ShimmerLine { x: number; y: number; len: number; vx: number; }

export default function CitySkylineCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0, frame = 0;
    let skylineY = 0, waterY = 0;

    const backBuildings: BackBuilding[] = [];
    const midBuildings: MidBuilding[] = [];
    const frontBuildings: FrontBuilding[] = [];
    const bokehDots: Bokeh[] = [];
    const shimmerLines: ShimmerLine[] = [];

    // Track which window should flicker each cycle
    let flickerTimer = 0;

    function makeMidWindows(w: number, h: number): Window2[] {
      const rows = Math.floor(h / 16);
      const cols = Math.floor(w / 13);
      const wins: Window2[] = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          wins.push({ r, c, on: Math.random() > 0.35 });
      return wins;
    }

    function makeFrontWindows(w: number, h: number): Window2[] {
      const rows = Math.floor(h / 14);
      const cols = Math.floor(w / 11);
      const wins: Window2[] = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          wins.push({ r, c, on: Math.random() > 0.40 });
      return wins;
    }

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      skylineY = H * 0.58; waterY = H * 0.82;
      backBuildings.length = 0; midBuildings.length = 0; frontBuildings.length = 0;
      bokehDots.length = 0; shimmerLines.length = 0;
      frame = 0; flickerTimer = 0;

      // Back layer — ~15 simple dark buildings
      let bx = 0;
      while (bx < W + 40) {
        const bw = rand(25, 65);
        const bh = rand(skylineY * 0.15, skylineY * 0.65);
        backBuildings.push({ x: bx, w: bw, h: bh });
        bx += bw + rand(1, 6);
      }

      // Mid layer — ~10 buildings with lit windows
      bx = rand(-20, 0);
      while (bx < W + 40) {
        const bw = rand(40, 80);
        const bh = rand(skylineY * 0.25, skylineY * 0.75);
        midBuildings.push({ x: bx, w: bw, h: bh, windows: makeMidWindows(bw, bh) });
        bx += bw + rand(2, 10);
      }

      // Front layer — ~8 large detailed buildings
      const frontCount = 8;
      const segW = W / frontCount;
      for (let i = 0; i < frontCount; i++) {
        const bw = rand(segW * 0.55, segW * 0.85);
        const bh = rand(skylineY * 0.45, skylineY * 0.95);
        const bxPos = i * segW + (segW - bw) / 2 + rand(-10, 10);
        frontBuildings.push({
          x: bxPos, w: bw, h: bh,
          windows: makeFrontWindows(bw, bh),
          hasSpire: Math.random() > 0.55,
          spireH: rand(20, 55),
          stepped: Math.random() > 0.6,
          antennaGlow: Math.random() > 0.5,
        });
      }

      // Bokeh dots (5-8 large blurred circles in sky)
      for (let i = 0; i < 7; i++) {
        bokehDots.push({
          x: rand(0, W),
          y: rand(H * 0.05, skylineY * 0.7),
          r: rand(18, 45),
          phase: rand(0, Math.PI * 2),
          vy: -rand(0.03, 0.12),
        });
      }

      // Shimmer lines for water
      for (let i = 0; i < 18; i++) {
        shimmerLines.push({
          x: rand(0, W),
          y: waterY + rand(5, (H - waterY) * 0.9),
          len: rand(20, 100),
          vx: rand(-0.3, 0.3),
        });
      }
    }

    function drawSky() {
      // Sunset sky: deep purple top → warm gold horizon
      const sky = ctx.createLinearGradient(0, 0, 0, skylineY);
      sky.addColorStop(0, '#0a0520');
      sky.addColorStop(0.18, '#1a0840');
      sky.addColorStop(0.38, '#3d1068');
      sky.addColorStop(0.58, '#8b2a8b');
      sky.addColorStop(0.75, '#c0506a');
      sky.addColorStop(0.88, '#e8804a');
      sky.addColorStop(1, '#f5b848');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, skylineY);

      // Sun glow at horizon center
      const sunX = W * 0.5;
      const sunY = skylineY;
      const sunG = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * 0.4);
      sunG.addColorStop(0, 'rgba(255,220,80,0.55)');
      sunG.addColorStop(0.15, 'rgba(255,160,40,0.35)');
      sunG.addColorStop(0.4, 'rgba(200,80,20,0.15)');
      sunG.addColorStop(1, 'transparent');
      ctx.fillStyle = sunG;
      ctx.fillRect(0, 0, W, skylineY);
    }

    function drawBokeh() {
      for (const b of bokehDots) {
        b.y += b.vy;
        if (b.y < -b.r * 2) b.y = skylineY * 0.8;
        b.phase += 0.005;
        const alpha = (0.025 + Math.sin(b.phase) * 0.015);
        ctx.globalAlpha = Math.max(0, alpha);
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, 'rgba(255,200,100,0.8)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawBackBuildings() {
      ctx.fillStyle = '#0c0820';
      for (const b of backBuildings) {
        const by = skylineY - b.h;
        ctx.fillRect(b.x, by, b.w, b.h);
      }
    }

    function drawMidBuildings() {
      for (const b of midBuildings) {
        const by = skylineY - b.h;
        ctx.fillStyle = '#140c30';
        ctx.fillRect(b.x, by, b.w, b.h);

        // Subtle sunset edge glow
        const edgeG = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
        edgeG.addColorStop(0, 'rgba(240,140,60,0.08)');
        edgeG.addColorStop(0.5, 'transparent');
        edgeG.addColorStop(1, 'rgba(240,140,60,0.06)');
        ctx.fillStyle = edgeG;
        ctx.fillRect(b.x, by, b.w, b.h);

        // Windows
        for (const win of b.windows) {
          const wx = b.x + win.c * 13 + 3;
          const wy = by + win.r * 16 + 6;
          if (wx + 8 > b.x + b.w || wy + 9 > skylineY) continue;
          ctx.fillStyle = win.on ? 'rgba(255,220,100,0.70)' : 'rgba(15,8,30,0.5)';
          ctx.fillRect(wx, wy, 8, 9);
        }
      }
    }

    function drawFrontBuildings() {
      for (const b of frontBuildings) {
        const by = skylineY - b.h;

        // Main body
        ctx.fillStyle = '#0a0818';
        if (b.stepped) {
          // Stepped silhouette
          ctx.fillRect(b.x, by + b.h * 0.25, b.w, b.h * 0.75);
          ctx.fillRect(b.x + b.w * 0.1, by + b.h * 0.1, b.w * 0.8, b.h * 0.15);
          ctx.fillRect(b.x + b.w * 0.22, by, b.w * 0.56, b.h * 0.1);
        } else {
          ctx.fillRect(b.x, by, b.w, b.h);
        }

        // Sunset edge glow on building sides
        const leftG = ctx.createLinearGradient(b.x, 0, b.x + 8, 0);
        leftG.addColorStop(0, 'rgba(232,120,50,0.22)');
        leftG.addColorStop(1, 'transparent');
        ctx.fillStyle = leftG;
        ctx.fillRect(b.x, by, 8, b.h);

        const rightG = ctx.createLinearGradient(b.x + b.w - 8, 0, b.x + b.w, 0);
        rightG.addColorStop(0, 'transparent');
        rightG.addColorStop(1, 'rgba(200,80,30,0.16)');
        ctx.fillStyle = rightG;
        ctx.fillRect(b.x + b.w - 8, by, 8, b.h);

        // Spire
        if (b.hasSpire) {
          ctx.fillStyle = '#080614';
          ctx.beginPath();
          ctx.moveTo(b.x + b.w * 0.5 - 3, by);
          ctx.lineTo(b.x + b.w * 0.5, by - b.spireH);
          ctx.lineTo(b.x + b.w * 0.5 + 3, by);
          ctx.fill();
        }

        // Antenna glow (top of spire or building)
        if (b.antennaGlow) {
          const tipY = b.hasSpire ? by - b.spireH : by - 4;
          const ag = ctx.createRadialGradient(b.x + b.w * 0.5, tipY, 0, b.x + b.w * 0.5, tipY, 8);
          ag.addColorStop(0, 'rgba(255,60,60,0.85)');
          ag.addColorStop(1, 'transparent');
          ctx.fillStyle = ag;
          ctx.beginPath();
          ctx.arc(b.x + b.w * 0.5, tipY, 8, 0, Math.PI * 2);
          ctx.fill();
          // Small blinking dot
          const blinkAlpha = 0.5 + Math.sin(frame * 0.04 + b.x) * 0.5;
          ctx.globalAlpha = blinkAlpha;
          ctx.fillStyle = '#ff3030';
          ctx.beginPath();
          ctx.arc(b.x + b.w * 0.5, tipY, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Windows grid — 4px squares
        for (const win of b.windows) {
          const wx = b.x + win.c * 11 + 3;
          const wy = by + win.r * 14 + 5;
          if (wx + 4 > b.x + b.w || wy + 4 > skylineY) continue;
          ctx.fillStyle = win.on ? 'rgba(255,235,120,0.85)' : 'rgba(10,6,20,0.6)';
          ctx.fillRect(wx, wy, 4, 4);
        }
      }
    }

    function drawWater() {
      // Mirror reflection of sunset sky
      const water = ctx.createLinearGradient(0, waterY, 0, H);
      water.addColorStop(0, '#180c38');
      water.addColorStop(0.25, '#100828');
      water.addColorStop(0.55, '#080418');
      water.addColorStop(1, '#060410');
      ctx.fillStyle = water;
      ctx.fillRect(0, waterY, W, H - waterY);

      // Warm sunset colour streaks in water
      const refl = ctx.createLinearGradient(0, waterY, 0, H);
      refl.addColorStop(0, 'rgba(245,184,72,0.12)');
      refl.addColorStop(0.3, 'rgba(232,128,74,0.08)');
      refl.addColorStop(0.6, 'rgba(139,42,139,0.05)');
      refl.addColorStop(1, 'transparent');
      ctx.fillStyle = refl;
      ctx.fillRect(0, waterY, W, H - waterY);

      // Vertical shimmer streaks from building lights
      ctx.globalAlpha = 0.15;
      for (const b of frontBuildings) {
        const cx = b.x + b.w / 2;
        const streakG = ctx.createLinearGradient(cx - 3, waterY, cx + 3, waterY);
        streakG.addColorStop(0, 'transparent');
        streakG.addColorStop(0.5, 'rgba(255,220,100,0.6)');
        streakG.addColorStop(1, 'transparent');
        ctx.fillStyle = streakG;
        ctx.fillRect(cx - 3, waterY, 6, (H - waterY) * 0.7);
      }
      ctx.globalAlpha = 1;

      // Horizon line
      ctx.strokeStyle = 'rgba(245,184,72,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, waterY); ctx.lineTo(W, waterY); ctx.stroke();
    }

    function drawShimmerLines() {
      ctx.strokeStyle = 'rgba(255,220,120,0.18)';
      ctx.lineWidth = 0.8;
      for (const s of shimmerLines) {
        s.x += s.vx;
        if (s.x > W + s.len) s.x = -s.len;
        if (s.x < -s.len) s.x = W + s.len;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.len, s.y);
        ctx.stroke();
      }
    }

    function drawGroundStrip() {
      // Dark ground between building bases and water
      ctx.fillStyle = '#04020c';
      ctx.fillRect(0, skylineY, W, waterY - skylineY);
    }

    function tickWindows() {
      flickerTimer++;
      if (flickerTimer >= 90 + Math.floor(Math.random() * 31)) {
        flickerTimer = 0;
        // Toggle one window in a random front building
        if (frontBuildings.length > 0) {
          const b = frontBuildings[Math.floor(Math.random() * frontBuildings.length)];
          if (b.windows.length > 0) {
            const w = b.windows[Math.floor(Math.random() * b.windows.length)];
            w.on = !w.on;
          }
        }
        // Toggle one window in a random mid building
        if (midBuildings.length > 0) {
          const b = midBuildings[Math.floor(Math.random() * midBuildings.length)];
          if (b.windows.length > 0) {
            const w = b.windows[Math.floor(Math.random() * b.windows.length)];
            w.on = !w.on;
          }
        }
      }
    }

    function loop() {
      frame++;
      tickWindows();

      drawSky();
      drawBokeh();
      drawBackBuildings();
      drawMidBuildings();
      drawFrontBuildings();
      drawGroundStrip();
      drawWater();
      drawShimmerLines();

      raf = requestAnimationFrame(loop);
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
