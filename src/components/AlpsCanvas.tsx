'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function randInt(a: number, b: number) { return Math.floor(rand(a, b + 1)); }

function shadeHex(col: string, amt: number): string {
  let r = 0, g = 0, b = 0;
  if (col.startsWith('#')) {
    const n = parseInt(col.replace('#', ''), 16);
    r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
  } else {
    const m = col.match(/\d+/g);
    if (m) { r = +m[0]; g = +m[1]; b = +m[2]; }
  }
  return `rgb(${Math.max(0,Math.min(255,r+amt))},${Math.max(0,Math.min(255,g+amt))},${Math.max(0,Math.min(255,b+amt))})`;
}

interface Cloud { x: number; y: number; blobs: { dx: number; dy: number; rx: number; ry: number }[]; }
interface PineTree { x: number; baseY: number; h: number; w: number; color: string; }
interface AlpsHouse { x: number; y: number; w: number; h: number; roofH: number; roofColor: string; bodyColor: string; doors: { x: number; y: number; w: number; h: number }[]; windows: { x: number; y: number; w: number; h: number }[]; }
interface Person { x: number; y: number; color: string; vx: number; walking: boolean; dir: number; }
interface Carriage { offsetX: number; }
interface TrainState { x: number; carriages: Carriage[]; }
interface FlowerDot { x: number; y: number; color: string; r: number; }
interface RiverPoint { x: number; y: number; }

// Mountain layer for smooth bezier approach
interface MountainLayer { baseY: number; amplitude: number; freq: number; colDark: string; colLight: string; }

