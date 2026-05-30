'use client';
import { useEffect, useRef } from 'react';

/* ── colour helpers ── */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r + amt)},${Math.min(255, g + amt)},${Math.min(255, b + amt)})`;
}
function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0, r - amt)},${Math.max(0, g - amt)},${Math.max(0, b - amt)})`;
}
function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

/* ── interfaces ── */
interface Ridge { x: number; y: number }
interface SmokeParticle { x: number; y: number; r: number; alpha: number; drift: number }
interface CloudBlob { cx: number; cy: number; rx: number; ry: number }
interface Cloud { blobs: CloudBlob[]; x: number; y: number; speed: number; alpha: number }
interface Building {
  x: number; y: number; w: number; h: number; rh: number;
  wallCol: string; sideCol: string; roofCol: string;
  numWindows: number; hasBalcony: boolean; hasChimney: boolean;
  chimneyX: number; smokeIdx: number;
}
interface Horse { x: number; baseY: number; scale: number; col: string; maneCol: string; dir: 1 | -1; lo: number; hi: number; phase: number; pose: 'stand' | 'graze' }
interface Soldier { x: number; baseY: number; phase: number }
interface FlagState { angle: number }

/* ── ridge generator ── */
function genRidge(W: number, H: number, baseY: number, topY: number, segs: number, seed: number): Ridge[] {
  const pts: Ridge[] = [{ x: 0, y: baseY * 0.88 }];
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const s1 = Math.sin(t * Math.PI * 2.3 + seed) * 0.40;
    const s2 = Math.sin(t * Math.PI * 4.7 + seed * 1.3) * 0.22;
    const s3 = Math.sin(t * Math.PI * 7.1 + seed * 0.7) * 0.12;
    const amp = s1 + s2 + s3;
    const peakBias = Math.sin(t * Math.PI) * 0.55; // taller in middle
    pts.push({ x: W * t, y: topY + (baseY - topY) * (0.08 + 0.92 * (1 - Math.max(0, amp * 0.6 + peakBias * 0.4))) });
  }
  pts.push({ x: W, y: baseY * 0.91 });
  return pts;
}

function strokeRidge(ctx: CanvasRenderingContext2D, pts: Ridge[], W: number, H: number, fillStyle: string | CanvasGradient) {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
}

/* ──────────────────────────────────────────────
   STATIC SCENE DRAWERS
────────────────────────────────────────────── */

function drawSky(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.42);
  g.addColorStop(0,    '#1a0a2e');
  g.addColorStop(0.15, '#2d1b4e');
  g.addColorStop(0.30, '#5c3478');
  g.addColorStop(0.50, '#8b4a8a');
  g.addColorStop(0.68, '#c4705a');
  g.addColorStop(0.84, '#e8924a');
  g.addColorStop(1.0,  '#f0b840');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.44);

  // Sun glow — partially set, right side
  const sunG = ctx.createRadialGradient(W * 0.80, H * 0.26, 0, W * 0.80, H * 0.26, H * 0.28);
  sunG.addColorStop(0,   'rgba(255,230,110,0.72)');
  sunG.addColorStop(0.25,'rgba(255,170,60,0.40)');
  sunG.addColorStop(0.60,'rgba(255,110,30,0.14)');
  sunG.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = sunG;
  ctx.fillRect(0, 0, W, H * 0.44);

  // Horizon warmth band
  const horizG = ctx.createLinearGradient(0, H * 0.30, 0, H * 0.44);
  horizG.addColorStop(0, 'rgba(255,180,60,0)');
  horizG.addColorStop(1, 'rgba(255,200,80,0.28)');
  ctx.fillStyle = horizG;
  ctx.fillRect(0, H * 0.30, W, H * 0.14);
}

