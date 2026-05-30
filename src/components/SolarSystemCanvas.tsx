'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

interface Planet {
  name: string; orbitR: number; size: number; speed: number; angle: number;
  col: string; col2: string; hasRings?: boolean; stripes?: boolean;
  moon?: { r: number; speed: number; angle: number; };
}
interface Star { x: number; y: number; r: number; phase: number; }

export default function SolarSystemCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0;
    let sunX = 0, sunY = 0, sunPulse = 0;
    const stars: Star[] = [];
    const planets: Planet[] = [];

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      sunX = W * 0.18; sunY = H * 0.5;
      stars.length = 0; planets.length = 0;

      for (let i = 0; i < 200; i++) stars.push({ x: rand(0, W), y: rand(0, H), r: rand(0.3, 1.8), phase: rand(0, Math.PI * 2) });

      const scale = Math.min(W, H) / 700;
      planets.push({ name:'Mercury', orbitR:75*scale, size:4*scale, speed:0.022, angle:rand(0,Math.PI*2), col:'#b8a898', col2:'#a09080' });
      planets.push({ name:'Venus', orbitR:115*scale, size:7*scale, speed:0.014, angle:rand(0,Math.PI*2), col:'#e8d0a0', col2:'#c8b080' });
      planets.push({ name:'Earth', orbitR:160*scale, size:8*scale, speed:0.010, angle:rand(0,Math.PI*2), col:'#2860a0', col2:'#48b048', moon:{ r:14*scale, speed:0.06, angle:0 } });
      planets.push({ name:'Mars', orbitR:210*scale, size:6*scale, speed:0.0075, angle:rand(0,Math.PI*2), col:'#c04020', col2:'#a03010' });
      planets.push({ name:'Jupiter', orbitR:285*scale, size:18*scale, speed:0.0040, angle:rand(0,Math.PI*2), col:'#c89060', col2:'#d0a070', stripes:true });
      planets.push({ name:'Saturn', orbitR:360*scale, size:14*scale, speed:0.0028, angle:rand(0,Math.PI*2), col:'#d8c070', col2:'#c0a850', hasRings:true });
      planets.push({ name:'Uranus', orbitR:425*scale, size:11*scale, speed:0.0018, angle:rand(0,Math.PI*2), col:'#80c8d8', col2:'#60b0c0' });
      planets.push({ name:'Neptune', orbitR:490*scale, size:10*scale, speed:0.0013, angle:rand(0,Math.PI*2), col:'#2040c0', col2:'#1830a0' });
    }

    function drawPlanet(p: Planet) {
      const px = sunX + Math.cos(p.angle) * p.orbitR;
      const py = sunY + Math.sin(p.angle) * p.orbitR * 0.38;

      // Saturn rings (behind)
      if (p.hasRings) {
        ctx.save(); ctx.translate(px, py);
        ctx.strokeStyle = 'rgba(200,180,80,0.5)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size * 2.4, p.size * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(180,160,60,0.3)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size * 2.8, p.size * 0.65, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // Planet body
      const g = ctx.createRadialGradient(px - p.size * 0.3, py - p.size * 0.3, 0, px, py, p.size);
      g.addColorStop(0, p.col); g.addColorStop(1, p.col2);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill();

      // Jupiter stripes
      if (p.stripes) {
        ctx.save(); ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = 'rgba(180,120,50,0.4)';
        for (const dy of [-p.size * 0.4, p.size * 0.1, p.size * 0.55]) {
          ctx.fillRect(px - p.size, py + dy, p.size * 2, p.size * 0.2);
        }
        ctx.restore();
      }

      // Earth continents
      if (p.name === 'Earth') {
        ctx.save(); ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = 'rgba(60,160,60,0.7)';
        ctx.beginPath(); ctx.ellipse(px - p.size * 0.2, py - p.size * 0.1, p.size * 0.35, p.size * 0.5, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px + p.size * 0.25, py + p.size * 0.1, p.size * 0.28, p.size * 0.38, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Moon
      if (p.moon) {
        p.moon.angle += p.moon.speed;
        const mx = px + Math.cos(p.moon.angle) * p.moon.r;
        const my = py + Math.sin(p.moon.angle) * p.moon.r * 0.5;
        ctx.fillStyle = '#c0b8a8';
        ctx.beginPath(); ctx.arc(mx, my, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      // Planet name label
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = `${Math.max(8, p.size * 0.7)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p.name, px, py + p.size + 10);
    }

    function loop() {
      sunPulse += 0.018;

      ctx.fillStyle = '#000010'; ctx.fillRect(0, 0, W, H);

      // Milky Way
      const mw = ctx.createLinearGradient(0, H * 0.2, W, H * 0.8);
      mw.addColorStop(0, 'transparent'); mw.addColorStop(0.5, 'rgba(180,160,255,0.04)'); mw.addColorStop(1, 'transparent');
      ctx.fillStyle = mw; ctx.fillRect(0, 0, W, H);

      // Stars
      for (const s of stars) {
        s.phase += 0.008;
        ctx.globalAlpha = 0.5 + Math.sin(s.phase) * 0.5;
        ctx.fillStyle = '#d8e0ff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Orbit paths
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.7;
      for (const p of planets) {
        ctx.beginPath(); ctx.ellipse(sunX, sunY, p.orbitR, p.orbitR * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
      }

      // Planets (update + draw)
      for (const p of planets) { p.angle += p.speed; }

      // Draw planets behind sun (y < sunY, so angle between PI and 2*PI)
      for (const p of planets) {
        if (Math.sin(p.angle) < 0) drawPlanet(p);
      }

      // Sun
      const sunR = 32 + Math.sin(sunPulse) * 3;
      // Corona glow
      const corona = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 3.5);
      corona.addColorStop(0, 'rgba(255,200,50,0.6)');
      corona.addColorStop(0.3, 'rgba(255,150,0,0.25)');
      corona.addColorStop(0.7, 'rgba(255,100,0,0.08)');
      corona.addColorStop(1, 'transparent');
      ctx.fillStyle = corona; ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 3.5, 0, Math.PI * 2); ctx.fill();

      const sunGrad = ctx.createRadialGradient(sunX - sunR * 0.3, sunY - sunR * 0.3, 0, sunX, sunY, sunR);
      sunGrad.addColorStop(0, '#fffde0'); sunGrad.addColorStop(0.5, '#ffe040'); sunGrad.addColorStop(1, '#ff8800');
      ctx.fillStyle = sunGrad; ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();

      // Planets in front of sun
      for (const p of planets) {
        if (Math.sin(p.angle) >= 0) drawPlanet(p);
      }

      raf = requestAnimationFrame(loop);
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
