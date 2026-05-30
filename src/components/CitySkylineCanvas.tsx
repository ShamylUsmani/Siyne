'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function randInt(a: number, b: number) { return Math.floor(rand(a, b + 1)); }

interface StarDot { x: number; y: number; r: number; phase: number; }
interface BackBuilding { x: number; w: number; h: number; wins: { r: number; c: number; on: boolean }[]; }
interface NeonSign { x: number; y: number; w: number; h: number; color: string; phase: number; }
interface MidBuilding { x: number; w: number; h: number; wins: { r: number; c: number; on: boolean; blue: boolean }[]; neon: NeonSign | null; }
interface FrontBuilding {
  x: number; w: number; h: number;
  wins: { r: number; c: number; on: boolean }[];
  spireH: number; stepped: boolean; broadcast: boolean;
  antennaOn: boolean; antennaTimer: number; antennaInterval: number;
  neonFace: boolean; neonFaceColor: string; neonFacePhase: number;
}
interface ShimmerLine { x: number; y: number; len: number; vx: number; }
interface ReflectionStreak { cx: number; color: string; }

export default function CitySkylineCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0, frame = 0;
    let skylineY = 0, waterY = 0;

    const stars: StarDot[] = [];
    const backBuildings: BackBuilding[] = [];
    const midBuildings: MidBuilding[] = [];
    const frontBuildings: FrontBuilding[] = [];
    const shimmerLines: ShimmerLine[] = [];
    const reflectionStreaks: ReflectionStreak[] = [];

    let flickerTimer = 0;

    function makeBackWins(w: number, h: number) {
      const rows = Math.floor(h / 18), cols = Math.floor(w / 14);
      const arr: { r: number; c: number; on: boolean }[] = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          arr.push({ r, c, on: Math.random() > 0.72 });
      return arr;
    }

    function makeMidWins(w: number, h: number) {
      const rows = Math.floor(h / 15), cols = Math.floor(w / 12);
      const arr: { r: number; c: number; on: boolean; blue: boolean }[] = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          arr.push({ r, c, on: Math.random() > 0.60, blue: Math.random() > 0.65 });
      return arr;
    }

    function makeFrontWins(w: number, h: number) {
      const rows = Math.floor(h / 13), cols = Math.floor(w / 10);
      const arr: { r: number; c: number; on: boolean }[] = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          arr.push({ r, c, on: Math.random() > 0.40 });
      return arr;
    }

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      skylineY = H * 0.60; waterY = H * 0.78;
      stars.length = 0; backBuildings.length = 0; midBuildings.length = 0;
      frontBuildings.length = 0; shimmerLines.length = 0; reflectionStreaks.length = 0;
      frame = 0; flickerTimer = 0;

      // Stars
      for (let i = 0; i < 70; i++) {
        stars.push({
          x: rand(0, W), y: rand(H * 0.02, skylineY * 0.75),
          r: rand(0.4, 2.0), phase: rand(0, Math.PI * 2),
        });
      }

      // Back layer (15-20 buildings)
      let bx = 0;
      while (bx < W + 30) {
        const bw = rand(22, 55);
        const bh = rand(skylineY * 0.12, skylineY * 0.58);
        backBuildings.push({ x: bx, w: bw, h: bh, wins: makeBackWins(bw, bh) });
        bx += bw + rand(1, 5);
      }

      // Mid layer (10-12 buildings)
      bx = rand(-15, 0);
      while (bx < W + 30) {
        const bw = rand(38, 75);
        const bh = rand(skylineY * 0.28, skylineY * 0.78);
        const hasNeon = Math.random() > 0.55;
        const neonColors = ['rgba(255,50,150,0.6)', 'rgba(50,150,255,0.5)', 'rgba(180,50,255,0.55)', 'rgba(50,220,180,0.5)'];
        const neon: NeonSign | null = hasNeon ? {
          x: bx + bw * rand(0.1, 0.5),
          y: skylineY - bh * rand(0.35, 0.60),
          w: bw * rand(0.3, 0.55),
          h: 6 + rand(0, 4),
          color: neonColors[randInt(0, neonColors.length - 1)],
          phase: rand(0, Math.PI * 2),
        } : null;
        midBuildings.push({ x: bx, w: bw, h: bh, wins: makeMidWins(bw, bh), neon });
        bx += bw + rand(2, 8);
      }

      // Front layer (6-8 tall landmark buildings)
      const frontCount = randInt(6, 8);
      const segW = W / frontCount;
      for (let i = 0; i < frontCount; i++) {
        const bw = rand(segW * 0.50, segW * 0.82);
        const bh = rand(skylineY * 0.50, skylineY * 0.96);
        const bxPos = i * segW + (segW - bw) / 2 + rand(-8, 8);
        const neonFaceColors = ['#c830ff', '#30ffe8', '#ff30a0'];
        frontBuildings.push({
          x: bxPos, w: bw, h: bh,
          wins: makeFrontWins(bw, bh),
          spireH: rand(22, 60),
          stepped: Math.random() > 0.55,
          broadcast: i === Math.floor(frontCount / 2),
          antennaOn: false,
          antennaTimer: 0,
          antennaInterval: randInt(60, 90),
          neonFace: Math.random() > 0.6,
          neonFaceColor: neonFaceColors[randInt(0, neonFaceColors.length - 1)],
          neonFacePhase: rand(0, Math.PI * 2),
        });
      }

      // Reflection streaks
      for (const b of frontBuildings) {
        if (b.neonFace) {
          reflectionStreaks.push({ cx: b.x + b.w / 2, color: b.neonFaceColor });
        }
      }
      reflectionStreaks.push({ cx: W * 0.25, color: 'rgba(255,50,150,0.15)' });
      reflectionStreaks.push({ cx: W * 0.60, color: 'rgba(120,50,255,0.12)' });
      reflectionStreaks.push({ cx: W * 0.80, color: 'rgba(50,150,255,0.10)' });

      // Shimmer lines
      for (let i = 0; i < 8; i++) {
        shimmerLines.push({
          x: rand(0, W), y: waterY + rand(5, (H - waterY) * 0.9),
          len: rand(25, 90), vx: rand(-0.25, 0.25),
        });
      }
    }

    // ── DRAW ──────────────────────────────────────────────────

    function drawSky() {
      const g = ctx.createLinearGradient(0, 0, 0, skylineY);
      g.addColorStop(0,    '#02020e');
      g.addColorStop(0.18, '#080418');
      g.addColorStop(0.40, '#180830');
      g.addColorStop(0.65, '#2a1050');
      g.addColorStop(1,    '#401870');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, skylineY);

      // Moon (upper-right)
      const mx = W * 0.82, my = H * 0.10, mr = 22;
      // Soft glow behind moon
      const moonGlow = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 4.5);
      moonGlow.addColorStop(0, 'rgba(220,220,240,0.18)');
      moonGlow.addColorStop(0.4, 'rgba(200,200,230,0.07)');
      moonGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = moonGlow;
      ctx.beginPath(); ctx.arc(mx, my, mr * 4.5, 0, Math.PI * 2); ctx.fill();
      // Moon disc
      const moonG = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
      moonG.addColorStop(0, '#f4f4ff');
      moonG.addColorStop(0.5, '#e8e8f0');
      moonG.addColorStop(1, '#c8c8d8');
      ctx.fillStyle = moonG;
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    }

    function drawStars() {
      for (const s of stars) {
        s.phase += 0.018;
        const alpha = 0.45 + Math.sin(s.phase) * 0.45;
        ctx.globalAlpha = alpha * 0.92;
        if (s.r > 1.5) ctx.fillStyle = '#f8f8ff';
        else if (s.r > 1.0) ctx.fillStyle = '#d8e0ff';
        else ctx.fillStyle = '#a8b8ff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawBackBuildings() {
      for (const b of backBuildings) {
        const by = skylineY - b.h;
        ctx.fillStyle = '#0a0618';
        ctx.fillRect(b.x, by, b.w, b.h);
        for (const w of b.wins) {
          const wx = b.x + w.c * 14 + 3;
          const wy = by + w.r * 18 + 5;
          if (wx + 6 > b.x + b.w || wy + 7 > skylineY) continue;
          if (!w.on) continue;
          ctx.fillStyle = 'rgba(255,230,100,0.6)';
          ctx.fillRect(wx, wy, 6, 7);
        }
      }
    }

    function drawMidBuildings() {
      for (const b of midBuildings) {
        const by = skylineY - b.h;

        // Building body
        ctx.fillStyle = '#0e0a22';
        ctx.fillRect(b.x, by, b.w, b.h);

        // Illuminated top floors
        if (Math.random() > 0.97) {
          const topG = ctx.createLinearGradient(0, by, 0, by + b.h * 0.20);
          topG.addColorStop(0, 'rgba(120,60,255,0.12)');
          topG.addColorStop(1, 'transparent');
          ctx.fillStyle = topG;
          ctx.fillRect(b.x, by, b.w, b.h * 0.20);
        }

        // Windows
        for (const w of b.wins) {
          const wx = b.x + w.c * 12 + 3;
          const wy = by + w.r * 15 + 4;
          if (wx + 7 > b.x + b.w || wy + 8 > skylineY) continue;
          if (!w.on) continue;
          ctx.fillStyle = w.blue
            ? 'rgba(180,210,255,0.75)'
            : 'rgba(255,220,100,0.70)';
          ctx.fillRect(wx, wy, 7, 8);
        }

        // Neon sign
        if (b.neon) {
          b.neon.phase += 0.012;
          const pulse = 0.85 + Math.sin(b.neon.phase) * 0.15;
          ctx.globalAlpha = pulse;
          ctx.fillStyle = b.neon.color;
          ctx.fillRect(b.neon.x, b.neon.y, b.neon.w, b.neon.h);
          // Glow around neon
          const ng = ctx.createLinearGradient(b.neon.x, b.neon.y - 4, b.neon.x, b.neon.y + b.neon.h + 4);
          ng.addColorStop(0, 'transparent');
          ng.addColorStop(0.5, b.neon.color.replace('0.6', '0.2').replace('0.5', '0.15').replace('0.55', '0.18'));
          ng.addColorStop(1, 'transparent');
          ctx.fillStyle = ng;
          ctx.fillRect(b.neon.x - 4, b.neon.y - 5, b.neon.w + 8, b.neon.h + 10);
          ctx.globalAlpha = 1;
        }
      }
    }

    function drawFrontBuildings() {
      for (const b of frontBuildings) {
        const by = skylineY - b.h;
        const spireTopY = by - b.spireH;

        // Building body (stepped or plain)
        ctx.fillStyle = '#06040e';
        if (b.stepped) {
          ctx.fillRect(b.x, by + b.h * 0.22, b.w, b.h * 0.78);
          ctx.fillRect(b.x + b.w * 0.10, by + b.h * 0.10, b.w * 0.80, b.h * 0.12);
          ctx.fillRect(b.x + b.w * 0.22, by, b.w * 0.56, b.h * 0.10);
        } else {
          // Taper at top for some
          ctx.beginPath();
          ctx.moveTo(b.x, skylineY);
          ctx.lineTo(b.x, by + b.h * 0.15);
          ctx.lineTo(b.x + b.w * 0.05, by);
          ctx.lineTo(b.x + b.w * 0.95, by);
          ctx.lineTo(b.x + b.w, by + b.h * 0.15);
          ctx.lineTo(b.x + b.w, skylineY);
          ctx.closePath();
          ctx.fill();
        }

        // Neon face illumination on upper section
        if (b.neonFace) {
          b.neonFacePhase += 0.008;
          const pulse = 0.85 + Math.sin(b.neonFacePhase) * 0.12;
          const col = b.neonFaceColor;
          const faceG = ctx.createLinearGradient(b.x, by, b.x + b.w, by);
          faceG.addColorStop(0, 'transparent');
          faceG.addColorStop(0.3, col.replace(')', `,${0.18 * pulse})`).replace('rgba(', 'rgba('));
          faceG.addColorStop(0.7, col.replace(')', `,${0.22 * pulse})`).replace('rgba(', 'rgba('));
          faceG.addColorStop(1, 'transparent');
          ctx.globalAlpha = pulse;
          ctx.fillStyle = faceG;
          ctx.fillRect(b.x, by, b.w, b.h * 0.35);
          ctx.globalAlpha = 1;

          // Edge glow lines
          ctx.strokeStyle = col;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.35 * pulse;
          ctx.strokeRect(b.x + 1, by + 1, b.w - 2, b.h * 0.34);
          ctx.globalAlpha = 1;
        }

        // Spire
        ctx.fillStyle = '#04030a';
        if (b.broadcast) {
          // Broadcast tower — lattice-style
          ctx.beginPath();
          ctx.moveTo(b.x + b.w * 0.5 - 4, by);
          ctx.lineTo(b.x + b.w * 0.5 - 2, by - b.spireH * 0.5);
          ctx.lineTo(b.x + b.w * 0.5, by - b.spireH);
          ctx.lineTo(b.x + b.w * 0.5 + 2, by - b.spireH * 0.5);
          ctx.lineTo(b.x + b.w * 0.5 + 4, by);
          ctx.closePath();
          ctx.fill();
          // Crossbars
          ctx.strokeStyle = '#04030a';
          ctx.lineWidth = 2;
          const steps = 4;
          for (let si = 1; si < steps; si++) {
            const t = si / steps;
            const sw = 4 * (1 - t * 0.7);
            const sy2 = by - b.spireH * t;
            ctx.beginPath();
            ctx.moveTo(b.x + b.w * 0.5 - sw, sy2);
            ctx.lineTo(b.x + b.w * 0.5 + sw, sy2);
            ctx.stroke();
          }
        } else {
          ctx.beginPath();
          ctx.moveTo(b.x + b.w * 0.5 - 3, by);
          ctx.lineTo(b.x + b.w * 0.5, spireTopY);
          ctx.lineTo(b.x + b.w * 0.5 + 3, by);
          ctx.fill();
        }

        // Aircraft warning light
        b.antennaTimer++;
        if (b.antennaTimer >= b.antennaInterval) {
          b.antennaOn = !b.antennaOn;
          b.antennaTimer = 0;
          b.antennaInterval = randInt(60, 90);
        }
        if (b.antennaOn) {
          const tipX = b.x + b.w * 0.5;
          const tipY = spireTopY;
          const ag = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 7);
          ag.addColorStop(0, 'rgba(255,40,40,0.95)');
          ag.addColorStop(0.4, 'rgba(255,30,30,0.4)');
          ag.addColorStop(1, 'transparent');
          ctx.fillStyle = ag;
          ctx.beginPath(); ctx.arc(tipX, tipY, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ff2020';
          ctx.beginPath(); ctx.arc(tipX, tipY, 2, 0, Math.PI * 2); ctx.fill();
        }

        // Windows grid
        for (const w of b.wins) {
          const wx = b.x + w.c * 10 + 3;
          const wy = by + w.r * 13 + 4;
          if (wx + 5 > b.x + b.w || wy + 6 > skylineY) continue;
          if (!w.on) continue;
          ctx.fillStyle = 'rgba(255,220,100,0.85)';
          ctx.fillRect(wx, wy, 5, 6);
        }
      }
    }

    function drawHorizonGlow() {
      const glow = ctx.createLinearGradient(0, skylineY - H * 0.08, 0, skylineY + H * 0.04);
      glow.addColorStop(0, 'transparent');
      glow.addColorStop(0.5, 'rgba(80,40,180,0.25)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, skylineY - H * 0.08, W, H * 0.12);
    }

    function drawGroundStrip() {
      ctx.fillStyle = '#030210';
      ctx.fillRect(0, skylineY, W, waterY - skylineY);
    }

    function drawWater() {
      // Dark water
      const water = ctx.createLinearGradient(0, waterY, 0, H);
      water.addColorStop(0, '#070218');
      water.addColorStop(0.4, '#040110');
      water.addColorStop(1, '#020008');
      ctx.fillStyle = water;
      ctx.fillRect(0, waterY, W, H - waterY);

      // Neon reflections — tapering streaks
      for (const r of reflectionStreaks) {
        const maxW = 20;
        const rg = ctx.createLinearGradient(r.cx - maxW, waterY, r.cx + maxW, waterY);
        rg.addColorStop(0, 'transparent');
        rg.addColorStop(0.5, r.color);
        rg.addColorStop(1, 'transparent');
        ctx.fillStyle = rg;

        // Taper: narrow at top (waterY), wider at bottom
        ctx.beginPath();
        ctx.moveTo(r.cx - 3, waterY);
        ctx.lineTo(r.cx + 3, waterY);
        ctx.lineTo(r.cx + maxW, H);
        ctx.lineTo(r.cx - maxW, H);
        ctx.closePath();
        ctx.fillStyle = rg;
        ctx.fill();
      }
    }

    function drawShimmerLines() {
      for (const s of shimmerLines) {
        s.x += s.vx;
        if (s.x > W + s.len) s.x = -s.len;
        if (s.x < -s.len) s.x = W + s.len;
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = 'rgba(200,180,255,1)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.len, s.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function tickWindows() {
      flickerTimer++;
      const threshold = 100 + Math.floor(Math.random() * 50);
      if (flickerTimer >= threshold) {
        flickerTimer = 0;
        if (frontBuildings.length > 0) {
          const b = frontBuildings[Math.floor(Math.random() * frontBuildings.length)];
          if (b.wins.length > 0) { const w = b.wins[Math.floor(Math.random() * b.wins.length)]; w.on = !w.on; }
        }
        if (midBuildings.length > 0) {
          const b = midBuildings[Math.floor(Math.random() * midBuildings.length)];
          if (b.wins.length > 0) { const w = b.wins[Math.floor(Math.random() * b.wins.length)]; w.on = !w.on; }
        }
      }
    }

    function loop() {
      frame++;
      tickWindows();

      drawSky();
      drawStars();
      drawHorizonGlow();
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
