'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

interface Star     { x: number; y: number; r: number; phase: number; base: number; }
interface Satellite{ angle: number; speed: number; orbitA: number; orbitB: number; cx: number; cy: number; rot: number; }
interface Meteor   { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; active: boolean; }

export default function SpaceCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0, frame = 0;
    let earthX = 0, earthY = 0, earthR = 0;
    const stars: Star[] = []; const sats: Satellite[] = []; const meteors: Meteor[] = [];
    let sunPulse = 0;

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      earthX = W * 0.68; earthY = H * 0.62; earthR = Math.min(W, H) * 0.22;
      stars.length = 0; sats.length = 0; meteors.length = 0;

      for (let i = 0; i < 280; i++) {
        stars.push({ x: rand(0, W), y: rand(0, H), r: rand(0.4, 2.2), phase: rand(0, Math.PI * 2), base: rand(0.4, 1) });
      }

      // Satellites at different orbit sizes
      const orbitConfigs = [
        { a: earthR * 1.35, b: earthR * 0.55, spd: 0.006 },
        { a: earthR * 1.7,  b: earthR * 0.65, spd: 0.004 },
        { a: earthR * 2.1,  b: earthR * 0.78, spd: 0.0028 },
        { a: earthR * 1.5,  b: earthR * 1.1,  spd: 0.0035 },
      ];
      for (const oc of orbitConfigs) {
        sats.push({ angle: rand(0, Math.PI * 2), speed: oc.spd, orbitA: oc.a, orbitB: oc.b, cx: earthX, cy: earthY, rot: rand(0, Math.PI * 2) });
      }

      for (let i = 0; i < 4; i++) meteors.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 40, active: false });
    }

    function spawnMeteor() {
      const m = meteors.find(m => !m.active);
      if (!m) return;
      m.x = rand(0, W); m.y = rand(0, H * 0.4);
      const angle = rand(Math.PI * 0.6, Math.PI * 0.9);
      const spd = rand(8, 15);
      m.vx = Math.cos(angle) * spd; m.vy = Math.sin(angle) * spd;
      m.life = 0; m.maxLife = rand(25, 50); m.active = true;
    }

    function drawEarth() {
      ctx.save();
      // Clip to circle first
      ctx.beginPath();
      ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
      ctx.clip();

      // Ocean base
      const oceanGrad = ctx.createRadialGradient(
        earthX - earthR * 0.3, earthY - earthR * 0.3, 0,
        earthX, earthY, earthR
      );
      oceanGrad.addColorStop(0,   '#2870d0');
      oceanGrad.addColorStop(0.6, '#1a50a8');
      oceanGrad.addColorStop(1,   '#0e2d70');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(earthX - earthR, earthY - earthR, earthR * 2, earthR * 2);

      // S-shaped landmasses (like Siyne's initial)
      ctx.fillStyle = 'rgba(45,110,40,0.88)';

      // Upper part of S — large northern landmass
      ctx.beginPath();
      ctx.moveTo(earthX - earthR * 0.5, earthY - earthR * 0.6);
      ctx.bezierCurveTo(
        earthX - earthR * 0.1, earthY - earthR * 0.9,
        earthX + earthR * 0.5, earthY - earthR * 0.7,
        earthX + earthR * 0.4, earthY - earthR * 0.1
      );
      ctx.bezierCurveTo(
        earthX + earthR * 0.35, earthY + earthR * 0.15,
        earthX + earthR * 0.0, earthY + earthR * 0.0,
        earthX - earthR * 0.1, earthY - earthR * 0.1
      );
      ctx.bezierCurveTo(
        earthX - earthR * 0.35, earthY - earthR * 0.3,
        earthX - earthR * 0.6, earthY - earthR * 0.3,
        earthX - earthR * 0.5, earthY - earthR * 0.6
      );
      ctx.closePath(); ctx.fill();

      // Lower part of S — southern landmass
      ctx.beginPath();
      ctx.moveTo(earthX + earthR * 0.4, earthY + earthR * 0.05);
      ctx.bezierCurveTo(
        earthX + earthR * 0.5, earthY + earthR * 0.3,
        earthX + earthR * 0.2, earthY + earthR * 0.7,
        earthX - earthR * 0.1, earthY + earthR * 0.75
      );
      ctx.bezierCurveTo(
        earthX - earthR * 0.5, earthY + earthR * 0.8,
        earthX - earthR * 0.6, earthY + earthR * 0.5,
        earthX - earthR * 0.4, earthY + earthR * 0.3
      );
      ctx.bezierCurveTo(
        earthX - earthR * 0.2, earthY + earthR * 0.1,
        earthX + earthR * 0.1, earthY + earthR * 0.2,
        earthX + earthR * 0.4, earthY + earthR * 0.05
      );
      ctx.closePath(); ctx.fill();

      // Ice caps
      ctx.fillStyle = 'rgba(240,245,255,0.75)';
      ctx.beginPath(); ctx.ellipse(earthX, earthY - earthR * 0.88, earthR * 0.3, earthR * 0.15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(earthX, earthY + earthR * 0.88, earthR * 0.22, earthR * 0.12, 0, 0, Math.PI * 2); ctx.fill();

      // Cloud layer
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      const cloudData: [number,number,number,number][] = [[-0.08,-0.42,0.42,0.08],[0.28,-0.08,0.32,0.07],[-0.38,0.18,0.28,0.08],[0.08,0.38,0.38,0.07]];
      for (const [cx,cy,cw,ch] of cloudData) {
        ctx.beginPath(); ctx.ellipse(earthX+earthR*cx, earthY+earthR*cy, earthR*cw, earthR*ch, 0, 0, Math.PI*2); ctx.fill();
      }

      // Night-side terminator (dark half on right side)
      const terminator = ctx.createLinearGradient(earthX, earthY - earthR, earthX + earthR * 1.2, earthY + earthR);
      terminator.addColorStop(0,    'transparent');
      terminator.addColorStop(0.55, 'rgba(0,5,25,0.25)');
      terminator.addColorStop(1,    'rgba(0,5,25,0.78)');
      ctx.fillStyle = terminator;
      ctx.fillRect(earthX - earthR, earthY - earthR, earthR * 2, earthR * 2);

      ctx.restore();

      // Atmosphere glow (OUTSIDE clip)
      const atmoGlow = ctx.createRadialGradient(earthX, earthY, earthR * 0.92, earthX, earthY, earthR * 1.22);
      atmoGlow.addColorStop(0,   'rgba(80,150,255,0.20)');
      atmoGlow.addColorStop(0.5, 'rgba(50,120,220,0.10)');
      atmoGlow.addColorStop(1,   'transparent');
      ctx.fillStyle = atmoGlow;
      ctx.beginPath(); ctx.arc(earthX, earthY, earthR * 1.22, 0, Math.PI * 2); ctx.fill();
    }

    function drawSatellite(s: Satellite) {
      const x = s.cx + Math.cos(s.angle) * s.orbitA;
      const y = s.cy + Math.sin(s.angle) * s.orbitB;
      ctx.save(); ctx.translate(x, y); ctx.rotate(s.angle + s.rot);
      // Body
      ctx.fillStyle = '#b8b8c8';
      ctx.fillRect(-6, -3, 12, 6);
      // Solar panels
      ctx.fillStyle = '#2040a0';
      ctx.fillRect(-22, -2, 14, 4);
      ctx.fillRect(8, -2, 14, 4);
      // Panel detail
      ctx.strokeStyle = '#4060c0'; ctx.lineWidth = 0.5;
      for (let i = -21; i < -8; i += 3.5) { ctx.beginPath(); ctx.moveTo(i, -2); ctx.lineTo(i, 2); ctx.stroke(); }
      for (let i = 9; i < 22; i += 3.5)   { ctx.beginPath(); ctx.moveTo(i, -2); ctx.lineTo(i, 2); ctx.stroke(); }
      ctx.restore();
    }

    function loop() {
      frame++; sunPulse += 0.018;
      if (frame % 220 === 0) spawnMeteor();

      // Background
      ctx.fillStyle = '#000008'; ctx.fillRect(0, 0, W, H);

      // Nebula blobs
      const nebulas: [number,number,number,string][] = [[W*0.15,H*0.3,200,'rgba(40,10,80,0.10)'],[W*0.75,H*0.15,180,'rgba(10,20,80,0.08)'],[W*0.5,H*0.7,160,'rgba(20,60,20,0.07)']];
      for (const [nx,ny,nr,nc] of nebulas) {
        const ng = ctx.createRadialGradient(nx,ny,0,nx,ny,nr);
        ng.addColorStop(0,nc); ng.addColorStop(1,'transparent');
        ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(nx,ny,nr,0,Math.PI*2); ctx.fill();
      }

      // Stars
      for (const s of stars) {
        s.phase += 0.012;
        const b = s.base + Math.sin(s.phase) * (1 - s.base) * 0.5;
        ctx.globalAlpha = b;
        ctx.fillStyle = s.r > 1.5 ? '#fffde8' : '#c8d0ff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Moon
      const moonX = W * 0.15, moonY = H * 0.18, moonR = 28;
      const moonG = ctx.createRadialGradient(moonX - moonR * 0.2, moonY - moonR * 0.2, 0, moonX, moonY, moonR);
      moonG.addColorStop(0, '#e8e0d0'); moonG.addColorStop(1, '#b8b0a0');
      ctx.fillStyle = moonG; ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();
      // Craters
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (const [cx,cy,cr] of [[moonX-8,moonY+5,5],[moonX+10,moonY-8,4],[moonX-4,moonY-12,3]]) {
        ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2); ctx.fill();
      }
      // Moon shadow
      ctx.fillStyle = 'rgba(0,5,20,0.5)';
      ctx.beginPath(); ctx.arc(moonX + 8, moonY, moonR, 0, Math.PI * 2); ctx.fill();

      // Orbit paths (faint)
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.8;
      for (const s of sats) {
        ctx.beginPath(); ctx.ellipse(s.cx, s.cy, s.orbitA, s.orbitB, 0, 0, Math.PI * 2); ctx.stroke();
      }

      // Earth
      drawEarth();

      // Satellites (update + draw)
      for (const s of sats) {
        s.angle += s.speed;
        // Only draw if in front of Earth (y > earthY center area)
        if (Math.sin(s.angle) > -0.1 || Math.cos(s.angle) * s.orbitA + s.cx < earthX - earthR) {
          drawSatellite(s);
        }
      }

      // Meteors
      for (const m of meteors) {
        if (!m.active) continue;
        m.x += m.vx; m.y += m.vy; m.life++;
        if (m.life >= m.maxLife) { m.active = false; continue; }
        const prog = m.life / m.maxLife;
        const len = 30 * (1 - prog);
        ctx.strokeStyle = `rgba(255,255,220,${(1 - prog) * 0.9})`;
        ctx.lineWidth = 1.5 * (1 - prog);
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * len / 8, m.y - m.vy * len / 8); ctx.stroke();
      }

      raf = requestAnimationFrame(loop);
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