function drawCloud(ctx: CanvasRenderingContext2D, cloud: Cloud) {
  ctx.save();
  ctx.globalAlpha = cloud.alpha;
  ctx.translate(cloud.x, cloud.y);
  for (const b of cloud.blobs) {
    const g = ctx.createRadialGradient(b.cx, b.cy - b.ry * 0.2, 0, b.cx, b.cy, Math.max(b.rx, b.ry));
    g.addColorStop(0,   'rgba(255,228,200,0.72)');
    g.addColorStop(0.45,'rgba(220,180,200,0.48)');
    g.addColorStop(0.75,'rgba(180,140,180,0.22)');
    g.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(b.cx, b.cy, b.rx, b.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function makeClouds(W: number, H: number, count: number, seed: number): Cloud[] {
  const clouds: Cloud[] = [];
  for (let i = 0; i < count; i++) {
    const cx = seededRand(seed + i * 7) * W;
    const cy = H * (0.04 + seededRand(seed + i * 13) * 0.18);
    const speed = 0.05 + seededRand(seed + i * 3) * 0.12;
    const alpha = 0.55 + seededRand(seed + i * 5) * 0.30;
    const blobCount = 5 + Math.floor(seededRand(seed + i * 11) * 3);
    const blobs: CloudBlob[] = [];
    const baseRx = W * (0.05 + seededRand(seed + i * 17) * 0.07);
    const baseRy = baseRx * (0.28 + seededRand(seed + i * 19) * 0.20);
    for (let j = 0; j < blobCount; j++) {
      blobs.push({
        cx: (seededRand(seed + i * 23 + j) - 0.5) * baseRx * 2.2,
        cy: (seededRand(seed + i * 29 + j) - 0.5) * baseRy * 1.4,
        rx: baseRx * (0.45 + seededRand(seed + i * 31 + j) * 0.55),
        ry: baseRy * (0.55 + seededRand(seed + i * 37 + j) * 0.45),
      });
    }
    clouds.push({ blobs, x: cx, y: cy, speed, alpha });
  }
  return clouds;
}

function drawMountainLayer(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  pts: Ridge[], colorTop: string, colorBase: string,
  snowColor: string, hazeAlpha: number, pineCol: string | null
) {
  const minY = Math.min(...pts.map(p => p.y));

  // Main fill
  const g = ctx.createLinearGradient(0, minY, 0, H * 0.60);
  g.addColorStop(0, colorTop);
  g.addColorStop(1, colorBase);
  strokeRidge(ctx, pts, W, H, g);

  // Atmospheric haze
  if (hazeAlpha > 0.01) {
    const hazeG = ctx.createLinearGradient(0, minY, 0, H * 0.55);
    hazeG.addColorStop(0, `rgba(220,190,255,${hazeAlpha})`);
    hazeG.addColorStop(0.6, `rgba(255,220,180,${hazeAlpha * 0.4})`);
    hazeG.addColorStop(1, `rgba(255,220,180,0)`);
    strokeRidge(ctx, pts, W, H, hazeG);
  }

  // Snow caps
  const snowLineY = minY + H * 0.038;
  const snowG = ctx.createLinearGradient(0, minY - H * 0.04, 0, snowLineY + H * 0.025);
  snowG.addColorStop(0, snowColor);
  snowG.addColorStop(0.55, 'rgba(255,240,220,0.42)');
  snowG.addColorStop(1, 'rgba(255,235,210,0)');
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, snowLineY);
  ctx.clip();
  strokeRidge(ctx, pts, W, H, snowG);
  ctx.restore();

  // Pine strip at mountain base
  if (pineCol) {
    const baseY = Math.max(...pts.slice(Math.floor(pts.length * 0.1), Math.floor(pts.length * 0.9)).map(p => p.y));
    const stripH = H * 0.055;
    const pineG = ctx.createLinearGradient(0, baseY, 0, baseY + stripH);
    pineG.addColorStop(0, pineCol);
    pineG.addColorStop(1, 'rgba(0,0,0,0)');
    for (let x = 0; x < W; x += W * 0.011) {
      const sr = seededRand(x * 0.017 + 4.2);
      const h = stripH * (0.45 + Math.sin(x * 0.048) * 0.28 + sr * 0.18);
      ctx.fillStyle = pineG;
      ctx.beginPath();
      ctx.moveTo(x, baseY + stripH * 0.08);
      ctx.lineTo(x + W * 0.005, baseY - h * 0.55);
      ctx.lineTo(x + W * 0.011, baseY + stripH * 0.08);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawTerrain(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, H * 0.38, 0, H);
  g.addColorStop(0,   '#8a7040');
  g.addColorStop(0.18,'#7a8840');
  g.addColorStop(0.42,'#4e8030');
  g.addColorStop(1,   '#386020');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.40);
  ctx.quadraticCurveTo(W * 0.22, H * 0.36, W * 0.50, H * 0.40);
  ctx.quadraticCurveTo(W * 0.76, H * 0.43, W, H * 0.39);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Sunset warmth overlay
  const warm = ctx.createLinearGradient(W * 0.55, H * 0.33, 0, H);
  warm.addColorStop(0, 'rgba(255,145,45,0.20)');
  warm.addColorStop(1, 'rgba(255,190,80,0.06)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, H * 0.35, W, H * 0.65);

  // Foreground grass detail — darker strip
  const fgG = ctx.createLinearGradient(0, H * 0.78, 0, H);
  fgG.addColorStop(0, 'rgba(30,60,15,0)');
  fgG.addColorStop(1, 'rgba(20,45,10,0.55)');
  ctx.fillStyle = fgG;
  ctx.fillRect(0, H * 0.78, W, H * 0.22);
}

function drawRiver(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const ry = H * 0.53, rh = H * 0.075;

  const riverG = ctx.createLinearGradient(0, ry, 0, ry + rh);
  riverG.addColorStop(0,   '#2a5878');
  riverG.addColorStop(0.30,'#1e4860');
  riverG.addColorStop(0.70,'#2a6080');
  riverG.addColorStop(1,   '#1a3850');
  ctx.fillStyle = riverG;
  ctx.beginPath();
  ctx.moveTo(0, ry);
  ctx.quadraticCurveTo(W * 0.25, ry - H * 0.009, W * 0.50, ry + H * 0.005);
  ctx.quadraticCurveTo(W * 0.76, ry + H * 0.014, W, ry + H * 0.006);
  ctx.lineTo(W, ry + rh);
  ctx.quadraticCurveTo(W * 0.50, ry + rh + H * 0.009, 0, ry + rh - H * 0.005);
  ctx.closePath();
  ctx.fill();

  // Castle reflection
  const reflG = ctx.createLinearGradient(W * 0.55, ry, W * 0.55, ry + rh);
  reflG.addColorStop(0, 'rgba(200,180,150,0.28)');
  reflG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = reflG;
  ctx.fillRect(W * 0.50, ry, W * 0.50, rh);

  // Sky reflection
  const skyR = ctx.createLinearGradient(0, ry, W, ry);
  skyR.addColorStop(0,   'rgba(255,180,80,0.10)');
  skyR.addColorStop(0.5, 'rgba(255,225,120,0.20)');
  skyR.addColorStop(1,   'rgba(255,200,100,0.13)');
  ctx.fillStyle = skyR;
  ctx.fillRect(0, ry, W, rh * 0.45);

  // Banks
  const bankTop = ctx.createLinearGradient(0, ry - H * 0.016, 0, ry);
  bankTop.addColorStop(0, '#8a7040'); bankTop.addColorStop(1, '#b09060');
  ctx.fillStyle = bankTop;
  ctx.fillRect(0, ry - H * 0.018, W, H * 0.020);

  const bankBot = ctx.createLinearGradient(0, ry + rh, 0, ry + rh + H * 0.018);
  bankBot.addColorStop(0, '#a08850'); bankBot.addColorStop(1, '#6a7038');
  ctx.fillStyle = bankBot;
  ctx.fillRect(0, ry + rh, W, H * 0.020);
}

function drawBridge(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const ry = H * 0.53, rh = H * 0.075;
  const bx = W * 0.37, bw = W * 0.13, bh = H * 0.033;

  // Save so we can use compositing
  ctx.save();

  const bridgeG = ctx.createLinearGradient(bx, ry - bh, bx, ry + rh + H * 0.01);
  bridgeG.addColorStop(0, '#c8a878');
  bridgeG.addColorStop(1, '#a08860');
  ctx.fillStyle = bridgeG;
  ctx.fillRect(bx, ry - bh, bw, bh + rh + H * 0.012);

  // Punch out arches
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 3; i++) {
    const ax = bx + bw * 0.08 + i * (bw * 0.29);
    const aw = bw * 0.24;
    const ah = rh * 0.88;
    const ay = ry + rh * 0.04;
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath();
    ctx.moveTo(ax, ay + ah);
    ctx.lineTo(ax, ay + ah * 0.36);
    ctx.arc(ax + aw / 2, ay + ah * 0.36, aw / 2, Math.PI, 0);
    ctx.lineTo(ax + aw, ay + ah);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // Parapet top
  ctx.fillStyle = '#a89060';
  ctx.fillRect(bx, ry - bh - H * 0.013, bw, H * 0.013);
  ctx.fillStyle = '#987850';
  for (let i = 0; i < 9; i++) {
    ctx.fillRect(bx + bw * (i / 8) - 2, ry - bh - H * 0.030, 4, H * 0.018);
  }
}

function drawAlpineRoof(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, bw: number, roofH: number,
  roofCol: string, sideShift: number
) {
  const sideW = bw * 0.14;

  // Front face gradient
  const g = ctx.createLinearGradient(bx, by - roofH, bx + bw, by);
  g.addColorStop(0,   darken(roofCol, 25));
  g.addColorStop(0.38, lighten(roofCol, 18));
  g.addColorStop(1,   darken(roofCol, 10));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(bx - 4, by);
  ctx.quadraticCurveTo(bx + bw * 0.28, by - roofH * 0.88, bx + bw / 2, by - roofH);
  ctx.quadraticCurveTo(bx + bw * 0.72, by - roofH * 0.88, bx + bw + 4, by);
  ctx.closePath();
  ctx.fill();

  // Side face (3D depth)
  ctx.fillStyle = darken(roofCol, 35);
  ctx.beginPath();
  ctx.moveTo(bx + bw + 4, by);
  ctx.quadraticCurveTo(bx + bw * 0.72, by - roofH * 0.88, bx + bw / 2, by - roofH);
  ctx.lineTo(bx + bw / 2 + sideW, by - roofH * 0.84 + sideShift);
  ctx.lineTo(bx + bw + 4 + sideW, by - roofH * 0.12 + sideShift);
  ctx.closePath();
  ctx.fill();

  // Snow on roof
  const snowDepth = roofH * 0.20;
  const snowG = ctx.createLinearGradient(bx, by - snowDepth * 2.4, bx, by);
  snowG.addColorStop(0, 'rgba(245,250,255,0.96)');
  snowG.addColorStop(0.5,'rgba(220,238,255,0.72)');
  snowG.addColorStop(1, 'rgba(200,220,255,0)');
  ctx.fillStyle = snowG;
  ctx.beginPath();
  const steps = 9;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const sx = bx + bw * t;
    const baseSlope = (1 - Math.abs(t - 0.5) * 2) * roofH;
    const snowSag = snowDepth * (0.58 + Math.sin(t * Math.PI * 3.2) * 0.22);
    if (i === 0) {
      ctx.moveTo(sx - 4, by - snowSag * 0.25);
    } else {
      const pt = (i - 1) / steps;
      const mx = bx + bw * (pt + t) / 2;
      const mBase = (1 - Math.abs((pt + t) / 2 - 0.5) * 2) * roofH;
      const mSnow = snowDepth * (0.58 + Math.sin((pt + t) / 2 * Math.PI * 3.2) * 0.22);
      ctx.quadraticCurveTo(mx, by - mBase - mSnow, sx, by - baseSlope - snowSag);
    }
  }
  ctx.lineTo(bx + bw + 4 + snowDepth * 0.28, by - snowDepth * 0.18);
  ctx.lineTo(bx - 4 - snowDepth * 0.28, by - snowDepth * 0.18);
  ctx.closePath();
  ctx.fill();
}

function drawWindow(ctx: CanvasRenderingContext2D, wx: number, wy: number, ww: number, wh: number) {
  // Frame
  ctx.fillStyle = '#5a3818';
  ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);

  // Warm glass
  const wg = ctx.createRadialGradient(wx + ww / 2, wy + wh * 0.38, 0, wx + ww / 2, wy + wh / 2, ww * 0.95);
  wg.addColorStop(0,   'rgba(255,230,105,0.96)');
  wg.addColorStop(0.5, 'rgba(255,185,62,0.78)');
  wg.addColorStop(1,   'rgba(255,140,40,0.42)');
  ctx.fillStyle = wg;
  ctx.fillRect(wx, wy, ww, wh);

  // Light bleed
  const bleed = ctx.createRadialGradient(wx + ww / 2, wy + wh / 2, 0, wx + ww / 2, wy + wh / 2, ww * 3.8);
  bleed.addColorStop(0, 'rgba(255,185,62,0.16)');
  bleed.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bleed;
  ctx.fillRect(wx - ww * 2.5, wy - wh * 2, ww * 6, wh * 5);

  // Cross divider
  ctx.strokeStyle = 'rgba(120,80,30,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(wx + ww / 2, wy);
  ctx.lineTo(wx + ww / 2, wy + wh);
  ctx.moveTo(wx, wy + wh / 2);
  ctx.lineTo(wx + ww, wy + wh / 2);
  ctx.stroke();
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, H: number) {
  const sideW = b.w * 0.13;

  ctx.shadowColor = 'rgba(20,10,5,0.30)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 6;

  // Front wall
  const wallG = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
  wallG.addColorStop(0, b.wallCol);
  wallG.addColorStop(1, b.sideCol);
  ctx.fillStyle = wallG;
  ctx.fillRect(b.x, b.y, b.w, b.h);

  // Side wall
  const sideG = ctx.createLinearGradient(b.x + b.w, b.y, b.x + b.w + sideW, b.y + b.h);
  sideG.addColorStop(0, b.sideCol);
  sideG.addColorStop(1, darken(b.sideCol, 20));
  ctx.fillStyle = sideG;
  ctx.beginPath();
  ctx.moveTo(b.x + b.w,         b.y);
  ctx.lineTo(b.x + b.w + sideW, b.y - b.rh * 0.15);
  ctx.lineTo(b.x + b.w + sideW, b.y + b.h - b.rh * 0.15);
  ctx.lineTo(b.x + b.w,         b.y + b.h);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  // Roof
  drawAlpineRoof(ctx, b.x, b.y, b.w, b.rh, b.roofCol, 0);

  // Chimney
  if (b.hasChimney) {
    const chX = b.x + b.chimneyX * b.w;
    const chW = b.w * 0.10, chH = b.rh * 0.55;
    const chY = b.y - chH;
    const chG = ctx.createLinearGradient(chX, chY, chX + chW, chY + chH);
    chG.addColorStop(0, '#8a7060'); chG.addColorStop(1, '#6a5040');
    ctx.fillStyle = chG;
    ctx.fillRect(chX, chY, chW, chH);
    ctx.fillStyle = '#7a6050';
    ctx.fillRect(chX - 2, chY, chW + 4, chH * 0.12);
  }

  // Windows
  const ww = b.w * 0.20, wh = b.h * 0.23;
  const wy = b.y + b.h * 0.20;
  const positions = b.numWindows === 2 ? [0.15, 0.58] : [0.12, 0.42, 0.72];
  for (const wx of positions) {
    drawWindow(ctx, b.x + b.w * wx, wy, ww, wh);
  }

  // Door
  const dx = b.x + b.w * 0.38, dw = b.w * 0.24, dh = b.h * 0.42;
  const dy = b.y + b.h - dh;
  ctx.fillStyle = '#7a4820';
  ctx.beginPath();
  ctx.moveTo(dx, b.y + b.h);
  ctx.lineTo(dx, dy + dh * 0.28);
  ctx.arc(dx + dw / 2, dy + dh * 0.28, dw / 2, Math.PI, 0);
  ctx.lineTo(dx + dw, b.y + b.h);
  ctx.closePath();
  ctx.fill();
  // Door handle
  ctx.fillStyle = '#d4a830';
  ctx.beginPath(); ctx.arc(dx + dw * 0.70, b.y + b.h * 0.80, 2.5, 0, Math.PI * 2); ctx.fill();

  // Balcony
  if (b.hasBalcony) {
    const balY = b.y + b.h * 0.15, balW = b.w * 0.55, balX = b.x + b.w * 0.20;
    ctx.fillStyle = darken(b.wallCol, 15);
    ctx.fillRect(balX - 3, balY + H * 0.038, balW + 6, H * 0.011);
    ctx.strokeStyle = darken(b.wallCol, 20); ctx.lineWidth = 1.5;
    for (let pi = 0; pi <= 4; pi++) {
      ctx.beginPath();
      ctx.moveTo(balX + balW * (pi / 4), balY);
      ctx.lineTo(balX + balW * (pi / 4), balY + H * 0.038);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(balX, balY); ctx.lineTo(balX + balW, balY); ctx.stroke();
    // Flower box
    ctx.fillStyle = '#8a3018';
    ctx.fillRect(balX + balW * 0.10, balY + H * 0.022, balW * 0.80, H * 0.014);
    const flG = ctx.createLinearGradient(balX, balY + H * 0.020, balX, balY + H * 0.040);
    flG.addColorStop(0, '#e84040'); flG.addColorStop(1, '#c02828');
    ctx.fillStyle = flG;
    for (let fi = 0; fi < 5; fi++) {
      ctx.beginPath();
      ctx.arc(balX + balW * (0.15 + fi * 0.16), balY + H * 0.024, H * 0.007, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Horizontal timber beams
  ctx.strokeStyle = 'rgba(80,50,20,0.25)';
  ctx.lineWidth = 1;
  for (let bi = 1; bi < 4; bi++) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h * (bi / 4));
    ctx.lineTo(b.x + b.w, b.y + b.h * (bi / 4));
    ctx.stroke();
  }
}

function drawChurch(ctx: CanvasRenderingContext2D, cx: number, baseY: number, w: number, h: number) {
  const wallG = ctx.createLinearGradient(cx, baseY - h, cx + w, baseY);
  wallG.addColorStop(0, '#e0dcd0');
  wallG.addColorStop(1, '#c0b8a0');
  ctx.shadowColor = 'rgba(20,10,5,0.28)'; ctx.shadowBlur = 12; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 7;
  ctx.fillStyle = wallG;
  ctx.fillRect(cx, baseY - h, w, h);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  // Stone texture
  ctx.strokeStyle = 'rgba(100,85,65,0.14)'; ctx.lineWidth = 1;
  for (let ly = baseY - h + 12; ly < baseY; ly += 12) {
    ctx.beginPath(); ctx.moveTo(cx, ly); ctx.lineTo(cx + w, ly); ctx.stroke();
  }

  // Arched window
  const awx = cx + w * 0.26, awy = baseY - h * 0.55, aww = w * 0.48;
  const awh = h * 0.32;
  ctx.fillStyle = 'rgba(180,215,255,0.60)';
  ctx.beginPath();
  ctx.moveTo(awx, baseY - h * 0.25);
  ctx.lineTo(awx, awy + awh * 0.38);
  ctx.arc(awx + aww / 2, awy + awh * 0.38, aww / 2, Math.PI, 0);
  ctx.lineTo(awx + aww, baseY - h * 0.25);
  ctx.closePath();
  ctx.fill();
  // Window warm glow
  const awBleed = ctx.createRadialGradient(awx + aww / 2, awy + awh * 0.6, 0, awx + aww / 2, awy + awh * 0.6, aww * 2.5);
  awBleed.addColorStop(0, 'rgba(255,200,80,0.14)'); awBleed.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = awBleed;
  ctx.fillRect(awx - aww, awy - awh, aww * 3, awh * 3);

  // Bell tower
  const tx = cx + w * 0.32, tw = w * 0.36;
  const towerG = ctx.createLinearGradient(tx, baseY - h * 1.78, tx + tw, baseY - h);
  towerG.addColorStop(0, '#d0c8b0'); towerG.addColorStop(1, '#b0a888');
  ctx.fillStyle = towerG;
  ctx.fillRect(tx, baseY - h * 1.78, tw, h * 0.80);

  // Tower stone lines
  for (let ly = baseY - h * 1.76; ly < baseY - h; ly += 12) {
    ctx.beginPath(); ctx.moveTo(tx, ly); ctx.lineTo(tx + tw, ly); ctx.stroke();
  }

  // Bell arch openings
  ctx.fillStyle = 'rgba(20,12,6,0.62)';
  ctx.beginPath();
  ctx.arc(tx + tw / 2, baseY - h * 1.30, tw * 0.27, 0, Math.PI * 2);
  ctx.fill();

  // Spire
  const spireG = ctx.createLinearGradient(tx + tw / 2, baseY - h * 2.58, tx + tw, baseY - h * 1.78);
  spireG.addColorStop(0, '#282e38'); spireG.addColorStop(1, '#404858');
  ctx.fillStyle = spireG;
  ctx.beginPath();
  ctx.moveTo(tx + tw / 2, baseY - h * 2.58);
  ctx.quadraticCurveTo(tx + tw * 0.30, baseY - h * 2.10, tx - 3, baseY - h * 1.78);
  ctx.lineTo(tx + tw + 3, baseY - h * 1.78);
  ctx.quadraticCurveTo(tx + tw * 0.70, baseY - h * 2.10, tx + tw / 2, baseY - h * 2.58);
  ctx.closePath();
  ctx.fill();

  // Cross at spire tip
  ctx.strokeStyle = '#f0e8d0'; ctx.lineWidth = 2.5;
  const crossX = tx + tw / 2, crossY = baseY - h * 2.62;
  ctx.beginPath();
  ctx.moveTo(crossX, crossY - 10); ctx.lineTo(crossX, crossY + 7);
  ctx.moveTo(crossX - 6, crossY - 4); ctx.lineTo(crossX + 6, crossY - 4);
  ctx.stroke();

  // Church roof (main body)
  drawAlpineRoof(ctx, cx, baseY - h, w, h * 0.36, '#303840', 0);
}

function drawTower(
  ctx: CanvasRenderingContext2D,
  tx: number, ty: number, tw: number, th: number,
  H: number, conical: boolean
) {
  // Shadow
  ctx.shadowColor = 'rgba(30,15,5,0.38)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 8;

  const wallG = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
  wallG.addColorStop(0,   '#c8b898');
  wallG.addColorStop(0.45,'#a89878');
  wallG.addColorStop(1,   '#887858');
  ctx.fillStyle = wallG;
  ctx.fillRect(tx, ty, tw, th);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  // Stone lines
  ctx.strokeStyle = 'rgba(80,60,40,0.12)'; ctx.lineWidth = 1;
  for (let ly = ty + 13; ly < ty + th; ly += 13) {
    ctx.beginPath(); ctx.moveTo(tx, ly); ctx.lineTo(tx + tw, ly); ctx.stroke();
  }

  // Crenellations
  const mW = Math.max(5, tw / 7), mH = th * 0.055, gW = mW * 0.7;
  ctx.fillStyle = '#9a8868';
  let cx2 = tx;
  while (cx2 < tx + tw) {
    ctx.fillRect(cx2, ty - mH, Math.min(mW, tx + tw - cx2), mH);
    cx2 += mW + gW;
  }

  // Arrow slits
  const slitW = Math.max(4, tw * 0.11), slitH = th * 0.075;
  for (let row = 0; row < 3; row++) {
    const wy = ty + th * (0.18 + row * 0.26);
    for (const col of [0.30, 0.70]) {
      ctx.fillStyle = '#201808';
      ctx.beginPath();
      ctx.moveTo(tx + tw * col - slitW / 2, wy + slitH * 0.38);
      ctx.arc(tx + tw * col, wy + slitH * 0.38, slitW / 2, Math.PI, 0);
      ctx.lineTo(tx + tw * col + slitW / 2, wy + slitH);
      ctx.lineTo(tx + tw * col - slitW / 2, wy + slitH);
      ctx.closePath();
      ctx.fill();
      // Glow
      const wg = ctx.createRadialGradient(tx + tw * col, wy + slitH * 0.65, 0, tx + tw * col, wy + slitH * 0.65, slitW * 2.2);
      wg.addColorStop(0, 'rgba(255,200,80,0.20)'); wg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.arc(tx + tw * col, wy + slitH * 0.65, slitW * 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Conical roof
  if (conical) {
    const rh = th * 0.36;
    const rg = ctx.createLinearGradient(tx, ty - rh, tx + tw, ty);
    rg.addColorStop(0, '#1a2030'); rg.addColorStop(1, '#2a3242');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(tx + tw / 2, ty - rh);
    ctx.quadraticCurveTo(tx + tw * 0.72, ty - rh * 0.28, tx + tw + 2, ty);
    ctx.lineTo(tx - 2, ty);
    ctx.quadraticCurveTo(tx + tw * 0.28, ty - rh * 0.28, tx + tw / 2, ty - rh);
    ctx.closePath();
    ctx.fill();

    // Flag pole
    const fpx = tx + tw / 2;
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(fpx, ty - rh - H * 0.016); ctx.lineTo(fpx, ty - rh); ctx.stroke();
  }
}

function drawCastle(ctx: CanvasRenderingContext2D, W: number, H: number, cX: number, cBY: number, cW: number, frame: number): { balX: number; balY: number; kX: number; kW: number } {
  // Rocky cliff base
  const cliffG = ctx.createLinearGradient(cX, cBY - H * 0.065, cX + cW, cBY + H * 0.05);
  cliffG.addColorStop(0, '#9a8868');
  cliffG.addColorStop(0.5,'#7a6848');
  cliffG.addColorStop(1, '#5a4828');
  ctx.fillStyle = cliffG;
  ctx.beginPath();
  ctx.moveTo(cX - W * 0.018, cBY + H * 0.04);
  ctx.quadraticCurveTo(cX + W * 0.005, cBY - H * 0.055, cX + cW * 0.18, cBY - H * 0.065);
  ctx.quadraticCurveTo(cX + cW * 0.50, cBY - H * 0.085, cX + cW * 0.82, cBY - H * 0.060);
  ctx.quadraticCurveTo(cX + cW - W * 0.005, cBY - H * 0.048, cX + cW + W * 0.018, cBY + H * 0.04);
  ctx.lineTo(cX + cW + W * 0.04, cBY + H * 0.08);
  ctx.lineTo(cX - W * 0.04, cBY + H * 0.08);
  ctx.closePath();
  ctx.fill();

  // Walls
  const wallTop = cBY - H * 0.27;
  function sg() {
    const g = ctx.createLinearGradient(cX, wallTop, cX + cW, cBY);
    g.addColorStop(0, '#b8a888'); g.addColorStop(0.5,'#9a8878'); g.addColorStop(1,'#7a6858'); return g;
  }
  function battl(bx: number, by: number, bw: number, mw: number, mh: number, gw: number) {
    let px = bx;
    ctx.fillStyle = '#9a8868';
    while (px < bx + bw) { ctx.fillRect(px, by - mh, Math.min(mw, bx + bw - px), mh); px += mw + gw; }
  }
  function stoneLines(x: number, y: number, w: number, h: number) {
    ctx.strokeStyle = 'rgba(0,0,0,0.09)'; ctx.lineWidth = 1;
    for (let ly = y + 14; ly < y + h; ly += 14) { ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + w, ly); ctx.stroke(); }
  }

  const kW = cW * 0.30, kX = cX + cW * 0.35;

  // Left wall
  const lwX = cX + W * 0.008, lwW = kX - lwX - W * 0.005;
  ctx.fillStyle = sg(); ctx.fillRect(lwX, wallTop, lwW, cBY - wallTop);
  stoneLines(lwX, wallTop, lwW, cBY - wallTop);
  battl(lwX, wallTop, lwW, W * 0.014, H * 0.022, W * 0.010);

  // Gate arch
  const gX = lwX + lwW * 0.48 - W * 0.022, gW = W * 0.044, gH = H * 0.14;
  const gY = cBY - gH;
  ctx.fillStyle = '#201808';
  ctx.beginPath();
  ctx.moveTo(gX, cBY); ctx.lineTo(gX, gY + gH * 0.30);
  ctx.arc(gX + gW / 2, gY + gH * 0.30, gW / 2, Math.PI, 0);
  ctx.lineTo(gX + gW, cBY); ctx.closePath(); ctx.fill();
  // Gate portcullis lines
  ctx.strokeStyle = '#483828'; ctx.lineWidth = 1.8;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(gX + gW * (i / 4), gY + gH * 0.30 - gW / 2); ctx.lineTo(gX + gW * (i / 4), cBY); ctx.stroke();
  }
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(gX, gY + gH * (0.30 + i * 0.25)); ctx.lineTo(gX + gW, gY + gH * (0.30 + i * 0.25)); ctx.stroke();
  }

  // Right wall
  const rwX = kX + kW + W * 0.005, rwW = cX + cW - W * 0.008 - rwX;
  ctx.fillStyle = sg(); ctx.fillRect(rwX, wallTop, rwW, cBY - wallTop);
  stoneLines(rwX, wallTop, rwW, cBY - wallTop);
  battl(rwX, wallTop, rwW, W * 0.014, H * 0.022, W * 0.010);

  // Left tower
  const ltW = W * 0.038, ltX = cX + W * 0.004;
  const ltTop = cBY - H * 0.38;
  drawTower(ctx, ltX, ltTop, ltW, cBY - ltTop, H, true);

  // Right tower
  const rtX = cX + cW - ltW - W * 0.004;
  const rtTop = cBY - H * 0.35;
  drawTower(ctx, rtX, rtTop, ltW, cBY - rtTop, H, true);

  // Main Keep
  const kTop = cBY - H * 0.50;
  ctx.shadowColor = 'rgba(20,10,5,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 10;
  const keepG = ctx.createLinearGradient(kX, kTop, kX + kW, cBY);
  keepG.addColorStop(0, '#c0b090'); keepG.addColorStop(0.5,'#a89878'); keepG.addColorStop(1,'#887858');
  ctx.fillStyle = keepG; ctx.fillRect(kX, kTop, kW, cBY - kTop);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  stoneLines(kX, kTop, kW, cBY - kTop);

  // Keep windows
  for (let si = 0; si < 5; si++) {
    const cols = si % 2 === 0 ? [kW * 0.22, kW * 0.66] : [kW * 0.44];
    for (const col of cols) {
      drawWindow(ctx, kX + col, kTop + (cBY - kTop) * (0.10 + si * 0.15), kW * 0.11, H * 0.042);
    }
  }
  battl(kX, kTop, kW, W * 0.018, H * 0.028, W * 0.012);

  // Keep conical roof
  const krH = (cBY - kTop) * 0.28;
  const krg = ctx.createLinearGradient(kX, kTop - krH, kX + kW, kTop);
  krg.addColorStop(0, '#1e2530'); krg.addColorStop(1, '#344050');
  ctx.fillStyle = krg;
  ctx.beginPath();
  ctx.moveTo(kX + kW / 2, kTop - krH);
  ctx.quadraticCurveTo(kX + kW * 0.72, kTop - krH * 0.28, kX + kW + 3, kTop);
  ctx.lineTo(kX - 3, kTop);
  ctx.quadraticCurveTo(kX + kW * 0.28, kTop - krH * 0.28, kX + kW / 2, kTop - krH);
  ctx.closePath();
  ctx.fill();

  // Balcony on keep
  const balY = kTop + (cBY - kTop) * 0.28;
  const balW = kW * 0.60, balX = kX + kW * 0.20;
  ctx.fillStyle = '#a89070';
  ctx.fillRect(balX - 4, balY + H * 0.042, balW + 8, H * 0.012);
  ctx.strokeStyle = '#9a8060'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(balX, balY); ctx.lineTo(balX + balW, balY); ctx.stroke();
  for (let pi = 0; pi <= 6; pi++) {
    ctx.beginPath(); ctx.moveTo(balX + balW * (pi / 6), balY); ctx.lineTo(balX + balW * (pi / 6), balY + H * 0.042); ctx.stroke();
  }

  // Animated flag on keep
  const fpx = kX + kW / 2;
  const fpt = kTop - krH - H * 0.018;
  ctx.strokeStyle = '#888'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(fpx, fpt); ctx.lineTo(fpx, kTop - krH); ctx.stroke();
  const fw = Math.sin(frame * 0.038) * 6;
  const fg = ctx.createLinearGradient(fpx, fpt, fpx + W * 0.040, fpt);
  fg.addColorStop(0, '#c82010'); fg.addColorStop(1, '#a01808');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(fpx, fpt);
  ctx.lineTo(fpx + W * 0.040 + fw, fpt + H * 0.009 + fw * 0.28);
  ctx.lineTo(fpx + W * 0.036 + fw * 0.8, fpt + H * 0.020);
  ctx.lineTo(fpx, fpt + H * 0.018);
  ctx.closePath();
  ctx.fill();

  return { balX, balY, kX, kW };
}

function drawPrincess(ctx: CanvasRenderingContext2D, balX: number, balY: number, kX: number, kW: number, H: number, frame: number) {
  const ph = H * 0.068;
  const pX = kX + kW * 0.50;
  const pBase = balY;
  const wave = Math.sin(frame * 0.022) * 0.30;

  // Gown — dark navy/blue as specified
  const dg = ctx.createLinearGradient(pX, pBase - ph, pX, pBase);
  dg.addColorStop(0, '#2030a0');
  dg.addColorStop(0.5, '#1828b8');
  dg.addColorStop(1, '#1020c0');
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.moveTo(pX, pBase);
  ctx.quadraticCurveTo(pX - ph * 0.34, pBase - ph * 0.36, pX - ph * 0.14, pBase - ph * 0.70);
  ctx.lineTo(pX, pBase - ph * 0.72);
  ctx.lineTo(pX + ph * 0.14, pBase - ph * 0.70);
  ctx.quadraticCurveTo(pX + ph * 0.34, pBase - ph * 0.36, pX, pBase);
  ctx.closePath();
  ctx.fill();

  // Skin — face
  ctx.fillStyle = '#f0d0a8';
  ctx.beginPath(); ctx.arc(pX, pBase - ph * 0.88, ph * 0.135, 0, Math.PI * 2); ctx.fill();

  // Dark hair
  ctx.fillStyle = '#2a1505';
  ctx.beginPath();
  ctx.arc(pX, pBase - ph * 0.91, ph * 0.155, Math.PI, 0);
  ctx.quadraticCurveTo(pX + ph * 0.22, pBase - ph * 0.60, pX + ph * 0.14, pBase - ph * 0.48);
  ctx.quadraticCurveTo(pX - ph * 0.04, pBase - ph * 0.56, pX - ph * 0.22, pBase - ph * 0.55);
  ctx.closePath();
  ctx.fill();
  // Hair flowing behind
  ctx.beginPath();
  ctx.moveTo(pX - ph * 0.08, pBase - ph * 0.96);
  ctx.quadraticCurveTo(pX - ph * 0.35, pBase - ph * 0.75, pX - ph * 0.28, pBase - ph * 0.50);
  ctx.quadraticCurveTo(pX - ph * 0.14, pBase - ph * 0.42, pX - ph * 0.06, pBase - ph * 0.50);
  ctx.fill();

  // Arm on railing
  ctx.save();
  ctx.translate(pX + ph * 0.12, pBase - ph * 0.76);
  ctx.rotate(-0.36 + wave);
  ctx.strokeStyle = '#2030a0'; ctx.lineWidth = ph * 0.10;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ph * 0.28, -ph * 0.18); ctx.stroke();
  ctx.fillStyle = '#f0d0a8';
  ctx.beginPath(); ctx.arc(ph * 0.28, -ph * 0.18, ph * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  void balX;
}

function drawSoldier(ctx: CanvasRenderingContext2D, sx: number, sy: number, ph: number, frame: number, phase: number) {
  const swing = Math.sin(frame * 0.055 + phase) * ph * 0.24;
  const bob   = Math.abs(Math.sin(frame * 0.055 + phase)) * ph * 0.032;
  const y = sy - bob;

  // Shadow
  ctx.globalAlpha = 0.20;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(sx, sy, ph * 0.28, ph * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // Legs
  for (const [side, lsw] of [[-1, swing], [1, -swing]] as [number, number][]) {
    const legG = ctx.createLinearGradient(sx + side * ph * 0.11, y - ph * 0.42, sx + side * ph * 0.11, y);
    legG.addColorStop(0, '#8090a0'); legG.addColorStop(1, '#505860');
    ctx.fillStyle = legG;
    ctx.beginPath();
    ctx.ellipse(sx + side * ph * 0.11 + lsw * 0.14, y - ph * 0.10 + Math.abs(lsw) * 0.08, ph * 0.08, ph * 0.22, lsw * 0.10, 0, Math.PI * 2);
    ctx.fill();
    // Sabaton
    ctx.fillStyle = '#606870';
    ctx.beginPath();
    ctx.ellipse(sx + side * ph * 0.11 + lsw * 0.28, y - ph * 0.01, ph * 0.11, ph * 0.054, 0.15 * side, 0, Math.PI * 2);
    ctx.fill();
  }

  // Body plate armor
  const bodyG = ctx.createLinearGradient(sx - ph * 0.18, y - ph * 0.72, sx + ph * 0.18, y - ph * 0.32);
  bodyG.addColorStop(0,   '#c8c0b0');
  bodyG.addColorStop(0.30,'#a0a8b0');
  bodyG.addColorStop(0.70,'#707880');
  bodyG.addColorStop(1,   '#505860');
  ctx.fillStyle = bodyG;
  ctx.beginPath(); ctx.ellipse(sx, y - ph * 0.50, ph * 0.15, ph * 0.22, 0, 0, Math.PI * 2); ctx.fill();

  // Pauldrons
  ctx.fillStyle = '#9098a8';
  ctx.beginPath(); ctx.ellipse(sx - ph * 0.18, y - ph * 0.62, ph * 0.10, ph * 0.07, 0.30, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx + ph * 0.18, y - ph * 0.62, ph * 0.10, ph * 0.07, -0.30, 0, Math.PI * 2); ctx.fill();

  // Shield (left)
  const shieldG = ctx.createLinearGradient(sx - ph * 0.34, y - ph * 0.62, sx - ph * 0.18, y - ph * 0.28);
  shieldG.addColorStop(0, '#9a3020'); shieldG.addColorStop(1, '#702010');
  ctx.fillStyle = shieldG;
  ctx.beginPath();
  ctx.moveTo(sx - ph * 0.20, y - ph * 0.65);
  ctx.lineTo(sx - ph * 0.36, y - ph * 0.65);
  ctx.quadraticCurveTo(sx - ph * 0.42, y - ph * 0.42, sx - ph * 0.30, y - ph * 0.28);
  ctx.quadraticCurveTo(sx - ph * 0.20, y - ph * 0.22, sx - ph * 0.18, y - ph * 0.30);
  ctx.closePath(); ctx.fill();
  // Shield cross
  ctx.strokeStyle = '#d4a830'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx - ph * 0.29, y - ph * 0.62); ctx.lineTo(sx - ph * 0.29, y - ph * 0.34);
  ctx.moveTo(sx - ph * 0.39, y - ph * 0.48); ctx.lineTo(sx - ph * 0.19, y - ph * 0.48);
  ctx.stroke();

  // Spear
  ctx.strokeStyle = '#8a6030'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx + ph * 0.22, y - ph * 0.30); ctx.lineTo(sx + ph * 0.24, y - ph * 1.32); ctx.stroke();
  const spG = ctx.createLinearGradient(sx + ph * 0.16, y - ph * 1.32, sx + ph * 0.30, y - ph * 1.10);
  spG.addColorStop(0, '#d8d0c0'); spG.addColorStop(1, '#a0a8b0');
  ctx.fillStyle = spG;
  ctx.beginPath();
  ctx.moveTo(sx + ph * 0.24, y - ph * 1.34);
  ctx.quadraticCurveTo(sx + ph * 0.16, y - ph * 1.20, sx + ph * 0.21, y - ph * 1.10);
  ctx.quadraticCurveTo(sx + ph * 0.30, y - ph * 1.20, sx + ph * 0.24, y - ph * 1.34);
  ctx.closePath(); ctx.fill();

  // Helmet
  const helmG = ctx.createRadialGradient(sx - ph * 0.05, y - ph * 0.84, 0, sx, y - ph * 0.80, ph * 0.18);
  helmG.addColorStop(0, '#e0d8c8');
  helmG.addColorStop(0.40,'#b0b0b8');
  helmG.addColorStop(0.80,'#888090');
  helmG.addColorStop(1,   '#606070');
  ctx.fillStyle = helmG;
  ctx.beginPath(); ctx.arc(sx, y - ph * 0.80, ph * 0.18, 0, Math.PI * 2); ctx.fill();
  // Visor slit
  ctx.fillStyle = 'rgba(15,10,5,0.62)';
  ctx.beginPath(); ctx.ellipse(sx, y - ph * 0.78, ph * 0.14, ph * 0.040, 0, 0, Math.PI * 2); ctx.fill();
  // Visor grate lines
  ctx.strokeStyle = 'rgba(30,25,20,0.5)'; ctx.lineWidth = 1;
  for (let gi = -1; gi <= 1; gi++) {
    ctx.beginPath();
    ctx.moveTo(sx - ph * 0.14, y - ph * 0.78 + gi * ph * 0.020);
    ctx.lineTo(sx + ph * 0.14, y - ph * 0.78 + gi * ph * 0.020);
    ctx.stroke();
  }
  // Plume
  ctx.strokeStyle = '#c82010'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(sx, y - ph * 0.98);
  ctx.quadraticCurveTo(sx + ph * 0.13, y - ph * 1.10, sx + ph * 0.07, y - ph * 0.94);
  ctx.stroke();
}

function drawHorse(
  ctx: CanvasRenderingContext2D,
  hx: number, hy: number, scale: number,
  col: string, maneCol: string, dir: 1 | -1,
  pose: 'stand' | 'graze', frame: number, phase: number
) {
  const s = scale;
  const ls = Math.sin(frame * 0.040 + phase) * s * 0.22;

  ctx.save();
  ctx.translate(hx, hy);
  ctx.scale(dir, 1);

  // Shadow
  ctx.globalAlpha = 0.20;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.58, s * 0.10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // Legs
  const legPairs: [number, number][] = [[-s * 0.27, ls], [-s * 0.09, -ls], [s * 0.11, ls * 0.9], [s * 0.27, -ls * 0.9]];
  for (const [lx, lsw] of legPairs) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(lx + lsw * 0.18, -s * 0.13, s * 0.076, s * 0.22, lsw * 0.08, 0, Math.PI * 2); ctx.fill();
    // Lower leg
    ctx.beginPath(); ctx.ellipse(lx + lsw * 0.34, -s * 0.02, s * 0.058, s * 0.18, lsw * 0.04, 0, Math.PI * 2); ctx.fill();
    // Hoof
    ctx.fillStyle = '#1a1208';
    ctx.beginPath(); ctx.ellipse(lx + lsw * 0.40, s * 0.11, s * 0.068, s * 0.048, 0.12, 0, Math.PI * 2); ctx.fill();
  }

  // Body
  const bodyG = ctx.createLinearGradient(-s * 0.48, -s * 0.52, s * 0.48, -s * 0.10);
  bodyG.addColorStop(0, lighten(col, 55));
  bodyG.addColorStop(0.45, col);
  bodyG.addColorStop(1, darken(col, 28));
  ctx.fillStyle = bodyG;
  ctx.beginPath(); ctx.ellipse(0, -s * 0.32, s * 0.50, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  // Hindquarters
  ctx.beginPath(); ctx.ellipse(s * 0.28, -s * 0.28, s * 0.26, s * 0.20, 0.18, 0, Math.PI * 2); ctx.fill();

  // Neck + head
  if (pose === 'graze') {
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, -s * 0.48);
    ctx.bezierCurveTo(-s * 0.55, -s * 0.44, -s * 0.66, -s * 0.18, -s * 0.60, s * 0.06);
    ctx.bezierCurveTo(-s * 0.54, s * 0.09, -s * 0.42, -s * 0.06, -s * 0.30, -s * 0.38);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-s * 0.68, s * 0.09, s * 0.20, s * 0.11, 0.48, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-s * 0.82, s * 0.15, s * 0.10, s * 0.07, 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#060402';
    ctx.beginPath(); ctx.arc(-s * 0.74, s * 0.05, s * 0.025, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.moveTo(-s * 0.34, -s * 0.46);
    ctx.bezierCurveTo(-s * 0.50, -s * 0.64, -s * 0.56, -s * 0.82, -s * 0.48, -s * 0.92);
    ctx.bezierCurveTo(-s * 0.38, -s * 1.02, -s * 0.26, -s * 0.90, -s * 0.24, -s * 0.50);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-s * 0.52, -s * 0.94, s * 0.18, s * 0.12, -0.38, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-s * 0.64, -s * 0.88, s * 0.10, s * 0.08, -0.18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#060402';
    ctx.beginPath(); ctx.arc(-s * 0.57, -s * 0.96, s * 0.025, 0, Math.PI * 2); ctx.fill();
  }

  // Mane
  ctx.strokeStyle = maneCol; ctx.lineWidth = s * 0.048;
  if (pose !== 'graze') {
    ctx.beginPath();
    ctx.moveTo(-s * 0.34, -s * 0.46);
    ctx.quadraticCurveTo(-s * 0.22, -s * 0.72, -s * 0.40, -s * 0.82);
    ctx.stroke();
  }
  // Tail
  ctx.lineWidth = s * 0.052;
  ctx.beginPath();
  ctx.moveTo(s * 0.46, -s * 0.38);
  ctx.quadraticCurveTo(s * 0.74, -s * 0.26, s * 0.80, s * 0.06);
  ctx.stroke();

  ctx.restore();
}

function drawPineTree(ctx: CanvasRenderingContext2D, tx: number, ty: number, th: number) {
  const trunkH = th * 0.18;
  ctx.fillStyle = '#5a3818';
  ctx.fillRect(tx - 2, ty, 4, trunkH);

  for (let l = 0; l < 3; l++) {
    const lf = l / 2;
    const ly = ty - th * (lf * 0.62);
    const lw = th * (0.52 - l * 0.12);
    const lh = th * (0.42 + l * 0.05);
    const g = ctx.createLinearGradient(tx, ly - lh, tx, ly);
    g.addColorStop(0, l === 0 ? '#1a3a10' : '#122e08');
    g.addColorStop(0.55, '#0e2206');
    g.addColorStop(1, '#0a1a04');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(tx, ly - lh);
    ctx.quadraticCurveTo(tx + lw * 0.38, ly - lh * 0.38, tx + lw, ly);
    ctx.quadraticCurveTo(tx, ly + lh * 0.07, tx - lw, ly);
    ctx.quadraticCurveTo(tx - lw * 0.38, ly - lh * 0.38, tx, ly - lh);
    ctx.fill();
    // Snow dusting on tip
    if (l === 0) {
      ctx.fillStyle = 'rgba(235,245,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(tx, ly - lh);
      ctx.quadraticCurveTo(tx + lw * 0.18, ly - lh + th * 0.08, tx + lw * 0.30, ly - lh + th * 0.12);
      ctx.quadraticCurveTo(tx, ly - lh + th * 0.06, tx - lw * 0.30, ly - lh + th * 0.12);
      ctx.quadraticCurveTo(tx - lw * 0.18, ly - lh + th * 0.08, tx, ly - lh);
      ctx.fill();
    }
  }
}

function drawFarm(ctx: CanvasRenderingContext2D, W: number, H: number, fX: number, fW: number, cBY: number) {
  const fBase = cBY + H * 0.010;
  const bW = fW * 0.62, bH = H * 0.095, bX = fX + fW * 0.08;
  const bY = fBase - bH;

  ctx.shadowColor = 'rgba(20,10,5,0.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 5;
  const barnG = ctx.createLinearGradient(bX, bY, bX + bW, fBase);
  barnG.addColorStop(0, '#9a5020'); barnG.addColorStop(1, '#6a3010');
  ctx.fillStyle = barnG; ctx.fillRect(bX, bY, bW, bH);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  drawAlpineRoof(ctx, bX, bY, bW, bH * 0.44, '#7a2808', 0);

  // Barn door
  ctx.fillStyle = '#4a2810';
  ctx.beginPath();
  ctx.arc(bX + bW * 0.50, bY + bH * 0.35, bW * 0.22, Math.PI, 0);
  ctx.lineTo(bX + bW * 0.72, fBase);
  ctx.lineTo(bX + bW * 0.28, fBase);
  ctx.closePath(); ctx.fill();

  // Fence
  const pX = fX + fW * 0.02, pW = fW * 0.96, pH = H * 0.050;
  ctx.strokeStyle = '#9a7040'; ctx.lineWidth = 2.5;
  for (const ry of [pH * 0.24, pH * 0.62]) {
    ctx.beginPath(); ctx.moveTo(pX, fBase - ry); ctx.lineTo(pX + pW, fBase - ry); ctx.stroke();
  }
  ctx.fillStyle = '#8a6030';
  for (let px = pX; px <= pX + pW; px += W * 0.018) {
    ctx.fillRect(px - 2, fBase - pH, 4, pH);
  }

  // Haystacks
  for (const [hx, hr] of [[pX + pW * 0.58, H * 0.022], [pX + pW * 0.80, H * 0.016]] as [number, number][]) {
    const hg = ctx.createRadialGradient(hx, fBase - hr * 0.65, 0, hx, fBase - hr * 0.65, hr * 1.6);
    hg.addColorStop(0, '#e8c840'); hg.addColorStop(0.6, '#c8a020'); hg.addColorStop(1, '#a88010');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(hx, fBase - hr * 0.32, hr * 1.22, hr, 0, 0, Math.PI * 2); ctx.fill();
  }
}

/* ──────────────────────────────────────────────
   ANIMATED DRAWERS
────────────────────────────────────────────── */

function drawRiverShimmer(ctx: CanvasRenderingContext2D, W: number, H: number, frame: number) {
  const ry = H * 0.53, rh = H * 0.075;
  for (let i = 0; i < 10; i++) {
    const lx = ((frame * 0.32 + i * 71) % (W + 120)) - 60;
    const ly = ry + rh * (0.10 + (i * 0.082) % 0.80);
    const lw = 28 + (i * 18 % 58);
    ctx.strokeStyle = `rgba(255,222,150,${0.055 + (i % 3) * 0.038})`;
    ctx.lineWidth = 1 + (i % 2);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + lw, ly + 1); ctx.stroke();
  }
}

function drawTrain(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  offset: number
) {
  // Track path: bezier from left to right through mid-ground
  const trackY = H * 0.585;

  // Draw tracks (static but called from animated layer for simplicity — only when train is nearby)
  ctx.strokeStyle = '#a08858'; ctx.lineWidth = 2.5;
  for (const dy of [-4, 4]) {
    ctx.beginPath();
    ctx.moveTo(0, trackY + dy);
    ctx.quadraticCurveTo(W * 0.25, trackY + dy - H * 0.012, W * 0.50, trackY + dy + H * 0.006);
    ctx.quadraticCurveTo(W * 0.75, trackY + dy + H * 0.018, W, trackY + dy + H * 0.008);
    ctx.stroke();
  }
  // Sleepers
  ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = 3;
  for (let sx = 0; sx < W; sx += W * 0.022) {
    ctx.beginPath(); ctx.moveTo(sx, trackY - 6); ctx.lineTo(sx + 3, trackY + 6); ctx.stroke();
  }

  // Compute car positions along the bezier (simplified linear approximation)
  function trainX(t: number): [number, number] {
    // Rough parametric along the quad bezier
    const x = t * W;
    const y = trackY + (Math.sin(t * Math.PI) * -H * 0.012) + t * H * 0.014;
    return [x, y];
  }

  const carSpacing = W * 0.115;
  const cars = [
    { offset: 0,             isEngine: true  },
    { offset: carSpacing,     isEngine: false },
    { offset: carSpacing * 2, isEngine: false },
  ];

  for (const car of cars) {
    const t = ((offset - car.offset) % W + W) % W / W;
    const [cx, cy] = trainX(t);
    const cw = W * 0.095, ch = H * 0.048;

    // Car body
    const carG = ctx.createLinearGradient(cx - cw / 2, cy - ch, cx + cw / 2, cy);
    if (car.isEngine) {
      carG.addColorStop(0, '#8a1808'); carG.addColorStop(1, '#5a1005');
    } else {
      carG.addColorStop(0, '#e8e0d0'); carG.addColorStop(1, '#c8c0b0');
    }
    ctx.shadowColor = 'rgba(20,10,5,0.30)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;
    ctx.fillStyle = carG;
    // Rounded rect manually
    const r = 4;
    ctx.beginPath();
    ctx.moveTo(cx - cw / 2 + r, cy - ch);
    ctx.lineTo(cx + cw / 2 - r, cy - ch);
    ctx.arc(cx + cw / 2 - r, cy - ch + r, r, -Math.PI / 2, 0);
    ctx.lineTo(cx + cw / 2, cy);
    ctx.lineTo(cx - cw / 2, cy);
    ctx.arc(cx - cw / 2 + r, cy - ch + r, r, Math.PI, -Math.PI / 2, true);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

    // Red trim line
    if (!car.isEngine) {
      ctx.strokeStyle = '#c02010'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - cw / 2, cy - ch * 0.22); ctx.lineTo(cx + cw / 2, cy - ch * 0.22); ctx.stroke();
    }

    // Windows on passenger cars
    if (!car.isEngine) {
      const numW = 3;
      for (let wi = 0; wi < numW; wi++) {
        const wx = cx - cw / 2 + cw * (0.14 + wi * 0.28);
        const wy = cy - ch * 0.80;
        drawWindow(ctx, wx, wy, cw * 0.18, ch * 0.36);
      }
    }

    // Engine chimney + dome
    if (car.isEngine) {
      ctx.fillStyle = '#3a1808';
      ctx.fillRect(cx + cw * 0.28, cy - ch * 1.18, cw * 0.12, ch * 0.38);
      ctx.fillRect(cx + cw * 0.24, cy - ch * 1.22, cw * 0.20, ch * 0.10);
      // Dome
      const domeG = ctx.createRadialGradient(cx - cw * 0.12, cy - ch * 1.02, 0, cx - cw * 0.12, cy - ch, ch * 0.32);
      domeG.addColorStop(0, '#c02010'); domeG.addColorStop(1, '#7a1008');
      ctx.fillStyle = domeG;
      ctx.beginPath(); ctx.arc(cx - cw * 0.12, cy - ch, ch * 0.22, Math.PI, 0); ctx.fill();
    }

    // Wheels
    ctx.fillStyle = '#303030';
    for (const wx of [-cw * 0.32, -cw * 0.08, cw * 0.16, cw * 0.36]) {
      ctx.beginPath(); ctx.arc(cx + wx, cy + 3, H * 0.018, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#606060'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx + wx, cy + 3, H * 0.014, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

function drawSmokeParticles(ctx: CanvasRenderingContext2D, particles: SmokeParticle[]) {
  for (const p of particles) {
    if (p.alpha <= 0) continue;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    g.addColorStop(0, `rgba(200,185,168,${p.alpha})`);
    g.addColorStop(1, `rgba(190,175,160,0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCastleFlags(ctx: CanvasRenderingContext2D, W: number, H: number, cX: number, cBY: number, cW: number, frame: number) {
  const ltW = W * 0.038, ltX = cX + W * 0.004;
  const ltTop = cBY - H * 0.38;
  const ltcH = (cBY - ltTop) * 0.36;

  const rtX = cX + cW - ltW - W * 0.004;
  const rtTop = cBY - H * 0.35;
  const rtcH = (cBY - rtTop) * 0.36;

  for (const [tx, ty, cH] of [[ltX, ltTop, ltcH], [rtX, rtTop, rtcH]] as [number, number, number][]) {
    const fpx = tx + ltW / 2;
    const fpt = ty - cH - H * 0.016;
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(fpx, fpt); ctx.lineTo(fpx, ty - cH); ctx.stroke();
    const fw = Math.sin(frame * 0.044 + tx) * 5;
    const fg = ctx.createLinearGradient(fpx, fpt, fpx + W * 0.030, fpt);
    fg.addColorStop(0, '#c82010'); fg.addColorStop(1, '#a01808');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(fpx, fpt);
    ctx.lineTo(fpx + W * 0.030 + fw, fpt + H * 0.008 + fw * 0.22);
    ctx.lineTo(fpx + W * 0.026 + fw * 0.7, fpt + H * 0.016);
    ctx.lineTo(fpx, fpt + H * 0.015);
    ctx.closePath();
    ctx.fill();
  }
}

/* ══════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════ */

export default function AlpsCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let W = 0, H = 0, raf = 0, frame = 0;
    let bgCanvas: HTMLCanvasElement | null = null;

    // Static data arrays
    let ridgeA: Ridge[] = [], ridgeB: Ridge[] = [], ridgeC: Ridge[] = [], ridgeD: Ridge[] = [], ridgeE: Ridge[] = [];
    let clouds: Cloud[] = [];
    let buildings: Building[] = [];
    let pineTrees: { x: number; y: number; h: number }[] = [];
    let horses: Horse[] = [];
    let soldiers: Soldier[] = [];
    let cX = 0, cBY = 0, cW = 0;
    let fX = 0, fW = 0;

    // Animated state
    let trainOffset = 0;
    let smokeParticles: SmokeParticle[] = [];

    function initSmokeParticles(): SmokeParticle[] {
      const out: SmokeParticle[] = [];
      for (let i = 0; i < 60; i++) out.push({ x: 0, y: 0, r: 2, alpha: 0, drift: 0 });
      return out;
    }

    function buildStaticScene(bg: CanvasRenderingContext2D) {
      // Sky
      drawSky(bg, W, H);

      // Clouds (static bake position at t=0)
      for (const c of clouds) drawCloud(bg, c);

      // Mountains back to front
      drawMountainLayer(bg, W, H, ridgeA, '#a090c8', '#c4a8e8', 'rgba(255,255,255,0.85)', 0.46, null);
      drawMountainLayer(bg, W, H, ridgeB, '#8070b0', '#a888c8', 'rgba(255,248,222,0.90)', 0.30, null);
      drawMountainLayer(bg, W, H, ridgeC, '#604880', '#805898', 'rgba(255,244,200,0.95)', 0.18, 'rgba(15,35,8,0.55)');
      drawMountainLayer(bg, W, H, ridgeD, '#483060', '#604878', 'rgba(255,242,190,0.98)', 0.08, 'rgba(10,28,6,0.72)');
      drawMountainLayer(bg, W, H, ridgeE, '#302040', '#483058', 'rgba(255,240,180,1.00)',  0.00, 'rgba(8,22,4,0.85)');

      // Terrain
      drawTerrain(bg, W, H);

      // Far pine trees
      for (const t of pineTrees) {
        if (t.y < H * 0.56) drawPineTree(bg, t.x, t.y, t.h);
      }

      // River
      drawRiver(bg, W, H);
      drawBridge(bg, W, H);

      // Village buildings
      for (const b of buildings) drawBuilding(bg, b, H);
      drawChurch(bg, W * 0.18, cBY, W * 0.075, H * 0.195);

      // Train station
      {
        const stX = W * 0.28, stY = cBY - H * 0.085, stW = W * 0.095, stH = H * 0.085;
        const stG = bg.createLinearGradient(stX, stY, stX + stW, stY + stH);
        stG.addColorStop(0, '#d0b888'); stG.addColorStop(1, '#a89060');
        bg.fillStyle = stG; bg.fillRect(stX, stY, stW, stH);
        // Platform overhang
        const ohG = bg.createLinearGradient(stX, stY, stX, stY + H * 0.015);
        ohG.addColorStop(0, '#a08848'); ohG.addColorStop(1, '#806838');
        bg.fillStyle = ohG;
        bg.fillRect(stX - stW * 0.15, stY, stW * 1.30, H * 0.015);
        // Overhang supports
        bg.fillStyle = '#7a5828';
        for (let si = 0; si < 4; si++) bg.fillRect(stX + stW * (si / 3) - 2, stY, 4, H * 0.055);
        drawAlpineRoof(bg, stX, stY, stW, stH * 0.42, '#5a3818', 0);
        drawWindow(bg, stX + stW * 0.20, stY + stH * 0.30, stW * 0.22, stH * 0.32);
        drawWindow(bg, stX + stW * 0.58, stY + stH * 0.30, stW * 0.22, stH * 0.32);
      }

      // Well
      {
        const wg = bg.createRadialGradient(W * 0.33, cBY - H * 0.016, 0, W * 0.33, cBY - H * 0.016, H * 0.024);
        wg.addColorStop(0, '#a89870'); wg.addColorStop(1, '#7a6848');
        bg.fillStyle = wg;
        bg.beginPath(); bg.arc(W * 0.33, cBY - H * 0.014, H * 0.024, 0, Math.PI * 2); bg.fill();
        bg.fillStyle = '#5a4830';
        bg.beginPath(); bg.arc(W * 0.33, cBY - H * 0.014, H * 0.013, 0, Math.PI * 2); bg.fill();
        bg.strokeStyle = '#7a5828'; bg.lineWidth = 2;
        bg.beginPath(); bg.moveTo(W * 0.330 - H * 0.024, cBY - H * 0.014); bg.lineTo(W * 0.330 + H * 0.024, cBY - H * 0.014); bg.stroke();
      }

      // Farm
      drawFarm(bg, W, H, fX, fW, cBY);

      // Castle (static parts — flags and princess are animated)
      drawCastle(bg, W, H, cX, cBY, cW, 0);

      // Near pine trees
      for (const t of pineTrees) {
        if (t.y >= H * 0.56) drawPineTree(bg, t.x, t.y, t.h);
      }

      // Path from village to castle
      bg.strokeStyle = '#9a8878'; bg.lineWidth = W * 0.014; bg.lineCap = 'round';
      bg.beginPath();
      bg.moveTo(W * 0.30, cBY + H * 0.022);
      bg.quadraticCurveTo(W * 0.50, cBY + H * 0.040, cX + W * 0.010, cBY + H * 0.010);
      bg.stroke();
      bg.lineCap = 'butt';

      // Foreground darker overlay
      const fgG = bg.createLinearGradient(0, H * 0.85, 0, H);
      fgG.addColorStop(0, 'rgba(10,25,5,0)');
      fgG.addColorStop(1, 'rgba(8,20,4,0.50)');
      bg.fillStyle = fgG;
      bg.fillRect(0, H * 0.85, W, H * 0.15);
    }

    function init() {
      try {
        if (!canvas) return;
        W = canvas.offsetWidth  || 1280;
        H = canvas.offsetHeight || 720;
        canvas.width  = W;
        canvas.height = H;

        const mob = W < 640;

        cX  = W * 0.60;
        cW  = W * 0.30;
        cBY = H * 0.615;
        fX  = cX + cW + W * 0.010;
        fW  = W * 0.105;

        // Ridges (seeded for reproducibility after resize)
        ridgeA = genRidge(W, H, H * 0.50, H * 0.065, mob ? 10 : 18, 1.0);
        ridgeB = genRidge(W, H, H * 0.54, H * 0.12,  mob ? 12 : 20, 2.3);
        ridgeC = genRidge(W, H, H * 0.57, H * 0.18,  mob ? 14 : 22, 3.7);
        ridgeD = genRidge(W, H, H * 0.60, H * 0.25,  mob ? 12 : 18, 5.1);
        ridgeE = genRidge(W, H, H * 0.62, H * 0.32,  mob ? 10 : 16, 7.4);

        // Clouds
        clouds = makeClouds(W, H, mob ? 4 : 7, 42);

        // Buildings
        buildings = [];
        const WALL_COLS  = ['#e8dcc0', '#d8c8a8', '#e0d090', '#c8d0d8', '#ddd0b0', '#e4d8b8'];
        const ROOF_COLS  = ['#3a2010', '#8a3820', '#404050', '#5a2818', '#2e3040'];
        let bx = W * 0.024;
        const numBuildings = mob ? 6 : 11;
        for (let i = 0; i < numBuildings; i++) {
          const sr = seededRand(i * 7 + 1);
          const sr2 = seededRand(i * 7 + 2);
          const sr3 = seededRand(i * 7 + 3);
          const bw = W * (0.040 + sr  * 0.032);
          const bh = H * (0.095 + sr2 * 0.068);
          const rh = bh * (0.36 + sr3 * 0.22);
          const wallCol = WALL_COLS[i % WALL_COLS.length];
          const roofCol = ROOF_COLS[i % ROOF_COLS.length];
          buildings.push({
            x: bx, y: cBY - bh, w: bw, h: bh, rh,
            wallCol, sideCol: darken(wallCol, 22), roofCol,
            numWindows: sr < 0.5 ? 2 : 3,
            hasBalcony: sr2 > 0.60,
            hasChimney: sr3 > 0.35,
            chimneyX: 0.62 + seededRand(i * 13) * 0.18,
            smokeIdx: i,
          });
          bx += bw + W * (0.008 + seededRand(i * 7 + 4) * 0.016);
        }

        // Pine trees
        pineTrees = [];
        const numPines = mob ? 24 : 52;
        for (let i = 0; i < numPines; i++) {
          pineTrees.push({
            x: seededRand(i * 11 + 3) * W,
            y: H * (0.48 + seededRand(i * 11 + 5) * 0.24),
            h: H * (0.048 + seededRand(i * 11 + 7) * 0.044),
          });
        }

        // Horses
        horses = [];
        const horseCols  = ['#2a1808', '#7a4820', '#c09060', '#a06838', '#1a1010'];
        const maneColors = ['#120a04', '#3a2010', '#6a4020', '#3a1808', '#080404'];
        const numHorses = mob ? 3 : 5;
        const pHX = fX + fW * 0.05;
        for (let i = 0; i < numHorses; i++) {
          const lo = pHX + W * 0.005;
          const hi = pHX + W * 0.088;
          horses.push({
            x:     lo + (hi - lo) * (i / numHorses),
            baseY: cBY - H * 0.003,
            scale: H * 0.055 + seededRand(i * 17) * H * 0.010,
            col:   horseCols[i % horseCols.length],
            maneCol: maneColors[i % maneColors.length],
            dir: i % 2 === 0 ? 1 : -1,
            lo, hi,
            phase: i * 1.88,
            pose: i === 2 ? 'graze' : 'stand',
          });
        }

        // Soldiers
        soldiers = [];
        const numSoldiers = mob ? 4 : 7;
        for (let i = 0; i < numSoldiers; i++) {
          soldiers.push({
            x:     cX + cW * 0.08 + i * W * 0.027,
            baseY: cBY + H * 0.002,
            phase: i * 0.92,
          });
        }

        // Smoke particles
        smokeParticles = initSmokeParticles();

        // Train start
        trainOffset = W * 0.20;

        // Build static offscreen canvas
        bgCanvas = document.createElement('canvas');
        bgCanvas.width  = W;
        bgCanvas.height = H;
        const bg = bgCanvas.getContext('2d')!;
        buildStaticScene(bg);

      } catch { /* swallow */ }
    }

    function updateSmoke() {
      // Emit from chimney positions
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (!b.hasChimney) continue;
        if (frame % 8 === (i % 8)) {
          // Find a dead particle
          const dead = smokeParticles.find(p => p.alpha <= 0);
          if (dead) {
            const chX = b.x + b.chimneyX * b.w + b.w * 0.05;
            const chY = b.y - b.rh * 0.82;
            dead.x = chX;
            dead.y = chY;
            dead.r = 3 + Math.random() * 2;
            dead.alpha = 0.42 + Math.random() * 0.18;
            dead.drift = (Math.random() - 0.5) * 0.5;
          }
        }
      }
      for (const p of smokeParticles) {
        if (p.alpha <= 0) continue;
        p.y     -= 0.55;
        p.x     += p.drift;
        p.r     += 0.08;
        p.alpha -= 0.004;
      }
    }

    function loop() {
      try {
        frame++;

        // Blit static background
        if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0);

        // River shimmer
        drawRiverShimmer(ctx, W, H, frame);

        // Smoke
        updateSmoke();
        drawSmokeParticles(ctx, smokeParticles);

        // Train
        trainOffset = (trainOffset + 0.55) % (W + W * 0.35);
        drawTrain(ctx, W, H, trainOffset);

        // Castle animated flags (on top of static castle)
        drawCastleFlags(ctx, W, H, cX, cBY, cW, frame);

        // Princess
        {
          const kW = cW * 0.30, kX = cX + cW * 0.35;
          const kTop = cBY - H * 0.50;
          const balY = kTop + (cBY - kTop) * 0.28;
          const balW = kW * 0.60, balX = kX + kW * 0.20;
          drawPrincess(ctx, balX, balY, kX, kW, H, frame);
        }

        // Soldiers march
        const ph = H * 0.052;
        for (const s of soldiers) {
          s.x += 0.38;
          if (s.x > cX + cW * 0.95) s.x = cX + cW * 0.08;
          drawSoldier(ctx, s.x, s.baseY, ph, frame, s.phase);
        }

        // Horses wander
        for (const h of horses) {
          h.phase += 0.024;
          h.x += h.dir * 0.25;
          if (h.x > h.hi) { h.dir = -1; }
          if (h.x < h.lo) { h.dir = 1; }
          drawHorse(ctx, h.x, h.baseY, h.scale, h.col, h.maneCol, h.dir, h.pose, frame, h.phase);
        }

        // Animated clouds drifting
        for (const c of clouds) {
          c.x += c.speed;
          if (c.x - 200 > W) c.x = -200;
          drawCloud(ctx, c);
        }

        raf = requestAnimationFrame(loop);
      } catch {
        raf = requestAnimationFrame(loop);
      }
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
