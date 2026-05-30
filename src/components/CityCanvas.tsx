'use client';

import { useEffect, useRef } from 'react';

/* ── colour helpers ───────────────────────────────────── */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

function hexToRgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ── palette ─────────────────────────────────────────── */
const SKIN: string[] = [
  '#e8d8c8', '#d4b896', '#c8a882', '#b89070',
  '#a87858', '#906040', '#784830', '#5a3018',
];
const CLOTHES: string[] = [
  '#e8e0d8', '#c4c8d4', '#d4c0a8', '#b8c4b8',
  '#d8d0c0', '#a8b0c0', '#c8b8a8', '#d0ccc4',
  '#b4b8c0', '#e0d8cc', '#c0bcb4', '#d8d4cc',
];

/* ── types ───────────────────────────────────────────── */
interface Walker {
  x: number; y: number;
  vx: number; vy: number;
  skinColor: string;
  clothColor: string;
  r: number;
  phase: number;
  type: 'sidewalk' | 'cross';
  lane: number;
  dir: 1 | -1;
}

interface Car {
  x: number; y: number;
  w: number; h: number;
  spd: number;
  bodyCol: string;
  accentCol: string;
}

interface Bldg {
  x: number; y: number;
  w: number; h: number;
  col: string;
  roofCol: string;
  shape: 'plain' | 'stepped' | 'spire' | 'dome';
  isLandmark: boolean;
  windowStyle: 'small' | 'tall' | 'mixed';
  windowHue: number;
}

interface Tree {
  x: number; y: number;
  r: number;
}

interface ParkedCar {
  x: number; y: number;
  w: number; h: number;
  col: string;
}

