'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

interface Star { x: number; y: number; r: number; phase: number; }
interface Cloud { x: number; y: number; w: number; h: number; phase: number; }
interface ShimmerLine { x: number; y: number; len: number; vx: number; opacity: number; }
interface PineTree { x: number; h: number; w: number; col: string; }

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

    // Mountain layer config (computed in init)
    const layers: Array<{ baseY: number; amplitude: number; freq: number; col: string; col2: string; }> = [];

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      mountainY = H * 0.52; lakeY = H * 0.75;
      stars.length = 0; clouds.length = 0; shimmerLines.length = 0;
      pineTrees.length = 0; layers.length = 0;

      // Stars — upper third
      for (let i = 0; i < 180; i++) {
        stars.push({ x: rand(0, W), y: rand(0, mountainY * 0.75), r: rand(0.4, 2.2), phase: rand(0, Math.PI * 2) });
      }

      // Wispy clouds
      for (let i = 0; i < 3; i++) {
        clouds.push({ x: rand(0, W), y: rand(mountainY * 0.1, mountainY * 0.45), w: rand(W * 0.18, W * 0.32), h: rand(20, 40), phase: rand(0, Math.PI * 2) });
      }

      // Mountain layers (back → front)
      layers.push({ baseY: mountainY, amplitude: mountainY * 0.52, freq: 3.8 / W * Math.PI, col: '#8060a0', col2: '#a080c0' });
      layers.push({ baseY: mountainY, amplitude: mountainY * 0.62, freq: 3.1 / W * Math.PI, col: '#503878', col2: '#705098' });
      layers.push({ baseY: mountainY, amplitude: mountainY * 0.75, freq: 2.6 / W * Math.PI, col: '#2a1848', col2: '#3a2858' });

      // Pine trees at base of mountains
      let tx = -15;
      const mobile = W < 600;
      const treeStep = mobile ? 18 : 14;
      while (tx < W + 15) {
        const th = rand(30, 65);
        const tw = th * 0.36;
        const greenVar = randInt(8, 22);
        const col = `rgb(${greenVar},${greenVar + rand(10, 28)},${greenVar})`;
        pineTrees.push({ x: tx, h: th, w: tw, col });
        tx += rand(treeStep - 4, treeStep + 6);
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

    function randInt(a: number, b: number) { return Math.floor(rand(a, b)); }

    function drawSky() {
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

    // Aurora ribbons — wavy filled shapes
    function drawAurora() {
      const auroraData = [
        { baseY: mountainY * 0.20, ampTop: 18, ampBot: 28, col: 'rgba(80,200,160,', freq: 0.006 },
        { baseY: mountainY * 0.32, ampTop: 14, ampBot: 22, col: 'rgba(120,80,220,', freq: 0.009 },
        { baseY: mountainY * 0.12, ampTop: 10, ampBot: 16, col: 'rgba(60,180,220,', freq: 0.007 },
      ];
      const t = Date.now() * 0.001;
      for (const a of auroraData) {
        ctx.beginPath();
        ctx.moveTo(0, a.baseY - a.ampTop);
        // Top edge — wavy sine
        for (let x = 0; x <= W; x += 20) {
          const y = a.baseY - a.ampTop + Math.sin(x * a.freq + t * 0.5) * a.ampTop * 0.5;
          const nx = Math.min(x + 20, W);
          const ny = a.baseY - a.ampTop + Math.sin(nx * a.freq + t * 0.5) * a.ampTop * 0.5;
          ctx.quadraticCurveTo(x + 10, (y + ny) / 2 - 3, nx, ny);
        }
        // Bottom edge — reversed
        for (let x = W; x >= 0; x -= 20) {
          const y = a.baseY + a.ampBot + Math.sin(x * a.freq + t * 0.6 + 1) * a.ampBot * 0.4;
          const nx = Math.max(x - 20, 0);
          const ny = a.baseY + a.ampBot + Math.sin(nx * a.freq + t * 0.6 + 1) * a.ampBot * 0.4;
          ctx.quadraticCurveTo(x - 10, (y + ny) / 2 + 3, nx, ny);
        }
        ctx.closePath();
        const aGrad = ctx.createLinearGradient(0, a.baseY - a.ampTop, 0, a.baseY + a.ampBot);
        aGrad.addColorStop(0, a.col + '0.0)');
        aGrad.addColorStop(0.4, a.col + '0.22)');
        aGrad.addColorStop(0.6, a.col + '0.18)');
        aGrad.addColorStop(1, a.col + '0.0)');
        ctx.fillStyle = aGrad;
        ctx.fill();
      }
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

    // Smooth mountain layer using quadraticCurveTo
    function drawMountainLayer(baseY: number, amplitude: number, freq: number, col: string, col2: string) {
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, baseY);

      const step = 30;
      function yAt(x: number) {
        return baseY - amplitude * Math.max(0, Math.sin(x * freq) * 0.5 + Math.sin(x * freq * 2.1) * 0.25 + 0.3);
      }

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
      grad.addColorStop(0, col2);
      grad.addColorStop(1, col);
      ctx.fillStyle = grad;
      ctx.fill();

      // Atmospheric haze overlay on layer
      const haze = ctx.createLinearGradient(0, baseY - amplitude, 0, baseY);
      haze.addColorStop(0, 'rgba(180,140,220,0.10)');
      haze.addColorStop(1, 'rgba(180,140,220,0.0)');
      ctx.fillStyle = haze;
      ctx.fill();
    }

    // Snow caps with gradient
    function drawSnowCap(peakX: number, peakY: number, snowBaseY: number) {
      if (peakY > snowBaseY) return;
      const snowGrad = ctx.createLinearGradient(peakX, peakY, peakX, snowBaseY);
      snowGrad.addColorStop(0, '#ffffff');
      snowGrad.addColorStop(0.5, 'rgba(220,230,255,0.9)');
      snowGrad.addColorStop(1, 'rgba(200,215,240,0)');
      ctx.fillStyle = snowGrad;
      const capW = (snowBaseY - peakY) * 0.9;
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX - capW, snowBaseY);
      ctx.lineTo(peakX + capW, snowBaseY);
      ctx.closePath();
      ctx.fill();
    }

    function drawMountains() {
      // Draw back to front
      for (const l of layers) {
        drawMountainLayer(l.baseY, l.amplitude, l.freq, l.col, l.col2);
      }

      // Snow caps on distant layer peaks (approximate peak positions)
      const distFreq = layers[0].freq;
      const distAmp = layers[0].amplitude;
      for (let x = 0; x <= W; x += 55) {
        const y = mountainY - distAmp * Math.max(0, Math.sin(x * distFreq) * 0.5 + Math.sin(x * distFreq * 2.1) * 0.25 + 0.3);
        if (y < mountainY * 0.38) {
          drawSnowCap(x, y, mountainY * 0.38);
        }
      }

      // Snow caps on mid layer peaks
      const midFreq = layers[1].freq;
      const midAmp = layers[1].amplitude;
      for (let x = 0; x <= W; x += 48) {
        const y = mountainY - midAmp * Math.max(0, Math.sin(x * midFreq) * 0.5 + Math.sin(x * midFreq * 2.1) * 0.25 + 0.3);
        if (y < mountainY * 0.28) {
          drawSnowCap(x, y, mountainY * 0.28);
        }
      }

      // Heavy snow caps on close layer peaks
      const closeFreq = layers[2].freq;
      const closeAmp = layers[2].amplitude;
      for (let x = 0; x <= W; x += 42) {
        const y = mountainY - closeAmp * Math.max(0, Math.sin(x * closeFreq) * 0.5 + Math.sin(x * closeFreq * 2.1) * 0.25 + 0.3);
        if (y < mountainY * 0.22) {
          drawSnowCap(x, y, mountainY * 0.22);
        }
      }
    }

    function drawPineForest() {
      const treeBaseY = mountainY * 0.98;
      for (const t of pineTrees) {
        // Soft drop shadow
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(t.x + 3, treeBaseY + 2, t.w * 0.6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Draw as 3 stacked ellipses for a softer look
        const layers3 = [
          { yOff: 0, rx: t.w, ry: t.h * 0.35, alpha: 0.9 },
          { yOff: -t.h * 0.3, rx: t.w * 0.72, ry: t.h * 0.3, alpha: 0.85 },
          { yOff: -t.h * 0.58, rx: t.w * 0.44, ry: t.h * 0.22, alpha: 0.8 },
        ];
        for (const layer of layers3) {
          ctx.globalAlpha = layer.alpha;
          ctx.fillStyle = t.col;
          ctx.beginPath();
          ctx.ellipse(t.x, treeBaseY - t.h * 0.5 + layer.yOff, layer.rx, layer.ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Trunk
        ctx.fillStyle = '#3a2010';
        ctx.fillRect(t.x - 1.5, treeBaseY - 5, 3, 7);
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

      ctx.globalAlpha = 0.55;
      ctx.fillStyle = lake;
      ctx.fillRect(0, lakeY, W, H - lakeY);
      ctx.globalAlpha = 1;

      const darkOverlay = ctx.createLinearGradient(0, lakeY, 0, H);
      darkOverlay.addColorStop(0, 'rgba(0,0,0,0.35)');
      darkOverlay.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = darkOverlay;
      ctx.fillRect(0, lakeY, W, H - lakeY);

      // Pine tree reflections using ctx.scale(1,-1) approach
      ctx.save();
      ctx.translate(0, lakeY * 2);
      ctx.scale(1, -1);
      ctx.globalAlpha = 0.22;
      const treeBaseY = mountainY * 0.98;
      for (const t of pineTrees) {
        ctx.fillStyle = '#060c08';
        ctx.beginPath();
        ctx.ellipse(t.x, treeBaseY - t.h * 0.5, t.w, t.h * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
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
      drawAurora();
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
