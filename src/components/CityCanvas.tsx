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
  phase: number;   // leg swing offset (0..2π)
  type: 'sidewalk' | 'cross';
  lane: number;    // fixed y for sidewalk walkers
  dir: 1 | -1;    // for crosswalk: +1 down, -1 up
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
}

interface Tree {
  x: number; y: number;
  r: number;
}

/* ── person drawing ──────────────────────────────────── */
function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  angle: number,   // direction of travel
  frame: number,
  phase: number,
  skin: string, cloth: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);   // head faces direction of travel

  const swing = Math.sin(frame * 0.14 + phase) * r * 0.72;
  const legR  = r * 0.28;
  const dk    = shade(cloth, -35);

  /* drop shadow */
  ctx.globalAlpha = 0.28;
  ctx.fillStyle   = '#000';
  ctx.beginPath();
  ctx.ellipse(r * 0.18, r * 0.2, r * 1.05, r * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  /* left leg */
  ctx.fillStyle = dk;
  ctx.beginPath();
  ctx.ellipse(-r * 0.30, r * 0.55 + swing, legR, r * 0.50, 0.18, 0, Math.PI * 2);
  ctx.fill();

  /* right leg */
  ctx.beginPath();
  ctx.ellipse( r * 0.30, r * 0.55 - swing, legR, r * 0.50, -0.18, 0, Math.PI * 2);
  ctx.fill();

  /* torso */
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.10, r * 0.62, r * 0.56, 0, 0, Math.PI * 2);
  ctx.fill();

  /* head */
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -r * 0.52, r * 0.46, 0, Math.PI * 2);
  ctx.fill();

  /* tiny face highlight */
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

    let light: 'red' | 'green' = 'red';
    let lightTick = 0;
    const RED_DUR   = 310;
    const GREEN_DUR = 230;

    function rand(a: number, b: number) { return a + Math.random() * (b - a); }
    function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

    /* ── init ── */
    function init() {
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

      /* buildings — top area */
      let bx = 0;
      while (bx < W) {
        const bw = rand(50, 130);
        const bh = rand(roadY * 0.35, roadY * 0.78);
        const by = rand(4, roadY * 0.15);
        const lum = rand(14, 26);
        bldgs.push({
          x: bx, y: by, w: bw - 4, h: bh,
          col:     `hsl(${rand(0,30)},${rand(0,8)}%,${lum}%)`,
          roofCol: `hsl(${rand(0,30)},${rand(0,8)}%,${lum + 5}%)`,
        });
        bx += bw + rand(2, 10);
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
        });
        bx += bw + rand(2, 10);
      }

      /* trees on sidewalk edges */
      for (let i = 0; i < 14; i++) {
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

      /* sidewalk walkers */
      for (let i = 0; i < 44; i++) {
        const top  = i < 22;
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
      for (let i = 0; i < 26; i++) {
        const dir = (i < 13 ? 1 : -1) as 1 | -1;
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

    /* ── static background ── */
    function drawBg() {
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(0, 0, W, H);

      /* building footprints */
      for (const b of bldgs) {
        ctx.fillStyle   = b.col;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        /* rooftop edge highlight */
        ctx.fillStyle   = b.roofCol;
        ctx.fillRect(b.x, b.y, b.w, 3);
        ctx.fillRect(b.x, b.y, 3, b.h);
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

      /* trees */
      for (const t of trees) {
        /* shadow */
        ctx.globalAlpha = 0.35;
        ctx.fillStyle   = '#000';
        ctx.beginPath();
        ctx.ellipse(t.x + 3, t.y + 3, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        /* canopy gradient */
        const g = ctx.createRadialGradient(t.x - t.r * 0.2, t.y - t.r * 0.2, 0, t.x, t.y, t.r);
        g.addColorStop(0, 'rgba(40,90,35,0.92)');
        g.addColorStop(1, 'rgba(18,50,15,0.55)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        ctx.fill();
      }

      /* road */
      ctx.fillStyle = '#141414';
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

      for (const [ly, facing] of [[roadY - 10, 'top'], [roadY + roadH + 4, 'bot']] as [number, string][]) {
        /* pole */
        ctx.fillStyle = '#222';
        ctx.fillRect(lx - 1.5, ly, 3, 22);

        /* box */
        ctx.fillStyle = '#181818';
        ctx.beginPath();
        ctx.roundRect(lx - 6, ly, 12, 20, 3);
        ctx.fill();

        /* glow */
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
      /* body */
      ctx.fillStyle = c.bodyCol;
      ctx.beginPath();
      ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 4);
      ctx.fill();

      /* roof highlight */
      ctx.fillStyle = c.accentCol;
      ctx.beginPath();
      ctx.roundRect(c.x - c.w * 0.28, c.y - c.h * 0.36, c.w * 0.50, c.h * 0.70, 2);
      ctx.fill();

      /* windshield glint */
      ctx.fillStyle = 'rgba(160,200,240,0.22)';
      ctx.beginPath();
      ctx.roundRect(c.x - c.w * 0.24, c.y - c.h * 0.30, c.w * 0.42, c.h * 0.58, 2);
      ctx.fill();

      /* tail lights */
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
      /* crosswalk */
      const crossing = light === 'red';
      p.vy += (crossing ? p.dir * 0.62 - p.vy : -p.vy) * 0.07;
      p.vx *= 0.95;
      if (p.x < crossX - 8)        p.vx += 0.04;
      if (p.x > crossX + crossW + 8) p.vx -= 0.04;
      p.x += p.vx; p.y += p.vy;
      /* respawn after crossing */
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

      /* cars behind people when stopped */
      if (light === 'red') { cars.forEach(updateCar); cars.forEach(drawCar); }

      drawLight();

      walkers.forEach(updateWalker);
      walkers.forEach(p => {
        const angle = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        drawPerson(ctx, p.x, p.y, p.r, angle, frame, p.phase, p.skinColor, p.clothColor);
      });

      /* cars on top when rolling */
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