/* ── person drawing ──────────────────────────────────── */
function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  angle: number,
  frame: number,
  phase: number,
  skin: string, cloth: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const swing = Math.sin(frame * 0.14 + phase) * r * 0.72;
  const legR  = r * 0.28;
  const dk    = shade(cloth, -35);

  ctx.globalAlpha = 0.28;
  ctx.fillStyle   = '#000';
  ctx.beginPath();
  ctx.ellipse(r * 0.18, r * 0.2, r * 1.05, r * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = dk;
  ctx.beginPath();
  ctx.ellipse(-r * 0.30, r * 0.55 + swing, legR, r * 0.50, 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse( r * 0.30, r * 0.55 - swing, legR, r * 0.50, -0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.10, r * 0.62, r * 0.56, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -r * 0.52, r * 0.46, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.62, r * 0.14, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* ── component ───────────────────────────────────────── */
export default function CityCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let W = 0, H = 0;
    let roadY = 0, roadH = 0, crossX = 0, crossW = 0;

    const walkers: Walker[] = [];
    const cars:    Car[]    = [];
    const bldgs:   Bldg[]   = [];
    const trees:   Tree[]   = [];
    const parkedCars: ParkedCar[] = [];

    let light: 'red' | 'green' = 'red';
    let lightTick = 0;
    const RED_DUR   = 310;
    const GREEN_DUR = 230;

    function rand(a: number, b: number) { return a + Math.random() * (b - a); }
    function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth  || 1200;
      H = canvas.offsetHeight || 700;
      canvas.width  = W;
      canvas.height = H;

      roadY  = H * 0.42;
      roadH  = H * 0.20;
      crossX = W * 0.40;
      crossW = W * 0.20;

      walkers.length = 0;
      cars.length    = 0;
      bldgs.length   = 0;
      trees.length   = 0;
      parkedCars.length = 0;

      const mobile = W < 600;
      const shapes: Array<'plain' | 'stepped' | 'spire' | 'dome'> = ['plain', 'plain', 'stepped', 'spire', 'dome'];

      /* landmark positions */
      const landmarkXs = [W * 0.15, W * 0.55, W * 0.82];

      /* buildings — top area */
      let bx = 0;
      let bldgIdx = 0;
      while (bx < W) {
        const bw = rand(50, 130);
        const isLandmark = landmarkXs.some(lx => Math.abs(bx + bw / 2 - lx) < 50) && bldgIdx < 3;
        const bh = isLandmark ? rand(roadY * 0.70, roadY * 0.95) : rand(roadY * 0.35, roadY * 0.78);
        const by = rand(4, roadY * 0.15);
        const lum = rand(14, 26);
        const shape = isLandmark ? 'spire' : pick(shapes);
        bldgs.push({
          x: bx, y: by, w: bw - 4, h: bh,
          col:     `hsl(${rand(0,30)},${rand(0,8)}%,${lum}%)`,
          roofCol: `hsl(${rand(0,30)},${rand(0,8)}%,${lum + 5}%)`,
          shape,
          isLandmark,
          windowStyle: pick(['small', 'tall', 'mixed'] as Array<'small' | 'tall' | 'mixed'>),
          windowHue: rand(20, 60),
        });
        bx += bw + rand(2, 10);
        if (isLandmark) bldgIdx++;
      }
      /* buildings — bottom area */
      bx = 0;
      while (bx < W) {
        const bw = rand(50, 140);
        const bh = rand((H - roadY - roadH) * 0.3, (H - roadY - roadH) * 0.72);
        const by = roadY + roadH + rand(4, 12);
        const lum = rand(14, 26);
        bldgs.push({
          x: bx, y: by, w: bw - 4, h: bh,
          col:     `hsl(${rand(0,30)},${rand(0,8)}%,${lum}%)`,
          roofCol: `hsl(${rand(0,30)},${rand(0,8)}%,${lum + 5}%)`,
          shape:   pick(shapes),
          isLandmark: false,
          windowStyle: pick(['small', 'tall', 'mixed'] as Array<'small' | 'tall' | 'mixed'>),
          windowHue: rand(20, 60),
        });
        bx += bw + rand(2, 10);
      }

      /* trees on sidewalk edges */
      const treeCount = mobile ? 9 : 14;
      for (let i = 0; i < treeCount; i++) {
        trees.push({
          x: rand(0, W),
          y: rand(roadY * 0.80, roadY - 12),
          r: rand(8, 14),
        });
        trees.push({
          x: rand(0, W),
          y: rand(roadY + roadH + 10, roadY + roadH + (H - roadY - roadH) * 0.25),
          r: rand(8, 14),
        });
      }

      /* parked cars at ground level between buildings */
      const carCount = mobile ? 4 : 7;
      for (let i = 0; i < carCount; i++) {
        const pcx = rand(0, W);
        const groundY = roadY - rand(4, 10);
        const pcw = rand(28, 44);
        const pch = rand(10, 15);
        const hue = rand(0, 360);
        parkedCars.push({
          x: pcx, y: groundY - pch,
          w: pcw, h: pch,
          col: `hsl(${hue},${rand(5,18)}%,${rand(10,20)}%)`,
        });
      }

      /* sidewalk walkers */
      const walkCount = mobile ? 28 : 44;
      for (let i = 0; i < walkCount; i++) {
        const top  = i < walkCount / 2;
        const yMin = top ? roadY * 0.25 : roadY + roadH + (H - roadY - roadH) * 0.1;
        const yMax = top ? roadY - 16   : H - 16;
        const lane = rand(yMin, yMax);
        const spd  = rand(0.42, 0.85);
        walkers.push({
          x:          rand(0, W),
          y:          lane,
          vx:         Math.random() > 0.5 ? spd : -spd,
          vy:         rand(-0.12, 0.12),
          skinColor:  pick(SKIN),
          clothColor: pick(CLOTHES),
          r:          rand(6.5, 10),
          phase:      rand(0, Math.PI * 2),
          type:       'sidewalk',
          lane,
          dir:        1,
        });
      }

      /* crosswalk walkers */
      const crossCount = mobile ? 16 : 26;
      for (let i = 0; i < crossCount; i++) {
        const dir = (i < crossCount / 2 ? 1 : -1) as 1 | -1;
        walkers.push({
          x:          crossX + rand(0, crossW),
          y:          dir === 1
                        ? roadY - rand(10, 90)
                        : roadY + roadH + rand(10, 90),
          vx:         rand(-0.14, 0.14),
          vy:         0,
          skinColor:  pick(SKIN),
          clothColor: pick(CLOTHES),
          r:          rand(6.5, 10),
          phase:      rand(0, Math.PI * 2),
          type:       'cross',
          lane:       0,
          dir,
        });
      }

      /* cars — two lanes */
      const laneA = roadY + roadH * 0.24;
      const laneB = roadY + roadH * 0.73;
      for (let i = 0; i < 7; i++) {
        const top = i < 4;
        const spd = rand(1.3, 2.2) * (top ? -1 : 1);
        const hue = rand(0, 360);
        cars.push({
          x:         rand(0, W),
          y:         top ? laneA : laneB,
          w:         rand(40, 58),
          h:         rand(16, 22),
          spd,
          bodyCol:   `hsl(${hue},${rand(8,20)}%,${rand(12,22)}%)`,
          accentCol: `hsl(${hue},${rand(10,25)}%,${rand(22,35)}%)`,
        });
      }
    }

    /* ── draw building with shape variety ── */
    function drawBuilding(b: Bldg) {
      const bTop = b.y;
      const bBot = b.y + b.h;

      /* gradient body */
      const bodyG = ctx.createLinearGradient(b.x, bTop, b.x + b.w, bBot);
      bodyG.addColorStop(0, b.col);
      bodyG.addColorStop(1, shade(b.col.replace(/hsl/, '').replace('(', '').replace(')', ''), -8));
      ctx.fillStyle = b.col;

      /* shape variants */
      if (b.shape === 'stepped') {
        ctx.fillRect(b.x, bBot - b.h, b.w, b.h);
        ctx.fillStyle = shade(b.col.replace(/hsl\(.*\)/, ''), 5) || b.roofCol;
        ctx.fillRect(b.x + b.w * 0.12, bTop - b.h * 0.18, b.w * 0.76, b.h * 0.18);
        ctx.fillRect(b.x + b.w * 0.24, bTop - b.h * 0.32, b.w * 0.52, b.h * 0.14);
      } else if (b.shape === 'spire' || b.shape === 'dome') {
        ctx.fillRect(b.x, bTop, b.w, b.h);
        /* glowing crown for landmark */
        if (b.isLandmark) {
          const crownG = ctx.createRadialGradient(b.x + b.w / 2, bTop, 0, b.x + b.w / 2, bTop, b.w * 0.8);
          crownG.addColorStop(0, `rgba(255,210,80,0.35)`);
          crownG.addColorStop(0.4, `rgba(255,180,50,0.12)`);
          crownG.addColorStop(1, 'transparent');
          ctx.fillStyle = crownG;
          ctx.beginPath();
          ctx.arc(b.x + b.w / 2, bTop, b.w * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        /* spire */
        ctx.fillStyle = b.roofCol;
        const spireH = b.shape === 'spire' ? b.h * 0.22 : 0;
        if (b.shape === 'spire') {
          ctx.beginPath();
          ctx.moveTo(b.x + b.w * 0.5 - 3, bTop);
          ctx.lineTo(b.x + b.w * 0.5, bTop - spireH);
          ctx.lineTo(b.x + b.w * 0.5 + 3, bTop);
          ctx.closePath(); ctx.fill();
        } else {
          /* dome arc */
          ctx.beginPath();
          ctx.arc(b.x + b.w / 2, bTop, b.w * 0.35, Math.PI, 0);
          ctx.closePath(); ctx.fill();
        }
      } else {
        ctx.fillRect(b.x, bTop, b.w, b.h);
      }

      /* rooftop edge highlight */
      ctx.fillStyle   = b.roofCol;
      ctx.fillRect(b.x, bTop, b.w, 3);
      ctx.fillRect(b.x, bTop, 3, b.h);

      /* windows */
      const winCols = b.windowStyle === 'small'
        ? { w: 5, h: 6, gapX: 9, gapY: 11 }
        : b.windowStyle === 'tall'
          ? { w: 4, h: 11, gapX: 8, gapY: 15 }
          : { w: 6, h: 8, gapX: 10, gapY: 13 };

      for (let wy = bTop + 6; wy < bBot - 4; wy += winCols.gapY) {
        for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += winCols.gapX) {
          if (wx + winCols.w > b.x + b.w - 2) continue;
          if (wy + winCols.h > bBot - 2) continue;
          const warmChance = Math.random();
          if (warmChance > 0.45) {
            const warm = warmChance > 0.75;
            ctx.fillStyle = warm
              ? `rgba(${230 + Math.floor(Math.random() * 25)},${180 + Math.floor(Math.random() * 40)},${60 + Math.floor(Math.random() * 40)},0.82)`
              : `rgba(${160 + Math.floor(Math.random() * 40)},${200 + Math.floor(Math.random() * 30)},${240 + Math.floor(Math.random() * 15)},0.75)`;
            ctx.fillRect(wx, wy, winCols.w, winCols.h);
          }
        }
      }
    }

    /* ── static background ── */
    function drawBg() {
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(0, 0, W, H);

      /* building footprints */
      for (const b of bldgs) {
        drawBuilding(b);
      }

      /* sidewalk tile grid */
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth   = 0.6;
      const ts = 36;
      for (let x = 0; x < W; x += ts) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, roadY);
        ctx.moveTo(x, roadY + roadH); ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += ts) {
        if (y > roadY && y < roadY + roadH) continue;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      /* parked cars */
      for (const pc of parkedCars) {
        ctx.fillStyle = pc.col;
        ctx.beginPath();
        ctx.roundRect(pc.x - pc.w / 2, pc.y, pc.w, pc.h, 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(100,150,200,0.3)';
        ctx.beginPath();
        ctx.roundRect(pc.x - pc.w * 0.3, pc.y, pc.w * 0.6, pc.h * 0.5, 1);
        ctx.fill();
      }

      /* trees */
      for (const t of trees) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle   = '#000';
        ctx.beginPath();
        ctx.ellipse(t.x + 3, t.y + 3, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        const g = ctx.createRadialGradient(t.x - t.r * 0.2, t.y - t.r * 0.2, 0, t.x, t.y, t.r);
        g.addColorStop(0, 'rgba(40,90,35,0.92)');
        g.addColorStop(1, 'rgba(18,50,15,0.55)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        ctx.fill();
      }

      /* road */
      const roadG = ctx.createLinearGradient(0, roadY, 0, roadY + roadH);
      roadG.addColorStop(0, '#181818');
      roadG.addColorStop(1, '#111111');
      ctx.fillStyle = roadG;
      ctx.fillRect(0, roadY, W, roadH);

      /* curb lines */
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth   = 1.5;
      for (const yy of [roadY, roadY + roadH]) {
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
      }

      /* centre dash */
      ctx.strokeStyle = 'rgba(255,215,0,0.22)';
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([16, 16]);
      ctx.beginPath();
      ctx.moveTo(0, roadY + roadH / 2); ctx.lineTo(W, roadY + roadH / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      /* crosswalk stripes */
      const sw = 17, sg = 9;
      for (let x = crossX; x < crossX + crossW - sw; x += sw + sg) {
        ctx.fillStyle = 'rgba(255,255,255,0.11)';
        ctx.fillRect(x, roadY, sw, roadH);
      }

      /* crosswalk boundaries */
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth   = 2;
      for (const xx of [crossX, crossX + crossW]) {
        ctx.beginPath(); ctx.moveTo(xx, roadY - 3); ctx.lineTo(xx, roadY + roadH + 3); ctx.stroke();
      }
    }

    /* ── traffic light ── */
    function drawLight() {
      const lx  = crossX - 22;
      const isR = light === 'red';

      for (const [ly] of [[roadY - 10], [roadY + roadH + 4]] as [number][]) {
        ctx.fillStyle = '#222';
        ctx.fillRect(lx - 1.5, ly, 3, 22);

        ctx.fillStyle = '#181818';
        ctx.beginPath();
        ctx.roundRect(lx - 6, ly, 12, 20, 3);
        ctx.fill();

        const cy = ly + 7;
        const grd = ctx.createRadialGradient(lx, cy, 0, lx, cy, 10);
        grd.addColorStop(0, isR ? 'rgba(255,35,0,0.92)' : 'rgba(255,35,0,0.16)');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(lx, cy, 10, 0, Math.PI * 2); ctx.fill();
      }
    }

    /* ── car ── */
    function drawCar(c: Car) {
      ctx.fillStyle = c.bodyCol;
      ctx.beginPath();
      ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 4);
      ctx.fill();

      ctx.fillStyle = c.accentCol;
      ctx.beginPath();
      ctx.roundRect(c.x - c.w * 0.28, c.y - c.h * 0.36, c.w * 0.50, c.h * 0.70, 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(160,200,240,0.22)';
      ctx.beginPath();
      ctx.roundRect(c.x - c.w * 0.24, c.y - c.h * 0.30, c.w * 0.42, c.h * 0.58, 2);
      ctx.fill();

      const tlx = c.spd > 0 ? c.x - c.w / 2 : c.x + c.w / 2 - 5;
      ctx.fillStyle = 'rgba(255,40,0,0.72)';
      ctx.fillRect(tlx, c.y - c.h / 2 + 2, 5, 4);
      ctx.fillRect(tlx, c.y + c.h / 2 - 6, 5, 4);
    }

    function updateCar(c: Car) {
      const nearPx = 70;
      const inZone = c.x > crossX - nearPx && c.x < crossX + crossW + nearPx;
      if (light === 'red' && inZone) {
        const stop = c.spd > 0 ? crossX - c.w / 2 - 6 : crossX + crossW + c.w / 2 + 6;
        const gap  = c.spd > 0 ? stop - c.x : c.x - stop;
        if (gap > 2) c.x += c.spd * Math.min(1, gap / 28);
      } else {
        c.x += c.spd;
      }
      if (c.x >  W + 80) c.x = -80;
      if (c.x < -80)     c.x =  W + 80;
    }

    /* ── walker ── */
    function updateWalker(p: Walker) {
      if (p.type === 'sidewalk') {
        p.x  += p.vx;
        p.vy += (p.lane - p.y) * 0.045;
        p.vy *= 0.84;
        p.y  += p.vy;
        if (p.x >  W + 20) p.x = -20;
        if (p.x < -20)     p.x =  W + 20;
        return;
      }
      const crossing = light === 'red';
      p.vy += (crossing ? p.dir * 0.62 - p.vy : -p.vy) * 0.07;
      p.vx *= 0.95;
      if (p.x < crossX - 8)          p.vx += 0.04;
      if (p.x > crossX + crossW + 8) p.vx -= 0.04;
      p.x += p.vx; p.y += p.vy;
      if (p.dir === 1  && p.y > roadY + roadH + 55) {
        p.y = roadY - 12 - Math.random() * 80;
        p.x = crossX + Math.random() * crossW;
      } else if (p.dir === -1 && p.y < roadY - 55) {
        p.y = roadY + roadH + 12 + Math.random() * 80;
        p.x = crossX + Math.random() * crossW;
      }
    }

    /* ── main loop ── */
    let frame = 0;
    let raf   = 0;

    function loop() {
      frame++;
      lightTick++;
      if (light === 'red'   && lightTick > RED_DUR)   { light = 'green'; lightTick = 0; }
      if (light === 'green' && lightTick > GREEN_DUR) { light = 'red';   lightTick = 0; }

      drawBg();

      if (light === 'red') { cars.forEach(updateCar); cars.forEach(drawCar); }

      drawLight();

      walkers.forEach(updateWalker);
      walkers.forEach(p => {
        const angle = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        drawPerson(ctx, p.x, p.y, p.r, angle, frame, p.phase, p.skinColor, p.clothColor);
      });

      if (light === 'green') { cars.forEach(updateCar); cars.forEach(drawCar); }

      raf = requestAnimationFrame(loop);
    }

    init();
    loop();

    const ro = new ResizeObserver(init);
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
