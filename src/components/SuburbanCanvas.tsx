'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function shadeHex(col: string, amt: number): string {
  // Works for '#rrggbb' or 'rgb(r,g,b)' strings
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

interface Car    { x: number; y: number; w: number; h: number; spd: number; col: string; }
interface Walker { x: number; y: number; vx: number; phase: number; skin: string; cloth: string; }
interface Bird   { x: number; y: number; state: 'sit'|'fly'; flap: number; vx: number; wireY: number; sitTimer: number; }
interface Cloud  { x: number; y: number; r: number; dx: number; }
interface House  { x: number; w: number; h: number; roofH: number; col: string; trimCol: string; }

export default function SuburbanCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0, frame = 0;
    let roadY = 0, sidewalkY = 0, horizonY = 0;
    const cars: Car[] = []; const walkers: Walker[] = []; const birds: Bird[] = [];
    const clouds: Cloud[] = []; const houses: House[] = [];
    const wireXs: number[] = [];
    let dashOffset = 0;

    const HOUSE_COLS = ['#e8d8c0','#c8d8e8','#e8e0c8','#d8c8b8','#c0d8c8','#e0c8b8'];
    const SKIN = ['#f5d5a8','#e8b888','#c8906a','#a06840','#805030'];
    const CLOTH = ['#8898a8','#a8b8c8','#b8a890','#98a8b0','#c8c0b0'];

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      horizonY = H * 0.52; roadY = H * 0.75; sidewalkY = H * 0.70;
      cars.length = 0; walkers.length = 0; birds.length = 0;
      clouds.length = 0; houses.length = 0; wireXs.length = 0;

      // Power line poles
      for (let x = W * 0.1; x < W; x += W / 5) wireXs.push(x);

      // Houses
      let hx = 0;
      while (hx < W + 50) {
        const hw = rand(80, 140); const hh = rand(80, 130); const roofH = rand(30, 55);
        houses.push({ x: hx, w: hw, h: hh, roofH, col: pick(HOUSE_COLS), trimCol: '#ffffff' });
        hx += hw + rand(10, 35);
      }

      // Cars
      const laneA = roadY + (H - roadY) * 0.25;
      const laneB = roadY + (H - roadY) * 0.65;
      for (let i = 0; i < 5; i++) {
        const top = i < 3;
        cars.push({ x: rand(0, W), y: top ? laneA : laneB, w: rand(55, 75), h: rand(20, 26), spd: rand(1.2, 2.2) * (top ? -1 : 1), col: pick(['#d05030','#3050a0','#c0b850','#606878','#c8c8c8','#50a050']) });
      }

      // Walkers
      for (let i = 0; i < 5; i++) {
        walkers.push({ x: rand(0, W), y: sidewalkY - rand(4, 10), vx: rand(0.3, 0.7) * (Math.random() > 0.5 ? 1 : -1), phase: rand(0, Math.PI * 2), skin: pick(SKIN), cloth: pick(CLOTH) });
      }

      // Birds
      for (let i = 0; i < 12; i++) {
        const wireY = H * 0.58;
        birds.push({ x: rand(0, W), y: wireY, state: 'sit', flap: rand(0, Math.PI * 2), vx: rand(1.2, 2.5) * (Math.random() > 0.5 ? 1 : -1), wireY, sitTimer: rand(120, 400) });
      }

      // Clouds
      for (let i = 0; i < 5; i++) {
        clouds.push({ x: rand(0, W), y: rand(H * 0.04, H * 0.25), r: rand(25, 55), dx: rand(0.15, 0.4) });
      }
    }

    function drawHouse(h: House) {
      const hy = horizonY - h.h - h.roofH + H * 0.18;
      const bodyY = hy + h.roofH;

      // Drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;

      // Body with subtle gradient
      const bodyGrad = ctx.createLinearGradient(h.x, bodyY, h.x + h.w, bodyY + h.h);
      bodyGrad.addColorStop(0, h.col);
      bodyGrad.addColorStop(1, shadeHex(h.col, -15));
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.roundRect(h.x, bodyY, h.w, h.h, 2);
      ctx.fill();

      // Side wall (3D effect)
      ctx.fillStyle = shadeHex(h.col, -30);
      ctx.beginPath();
      ctx.moveTo(h.x + h.w, bodyY);
      ctx.lineTo(h.x + h.w + 8, bodyY - 6);
      ctx.lineTo(h.x + h.w + 8, bodyY + h.h - 6);
      ctx.lineTo(h.x + h.w, bodyY + h.h);
      ctx.closePath();
      ctx.fill();

      // Roof front face
      const roofGrad = ctx.createLinearGradient(h.x, hy, h.x, bodyY);
      roofGrad.addColorStop(0, '#a05030');
      roofGrad.addColorStop(1, '#804020');
      ctx.fillStyle = roofGrad;
      ctx.beginPath();
      ctx.moveTo(h.x - 4, bodyY);
      ctx.lineTo(h.x + h.w / 2, hy);
      ctx.lineTo(h.x + h.w + 4, bodyY);
      ctx.closePath();
      ctx.fill();

      // Roof side face (3D)
      ctx.fillStyle = '#5a2810';
      ctx.beginPath();
      ctx.moveTo(h.x + h.w + 4, bodyY);
      ctx.lineTo(h.x + h.w / 2, hy);
      ctx.lineTo(h.x + h.w / 2 + 8, hy - 6);
      ctx.lineTo(h.x + h.w + 12, bodyY - 6);
      ctx.closePath();
      ctx.fill();

      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

      // Windows
      for (const wx of [0.12, 0.62]) {
        const winX = h.x + h.w * wx;
        const winY = bodyY + h.h * 0.2;
        const winW = h.w * 0.22;
        const winH = h.h * 0.25;
        // Frame
        ctx.fillStyle = '#c0a878';
        ctx.fillRect(winX - 1, winY - 1, winW + 2, winH + 2);
        // Glass
        ctx.fillStyle = 'rgba(200,230,255,0.6)';
        ctx.fillRect(winX, winY, winW, winH);
        // Divider
        ctx.strokeStyle = '#c0a878'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(winX + winW / 2, winY); ctx.lineTo(winX + winW / 2, winY + winH);
        ctx.moveTo(winX, winY + winH / 2); ctx.lineTo(winX + winW, winY + winH / 2);
        ctx.stroke();
      }

      // Door (arched top)
      const doorX = h.x + h.w * 0.38;
      const doorY = bodyY + h.h * 0.55;
      const doorW = h.w * 0.24;
      const doorH = h.h * 0.45;
      ctx.fillStyle = '#8b5e3c';
      ctx.beginPath();
      ctx.moveTo(doorX, bodyY + h.h);
      ctx.lineTo(doorX, doorY + doorH * 0.3);
      ctx.arc(doorX + doorW / 2, doorY + doorH * 0.3, doorW / 2, Math.PI, 0);
      ctx.lineTo(doorX + doorW, bodyY + h.h);
      ctx.closePath();
      ctx.fill();
      // Door knob
      ctx.fillStyle = '#d4a850';
      ctx.beginPath(); ctx.arc(doorX + doorW * 0.75, bodyY + h.h * 0.75, 1.5, 0, Math.PI * 2); ctx.fill();

      // Chimney
      ctx.fillStyle = '#705048';
      ctx.fillRect(h.x + h.w * 0.62, hy - h.roofH * 0.3, h.w * 0.09, h.roofH * 0.55);

      // Front garden/path
      ctx.fillStyle = 'rgba(80,160,40,0.4)';
      ctx.fillRect(h.x, bodyY + h.h, h.w, 8);
      ctx.fillStyle = '#c8b880';
      ctx.fillRect(h.x + h.w * 0.38, bodyY + h.h, h.w * 0.24, 8);
    }

    function drawBg() {
      // Sky gradient (golden hour)
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0,    '#5a80c0');
      sky.addColorStop(0.35, '#f0a050');
      sky.addColorStop(horizonY / H, '#f8c870');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizonY);

      // Sun glow
      const sg = ctx.createRadialGradient(W * 0.8, H * 0.12, 0, W * 0.8, H * 0.12, 120);
      sg.addColorStop(0,   'rgba(255,240,100,0.9)');
      sg.addColorStop(0.2, 'rgba(255,200,50,0.5)');
      sg.addColorStop(1,   'transparent');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, horizonY);

      // Sun disc
      ctx.fillStyle = '#fffce8';
      ctx.beginPath(); ctx.arc(W * 0.8, H * 0.12, 22, 0, Math.PI * 2); ctx.fill();

      // Clouds
      for (const c of clouds) {
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = '#fffdf0';
        for (let ox = -c.r; ox <= c.r; ox += c.r * 0.6) {
          ctx.beginPath(); ctx.arc(c.x + ox, c.y + Math.abs(ox) * 0.3, c.r * (0.6 + Math.abs(ox) / (c.r * 3)), 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Rolling lawn / hills in background
      const hill = ctx.createLinearGradient(0, horizonY, 0, roadY);
      hill.addColorStop(0, '#6ab840'); hill.addColorStop(1, '#58a030');
      ctx.fillStyle = hill;
      ctx.beginPath(); ctx.moveTo(0, horizonY);
      for (let x = 0; x <= W; x += 60) ctx.lineTo(x, horizonY + Math.sin(x * 0.012) * 12);
      ctx.lineTo(W, roadY); ctx.lineTo(0, roadY); ctx.closePath(); ctx.fill();

      // Houses with 3D look
      for (const h of houses) {
        drawHouse(h);
      }

      // Sidewalk
      ctx.fillStyle = '#c8c0b0';
      ctx.fillRect(0, sidewalkY, W, roadY - sidewalkY);

      // Fence (picket)
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, sidewalkY - 8); ctx.lineTo(W, sidewalkY - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, sidewalkY - 16); ctx.lineTo(W, sidewalkY - 16); ctx.stroke();
      for (let px = 0; px < W; px += 14) {
        ctx.beginPath(); ctx.moveTo(px, sidewalkY - 22); ctx.lineTo(px, sidewalkY - 2); ctx.stroke();
      }

      // Road
      ctx.fillStyle = '#484840';
      ctx.fillRect(0, roadY, W, H - roadY);
      // Road center line (animated dash)
      ctx.strokeStyle = 'rgba(255,230,0,0.55)'; ctx.lineWidth = 2;
      ctx.setLineDash([22, 18]); ctx.lineDashOffset = -dashOffset;
      ctx.beginPath(); ctx.moveTo(0, roadY + (H - roadY) * 0.5); ctx.lineTo(W, roadY + (H - roadY) * 0.5); ctx.stroke();
      ctx.setLineDash([]);

      // Power lines
      ctx.strokeStyle = 'rgba(30,30,30,0.6)'; ctx.lineWidth = 1.2;
      const wireY = H * 0.58;
      ctx.beginPath(); ctx.moveTo(0, wireY); ctx.lineTo(W, wireY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, wireY + 14); ctx.lineTo(W, wireY + 14); ctx.stroke();
      for (const px of wireXs) {
        ctx.fillStyle = '#504030';
        ctx.fillRect(px - 3, wireY - 4, 6, H * 0.15);
      }
    }

    function drawCar(c: Car) {
      const x = c.x, y = c.y, w = c.w, h = c.h;
      const dir = c.spd > 0 ? 1 : -1;

      ctx.fillStyle = c.col;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h * 0.45, w, h * 0.75, 5);
      ctx.fill();

      ctx.fillStyle = c.col;
      const cabinLeft  = x - w * 0.18;
      const cabinRight = x + w * 0.22;
      const cabinTop   = y - h * 1.0;
      const cabinBot   = y - h * 0.45;
      ctx.beginPath();
      ctx.moveTo(cabinLeft + (dir > 0 ? 8 : 0), cabinTop);
      ctx.lineTo(cabinRight - (dir > 0 ? 0 : 8), cabinTop);
      ctx.lineTo(cabinRight + (dir > 0 ? 5 : 0), cabinBot);
      ctx.lineTo(cabinLeft - (dir > 0 ? 0 : 5), cabinBot);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(140,200,230,0.65)';
      ctx.beginPath();
      ctx.roundRect(cabinLeft + 3, cabinTop + 3, (cabinRight - cabinLeft) - 6, (cabinBot - cabinTop) - 5, 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(0,0,0,0.2)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo((cabinLeft + cabinRight) / 2, cabinTop + 3);
      ctx.lineTo((cabinLeft + cabinRight) / 2, cabinBot - 2);
      ctx.stroke();

      const wheelY = y + h * 0.28;
      const wheelR = h * 0.42;
      for (const wx of [x - w * 0.28, x + w * 0.28]) {
        ctx.fillStyle = '#1a1a18';
        ctx.beginPath(); ctx.arc(wx, wheelY, wheelR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#909090';
        ctx.beginPath(); ctx.arc(wx, wheelY, wheelR * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c0c0c0';
        ctx.beginPath(); ctx.arc(wx, wheelY, wheelR * 0.2, 0, Math.PI * 2); ctx.fill();
      }

      const frontX = dir > 0 ? x + w / 2 - 3 : x - w / 2 + 3;
      const rearX  = dir > 0 ? x - w / 2 + 3 : x + w / 2 - 3;
      ctx.fillStyle = 'rgba(255,245,150,0.9)';
      ctx.beginPath(); ctx.roundRect(frontX - (dir > 0 ? 4 : 0), y - h * 0.3, 4, 7, 1); ctx.fill();
      ctx.fillStyle = 'rgba(220,50,50,0.85)';
      ctx.beginPath(); ctx.roundRect(rearX - (dir > 0 ? 0 : 4), y - h * 0.3, 4, 7, 1); ctx.fill();
    }

    function drawWalker(w: Walker) {
      const swing = Math.sin(frame * 0.14 + w.phase) * 5;
      const r = 7;
      ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(w.x, w.y + r * 1.6, r * 1.1, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = shadeHex(w.cloth, -30);
      ctx.beginPath(); ctx.ellipse(w.x - 2.5, w.y + r * 0.6 + swing * 0.5, 2.2, r * 0.55, 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w.x + 2.5, w.y + r * 0.6 - swing * 0.5, 2.2, r * 0.55, -0.15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = w.cloth;
      ctx.beginPath(); ctx.ellipse(w.x, w.y, r * 0.7, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = w.skin;
      ctx.beginPath(); ctx.arc(w.x, w.y - r * 0.7, r * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    function loop() {
      frame++; dashOffset = (dashOffset + 0.4) % 40;
      drawBg();

      for (const c of cars) {
        c.x += c.spd;
        if (c.x > W + 80) c.x = -80;
        if (c.x < -80) c.x = W + 80;
        drawCar(c);
      }

      for (const w of walkers) {
        w.x += w.vx;
        if (w.x > W + 20) w.x = -20;
        if (w.x < -20) w.x = W + 20;
        drawWalker(w);
      }

      for (const c of clouds) {
        c.x += c.dx;
        if (c.x > W + 100) c.x = -100;
      }

      const wireY = H * 0.58;
      for (const b of birds) {
        b.flap += 0.14;
        if (b.state === 'sit') {
          b.sitTimer--;
          if (b.sitTimer <= 0) { b.state = 'fly'; }
          ctx.fillStyle = '#303028';
          ctx.beginPath(); ctx.ellipse(b.x, b.y - 3, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(b.x + (b.vx > 0 ? 4 : -4), b.y - 5, 2.5, 0, Math.PI * 2); ctx.fill();
        } else {
          b.x += b.vx;
          b.y += Math.sin(b.flap) * 0.5;
          if (b.x > W + 30 || b.x < -30) {
            b.x = b.vx > 0 ? -20 : W + 20;
            b.y = wireY + rand(-15, 15);
            b.state = 'sit'; b.sitTimer = rand(80, 350);
          }
          const fy = Math.sin(b.flap) * 3.5;
          ctx.strokeStyle = '#252520'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(b.x - 7, b.y - fy); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + 7, b.y - fy); ctx.stroke();
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
