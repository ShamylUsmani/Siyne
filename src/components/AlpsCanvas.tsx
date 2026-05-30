'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function randInt(a: number, b: number) { return Math.floor(rand(a, b + 1)); }

interface Cloud { x: number; y: number; blobs: { dx: number; dy: number; rx: number; ry: number }[]; }
interface PineTree { x: number; baseY: number; h: number; w: number; color: string; }
interface House { x: number; y: number; w: number; h: number; roofH: number; roofColor: string; bodyColor: string; doors: { x: number; y: number; w: number; h: number }[]; windows: { x: number; y: number; w: number; h: number }[]; }
interface Person { x: number; y: number; color: string; vx: number; walking: boolean; dir: number; }
interface Carriage { offsetX: number; }
interface TrainState { x: number; carriages: Carriage[]; }
interface FlowerDot { x: number; y: number; color: string; r: number; }
interface RiverPoint { x: number; y: number; }

export default function AlpsCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0;

    // --- static pre-generated data ---
    const clouds: Cloud[] = [];
    const backPines: PineTree[] = [];
    const frontPines: PineTree[] = [];
    const houses: House[] = [];
    const flowers: FlowerDot[] = [];
    const riverPoints: RiverPoint[] = [];

    // --- animated data ---
    const people: Person[] = [];
    let train: TrainState = { x: 0, carriages: [] };

    // mountain silhouette points
    const backPeakPoints: { x: number; y: number }[] = [];
    const midPeakPoints:  { x: number; y: number }[] = [];
    const frontPeakPoints:{ x: number; y: number }[] = [];

    // church
    let churchX = 0, churchY = 0, churchW = 0, churchH = 0;

    function buildMatterhorn(cx: number, base: number, peakH: number, halfW: number): { x: number; y: number }[] {
      // classic pyramid silhouette with jagged sides
      const pts: { x: number; y: number }[] = [];
      pts.push({ x: cx - halfW, y: base });
      pts.push({ x: cx - halfW * 0.85, y: base - peakH * 0.18 });
      pts.push({ x: cx - halfW * 0.72, y: base - peakH * 0.30 });
      pts.push({ x: cx - halfW * 0.60, y: base - peakH * 0.45 });
      pts.push({ x: cx - halfW * 0.48, y: base - peakH * 0.55 });
      pts.push({ x: cx - halfW * 0.35, y: base - peakH * 0.68 });
      pts.push({ x: cx - halfW * 0.20, y: base - peakH * 0.82 });
      pts.push({ x: cx - halfW * 0.08, y: base - peakH * 0.93 });
      pts.push({ x: cx, y: base - peakH }); // tip
      pts.push({ x: cx + halfW * 0.08, y: base - peakH * 0.93 });
      pts.push({ x: cx + halfW * 0.20, y: base - peakH * 0.82 });
      pts.push({ x: cx + halfW * 0.35, y: base - peakH * 0.68 });
      pts.push({ x: cx + halfW * 0.48, y: base - peakH * 0.55 });
      pts.push({ x: cx + halfW * 0.60, y: base - peakH * 0.45 });
      pts.push({ x: cx + halfW * 0.72, y: base - peakH * 0.30 });
      pts.push({ x: cx + halfW * 0.85, y: base - peakH * 0.18 });
      pts.push({ x: cx + halfW, y: base });
      return pts;
    }

    function buildJaggedPeak(x1: number, x2: number, base: number, maxH: number, seed: number): { x: number; y: number }[] {
      const pts: { x: number; y: number }[] = [{ x: x1, y: base }];
      const steps = Math.floor((x2 - x1) / 18);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = x1 + t * (x2 - x1);
        const envelope = Math.sin(t * Math.PI) * maxH;
        const jag = Math.sin(t * Math.PI * 7.3 + seed) * maxH * 0.18
                  + Math.sin(t * Math.PI * 13.7 + seed * 2.1) * maxH * 0.08;
        pts.push({ x: px, y: base - Math.max(0, envelope + jag) });
      }
      pts.push({ x: x2, y: base });
      return pts;
    }

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1400; H = canvas.offsetHeight || 800;
      canvas.width = W; canvas.height = H;

      clouds.length = 0;
      backPines.length = 0; frontPines.length = 0;
      houses.length = 0; flowers.length = 0; riverPoints.length = 0;
      backPeakPoints.length = 0; midPeakPoints.length = 0; frontPeakPoints.length = 0;

      const skyH = H * 0.50;       // horizon at 50% from top
      const valleyTop = H * 0.75;  // valley/meadow starts
      const pineBackY = H * 0.65;  // back pine row base
      const pineFrontY = H * 0.72; // front pine row base

      // ── CLOUDS ───────────────────────────────────────────────
      for (let i = 0; i < 4; i++) {
        const cx = rand(W * 0.05, W * 0.95);
        const cy = rand(H * 0.04, H * 0.22);
        const blobs: { dx: number; dy: number; rx: number; ry: number }[] = [];
        const blobCount = randInt(5, 9);
        const baseRx = rand(W * 0.055, W * 0.10);
        for (let j = 0; j < blobCount; j++) {
          blobs.push({
            dx: rand(-baseRx * 0.9, baseRx * 0.9),
            dy: rand(-baseRx * 0.25, baseRx * 0.15),
            rx: rand(baseRx * 0.35, baseRx * 0.85),
            ry: rand(baseRx * 0.22, baseRx * 0.55),
          });
        }
        clouds.push({ x: cx, y: cy, blobs });
      }

      // ── MOUNTAIN PEAKS ───────────────────────────────────────
      // Back layer peaks (pale blue-gray) — 5 peaks
      {
        const base = skyH;
        const peaks = [0.10, 0.28, 0.50, 0.72, 0.90];
        const heights = [0.55, 0.62, 0.75, 0.58, 0.48]; // Matterhorn at 0.50
        for (let i = 0; i < peaks.length; i++) {
          const cx = W * peaks[i];
          const ph = base * heights[i];
          const hw = W * (i === 2 ? 0.12 : 0.09);
          if (i === 2) {
            // Matterhorn-like central peak
            const pts = buildMatterhorn(cx, base, ph, hw);
            for (const p of pts) backPeakPoints.push(p);
          } else {
            const pts = buildJaggedPeak(cx - hw, cx + hw, base, ph, i * 2.7);
            for (const p of pts) backPeakPoints.push(p);
          }
          backPeakPoints.push({ x: cx + (i === peaks.length - 1 ? W * 0.09 : W * 0.09), y: base });
        }
      }

      // Mid layer peaks
      {
        const base = skyH + H * 0.04;
        const segments = 6;
        for (let i = 0; i < segments; i++) {
          const x1 = (i / segments) * W;
          const x2 = ((i + 1) / segments) * W;
          const ph = rand(base * 0.38, base * 0.62);
          const pts = buildJaggedPeak(x1, x2, base, ph, i * 3.1 + 1);
          midPeakPoints.push(...pts);
        }
      }

      // Front peaks
      {
        const base = skyH + H * 0.09;
        const segments = 5;
        for (let i = 0; i < segments; i++) {
          const x1 = (i / segments) * W - 20;
          const x2 = ((i + 1) / segments) * W + 20;
          const ph = rand(base * 0.28, base * 0.50);
          const pts = buildJaggedPeak(x1, x2, base, ph, i * 4.2 + 2.3);
          frontPeakPoints.push(...pts);
        }
      }

      // ── PINE TREES ───────────────────────────────────────────
      // Back row (smaller, denser)
      let tx = -5;
      while (tx < W + 5) {
        const th = rand(16, 24);
        backPines.push({ x: tx, baseY: pineBackY, h: th, w: th * 0.38, color: '#1a3010' });
        tx += rand(7, 13);
      }
      // Front row (larger, denser)
      tx = -5;
      while (tx < W + 5) {
        const th = rand(28, 42);
        frontPines.push({ x: tx, baseY: pineFrontY, h: th, w: th * 0.38, color: '#0e2008' });
        tx += rand(10, 18);
      }

      // ── RIVER ────────────────────────────────────────────────
      {
        let rx = W * 0.55;
        riverPoints.push({ x: rx, y: valleyTop });
        for (let step = 0; step < 8; step++) {
          rx += rand(-25, 25);
          rx = Math.max(W * 0.35, Math.min(W * 0.75, rx));
          riverPoints.push({ x: rx, y: valleyTop + (step + 1) * ((H - valleyTop) / 8) });
        }
      }

      // ── WILDFLOWERS ──────────────────────────────────────────
      for (let i = 0; i < 180; i++) {
        const fy = rand(valleyTop, H - 5);
        flowers.push({
          x: rand(0, W),
          y: fy,
          r: rand(1.2, 2.5),
          color: Math.random() > 0.5
            ? `rgba(255,220,50,${rand(0.5, 0.8)})`
            : `rgba(255,180,200,${rand(0.4, 0.7)})`,
        });
      }

      // ── VILLAGE HOUSES ───────────────────────────────────────
      const villageLeft = W * 0.06;
      const villageRight = W * 0.45;
      const houseCount = randInt(9, 12);
      const houseBaseY = valleyTop + (H - valleyTop) * 0.28;
      const houseBodies = ['#f0ece0', '#e8e0d0', '#f4eee4', '#ece4d4'];
      const houseRoofs  = ['#c84020', '#a83018', '#b83820', '#d04428'];

      for (let i = 0; i < houseCount; i++) {
        const hx = rand(villageLeft, villageRight - 30);
        const hw = rand(22, 38);
        const hh = rand(20, 32);
        const roofH = rand(14, 22);
        const body = houseBodies[randInt(0, houseBodies.length - 1)];
        const roof = houseRoofs[randInt(0, houseRoofs.length - 1)];

        const doors: { x: number; y: number; w: number; h: number }[] = [];
        const dw = rand(5, 7); const dh = rand(8, 11);
        doors.push({ x: hw * rand(0.3, 0.55), y: hh - dh, w: dw, h: dh });

        const wins: { x: number; y: number; w: number; h: number }[] = [];
        const ww = rand(4, 6); const wh = rand(4, 6);
        wins.push({ x: hw * rand(0.1, 0.28), y: hh * rand(0.22, 0.45), w: ww, h: wh });
        if (hw > 28) {
          wins.push({ x: hw * rand(0.60, 0.78), y: hh * rand(0.22, 0.45), w: ww, h: wh });
        }

        houses.push({ x: hx, y: houseBaseY - hh, w: hw, h: hh, roofH, roofColor: roof, bodyColor: body, doors, windows: wins });
      }

      // ── CHURCH ───────────────────────────────────────────────
      churchW = 32; churchH = 44;
      churchX = villageLeft + (villageRight - villageLeft) * 0.5;
      churchY = houseBaseY - churchH;

      // ── TRAIN ────────────────────────────────────────────────
      const carriageCount = 4;
      const carriageSpacing = 30;
      train = { x: -carriageCount * carriageSpacing - 20, carriages: [] };
      for (let i = 0; i < carriageCount; i++) {
        train.carriages.push({ offsetX: i * carriageSpacing });
      }

      // ── PEOPLE ───────────────────────────────────────────────
      const personColors = ['#3060a0', '#c04020', '#208040', '#806020', '#6030a0', '#c07020'];
      people.length = 0;
      const personBaseY = houseBaseY + 4;
      for (let i = 0; i < 8; i++) {
        const walking = i < 4;
        people.push({
          x: rand(villageLeft, villageRight),
          y: personBaseY + rand(-6, 6),
          color: personColors[i % personColors.length],
          vx: walking ? rand(0.08, 0.20) * (Math.random() > 0.5 ? 1 : -1) : 0,
          walking,
          dir: 1,
        });
      }
    }

    // ── DRAW FUNCTIONS ────────────────────────────────────────

    function drawSky() {
      const skyH = H * 0.50;
      const g = ctx.createLinearGradient(0, 0, 0, skyH);
      g.addColorStop(0,   '#6ab4f0');
      g.addColorStop(0.5, '#90ccf8');
      g.addColorStop(1,   '#c8e8f8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, skyH);
    }

    function drawClouds(frame: number) {
      for (const c of clouds) {
        c.x += 0.05;
        if (c.x > W + 200) c.x = -200;
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (const b of c.blobs) {
          ctx.beginPath();
          ctx.ellipse(c.x + b.dx, c.y + b.dy + Math.sin(frame * 0.003 + b.dx) * 0.8, b.rx, b.ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function fillPolyPoints(pts: { x: number; y: number }[], color: string) {
      if (pts.length < 2) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
    }

    function drawSnowCaps(pts: { x: number; y: number }[], snowThreshold: number, capSize: number) {
      // Find local minima (peaks) and draw snow patches
      for (let i = 2; i < pts.length - 2; i++) {
        const p = pts[i];
        if (p.y < snowThreshold && pts[i - 1].y > p.y && pts[i + 1].y > p.y) {
          const spread = (snowThreshold - p.y) * capSize;
          ctx.fillStyle = '#f0f4ff';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - spread * 0.7, p.y + spread * 0.85);
          ctx.lineTo(p.x + spread * 0.7, p.y + spread * 0.85);
          ctx.closePath();
          ctx.fill();
          // Blue shadow on right side of snow
          ctx.fillStyle = 'rgba(160,180,220,0.4)';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + spread * 0.05, p.y + spread * 0.4);
          ctx.lineTo(p.x + spread * 0.7, p.y + spread * 0.85);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    function drawMountains() {
      const skyH = H * 0.50;

      if (backPeakPoints.length > 0) {
        // Back peaks fill
        const g = ctx.createLinearGradient(0, 0, 0, skyH);
        g.addColorStop(0, '#b8c8d8');
        g.addColorStop(1, '#8898a8');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, skyH);
        for (const p of backPeakPoints) ctx.lineTo(p.x, p.y);
        ctx.lineTo(W, skyH);
        ctx.closePath();
        ctx.fill();
        drawSnowCaps(backPeakPoints, skyH * 0.55, 1.8);
      }

      if (midPeakPoints.length > 0) {
        const g2 = ctx.createLinearGradient(0, 0, 0, skyH + H * 0.04);
        g2.addColorStop(0, '#8898a8');
        g2.addColorStop(1, '#6a7888');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.moveTo(0, skyH + H * 0.04);
        for (const p of midPeakPoints) ctx.lineTo(p.x, p.y);
        ctx.lineTo(W, skyH + H * 0.04);
        ctx.closePath();
        ctx.fill();
        drawSnowCaps(midPeakPoints, skyH * 0.72, 1.5);
      }

      if (frontPeakPoints.length > 0) {
        const g3 = ctx.createLinearGradient(0, 0, 0, skyH + H * 0.09);
        g3.addColorStop(0, '#6a7888');
        g3.addColorStop(1, '#4a5868');
        ctx.fillStyle = g3;
        ctx.beginPath();
        ctx.moveTo(0, skyH + H * 0.09);
        for (const p of frontPeakPoints) ctx.lineTo(p.x, p.y);
        ctx.lineTo(W, skyH + H * 0.09);
        ctx.closePath();
        ctx.fill();
        drawSnowCaps(frontPeakPoints, skyH * 0.88, 1.2);
      }
    }

    function drawPineRow(trees: PineTree[]) {
      for (const t of trees) {
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.moveTo(t.x, t.baseY);
        ctx.lineTo(t.x - t.w, t.baseY);
        ctx.lineTo(t.x, t.baseY - t.h);
        ctx.lineTo(t.x + t.w, t.baseY);
        ctx.closePath();
        ctx.fill();
      }
    }

    function drawValley() {
      const valleyTop = H * 0.75;
      const g = ctx.createLinearGradient(0, valleyTop, 0, H);
      g.addColorStop(0, '#3a8820');
      g.addColorStop(1, '#50a828');
      ctx.fillStyle = g;
      ctx.fillRect(0, valleyTop, W, H - valleyTop);
    }

    function drawRiver() {
      if (riverPoints.length < 2) return;
      ctx.strokeStyle = '#5a9ec8';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(riverPoints[0].x, riverPoints[0].y);
      for (let i = 1; i < riverPoints.length; i++) {
        ctx.lineTo(riverPoints[i].x, riverPoints[i].y);
      }
      ctx.stroke();
      // Highlight
      ctx.strokeStyle = 'rgba(150,210,240,0.45)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(riverPoints[0].x - 3, riverPoints[0].y);
      for (let i = 1; i < riverPoints.length; i++) {
        ctx.lineTo(riverPoints[i].x - 2, riverPoints[i].y);
      }
      ctx.stroke();
    }

    function drawFlowers() {
      for (const f of flowers) {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawHouses() {
      for (const h of houses) {
        // Shadow under house
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(h.x + 2, h.y + h.h, h.w, 3);

        // Body
        ctx.fillStyle = h.bodyColor;
        ctx.fillRect(h.x, h.y, h.w, h.h);

        // Roof (triangle)
        ctx.fillStyle = h.roofColor;
        ctx.beginPath();
        ctx.moveTo(h.x - 2, h.y);
        ctx.lineTo(h.x + h.w * 0.5, h.y - h.roofH);
        ctx.lineTo(h.x + h.w + 2, h.y);
        ctx.closePath();
        ctx.fill();

        // Windows
        for (const w of h.windows) {
          ctx.fillStyle = '#ffeea0';
          ctx.fillRect(h.x + w.x, h.y + w.y, w.w, w.h);
          ctx.strokeStyle = 'rgba(80,60,30,0.4)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(h.x + w.x, h.y + w.y, w.w, w.h);
        }

        // Doors
        for (const d of h.doors) {
          ctx.fillStyle = '#8a5a30';
          ctx.fillRect(h.x + d.x, h.y + d.y, d.w, d.h);
        }
      }
    }

    function drawChurch() {
      if (!churchW) return;
      const x = churchX, y = churchY, w = churchW, h = churchH;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + 3, y + h, w, 4);

      // Body
      ctx.fillStyle = '#f4f0e8';
      ctx.fillRect(x, y, w, h);

      // Door arch
      ctx.fillStyle = '#9a7040';
      ctx.beginPath();
      ctx.arc(x + w * 0.5, y + h - 10, 5, Math.PI, 0);
      ctx.rect(x + w * 0.5 - 5, y + h - 10, 10, 10);
      ctx.fill();

      // Windows
      ctx.fillStyle = '#ffeea0';
      ctx.beginPath(); ctx.arc(x + w * 0.25, y + h * 0.35, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w * 0.75, y + h * 0.35, 3, 0, Math.PI * 2); ctx.fill();

      // Roof
      ctx.fillStyle = '#c84020';
      ctx.beginPath();
      ctx.moveTo(x - 2, y);
      ctx.lineTo(x + w * 0.5, y - 12);
      ctx.lineTo(x + w + 2, y);
      ctx.closePath();
      ctx.fill();

      // Spire base
      const spireBaseX = x + w * 0.5;
      const spireBaseY = y - 12;
      ctx.fillStyle = '#484840';
      ctx.beginPath();
      ctx.moveTo(spireBaseX - 4, spireBaseY);
      ctx.lineTo(spireBaseX, spireBaseY - 28);
      ctx.lineTo(spireBaseX + 4, spireBaseY);
      ctx.closePath();
      ctx.fill();

      // Cross
      ctx.strokeStyle = '#484840';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(spireBaseX - 4, spireBaseY - 32);
      ctx.lineTo(spireBaseX + 4, spireBaseY - 32);
      ctx.moveTo(spireBaseX, spireBaseY - 35);
      ctx.lineTo(spireBaseX, spireBaseY - 28);
      ctx.stroke();

      // Clock face
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.arc(x + w * 0.5, y + h * 0.18, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#484840';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(x + w * 0.5, y + h * 0.18, 5, 0, Math.PI * 2); ctx.stroke();
      // Clock hands
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, y + h * 0.18);
      ctx.lineTo(x + w * 0.5 + 2, y + h * 0.18 - 3);
      ctx.moveTo(x + w * 0.5, y + h * 0.18);
      ctx.lineTo(x + w * 0.5 - 3, y + h * 0.18 + 1);
      ctx.stroke();
    }

    function drawTrainTrack() {
      const trackY = H * 0.75 + (H - H * 0.75) * 0.18;
      ctx.strokeStyle = 'rgba(50,40,30,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, trackY + 6);
      ctx.lineTo(W, trackY + 6);
      ctx.stroke();
      // Rail ties
      ctx.strokeStyle = 'rgba(60,45,30,0.4)';
      ctx.lineWidth = 1.5;
      for (let tx = 0; tx < W; tx += 18) {
        ctx.beginPath();
        ctx.moveTo(tx, trackY + 2);
        ctx.lineTo(tx, trackY + 10);
        ctx.stroke();
      }
      // Rail lines
      ctx.strokeStyle = 'rgba(80,70,60,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, trackY + 3);
      ctx.lineTo(W, trackY + 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, trackY + 9);
      ctx.lineTo(W, trackY + 9);
      ctx.stroke();
    }

    function drawTrain() {
      const trackY = H * 0.75 + (H - H * 0.75) * 0.18;
      const cw = 28, ch = 16;
      const r = 3;
      train.x += 0.5;
      const totalW = train.carriages.length * 30 + 20;
      if (train.x > W + totalW) train.x = -totalW;

      for (const car of train.carriages) {
        const cx = train.x - car.offsetX;
        const cy = trackY - ch + 2;

        // Carriage body
        ctx.fillStyle = '#cc2222';
        ctx.beginPath();
        ctx.roundRect(cx, cy, cw, ch, r);
        ctx.fill();

        // Roof
        ctx.fillStyle = '#a01818';
        ctx.fillRect(cx + 1, cy, cw - 2, 5);

        // Windows
        const winColors = 'rgba(255,250,230,0.85)';
        ctx.fillStyle = winColors;
        ctx.fillRect(cx + 4, cy + 5, 7, 5);
        ctx.fillRect(cx + 15, cy + 5, 7, 5);

        // Window divider
        ctx.strokeStyle = 'rgba(160,20,20,0.6)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(cx + 4, cy + 5, 7, 5);
        ctx.strokeRect(cx + 15, cy + 5, 7, 5);

        // Wheels
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(cx + 6, cy + ch, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + cw - 6, cy + ch, 3, 0, Math.PI * 2); ctx.fill();
      }

      // Locomotive (front)
      const lx = train.x + 4;
      const ly = trackY - ch - 4;
      ctx.fillStyle = '#dd1818';
      ctx.beginPath();
      ctx.roundRect(lx, ly, cw + 8, ch + 4, r);
      ctx.fill();
      ctx.fillStyle = '#991010';
      ctx.fillRect(lx + 1, ly, cw + 6, 6);
      ctx.fillStyle = 'rgba(255,250,230,0.85)';
      ctx.fillRect(lx + 3, ly + 7, 8, 6);
      ctx.fillRect(lx + 16, ly + 7, 8, 6);
      // Chimney
      ctx.fillStyle = '#222';
      ctx.fillRect(lx + 28, ly - 5, 5, 6);
      // Wheels
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(lx + 7, ly + ch + 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(lx + cw + 1, ly + ch + 4, 4, 0, Math.PI * 2); ctx.fill();
    }

    function drawPeople() {
      for (const p of people) {
        if (p.walking) {
          p.x += p.vx;
          if (p.x < W * 0.04 || p.x > W * 0.50) { p.vx = -p.vx; }
        }

        const headR = 3;
        const bodyW = 4, bodyH = 6;
        const totalH = headR * 2 + bodyH + 2;

        // Body
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - bodyW / 2, p.y - totalH * 0.5 + headR * 2 + 1, bodyW, bodyH);

        // Head
        ctx.fillStyle = '#f0d0a8';
        ctx.beginPath();
        ctx.arc(p.x, p.y - totalH * 0.5 + headR, headR, 0, Math.PI * 2);
        ctx.fill();

        // Legs (simple, walking only moves slightly)
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.2;
        const legOffset = p.walking ? Math.sin(Date.now() * 0.008 + p.x) * 2 : 0;
        const legBase = p.y - totalH * 0.5 + headR * 2 + bodyH + 1;
        ctx.beginPath();
        ctx.moveTo(p.x - 1, legBase);
        ctx.lineTo(p.x - 2 + legOffset, legBase + 4);
        ctx.moveTo(p.x + 1, legBase);
        ctx.lineTo(p.x + 2 - legOffset, legBase + 4);
        ctx.stroke();
      }
    }

    // ── MAIN LOOP ─────────────────────────────────────────────
    let frame = 0;
    function loop() {
      frame++;
      ctx.clearRect(0, 0, W, H);

      drawSky();
      drawClouds(frame);
      drawMountains();
      drawPineRow(backPines);
      drawPineRow(frontPines);
      drawValley();
      drawRiver();
      drawFlowers();
      drawTrainTrack();
      drawHouses();
      drawChurch();
      drawTrain();
      drawPeople();

      raf = requestAnimationFrame(loop);
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
