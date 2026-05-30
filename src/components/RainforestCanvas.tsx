'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

interface TreeCluster { x: number; y: number; r: number; col: string; shadowX: number; shadowY: number; bright: boolean; }
interface Bird { x: number; y: number; vx: number; vy: number; paired: boolean; }
interface RiverCP { x: number; y: number; }

const CANOPY_COLS = ['#2a8c18','#1e7010','#268c1a','#32a020','#1a6010','#3ab828','#128808','#20780e'];

export default function RainforestCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0;
    const clusters: TreeCluster[] = [];
    const birds: Bird[] = [];
    let riverCPs: RiverCP[] = [];
    let riverTopCPs: RiverCP[] = [];
    let riverBotCPs: RiverCP[] = [];
    let shimmerOffset = 0;
    let riverCenterY = 0;
    let riverHalfWidth = 0;

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      clusters.length = 0; birds.length = 0;
      riverCenterY = H * 0.5;
      riverHalfWidth = W * 0.065; // ~13% total width

      // Pre-generate 90-110 tree clusters scattered across full canvas
      const count = 90 + Math.floor(Math.random() * 21);
      for (let i = 0; i < count; i++) {
        clusters.push({
          x: rand(-30, W + 30),
          y: rand(-30, H + 30),
          r: rand(20, 60),
          col: pick(CANOPY_COLS),
          shadowX: rand(2, 4),
          shadowY: rand(2, 4),
          bright: Math.random() > 0.45,
        });
      }

      // Pre-generate river control points (winding left→right)
      const segments = 6;
      riverCPs = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = W * t;
        const y = riverCenterY + Math.sin(t * Math.PI * 2.5) * H * 0.12 + Math.sin(t * Math.PI * 1.3 + 1) * H * 0.06;
        riverCPs.push({ x, y });
      }

      // Top & bottom banks for the river path (offset from center)
      riverTopCPs = riverCPs.map(p => ({ x: p.x, y: p.y - riverHalfWidth }));
      riverBotCPs = riverCPs.map(p => ({ x: p.x, y: p.y + riverHalfWidth }));

      // Pre-generate birds (15-25)
      const birdCount = 15 + Math.floor(Math.random() * 11);
      for (let i = 0; i < birdCount; i++) {
        const paired = Math.random() > 0.5;
        birds.push({
          x: rand(-W * 0.2, W * 1.2),
          y: rand(0, H),
          vx: rand(0.4, 1.2) * (Math.random() > 0.5 ? 1 : -1),
          vy: rand(-0.15, 0.15),
          paired,
        });
      }
    }

    function buildSplinePath(pts: RiverCP[]) {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
    }

    function drawRiver() {
      // Sandy/muddy banks — slightly wider than river
      const bankPad = 5;
      const bankTopCPs = riverTopCPs.map(p => ({ x: p.x, y: p.y - bankPad }));
      const bankBotCPs = riverBotCPs.map(p => ({ x: p.x, y: p.y + bankPad }));

      ctx.fillStyle = '#5a3a10';
      ctx.beginPath();
      buildSplinePath(bankTopCPs);
      // reverse back along bottom
      const revBot = [...bankBotCPs].reverse();
      for (let i = 0; i < revBot.length - 1; i++) {
        const p0 = revBot[Math.max(0, i - 1)];
        const p1 = revBot[i];
        const p2 = revBot[i + 1];
        const p3 = revBot[Math.min(revBot.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
      ctx.closePath(); ctx.fill();

      // River water
      ctx.fillStyle = '#1a5a8a';
      ctx.beginPath();
      buildSplinePath(riverTopCPs);
      const revBotW = [...riverBotCPs].reverse();
      for (let i = 0; i < revBotW.length - 1; i++) {
        const p0 = revBotW[Math.max(0, i - 1)];
        const p1 = revBotW[i];
        const p2 = revBotW[i + 1];
        const p3 = revBotW[Math.min(revBotW.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
      ctx.closePath(); ctx.fill();

      // Shimmer highlights along river
      shimmerOffset = (shimmerOffset + 0.5) % (W + 60);
      ctx.strokeStyle = 'rgba(80,160,200,0.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const t = ((i * 73 + shimmerOffset) % (W + 60)) / W;
        if (t < 0 || t > 1) continue;
        // interpolate along river center
        const idx = Math.min(Math.floor(t * (riverCPs.length - 1)), riverCPs.length - 2);
        const localT = t * (riverCPs.length - 1) - idx;
        const cy = riverCPs[idx].y + (riverCPs[idx + 1].y - riverCPs[idx].y) * localT;
        const cx2 = W * t;
        ctx.beginPath();
        ctx.moveTo(cx2 - 20, cy - riverHalfWidth * 0.3);
        ctx.lineTo(cx2 + 20, cy + riverHalfWidth * 0.3);
        ctx.stroke();
      }
    }

    function drawClusters() {
      for (const c of clusters) {
        // Shadow
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#000';
        const sg = ctx.createRadialGradient(c.x + c.shadowX, c.y + c.shadowY, 0, c.x + c.shadowX, c.y + c.shadowY, c.r);
        sg.addColorStop(0, 'rgba(0,0,0,0.5)');
        sg.addColorStop(1, 'transparent');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(c.x + c.shadowX, c.y + c.shadowY, c.r, 0, Math.PI * 2); ctx.fill();

        // Canopy with radial gradient
        ctx.globalAlpha = 0.92;
        const brightCenter = c.bright ? c.col : '#0e5008';
        const darkEdge = c.bright ? '#0e5008' : '#082008';
        const g = ctx.createRadialGradient(c.x - c.r * 0.2, c.y - c.r * 0.2, 0, c.x, c.y, c.r);
        g.addColorStop(0, brightCenter);
        g.addColorStop(0.65, c.col);
        g.addColorStop(1, darkEdge);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function loop() {
      // Background
      ctx.fillStyle = '#082008';
      ctx.fillRect(0, 0, W, H);

      // Draw dense canopy clusters
      drawClusters();

      // Draw river on top of canopy
      drawRiver();

      // Birds (tiny V-shapes or dots seen from above)
      for (const b of birds) {
        b.x += b.vx;
        b.y += b.vy + Math.sin(b.x * 0.05) * 0.1;
        if (b.x > W + 40) b.x = -40;
        if (b.x < -40) b.x = W + 40;
        if (b.y < 0) b.y = H;
        if (b.y > H) b.y = 0;

        const span = rand(4, 7);
        ctx.strokeStyle = 'rgba(10,20,10,0.8)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(b.x - span, b.y - span * 0.4);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(b.x + span, b.y - span * 0.4);
        ctx.stroke();

        // Paired bird offset slightly
        if (b.paired) {
          ctx.beginPath();
          ctx.moveTo(b.x - span + 6, b.y + 5 - span * 0.4);
          ctx.lineTo(b.x + 6, b.y + 5);
          ctx.lineTo(b.x + span + 6, b.y + 5 - span * 0.4);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(loop);
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
