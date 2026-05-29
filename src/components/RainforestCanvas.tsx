'use client';

import { useEffect, useRef } from 'react';

interface Drop   { x: number; y: number; spd: number; len: number; op: number; }
interface Fly    { x: number; y: number; vx: number; vy: number; phase: number; }
interface Leaf   { x: number; y: number; vx: number; vy: number; rot: number; rs: number; sz: number; }
interface Trunk  { x: number; tw: number; th: number; }
interface Canopy { x: number; h: number; }

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

export default function RainforestCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let W = 0, H = 0;
    const drops:  Drop[]   = [];
    const flies:  Fly[]    = [];
    const leaves: Leaf[]   = [];
    const trunks: Trunk[]  = [];
    const canopy: Canopy[] = [];

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth  || 1200;
      H = canvas.offsetHeight || 700;
      canvas.width  = W;
      canvas.height = H;

      drops.length = 0; flies.length = 0; leaves.length = 0;
      trunks.length = 0; canopy.length = 0;

      for (let i = 0; i < 210; i++) drops.push({
        x: rand(0, W), y: rand(0, H),
        spd: rand(6, 14), len: rand(10, 24), op: rand(0.10, 0.38),
      });

      for (let i = 0; i < 28; i++) flies.push({
        x: rand(0, W), y: rand(H * 0.35, H * 0.88),
        vx: rand(-0.22, 0.22), vy: rand(-0.10, 0.10),
        phase: rand(0, Math.PI * 2),
      });

      for (let i = 0; i < 18; i++) leaves.push({
        x: rand(0, W), y: rand(-80, H),
        vx: rand(-0.55, 0.20), vy: rand(0.65, 1.55),
        rot: rand(0, Math.PI * 2), rs: rand(-0.032, 0.032),
        sz: rand(5, 14),
      });

      let tx = rand(15, 50);
      while (tx < W) {
        trunks.push({ x: tx, tw: rand(10, 28), th: rand(H * 0.26, H * 0.58) });
        tx += rand(65, 200);
      }

      for (let x = -40; x < W + 40; x += rand(38, 78)) {
        canopy.push({ x, h: rand(H * 0.10, H * 0.42) });
      }
    }

    function drawBg() {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0,   '#010d03');
      bg.addColorStop(0.45,'#020f05');
      bg.addColorStop(0.8, '#010c04');
      bg.addColorStop(1,   '#010b0e');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* canopy silhouettes */
      ctx.fillStyle = '#010901';
      for (const c of canopy) {
        ctx.beginPath();
        ctx.moveTo(c.x, 0);
        ctx.quadraticCurveTo(c.x + 32, H * 0.09, c.x + 64, 0);
        ctx.lineTo(c.x + 64, c.h);
        ctx.quadraticCurveTo(c.x + 32, c.h + 18, c.x, c.h);
        ctx.closePath();
        ctx.fill();
      }

      /* ambient glow at canopy level */
      const glow = ctx.createRadialGradient(W * 0.5, H * 0.14, 0, W * 0.5, H * 0.14, W * 0.54);
      glow.addColorStop(0, 'rgba(8,48,14,0.38)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      /* tree trunks */
      for (const t of trunks) {
        const g = ctx.createLinearGradient(t.x - t.tw / 2, 0, t.x + t.tw / 2, 0);
        g.addColorStop(0,   '#010601');
        g.addColorStop(0.5, '#020a02');
        g.addColorStop(1,   '#010601');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(t.x - t.tw / 2, H - t.th, t.tw, t.th, [2, 2, 0, 0]);
        ctx.fill();
      }

      /* ground mist */
      const mist = ctx.createLinearGradient(0, H * 0.74, 0, H);
      mist.addColorStop(0, 'transparent');
      mist.addColorStop(1, 'rgba(2,12,5,0.72)');
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, W, H);
    }

    let raf = 0;

    function loop() {
      drawBg();

      /* rain */
      ctx.lineWidth = 0.75;
      for (const d of drops) {
        d.x -= d.spd * 0.17;
        d.y += d.spd;
        if (d.y > H + 22) { d.y = rand(-22, -4); d.x = rand(-20, W + 20); }
        if (d.x < -20)    { d.x = W + 20; d.y = rand(0, H); }
        ctx.strokeStyle = `rgba(130,185,210,${d.op})`;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * 0.17, d.y + d.len);
        ctx.stroke();
      }

      /* fireflies */
      for (const f of flies) {
        f.phase += 0.036;
        f.vx += rand(-0.013, 0.013);
        f.vy += rand(-0.007, 0.007);
        f.vx *= 0.988; f.vy *= 0.988;
        f.x += f.vx; f.y += f.vy;
        if (f.x < 0) f.x = W; if (f.x > W) f.x = 0;
        if (f.y < H * 0.28) f.vy += 0.014;
        if (f.y > H * 0.93) f.vy -= 0.014;

        const b = (Math.sin(f.phase) * 0.5 + 0.5);
        if (b > 0.22) {
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 11);
          g.addColorStop(0,   `rgba(195,255,125,${b * 0.90})`);
          g.addColorStop(0.45,`rgba(85,205,52,${b * 0.36})`);
          g.addColorStop(1,   'transparent');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(f.x, f.y, 11, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      /* falling leaves */
      for (const l of leaves) {
        l.x += l.vx; l.y += l.vy; l.rot += l.rs;
        if (l.y > H + 32) { l.y = rand(-32, -8); l.x = rand(0, W); }
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(l.rot);
        ctx.globalAlpha = 0.42;
        const g = Math.floor(55 + l.sz * 3.5);
        ctx.fillStyle = `rgb(8,${g},10)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, l.sz, l.sz * 0.37, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(loop);
    }

    init();
    loop();

    const ro = new ResizeObserver(init);
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
