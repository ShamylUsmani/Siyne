'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function randInt(a: number, b: number) { return Math.floor(rand(a, b + 1)); }

interface AerialBuilding {
  x: number; y: number; w: number; h: number;
  height: number;       // 1-5 floors
  roofCol: string;
  isLit: boolean;
  hasGarden: boolean;
  hasHelipad: boolean;
  hasWaterTower: boolean;
  hasAtrium: boolean;
}

interface AerialCar {
  x: number; y: number; vx: number; vy: number; col: string; isHead: boolean;
  streetHoriz: boolean;  // driving on horizontal or vertical street
}

// Street grid data
interface Street {
  pos: number;       // x for vertical, y for horizontal
  horiz: boolean;
}

export default function CitySkylineCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, raf = 0, frame = 0;

    const buildings: AerialBuilding[] = [];
    const aerialCars: AerialCar[] = [];
    const streets: Street[] = [];

    // Park and river data
    let parkX = 0, parkY = 0, parkW = 0, parkH = 0;
    let riverX1 = 0, riverY1 = 0, riverX2 = 0, riverY2 = 0;
    let riverWidth = 0;

    const ROOF_COLS = ['#1e2830', '#242e3a', '#2a3444', '#303c4e', '#384458'];
    let flickerTimer = 0;

    function init() {
      if (!canvas) return;
      W = canvas.offsetWidth || 1200; H = canvas.offsetHeight || 700;
      canvas.width = W; canvas.height = H;
      frame = 0; flickerTimer = 0;
      buildings.length = 0; aerialCars.length = 0; streets.length = 0;

      const mobile = W < 600;

      // Generate street grid with irregular spacing
      // Horizontal streets
      let pos = 0;
      while (pos < H) {
        const gap = 80 + rand(0, 40);
        pos += gap;
        streets.push({ pos, horiz: true });
      }
      // Vertical streets
      pos = 0;
      while (pos < W) {
        const gap = 80 + rand(0, 40);
        pos += gap;
        streets.push({ pos, horiz: false });
      }

      // Sort streets
      const hStreets = streets.filter(s => s.horiz).map(s => s.pos);
      const vStreets = streets.filter(s => !s.horiz).map(s => s.pos);

      // Place park in one block
      const parkBlockH = randInt(0, hStreets.length - 2);
      const parkBlockV = randInt(0, vStreets.length - 2);
      const pH0 = parkBlockH === 0 ? 0 : hStreets[parkBlockH - 1];
      const pH1 = hStreets[parkBlockH];
      const pV0 = parkBlockV === 0 ? 0 : vStreets[parkBlockV - 1];
      const pV1 = vStreets[parkBlockV];
      parkX = pV0 + 12; parkY = pH0 + 12;
      parkW = pV1 - pV0 - 24; parkH = pH1 - pH0 - 24;

      // River diagonally across canvas
      riverX1 = W * 0.15; riverY1 = H * 0.08;
      riverX2 = W * 0.62; riverY2 = H * 0.92;
      riverWidth = 16 + rand(0, 8);

      // Generate buildings to fill blocks
      const bCount = mobile ? 40 : 70;
      let attempts = 0;
      while (buildings.length < bCount && attempts < 500) {
        attempts++;
        // Pick a random block between streets
        const hIdx = randInt(0, hStreets.length - 1);
        const vIdx = randInt(0, vStreets.length - 1);
        const y0 = hIdx === 0 ? 0 : hStreets[hIdx - 1];
        const y1 = hStreets[hIdx];
        const x0 = vIdx === 0 ? 0 : vStreets[vIdx - 1];
        const x1 = vStreets[vIdx];

        const blockW = x1 - x0;
        const blockH = y1 - y0;
        if (blockW < 35 || blockH < 35) continue;

        // Margin inside block
        const margin = 10;
        const bx = x0 + margin + rand(0, Math.max(0, blockW * 0.15));
        const by = y0 + margin + rand(0, Math.max(0, blockH * 0.15));
        const bw = Math.min(blockW - margin * 2 - rand(0, blockW * 0.15), 120);
        const bh = Math.min(blockH - margin * 2 - rand(0, blockH * 0.15), 100);

        if (bw < 30 || bh < 30) continue;

        // Skip if overlaps park
        const padded = 5;
        if (bx < parkX + parkW + padded && bx + bw > parkX - padded &&
            by < parkY + parkH + padded && by + bh > parkY - padded) continue;

        const heightLevel = randInt(1, 5);
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          height: heightLevel,
          roofCol: ROOF_COLS[heightLevel - 1],
          isLit: Math.random() < 0.20,
          hasGarden: Math.random() < 0.12,
          hasHelipad: Math.random() < 0.04,
          hasWaterTower: heightLevel >= 4 && Math.random() < 0.25,
          hasAtrium: Math.random() < 0.10,
        });
      }

      // Cars on streets
      const carCount = mobile ? 4 : 6;
      for (let i = 0; i < carCount; i++) {
        const horiz = Math.random() > 0.5;
        const streetList = horiz ? hStreets : vStreets;
        if (streetList.length === 0) continue;
        const sPos = streetList[randInt(0, streetList.length - 1)];
        const isHead = Math.random() > 0.5;
        const speed = rand(0.5, 1.5) * (Math.random() > 0.5 ? 1 : -1);
        aerialCars.push({
          x: horiz ? rand(0, W) : sPos + rand(-4, 4),
          y: horiz ? sPos + rand(-4, 4) : rand(0, H),
          vx: horiz ? speed : 0,
          vy: horiz ? 0 : speed,
          col: isHead ? 'rgba(255,255,220,0.9)' : 'rgba(220,50,50,0.9)',
          isHead,
          streetHoriz: horiz,
        });
      }
    }

    function drawStreetGrid() {
      // Base dark city colour
      ctx.fillStyle = '#0a0c10';
      ctx.fillRect(0, 0, W, H);

      // Street lines (slightly lighter than background)
      ctx.strokeStyle = '#12161e';
      ctx.lineWidth = 2;
      for (const s of streets) {
        ctx.beginPath();
        if (s.horiz) {
          ctx.moveTo(0, s.pos); ctx.lineTo(W, s.pos);
        } else {
          ctx.moveTo(s.pos, 0); ctx.lineTo(s.pos, H);
        }
        ctx.stroke();
      }

      // Pavement/sidewalk strips — slightly lighter borders
      ctx.strokeStyle = '#161a22';
      ctx.lineWidth = 8;
      for (const s of streets) {
        ctx.beginPath();
        if (s.horiz) {
          ctx.moveTo(0, s.pos); ctx.lineTo(W, s.pos);
        } else {
          ctx.moveTo(s.pos, 0); ctx.lineTo(s.pos, H);
        }
        ctx.stroke();
      }
    }

    function drawPark() {
      if (parkW <= 0 || parkH <= 0) return;
      // Dark green park
      ctx.fillStyle = 'rgba(30,80,20,0.7)';
      ctx.beginPath();
      ctx.roundRect(parkX, parkY, parkW, parkH, 6);
      ctx.fill();
      // Path through park
      ctx.strokeStyle = 'rgba(100,80,40,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(parkX + parkW * 0.2, parkY + parkH * 0.5);
      ctx.quadraticCurveTo(parkX + parkW * 0.5, parkY + parkH * 0.3, parkX + parkW * 0.8, parkY + parkH * 0.5);
      ctx.stroke();
      // Trees in park (viewed from above)
      for (let i = 0; i < 6; i++) {
        const tx = parkX + rand(parkW * 0.1, parkW * 0.9);
        const ty = parkY + rand(parkH * 0.1, parkH * 0.9);
        const tr = rand(4, 9);
        const tg = ctx.createRadialGradient(tx - tr * 0.2, ty - tr * 0.2, 0, tx, ty, tr);
        tg.addColorStop(0, 'rgba(50,140,30,0.9)');
        tg.addColorStop(1, 'rgba(20,70,10,0.6)');
        ctx.fillStyle = tg;
        ctx.beginPath(); ctx.arc(tx, ty, tr, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawRiver() {
      // River as a thick diagonal line with bezier slight bend
      const midX = (riverX1 + riverX2) / 2 + rand(-20, 20);
      const midY = (riverY1 + riverY2) / 2 + rand(-20, 20);

      // River base
      ctx.strokeStyle = '#0a1828';
      ctx.lineWidth = riverWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(riverX1, riverY1);
      ctx.quadraticCurveTo(midX, midY, riverX2, riverY2);
      ctx.stroke();

      // Subtle shimmer
      ctx.strokeStyle = 'rgba(20,50,100,0.3)';
      ctx.lineWidth = riverWidth * 0.4;
      ctx.beginPath();
      ctx.moveTo(riverX1 + 3, riverY1 + 3);
      ctx.quadraticCurveTo(midX + 2, midY + 2, riverX2 + 3, riverY2 + 3);
      ctx.stroke();
    }

    function drawBuildings() {
      for (const b of buildings) {
        const shadowLen = b.height * 8;

        // Drop shadow (South-East offset = height indicator)
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.roundRect(b.x + shadowLen, b.y + shadowLen, b.w, b.h, 2);
        ctx.fill();

        // Roof base colour (brighter for taller buildings)
        ctx.fillStyle = b.roofCol;
        if (b.hasGarden) {
          ctx.fillStyle = 'rgba(40,120,40,0.5)';
        }
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 2);
        ctx.fill();

        // Non-garden rooftop
        if (!b.hasGarden) {
          ctx.fillStyle = b.roofCol;
          ctx.beginPath();
          ctx.roundRect(b.x, b.y, b.w, b.h, 2);
          ctx.fill();
        }

        // Lit building — warm roof glow
        if (b.isLit) {
          const litG = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, 0, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) * 0.7);
          litG.addColorStop(0, 'rgba(255,180,60,0.28)');
          litG.addColorStop(1, 'transparent');
          ctx.fillStyle = litG;
          ctx.beginPath();
          ctx.roundRect(b.x, b.y, b.w, b.h, 2);
          ctx.fill();
        }

        // HVAC units (small darker squares on roof)
        const hvacCount = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < hvacCount; i++) {
          const hx = b.x + rand(b.w * 0.1, b.w * 0.8);
          const hy = b.y + rand(b.h * 0.1, b.h * 0.8);
          const hs = rand(4, 9);
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(hx, hy, hs, hs * 0.7);
        }

        // Water tower
        if (b.hasWaterTower) {
          const tx = b.x + b.w * 0.7;
          const ty = b.y + b.h * 0.2;
          ctx.fillStyle = 'rgba(80,60,40,0.7)';
          ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(100,80,55,0.5)';
          ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2); ctx.fill();
        }

        // Helipad
        if (b.hasHelipad) {
          const hpX = b.x + b.w / 2;
          const hpY = b.y + b.h / 2;
          ctx.strokeStyle = 'rgba(255,255,100,0.5)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(hpX, hpY, Math.min(b.w, b.h) * 0.3, 0, Math.PI * 2); ctx.stroke();
          // H letter
          ctx.strokeStyle = 'rgba(255,255,100,0.4)';
          ctx.lineWidth = 1.5;
          const hs = Math.min(b.w, b.h) * 0.15;
          ctx.beginPath();
          ctx.moveTo(hpX - hs, hpY - hs); ctx.lineTo(hpX - hs, hpY + hs);
          ctx.moveTo(hpX + hs, hpY - hs); ctx.lineTo(hpX + hs, hpY + hs);
          ctx.moveTo(hpX - hs, hpY); ctx.lineTo(hpX + hs, hpY);
          ctx.stroke();
        }

        // Glass atrium (top-down view — blue tinted rectangle)
        if (b.hasAtrium) {
          const ax = b.x + b.w * 0.25;
          const ay = b.y + b.h * 0.25;
          const aw = b.w * 0.5;
          const ah = b.h * 0.5;
          ctx.fillStyle = 'rgba(100,160,220,0.25)';
          ctx.beginPath();
          ctx.roundRect(ax, ay, aw, ah, 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(120,180,240,0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(ax, ay, aw, ah, 2);
          ctx.stroke();
        }

        // Roof edge highlight (top-left lit side)
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y + b.h);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(b.x + b.w, b.y);
        ctx.stroke();
      }
    }

    function drawAerialCars() {
      for (const c of aerialCars) {
        c.x += c.vx;
        c.y += c.vy;
        if (c.x > W + 20) c.x = -20;
        if (c.x < -20) c.x = W + 20;
        if (c.y > H + 20) c.y = -20;
        if (c.y < -20) c.y = H + 20;

        // Draw as a tiny glowing dot
        const dotG = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 5);
        dotG.addColorStop(0, c.col);
        dotG.addColorStop(1, 'transparent');
        ctx.fillStyle = dotG;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Solid dot center
        ctx.fillStyle = c.col;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function tickFlicker() {
      flickerTimer++;
      if (flickerTimer > 80 + Math.floor(Math.random() * 40)) {
        flickerTimer = 0;
        if (buildings.length > 0) {
          const b = buildings[Math.floor(Math.random() * buildings.length)];
          b.isLit = !b.isLit;
        }
      }
    }

    function loop() {
      frame++;
      tickFlicker();

      drawStreetGrid();
      drawPark();
      drawRiver();
      drawBuildings();
      drawAerialCars();

      raf = requestAnimationFrame(loop);
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
