'use client';
import { useEffect, useRef } from 'react';

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function lgt(hex: string, amt = 50): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgb(${Math.min(255, ((n >> 16) & 255) + amt)},${Math.min(255, ((n >> 8) & 255) + Math.floor(amt * .7))},${Math.min(255, (n & 255) + Math.floor(amt * .4))})`;
}

interface Ridge   { x: number; y: number }
interface Cloud   { x: number; y: number; rx: number; ry: number; spd: number }
interface House   { x: number; y: number; w: number; h: number; rh: number; col: string; dark: string; roof: string }
interface PTree   { x: number; y: number; h: number }
interface Soldier { x: number; baseY: number; phase: number; col: string }
interface Horse   { x: number; y: number; phase: number; col: string; dir: 1 | -1; lo: number; hi: number }

function genRidge(W: number, H: number, baseY: number, topY: number, segs: number): Ridge[] {
  const pts: Ridge[] = [{ x: 0, y: baseY * .86 }];
  for (let i = 1; i < segs; i++) {
    const s = Math.sin(i * 1.4) * .45 + Math.sin(i * .78 + .9) * .30 + Math.sin(i * 2.2 + .4) * .15;
    pts.push({ x: W * i / segs, y: topY + (baseY - topY) * (.12 + .88 * (1 - Math.max(0, s))) });
  }
  pts.push({ x: W, y: baseY * .89 });
  return pts;
}

function drawRidge(ctx: CanvasRenderingContext2D, pts: Ridge[], H: number, c1: string, c2: string) {
  const minY = Math.min(...pts.map(p => p.y));
  const g = ctx.createLinearGradient(0, minY, 0, H * .72);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, H);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.lineTo(pts[pts.length - 1].x, H); ctx.closePath(); ctx.fill();
}

function addSnow(ctx: CanvasRenderingContext2D, pts: Ridge[], snowY: number) {
  const g = ctx.createLinearGradient(0, snowY - 32, 0, snowY);
  g.addColorStop(0, 'rgba(255,255,255,.94)'); g.addColorStop(1, 'rgba(220,232,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, snowY);
  ctx.lineTo(pts[0].x, Math.min(pts[0].y, snowY));
  for (let i = 0; i < pts.length - 1; i++) {
    const a = Math.min(pts[i].y, snowY), b = Math.min(pts[i + 1].y, snowY);
    ctx.quadraticCurveTo(pts[i].x, a, (pts[i].x + pts[i + 1].x) / 2, (a + b) / 2);
  }
  ctx.lineTo(pts[pts.length - 1].x, Math.min(pts[pts.length - 1].y, snowY));
  ctx.lineTo(pts[pts.length - 1].x, snowY); ctx.closePath(); ctx.fill();
}

export default function AlpsCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, Hh = 0, raf = 0, frame = 0;
    const clouds: Cloud[] = [], houses: House[] = [], ptrees: PTree[] = [];
    const soldiers: Soldier[] = [], horses: Horse[] = [];
    let rA: Ridge[] = [], rB: Ridge[] = [], rC: Ridge[] = [], rD: Ridge[] = [];
    let cX = 0, cBY = 0, cW = 0;

    const HCOLS: [string, string, string][] = [
      ['#d8c8a8', '#b8a888', '#8a3018'], ['#e0d8c0', '#c0b8a0', '#9a4020'],
      ['#c8b898', '#a89878', '#7a2808'], ['#d4c8a0', '#b4a880', '#6a3010'],
      ['#dcceb0', '#bcae90', '#882818'],
    ];

    function init() {
      try {
        if (!canvas) return;
        W = canvas.offsetWidth || 1280; Hh = canvas.offsetHeight || 720;
        canvas.width = W; canvas.height = Hh; frame = 0;
        const mob = W < 640;
        cX = W * .60; cW = W * .26; cBY = Hh * .60;
        rA = genRidge(W, Hh, Hh * .52, Hh * .07, mob ? 10 : 16);
        rB = genRidge(W, Hh, Hh * .56, Hh * .14, mob ? 12 : 18);
        rC = genRidge(W, Hh, Hh * .60, Hh * .21, mob ? 14 : 22);
        rD = genRidge(W, Hh, Hh * .65, Hh * .30, mob ? 10 : 16);
        clouds.length = 0;
        for (let i = 0; i < (mob ? 4 : 7); i++)
          clouds.push({ x: rand(0, W), y: rand(Hh * .04, Hh * .22), rx: rand(55, 125), ry: rand(18, 42), spd: rand(.06, .14) });
        houses.length = 0;
        let hx = W * .03;
        for (let i = 0; i < (mob ? 4 : 7); i++) {
          const hw = rand(W * .044, W * .070), hh = rand(Hh * .10, Hh * .16), rh = hh * rand(.38, .56);
          const [c, d, r] = pick(HCOLS);
          houses.push({ x: hx, y: cBY - hh, w: hw, h: hh, rh, col: c, dark: d, roof: r });
          hx += hw + rand(W * .008, W * .022);
        }
        ptrees.length = 0;
        for (let i = 0; i < (mob ? 22 : 42); i++)
          ptrees.push({ x: rand(0, W), y: rand(Hh * .50, Hh * .66), h: rand(Hh * .048, Hh * .088) });
        soldiers.length = 0;
        for (let i = 0; i < (mob ? 3 : 6); i++)
          soldiers.push({ x: cX + cW * .07 + i * W * .028, baseY: cBY + Hh * .003, phase: i * .9, col: pick(['#8890a0', '#909aa8', '#787e8e']) });
        horses.length = 0;
        const pX = cX + cW + W * .012;
        for (let i = 0; i < (mob ? 2 : 3); i++) {
          const lo = pX + W * .005, hi = pX + W * .088;
          horses.push({ x: lo + (hi - lo) * (i / (mob ? 2 : 3)), y: cBY - Hh * .004, phase: i * 1.8, col: pick(['#2a1808', '#7a4820', '#c09060']), dir: 1, lo, hi });
        }
      } catch { /**/ }
    }

    /* ── cloud ── */
    function cloud(c: Cloud) {
      ctx.save(); ctx.globalAlpha = .82;
      for (const [ox, oy, r] of [
        [0, 0, 1], [-c.rx * .44, c.ry * .18, .66], [c.rx * .44, c.ry * .10, .70],
        [-c.rx * .18, -c.ry * .35, .56], [c.rx * .20, -c.ry * .25, .60],
      ] as [number, number, number][]) {
        const g = ctx.createRadialGradient(c.x + ox, c.y + oy, 0, c.x + ox, c.y + oy, c.rx * r * .74);
        g.addColorStop(0, '#fff'); g.addColorStop(.55, 'rgba(255,255,255,.72)'); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x + ox, c.y + oy, c.rx * r * .74, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    /* ── pine tree ── */
    function pine(t: PTree) {
      for (let l = 0; l < 3; l++) {
        const ly = t.y - t.h * (l / 3), lw = t.h * (.50 - l * .11), lh = t.h * (.44 + l * .04);
        const g = ctx.createLinearGradient(t.x, ly - lh, t.x, ly);
        g.addColorStop(0, l === 0 ? '#1a3a10' : l === 1 ? '#163008' : '#102808'); g.addColorStop(1, '#0a1e06');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(t.x, ly - lh);
        ctx.quadraticCurveTo(t.x + lw * .35, ly - lh * .40, t.x + lw, ly);
        ctx.quadraticCurveTo(t.x, ly + lh * .08, t.x - lw, ly);
        ctx.quadraticCurveTo(t.x - lw * .35, ly - lh * .40, t.x, ly - lh); ctx.fill();
      }
      ctx.fillStyle = '#5a3818'; ctx.fillRect(t.x - 2, t.y, 4, t.h * .18);
    }

    /* ── house ── */
    function house(h: House) {
      const sw = h.w * .13;
      ctx.shadowColor = 'rgba(0,0,0,.20)'; ctx.shadowBlur = 7; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;
      const bg = ctx.createLinearGradient(h.x, h.y, h.x + h.w, h.y + h.h);
      bg.addColorStop(0, h.col); bg.addColorStop(1, h.dark); ctx.fillStyle = bg;
      ctx.fillRect(h.x, h.y, h.w, h.h);
      const sg = ctx.createLinearGradient(h.x + h.w, h.y, h.x + h.w + sw, h.y + h.h);
      sg.addColorStop(0, h.dark); sg.addColorStop(1, '#806050'); ctx.fillStyle = sg;
      ctx.beginPath(); ctx.moveTo(h.x + h.w, h.y); ctx.lineTo(h.x + h.w + sw, h.y - h.rh * .18);
      ctx.lineTo(h.x + h.w + sw, h.y + h.h - h.rh * .18); ctx.lineTo(h.x + h.w, h.y + h.h); ctx.closePath(); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      const rf = ctx.createLinearGradient(h.x, h.y - h.rh, h.x, h.y);
      rf.addColorStop(0, h.roof); rf.addColorStop(1, '#5a2010'); ctx.fillStyle = rf;
      ctx.beginPath(); ctx.moveTo(h.x - 3, h.y); ctx.lineTo(h.x + h.w * .5, h.y - h.rh); ctx.lineTo(h.x + h.w + 3, h.y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a1808'; ctx.beginPath();
      ctx.moveTo(h.x + h.w + 3, h.y); ctx.lineTo(h.x + h.w * .5, h.y - h.rh);
      ctx.lineTo(h.x + h.w * .5 + sw * .8, h.y - h.rh * .82); ctx.lineTo(h.x + h.w + sw + 3, h.y - h.rh * .18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9a7860'; ctx.fillRect(h.x + h.w * .62, h.y - h.rh * .80, h.w * .10, h.rh * .65);
      for (const wx of [.14, .58]) {
        const wxx = h.x + h.w * wx, wyy = h.y + h.h * .22, ww = h.w * .22, wh = h.h * .26;
        ctx.fillStyle = '#8a6830'; ctx.fillRect(wxx - 2, wyy - 2, ww + 4, wh + 4);
        const wg = ctx.createLinearGradient(wxx, wyy, wxx, wyy + wh);
        wg.addColorStop(0, 'rgba(255,245,180,.85)'); wg.addColorStop(1, 'rgba(220,200,120,.60)');
        ctx.fillStyle = wg; ctx.fillRect(wxx, wyy, ww, wh);
        ctx.strokeStyle = '#9a7840'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(wxx + ww / 2, wyy); ctx.lineTo(wxx + ww / 2, wyy + wh);
        ctx.moveTo(wxx, wyy + wh / 2); ctx.lineTo(wxx + ww, wyy + wh / 2); ctx.stroke();
      }
      const dx = h.x + h.w * .36, dy = h.y + h.h * .56, dw = h.w * .26, dh = h.h * .44;
      ctx.fillStyle = '#7a4820'; ctx.beginPath();
      ctx.moveTo(dx, h.y + h.h); ctx.lineTo(dx, dy + dh * .25);
      ctx.arc(dx + dw / 2, dy + dh * .25, dw / 2, Math.PI, 0); ctx.lineTo(dx + dw, h.y + h.h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d4a830'; ctx.beginPath(); ctx.arc(dx + dw * .72, h.y + h.h * .80, 2, 0, Math.PI * 2); ctx.fill();
    }

    /* ── church ── */
    function church(cx: number, baseY: number, w: number, h: number) {
      const bg = ctx.createLinearGradient(cx, baseY - h, cx + w, baseY);
      bg.addColorStop(0, '#d0c8b0'); bg.addColorStop(1, '#a89878'); ctx.fillStyle = bg;
      ctx.fillRect(cx, baseY - h, w, h);
      const awx = cx + w * .28, awy = baseY - h * .58, aww = w * .44;
      ctx.fillStyle = 'rgba(180,210,255,.55)'; ctx.beginPath();
      ctx.moveTo(awx, baseY - h * .30); ctx.lineTo(awx, awy + aww / 2 * .7);
      ctx.arc(awx + aww / 2, awy + aww / 2 * .7, aww / 2, Math.PI, 0); ctx.lineTo(awx + aww, baseY - h * .30); ctx.closePath(); ctx.fill();
      const tx = cx + w * .30, tw = w * .40;
      const tg = ctx.createLinearGradient(tx, baseY - h * 1.72, tx + tw, baseY - h);
      tg.addColorStop(0, '#c0b898'); tg.addColorStop(1, '#9a8868'); ctx.fillStyle = tg;
      ctx.fillRect(tx, baseY - h * 1.72, tw, h * .74);
      ctx.fillStyle = 'rgba(20,12,6,.60)'; ctx.beginPath();
      ctx.arc(tx + tw / 2, baseY - h * 1.24, tw * .28, 0, Math.PI * 2); ctx.fill();
      const spg = ctx.createLinearGradient(tx + tw / 2, baseY - h * 2.45, tx + tw / 2, baseY - h * 1.72);
      spg.addColorStop(0, '#383e48'); spg.addColorStop(1, '#505868'); ctx.fillStyle = spg;
      ctx.beginPath(); ctx.moveTo(tx + tw / 2, baseY - h * 2.45);
      ctx.lineTo(tx - 3, baseY - h * 1.72); ctx.lineTo(tx + tw + 3, baseY - h * 1.72); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#f8f0d8'; ctx.lineWidth = 2;
      const cx2 = tx + tw / 2, cy2 = baseY - h * 2.47;
      ctx.beginPath(); ctx.moveTo(cx2, cy2 - 8); ctx.lineTo(cx2, cy2 + 5);
      ctx.moveTo(cx2 - 5, cy2 - 3); ctx.lineTo(cx2 + 5, cy2 - 3); ctx.stroke();
    }

    /* ── castle ── */
    function castle(): { balX: number; balY: number; kX: number; kW: number } {
      const kW = cW * .28, kX = cX + cW * .36;
      const kTop = cBY - Hh * .47, wallTop = cBY - Hh * .28;

      function sg(x1: number, y1: number, x2: number, y2: number) {
        const g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, '#b0a090'); g.addColorStop(.5, '#9a8878'); g.addColorStop(1, '#7a6858'); return g;
      }
      function battl(bx: number, by: number, bw: number, mw: number, mh: number, gw: number) {
        let cx2 = bx;
        while (cx2 < bx + bw) { ctx.fillRect(cx2, by - mh, Math.min(mw, bx + bw - cx2), mh); cx2 += mw + gw; }
      }
      function stoneLines(x: number, y: number, w: number, h: number) {
        ctx.strokeStyle = 'rgba(0,0,0,.09)'; ctx.lineWidth = 1;
        for (let ly = y + 14; ly < y + h; ly += 14) { ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + w, ly); ctx.stroke(); }
      }

      // Hill
      const hg = ctx.createLinearGradient(cX, cBY, cX, cBY + Hh * .06);
      hg.addColorStop(0, '#7a6a3a'); hg.addColorStop(1, '#5a4a28'); ctx.fillStyle = hg;
      ctx.beginPath(); ctx.moveTo(cX - W * .025, cBY + Hh * .05);
      ctx.quadraticCurveTo(cX + cW * .5, cBY - Hh * .025, cX + cW + W * .025, cBY + Hh * .05);
      ctx.lineTo(cX + cW + W * .05, cBY + Hh * .09); ctx.lineTo(cX - W * .05, cBY + Hh * .09); ctx.closePath(); ctx.fill();

      // Left wall
      const lwX = cX + W * .01, lwW = kX - lwX;
      ctx.fillStyle = sg(lwX, wallTop, lwX + lwW, cBY); ctx.fillRect(lwX, wallTop, lwW, cBY - wallTop);
      stoneLines(lwX, wallTop, lwW, cBY - wallTop);
      ctx.fillStyle = '#8a7868'; battl(lwX, wallTop, lwW, W * .014, Hh * .023, W * .010);

      // Gate arch
      const gX = lwX + lwW * .5 - W * .020, gW = W * .040, gH = Hh * .15, gY = cBY - gH;
      ctx.fillStyle = '#201808'; ctx.beginPath();
      ctx.moveTo(gX, cBY); ctx.lineTo(gX, gY + gH * .28);
      ctx.arc(gX + gW / 2, gY + gH * .28, gW / 2, Math.PI, 0); ctx.lineTo(gX + gW, cBY); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#483828'; ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(gX + gW * (i / 4), gY + gH * .28 - gW / 2); ctx.lineTo(gX + gW * (i / 4), cBY); ctx.stroke(); }
      for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(gX, gY + gH * (.28 + i * .24)); ctx.lineTo(gX + gW, gY + gH * (.28 + i * .24)); ctx.stroke(); }

      // Right wall
      const rwX = kX + kW, rwW = cX + cW - W * .01 - rwX;
      ctx.fillStyle = sg(rwX, wallTop, rwX + rwW, cBY); ctx.fillRect(rwX, wallTop, rwW, cBY - wallTop);
      stoneLines(rwX, wallTop, rwW, cBY - wallTop);
      ctx.fillStyle = '#8a7868'; battl(rwX, wallTop, rwW, W * .014, Hh * .023, W * .010);

      // Left tower
      const ltX = cX + W * .005, ltW = W * .040, ltTop = cBY - Hh * .36;
      ctx.fillStyle = sg(ltX, ltTop, ltX + ltW, cBY); ctx.fillRect(ltX, ltTop, ltW, cBY - ltTop);
      stoneLines(ltX, ltTop, ltW, cBY - ltTop);
      ctx.fillStyle = '#7a6858'; battl(ltX, ltTop, ltW, W * .011, Hh * .022, W * .009);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#201808'; ctx.fillRect(ltX + ltW * .40, ltTop + (cBY - ltTop) * (.18 + i * .26), ltW * .18, Hh * .036); }
      const ltcg = ctx.createLinearGradient(ltX, ltTop - Hh * .07, ltX + ltW, ltTop);
      ltcg.addColorStop(0, '#323a44'); ltcg.addColorStop(1, '#485060'); ctx.fillStyle = ltcg;
      ctx.beginPath(); ctx.moveTo(ltX + ltW / 2, ltTop - Hh * .07); ctx.lineTo(ltX - 2, ltTop); ctx.lineTo(ltX + ltW + 2, ltTop); ctx.closePath(); ctx.fill();

      // Right tower
      const rtX = cX + cW - ltW - W * .005, rtTop = cBY - Hh * .34;
      ctx.fillStyle = sg(rtX, rtTop, rtX + ltW, cBY); ctx.fillRect(rtX, rtTop, ltW, cBY - rtTop);
      stoneLines(rtX, rtTop, ltW, cBY - rtTop);
      ctx.fillStyle = '#7a6858'; battl(rtX, rtTop, ltW, W * .011, Hh * .022, W * .009);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#201808'; ctx.fillRect(rtX + ltW * .40, rtTop + (cBY - rtTop) * (.18 + i * .26), ltW * .18, Hh * .036); }
      const rtcg = ctx.createLinearGradient(rtX, rtTop - Hh * .065, rtX + ltW, rtTop);
      rtcg.addColorStop(0, '#323a44'); rtcg.addColorStop(1, '#485060'); ctx.fillStyle = rtcg;
      ctx.beginPath(); ctx.moveTo(rtX + ltW / 2, rtTop - Hh * .065); ctx.lineTo(rtX - 2, rtTop); ctx.lineTo(rtX + ltW + 2, rtTop); ctx.closePath(); ctx.fill();

      // Main Keep
      ctx.fillStyle = sg(kX, kTop, kX + kW, cBY); ctx.fillRect(kX, kTop, kW, cBY - kTop);
      stoneLines(kX, kTop, kW, cBY - kTop);
      for (let si = 0; si < 5; si++) {
        const cols = si % 2 === 0 ? [kW * .22, kW * .68] : [kW * .45];
        for (const col of cols) { ctx.fillStyle = '#201808'; ctx.fillRect(kX + col, kTop + (cBY - kTop) * (.13 + si * .14), kW * .09, Hh * .040); }
      }
      ctx.fillStyle = '#8a7868'; battl(kX, kTop, kW, W * .018, Hh * .030, W * .012);

      // Balcony
      const balY = kTop + (cBY - kTop) * .30, balW = kW * .62, balX = kX + kW * .19;
      ctx.fillStyle = '#9a8878'; ctx.fillRect(balX - 4, balY + Hh * .040, balW + 8, Hh * .013);
      ctx.fillRect(balX - 4, balY, 6, Hh * .044); ctx.fillRect(balX + balW - 2, balY, 6, Hh * .044);
      ctx.strokeStyle = '#8a7868'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(balX, balY); ctx.lineTo(balX + balW, balY); ctx.stroke();
      for (let pi = 0; pi <= 5; pi++) { ctx.beginPath(); ctx.moveTo(balX + balW * (pi / 5), balY); ctx.lineTo(balX + balW * (pi / 5), balY + Hh * .040); ctx.stroke(); }

      // Keep roof
      const krg = ctx.createLinearGradient(kX, kTop - Hh * .13, kX + kW, kTop);
      krg.addColorStop(0, '#272e38'); krg.addColorStop(1, '#3e4656'); ctx.fillStyle = krg;
      ctx.beginPath(); ctx.moveTo(kX + kW / 2, kTop - Hh * .13); ctx.lineTo(kX - 3, kTop); ctx.lineTo(kX + kW + 3, kTop); ctx.closePath(); ctx.fill();

      // Flag
      ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
      const fpx = kX + kW / 2, fpt = kTop - Hh * .145;
      ctx.beginPath(); ctx.moveTo(fpx, fpt); ctx.lineTo(fpx, kTop - Hh * .13); ctx.stroke();
      const fw = Math.sin(frame * .04) * 5;
      const fg = ctx.createLinearGradient(fpx, fpt, fpx + W * .038, fpt);
      fg.addColorStop(0, '#c82010'); fg.addColorStop(1, '#a81808'); ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(fpx, fpt);
      ctx.lineTo(fpx + W * .038 + fw, fpt + Hh * .010 + fw * .3);
      ctx.lineTo(fpx + W * .034 + fw * .8, fpt + Hh * .022);
      ctx.lineTo(fpx, fpt + Hh * .019); ctx.closePath(); ctx.fill();

      return { balX, balY, kX, kW };
    }

    /* ── princess ── */
    function princess(balX: number, balY: number, kX: number, kW: number) {
      const ph = Hh * .070, pX = kX + kW * .50, pBase = balY - 2;
      const wave = Math.sin(frame * .024) * .28;
      const dg = ctx.createLinearGradient(pX, pBase - ph, pX, pBase);
      dg.addColorStop(0, '#e040a8'); dg.addColorStop(1, '#c02888'); ctx.fillStyle = dg;
      ctx.beginPath(); ctx.moveTo(pX, pBase);
      ctx.quadraticCurveTo(pX - ph * .32, pBase - ph * .38, pX - ph * .14, pBase - ph * .70);
      ctx.lineTo(pX, pBase - ph * .72); ctx.lineTo(pX + ph * .14, pBase - ph * .70);
      ctx.quadraticCurveTo(pX + ph * .32, pBase - ph * .38, pX, pBase); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f5d5a8'; ctx.beginPath(); ctx.arc(pX, pBase - ph * .88, ph * .14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c8a030'; ctx.beginPath();
      ctx.arc(pX, pBase - ph * .90, ph * .16, Math.PI, 0);
      ctx.quadraticCurveTo(pX + ph * .22, pBase - ph * .58, pX + ph * .12, pBase - ph * .48);
      ctx.quadraticCurveTo(pX - ph * .06, pBase - ph * .58, pX - ph * .22, pBase - ph * .58); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f8d040';
      for (const cx2 of [-ph * .10, 0, ph * .10]) {
        ctx.beginPath(); ctx.moveTo(pX + cx2 - ph * .04, pBase - ph);
        ctx.lineTo(pX + cx2, pBase - ph * 1.11); ctx.lineTo(pX + cx2 + ph * .04, pBase - ph); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(248,210,50,.76)'; ctx.fillRect(pX - ph * .17, pBase - ph, ph * .34, ph * .06);
      ctx.save(); ctx.translate(pX + ph * .14, pBase - ph * .78); ctx.rotate(-.38 + wave);
      ctx.strokeStyle = '#e040a8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ph * .28, -ph * .20); ctx.stroke();
      ctx.fillStyle = '#f5d5a8'; ctx.beginPath(); ctx.arc(ph * .28, -ph * .20, ph * .065, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); void balX;
    }

    /* ── farm ── */
    function farm() {
      const fX = cX + cW + W * .012, fW = W * .110, fBase = cBY + Hh * .012;
      const bW = fW * .68, bH = Hh * .10, bX = fX + fW * .06, bY = fBase - bH;
      const barnG = ctx.createLinearGradient(bX, bY, bX + bW, fBase);
      barnG.addColorStop(0, '#9a5020'); barnG.addColorStop(1, '#6a3010'); ctx.fillStyle = barnG;
      ctx.fillRect(bX, bY, bW, bH);
      const brG = ctx.createLinearGradient(bX, bY - bH * .42, bX + bW, bY);
      brG.addColorStop(0, '#7a2808'); brG.addColorStop(1, '#5a1e06'); ctx.fillStyle = brG;
      ctx.beginPath(); ctx.moveTo(bX - 4, bY); ctx.lineTo(bX + bW / 2, bY - bH * .42); ctx.lineTo(bX + bW + 4, bY); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a2810'; ctx.beginPath();
      ctx.arc(bX + bW * .5, bY + bH * .35, bW * .22, Math.PI, 0);
      ctx.lineTo(bX + bW * .72, fBase); ctx.lineTo(bX + bW * .28, fBase); ctx.closePath(); ctx.fill();
      const pX = fX + fW * .02, pW = fW * .96, pH = Hh * .056, pY = fBase - Hh * .002;
      ctx.strokeStyle = '#9a7040'; ctx.lineWidth = 2.5;
      for (const ry of [pH * .24, pH * .62]) { ctx.beginPath(); ctx.moveTo(pX, pY - ry); ctx.lineTo(pX + pW, pY - ry); ctx.stroke(); }
      ctx.fillStyle = '#8a6030';
      for (let px = pX; px <= pX + pW; px += W * .018) ctx.fillRect(px - 2, pY - pH, 4, pH);
      for (const [hx, hr] of [[pX + pW * .60, Hh * .025], [pX + pW * .82, Hh * .018]] as [number, number][]) {
        const hg = ctx.createRadialGradient(hx, pY - hr * .65, 0, hx, pY - hr * .65, hr * 1.6);
        hg.addColorStop(0, '#e8c840'); hg.addColorStop(.6, '#c8a020'); hg.addColorStop(1, '#a88010');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(hx, pY - hr * .32, hr * 1.25, hr, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    /* ── soldier ── */
    function soldier(s: Soldier) {
      const ph = Hh * .053, sw = Math.sin(frame * .055 + s.phase) * ph * .28;
      const bob = Math.abs(Math.sin(frame * .055 + s.phase)) * ph * .04, y = s.baseY - bob;
      ctx.globalAlpha = .18; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(s.x, s.baseY, ph * .36, ph * .09, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      for (const [side, lsw] of [[-1, sw], [1, -sw]] as [number, number][]) {
        const lg = ctx.createLinearGradient(s.x + side * ph * .12, y - ph * .4, s.x + side * ph * .12, y);
        lg.addColorStop(0, '#606870'); lg.addColorStop(1, '#404850'); ctx.fillStyle = lg;
        ctx.beginPath(); ctx.ellipse(s.x + side * ph * .12 + lsw * .15, y - ph * .12 + Math.abs(lsw) * .1, ph * .09, ph * .22, lsw * .12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#382818'; ctx.beginPath(); ctx.ellipse(s.x + side * ph * .12 + lsw * .26, y - ph * .02, ph * .12, ph * .07, 0, 0, Math.PI * 2); ctx.fill();
      }
      const bg = ctx.createLinearGradient(s.x - ph * .18, y - ph * .70, s.x + ph * .18, y - ph * .35);
      bg.addColorStop(0, s.col); bg.addColorStop(.5, '#d0c8b8'); bg.addColorStop(1, '#606870'); ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(s.x, y - ph * .54, ph * .17, ph * .21, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#703828'; ctx.beginPath(); ctx.ellipse(s.x - ph * .26, y - ph * .48, ph * .12, ph * .16, -.30, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d4a830'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s.x - ph * .26, y - ph * .56); ctx.lineTo(s.x - ph * .26, y - ph * .40);
      ctx.moveTo(s.x - ph * .34, y - ph * .48); ctx.lineTo(s.x - ph * .18, y - ph * .48); ctx.stroke();
      ctx.strokeStyle = '#8a6030'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(s.x + ph * .20, y - ph * .40); ctx.lineTo(s.x + ph * .22, y - ph * 1.26); ctx.stroke();
      ctx.fillStyle = '#c0c0a8'; ctx.beginPath();
      ctx.moveTo(s.x + ph * .22, y - ph * 1.26); ctx.lineTo(s.x + ph * .17, y - ph * 1.14); ctx.lineTo(s.x + ph * .27, y - ph * 1.14); ctx.closePath(); ctx.fill();
      const hg = ctx.createRadialGradient(s.x - ph * .04, y - ph * .82, 0, s.x, y - ph * .78, ph * .18);
      hg.addColorStop(0, '#d8d0c0'); hg.addColorStop(.5, '#b0a898'); hg.addColorStop(1, '#888070'); ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(s.x, y - ph * .78, ph * .18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(20,15,10,.50)'; ctx.beginPath(); ctx.ellipse(s.x, y - ph * .74, ph * .14, ph * .05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c82010'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x, y - ph * .96); ctx.quadraticCurveTo(s.x + ph * .13, y - ph * 1.06, s.x + ph * .09, y - ph * .88); ctx.stroke();
    }

    /* ── horse ── */
    function horse(h: Horse) {
      const ph = Hh * .058, ls = Math.sin(frame * .042 + h.phase) * ph * .26;
      const bob = Math.abs(Math.sin(frame * .042 + h.phase)) * ph * .03, y = h.y - bob;
      ctx.save(); ctx.translate(h.x, y); ctx.scale(h.dir, 1);
      ctx.globalAlpha = .20; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0, 0, ph * .56, ph * .10, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      for (const [lx, lsw] of [[-ph * .28, ls], [-ph * .08, -ls], [ph * .12, ls * .8], [ph * .28, -ls * .8]] as [number, number][]) {
        ctx.fillStyle = h.col;
        ctx.beginPath(); ctx.ellipse(lx + lsw * .20, -ph * .14 + .10, ph * .078, ph * .23, lsw * .08, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1208'; ctx.beginPath(); ctx.ellipse(lx + lsw * .36, -ph * .01, ph * .072, ph * .052, 0, 0, Math.PI * 2); ctx.fill();
      }
      const bg = ctx.createLinearGradient(-ph * .46, -ph * .50, ph * .46, -ph * .10);
      bg.addColorStop(0, h.col); bg.addColorStop(.5, lgt(h.col, 55)); bg.addColorStop(1, h.col); ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(0, -ph * .32, ph * .48, ph * .22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = h.col; ctx.beginPath();
      ctx.moveTo(ph * .32, -ph * .46); ctx.quadraticCurveTo(ph * .52, -ph * .66, ph * .43, -ph * .80);
      ctx.quadraticCurveTo(ph * .38, -ph * .60, ph * .22, -ph * .46); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ph * .49, -ph * .81, ph * .16, ph * .11, -.36, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#080402'; ctx.beginPath(); ctx.arc(ph * .56, -ph * .84, ph * .026, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = lgt(h.col, 60); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ph * .32, -ph * .46); ctx.quadraticCurveTo(ph * .22, -ph * .70, ph * .39, -ph * .80); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-ph * .46, -ph * .38); ctx.quadraticCurveTo(-ph * .70, -ph * .28, -ph * .74, -ph * .10); ctx.stroke();
      ctx.restore();
    }

    /* ── main loop ── */
    function loop() {
      try {
        frame++;
        // Sky
        const sky = ctx.createLinearGradient(0, 0, 0, Hh * .68);
        sky.addColorStop(0, '#3a7ec0'); sky.addColorStop(.42, '#6aaee0'); sky.addColorStop(.72, '#a0ccee'); sky.addColorStop(1, '#c8e4f4');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, Hh);
        // Sun glow
        const sun = ctx.createRadialGradient(W * .72, Hh * .08, 0, W * .72, Hh * .08, Hh * .32);
        sun.addColorStop(0, 'rgba(255,250,200,.52)'); sun.addColorStop(.3, 'rgba(255,228,140,.16)'); sun.addColorStop(1, 'transparent');
        ctx.fillStyle = sun; ctx.fillRect(0, 0, W, Hh);
        // Mountains back to front
        drawRidge(ctx, rA, Hh, '#8090a8', '#98a8bc'); addSnow(ctx, rA, Hh * .19);
        const haze = ctx.createLinearGradient(0, Hh * .38, 0, Hh * .56);
        haze.addColorStop(0, 'transparent'); haze.addColorStop(1, 'rgba(175,208,238,.22)');
        ctx.fillStyle = haze; ctx.fillRect(0, Hh * .38, W, Hh * .18);
        drawRidge(ctx, rB, Hh, '#6878a0', '#788ab0'); addSnow(ctx, rB, Hh * .25);
        drawRidge(ctx, rC, Hh, '#485870', '#586880'); addSnow(ctx, rC, Hh * .32);
        drawRidge(ctx, rD, Hh, '#384858', '#3a5030');
        // Far pines
        for (const t of ptrees) { if (t.y > Hh * .57) continue; pine(t); }
        // Farm
        farm();
        // Valley
        const valley = ctx.createLinearGradient(0, Hh * .58, 0, Hh);
        valley.addColorStop(0, '#4aaa20'); valley.addColorStop(.38, '#58c025'); valley.addColorStop(1, '#6ad030');
        ctx.fillStyle = valley; ctx.beginPath();
        ctx.moveTo(0, Hh * .62); ctx.quadraticCurveTo(W * .25, Hh * .57, W * .50, Hh * .62);
        ctx.quadraticCurveTo(W * .75, Hh * .66, W, Hh * .62);
        ctx.lineTo(W, Hh); ctx.lineTo(0, Hh); ctx.closePath(); ctx.fill();
        // Path
        ctx.strokeStyle = '#9a8878'; ctx.lineWidth = W * .016; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(W * .32, cBY + Hh * .025);
        ctx.quadraticCurveTo(W * .50, cBY + Hh * .045, cX + W * .012, cBY + Hh * .012); ctx.stroke();
        ctx.lineCap = 'butt';
        // Near pines
        for (const t of ptrees) { if (t.y <= Hh * .57) continue; pine(t); }
        // Village
        for (const h of houses) house(h);
        church(W * .20, cBY, W * .072, Hh * .185);
        // Well
        const wg = ctx.createRadialGradient(W * .33, cBY - Hh * .017, 0, W * .33, cBY - Hh * .017, Hh * .024);
        wg.addColorStop(0, '#a89870'); wg.addColorStop(1, '#7a6848'); ctx.fillStyle = wg;
        ctx.beginPath(); ctx.arc(W * .33, cBY - Hh * .015, Hh * .024, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a4830'; ctx.beginPath(); ctx.arc(W * .33, cBY - Hh * .015, Hh * .014, 0, Math.PI * 2); ctx.fill();
        // Castle
        const { balX, balY, kX, kW } = castle();
        princess(balX, balY, kX, kW);
        // Soldiers march
        for (const s of soldiers) { s.x += .38; if (s.x > cX + cW * .95) s.x = cX + cW * .07; soldier(s); }
        // Horses
        for (const h of horses) { h.phase += .025; h.x += h.dir * .28; if (h.x > h.hi) h.dir = -1; if (h.x < h.lo) h.dir = 1; horse(h); }
        // Clouds on top
        for (const c of clouds) { c.x += c.spd; if (c.x - c.rx > W) c.x = -c.rx; cloud(c); }
        raf = requestAnimationFrame(loop);
      } catch { raf = requestAnimationFrame(loop); }
    }

    init(); loop();
    const ro = new ResizeObserver(init); ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