export default function AlpsCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0;

    const clouds: Cloud[] = [];
    const backPines: PineTree[] = [];
    const frontPines: PineTree[] = [];
    const houses: AlpsHouse[] = [];
    const flowers: FlowerDot[] = [];
    const riverPoints: RiverPoint[] = [];
    const people: Person[] = [];
    const mountainLayers: MountainLayer[] = [];
    let train: TrainState = { x: 0, carriages: [] };

    // Matterhorn bezier data
    let mattX = 0, mattBaseY = 0, mattPeakH = 0;

    let churchX = 0, churchY = 0, churchW = 0, churchH = 0;

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1400; H = canvas.offsetHeight || 800;
      canvas.width = W; canvas.height = H;

      clouds.length = 0;
      backPines.length = 0; frontPines.length = 0;
      houses.length = 0; flowers.length = 0; riverPoints.length = 0;
      people.length = 0; mountainLayers.length = 0;

      const skyH = H * 0.50;
      const valleyTop = H * 0.75;
      const pineBackY = H * 0.65;
      const pineFrontY = H * 0.72;

      // Matterhorn position
      mattX = W * 0.50;
      mattBaseY = skyH;
      mattPeakH = skyH * 0.82;

      // Mountain layers (back → front using smooth bezier in draw)
      mountainLayers.push({ baseY: skyH, amplitude: skyH * 0.52, freq: 3.8 / W * Math.PI, colDark: '#b8c8d8', colLight: '#d0dce8' });
      mountainLayers.push({ baseY: skyH + H * 0.04, amplitude: skyH * 0.55, freq: 3.1 / W * Math.PI, colDark: '#8898a8', colLight: '#9faabb' });
      mountainLayers.push({ baseY: skyH + H * 0.09, amplitude: skyH * 0.42, freq: 4.2 / W * Math.PI, colDark: '#6a7888', colLight: '#7b8c9a' });

      // Clouds
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

      // Back pine row
      let tx = -5;
      while (tx < W + 5) {
        const th = rand(16, 24);
        const hue = randInt(8, 20);
        backPines.push({ x: tx, baseY: pineBackY, h: th, w: th * 0.38, color: `rgb(${hue},${hue + randInt(15, 25)},${hue})` });
        tx += rand(7, 13);
      }
      // Front pine row
      tx = -5;
      while (tx < W + 5) {
        const th = rand(28, 42);
        const hue = randInt(6, 16);
        frontPines.push({ x: tx, baseY: pineFrontY, h: th, w: th * 0.38, color: `rgb(${hue},${hue + randInt(18, 28)},${hue})` });
        tx += rand(10, 18);
      }

      // River
      {
        let rx = W * 0.55;
        riverPoints.push({ x: rx, y: valleyTop });
        for (let step = 0; step < 8; step++) {
          rx += rand(-25, 25);
          rx = Math.max(W * 0.35, Math.min(W * 0.75, rx));
          riverPoints.push({ x: rx, y: valleyTop + (step + 1) * ((H - valleyTop) / 8) });
        }
      }

      // Flowers
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

      // Village houses
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

      // Church
      churchW = 32; churchH = 44;
      churchX = villageLeft + (villageRight - villageLeft) * 0.5;
      churchY = houseBaseY - churchH;

      // Train
      const carriageCount = 4;
      const carriageSpacing = 30;
      train = { x: -carriageCount * carriageSpacing - 20, carriages: [] };
      for (let i = 0; i < carriageCount; i++) {
        train.carriages.push({ offsetX: i * carriageSpacing });
      }

      // People
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

    function drawSky() {
      const skyH = H * 0.50;
      const g = ctx.createLinearGradient(0, 0, 0, skyH);
      g.addColorStop(0,   '#5a9ce0');
      g.addColorStop(0.3, '#7ab8f0');
      g.addColorStop(0.7, '#a8d4f8');
      g.addColorStop(1,   '#d0eafc');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, skyH);

      // Subtle sun glow upper-right
      const sunG = ctx.createRadialGradient(W * 0.85, H * 0.06, 0, W * 0.85, H * 0.06, W * 0.3);
      sunG.addColorStop(0, 'rgba(255,250,220,0.3)');
      sunG.addColorStop(0.4, 'rgba(255,220,150,0.1)');
      sunG.addColorStop(1, 'transparent');
      ctx.fillStyle = sunG;
      ctx.fillRect(0, 0, W, skyH);
    }

    function drawClouds(frame: number) {
      for (const c of clouds) {
        c.x += 0.05;
        if (c.x > W + 200) c.x = -200;
        // Soft layered cloud
        for (let pass = 0; pass < 2; pass++) {
          ctx.globalAlpha = pass === 0 ? 0.55 : 0.88;
          ctx.fillStyle = pass === 0 ? 'rgba(220,235,255,0.7)' : 'rgba(255,255,255,0.85)';
          for (const b of c.blobs) {
            ctx.beginPath();
            ctx.ellipse(
              c.x + b.dx + (pass === 0 ? 2 : 0),
              c.y + b.dy + (pass === 0 ? 2 : 0) + Math.sin(frame * 0.003 + b.dx) * 0.8,
              b.rx * (pass === 0 ? 1.1 : 1),
              b.ry * (pass === 0 ? 1.1 : 1),
              0, 0, Math.PI * 2
            );
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // Draw smooth mountain layer using quadraticCurveTo
    function drawSmoothMountainLayer(layer: MountainLayer, snowThreshold: number) {
      const { baseY, amplitude, freq, colDark, colLight } = layer;
      const step = 30;

      function yAt(x: number) {
        return baseY - amplitude * Math.max(0, Math.sin(x * freq) * 0.5 + Math.sin(x * freq * 2.1) * 0.25 + 0.3);
      }

      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, baseY);

      let prevY = yAt(0);
      ctx.lineTo(0, prevY);
      for (let x = step; x <= W + step; x += step) {
        const nx = Math.min(x, W);
        const ny = yAt(nx);
        ctx.quadraticCurveTo(x - step * 0.5, (prevY + ny) / 2 - 5, nx, ny);
        prevY = ny;
      }
      ctx.lineTo(W, H);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, baseY - amplitude, 0, baseY);
      grad.addColorStop(0, colLight);
      grad.addColorStop(1, colDark);
      ctx.fillStyle = grad;
      ctx.fill();

      // Atmospheric haze on peaks
      const haze = ctx.createLinearGradient(0, baseY - amplitude, 0, baseY - amplitude * 0.5);
      haze.addColorStop(0, 'rgba(200,220,255,0.18)');
      haze.addColorStop(1, 'rgba(200,220,255,0.0)');
      ctx.fillStyle = haze;
      ctx.fill();

      // Snow caps with gradient
      for (let x = 0; x <= W; x += 40) {
        const peakY = yAt(x);
        if (peakY < snowThreshold) {
          const snowBaseY = snowThreshold;
          const snowGrad = ctx.createLinearGradient(x, peakY, x, snowBaseY);
          snowGrad.addColorStop(0, '#ffffff');
          snowGrad.addColorStop(0.5, 'rgba(220,230,255,0.9)');
          snowGrad.addColorStop(1, 'rgba(200,215,240,0)');
          ctx.fillStyle = snowGrad;
          const capW = (snowBaseY - peakY) * 0.9;
          ctx.beginPath();
          ctx.moveTo(x, peakY);
          ctx.lineTo(x - capW, snowBaseY);
          ctx.lineTo(x + capW, snowBaseY);
          ctx.closePath();
          ctx.fill();
          // Blue shadow
          ctx.fillStyle = 'rgba(160,180,220,0.35)';
          ctx.beginPath();
          ctx.moveTo(x, peakY);
          ctx.lineTo(x + capW * 0.08, peakY + capW * 0.4);
          ctx.lineTo(x + capW, snowBaseY);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Draw the Matterhorn as a clean sharp bezier pyramid
    function drawMatterhorn() {
      const cx = mattX;
      const base = mattBaseY;
      const ph = mattPeakH;
      const hw = W * 0.10;
      const tipY = base - ph;

      // Left face
      const leftGrad = ctx.createLinearGradient(cx - hw, base, cx, tipY);
      leftGrad.addColorStop(0, '#7a8898');
      leftGrad.addColorStop(1, '#9aacb8');
      ctx.fillStyle = leftGrad;
      ctx.beginPath();
      ctx.moveTo(cx - hw, base);
      ctx.bezierCurveTo(cx - hw * 0.6, base - ph * 0.3, cx - hw * 0.2, base - ph * 0.7, cx, tipY);
      ctx.bezierCurveTo(cx - hw * 0.08, base - ph * 0.82, cx - hw * 0.25, base - ph * 0.5, cx - hw * 0.5, base - ph * 0.2);
      ctx.closePath();
      ctx.fill();

      // Right face (slightly darker)
      const rightGrad = ctx.createLinearGradient(cx, tipY, cx + hw, base);
      rightGrad.addColorStop(0, '#606878');
      rightGrad.addColorStop(1, '#505868');
      ctx.fillStyle = rightGrad;
      ctx.beginPath();
      ctx.moveTo(cx, tipY);
      ctx.bezierCurveTo(cx + hw * 0.2, base - ph * 0.7, cx + hw * 0.6, base - ph * 0.3, cx + hw, base);
      ctx.bezierCurveTo(cx + hw * 0.5, base - ph * 0.2, cx + hw * 0.08, base - ph * 0.5, cx, tipY);
      ctx.closePath();
      ctx.fill();

      // Snow cap on Matterhorn
      const snowEndY = base - ph * 0.72;
      const snowGrad = ctx.createLinearGradient(cx, tipY, cx, snowEndY);
      snowGrad.addColorStop(0, '#ffffff');
      snowGrad.addColorStop(0.5, 'rgba(230,238,255,0.95)');
      snowGrad.addColorStop(1, 'rgba(210,225,250,0)');
      ctx.fillStyle = snowGrad;
      ctx.beginPath();
      ctx.moveTo(cx, tipY);
      ctx.bezierCurveTo(cx - hw * 0.12, tipY + ph * 0.08, cx - hw * 0.22, tipY + ph * 0.18, cx - hw * 0.28, snowEndY);
      ctx.lineTo(cx + hw * 0.28, snowEndY);
      ctx.bezierCurveTo(cx + hw * 0.22, tipY + ph * 0.18, cx + hw * 0.12, tipY + ph * 0.08, cx, tipY);
      ctx.closePath();
      ctx.fill();
    }

    function drawMountains() {
      const skyH = H * 0.50;
      // Back layer
      drawSmoothMountainLayer(mountainLayers[0], skyH * 0.55);
      // Mid layer
      drawSmoothMountainLayer(mountainLayers[1], skyH * 0.72);
      // Front layer
      drawSmoothMountainLayer(mountainLayers[2], skyH * 0.88);
      // Matterhorn on top
      drawMatterhorn();
    }

    // Draw pine trees as stacked ellipses
    function drawPineTree(t: PineTree) {
      const layers3 = [
        { yOff: 0, rx: t.w, ry: t.h * 0.35 },
        { yOff: -t.h * 0.3, rx: t.w * 0.72, ry: t.h * 0.28 },
        { yOff: -t.h * 0.58, rx: t.w * 0.44, ry: t.h * 0.20 },
      ];
      for (const l of layers3) {
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.ellipse(t.x, t.baseY - t.h * 0.5 + l.yOff, l.rx, l.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Trunk
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(t.x - 1.5, t.baseY - 4, 3, 6);
    }

    function drawPineRow(trees: PineTree[]) {
      for (const t of trees) drawPineTree(t);
    }

    function drawValley() {
      const valleyTop = H * 0.75;
      // River-lit valley: lighter near river, darker away
      const riverCenterX = W * 0.55;
      const g = ctx.createLinearGradient(0, valleyTop, 0, H);
      g.addColorStop(0, '#4a9828');
      g.addColorStop(0.5, '#3a8820');
      g.addColorStop(1, '#50a828');
      ctx.fillStyle = g;
      ctx.fillRect(0, valleyTop, W, H - valleyTop);

      // Subtle texture variation — lighter near river
      const riverLight = ctx.createRadialGradient(riverCenterX, H * 0.88, 0, riverCenterX, H * 0.88, W * 0.3);
      riverLight.addColorStop(0, 'rgba(100,200,80,0.15)');
      riverLight.addColorStop(1, 'transparent');
      ctx.fillStyle = riverLight;
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
      for (let i = 1; i < riverPoints.length - 1; i++) {
        const cp = riverPoints[i];
        const np = riverPoints[i + 1];
        ctx.quadraticCurveTo(cp.x, cp.y, (cp.x + np.x) / 2, (cp.y + np.y) / 2);
      }
      ctx.lineTo(riverPoints[riverPoints.length - 1].x, riverPoints[riverPoints.length - 1].y);
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

    // 3D house drawing (same as Suburban)
    function drawAlpsHouse(h: AlpsHouse) {
      const bodyY = h.y;
      const bodyH = h.h;
      const bodyW = h.w;

      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Body gradient
      const bodyGrad = ctx.createLinearGradient(h.x, bodyY, h.x + bodyW, bodyY + bodyH);
      bodyGrad.addColorStop(0, h.bodyColor);
      bodyGrad.addColorStop(1, shadeHex(h.bodyColor, -12));
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.roundRect(h.x, bodyY, bodyW, bodyH, 1);
      ctx.fill();

      // Side wall (3D)
      ctx.fillStyle = shadeHex(h.bodyColor, -25);
      ctx.beginPath();
      ctx.moveTo(h.x + bodyW, bodyY);
      ctx.lineTo(h.x + bodyW + 5, bodyY - 4);
      ctx.lineTo(h.x + bodyW + 5, bodyY + bodyH - 4);
      ctx.lineTo(h.x + bodyW, bodyY + bodyH);
      ctx.closePath();
      ctx.fill();

      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

      // Roof front face
      const roofGrad = ctx.createLinearGradient(h.x, h.y - h.roofH, h.x, bodyY);
      roofGrad.addColorStop(0, h.roofColor);
      roofGrad.addColorStop(1, shadeHex(h.roofColor, -20));
      ctx.fillStyle = roofGrad;
      ctx.beginPath();
      ctx.moveTo(h.x - 2, bodyY);
      ctx.lineTo(h.x + bodyW * 0.5, h.y - h.roofH);
      ctx.lineTo(h.x + bodyW + 2, bodyY);
      ctx.closePath();
      ctx.fill();

      // Roof side face
      ctx.fillStyle = shadeHex(h.roofColor, -40);
      ctx.beginPath();
      ctx.moveTo(h.x + bodyW + 2, bodyY);
      ctx.lineTo(h.x + bodyW * 0.5, h.y - h.roofH);
      ctx.lineTo(h.x + bodyW * 0.5 + 5, h.y - h.roofH - 3);
      ctx.lineTo(h.x + bodyW + 7, bodyY - 3);
      ctx.closePath();
      ctx.fill();

      // Windows
      for (const w of h.windows) {
        ctx.fillStyle = '#c0a878';
        ctx.fillRect(h.x + w.x - 0.5, h.y + w.y - 0.5, w.w + 1, w.h + 1);
        ctx.fillStyle = 'rgba(200,230,255,0.65)';
        ctx.fillRect(h.x + w.x, h.y + w.y, w.w, w.h);
        ctx.strokeStyle = '#c0a878'; ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(h.x + w.x + w.w / 2, h.y + w.y);
        ctx.lineTo(h.x + w.x + w.w / 2, h.y + w.y + w.h);
        ctx.stroke();
      }

      // Doors (arched)
      for (const d of h.doors) {
        const doorX = h.x + d.x;
        const doorY = h.y + d.y;
        const doorW = d.w;
        const doorH = d.h;
        ctx.fillStyle = '#8b5e3c';
        ctx.beginPath();
        ctx.moveTo(doorX, h.y + h.h);
        ctx.lineTo(doorX, doorY + doorH * 0.3);
        ctx.arc(doorX + doorW / 2, doorY + doorH * 0.3, doorW / 2, Math.PI, 0);
        ctx.lineTo(doorX + doorW, h.y + h.h);
        ctx.closePath();
        ctx.fill();
      }
    }

    function drawHouses() {
      for (const h of houses) drawAlpsHouse(h);
    }

    function drawChurch() {
      if (!churchW) return;
      const x = churchX, y = churchY, w = churchW, h = churchH;

      ctx.shadowColor = 'rgba(0,0,0,0.12)';
      ctx.shadowBlur = 4; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;

      ctx.fillStyle = '#f4f0e8';
      ctx.fillRect(x, y, w, h);

      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

      ctx.fillStyle = '#9a7040';
      ctx.beginPath();
      ctx.arc(x + w * 0.5, y + h - 10, 5, Math.PI, 0);
      ctx.rect(x + w * 0.5 - 5, y + h - 10, 10, 10);
      ctx.fill();

      ctx.fillStyle = '#ffeea0';
      ctx.beginPath(); ctx.arc(x + w * 0.25, y + h * 0.35, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w * 0.75, y + h * 0.35, 3, 0, Math.PI * 2); ctx.fill();

      // Roof with gradient
      const roofGrad = ctx.createLinearGradient(x, y - 12, x, y);
      roofGrad.addColorStop(0, '#c84020');
      roofGrad.addColorStop(1, '#a03018');
      ctx.fillStyle = roofGrad;
      ctx.beginPath();
      ctx.moveTo(x - 2, y);
      ctx.lineTo(x + w * 0.5, y - 12);
      ctx.lineTo(x + w + 2, y);
      ctx.closePath();
      ctx.fill();

      const spireBaseX = x + w * 0.5;
      const spireBaseY = y - 12;
      ctx.fillStyle = '#484840';
      ctx.beginPath();
      ctx.moveTo(spireBaseX - 4, spireBaseY);
      ctx.lineTo(spireBaseX, spireBaseY - 28);
      ctx.lineTo(spireBaseX + 4, spireBaseY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#484840'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(spireBaseX - 4, spireBaseY - 32);
      ctx.lineTo(spireBaseX + 4, spireBaseY - 32);
      ctx.moveTo(spireBaseX, spireBaseY - 35);
      ctx.lineTo(spireBaseX, spireBaseY - 28);
      ctx.stroke();

      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.arc(x + w * 0.5, y + h * 0.18, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#484840'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(x + w * 0.5, y + h * 0.18, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 0.8;
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
      ctx.strokeStyle = 'rgba(60,45,30,0.4)';
      ctx.lineWidth = 1.5;
      for (let tx = 0; tx < W; tx += 18) {
        ctx.beginPath();
        ctx.moveTo(tx, trackY + 2);
        ctx.lineTo(tx, trackY + 10);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(80,70,60,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, trackY + 3); ctx.lineTo(W, trackY + 3); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, trackY + 9); ctx.lineTo(W, trackY + 9); ctx.stroke();
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

        ctx.fillStyle = '#cc2222';
        ctx.beginPath();
        ctx.roundRect(cx, cy, cw, ch, r);
        ctx.fill();

        ctx.fillStyle = '#a01818';
        ctx.fillRect(cx + 1, cy, cw - 2, 5);

        ctx.fillStyle = 'rgba(255,250,230,0.85)';
        ctx.fillRect(cx + 4, cy + 5, 7, 5);
        ctx.fillRect(cx + 15, cy + 5, 7, 5);

        ctx.strokeStyle = 'rgba(160,20,20,0.6)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(cx + 4, cy + 5, 7, 5);
        ctx.strokeRect(cx + 15, cy + 5, 7, 5);

        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(cx + 6, cy + ch, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + cw - 6, cy + ch, 3, 0, Math.PI * 2); ctx.fill();
      }

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
      ctx.fillStyle = '#222';
      ctx.fillRect(lx + 28, ly - 5, 5, 6);
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

        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - bodyW / 2, p.y - totalH * 0.5 + headR * 2 + 1, bodyW, bodyH);

        ctx.fillStyle = '#f0d0a8';
        ctx.beginPath();
        ctx.arc(p.x, p.y - totalH * 0.5 + headR, headR, 0, Math.PI * 2);
        ctx.fill();

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
