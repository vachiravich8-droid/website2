// "Laptop dive" home page: a photographic hero whose camera pushes into the laptop, which then shows each map.

const HX = (u, w = 2048) => `https://images.higgs.ai/?default=1&output=webp&url=${encodeURIComponent(u)}&w=${w}&q=85`;
const CF = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/';
const ASSET = {
  plate: HX(CF + 'hf_20261111_001031_a09dc558-2c69-4e05-83a4-5f01ebdd1363.png'),
  casePlate: HX(CF + 'hf_20261111_001031_4a7c3fd9-2168-4219-9736-096a17bbb0e2.png'),
  cut: HX(CF + 'hf_20261111_001143_ec356b1a-50a2-4b50-82fc-e346c914a406.png'),
  badge: HX(CF + 'hf_20261111_001143_65c037e6-0768-4b12-9f17-17be132ce16b.png', 1200),
  trans: CF + 'hf_20261111_001144_2b054228-95af-41d5-922d-b02979fe485b.mp4',
};
const APPS = {
  roblox: 'Roblox', discord: 'Discord', youtube: 'YouTube', tiktok: 'TikTok', facebook: 'Facebook',
  instagram: 'Instagram', x: 'X', line: 'LINE', email: 'อีเมล', other: 'ลิงก์',
};

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const EXIT = 'cubic-bezier(.5,0,.75,0)';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const root = document.documentElement;
const full = new Intl.NumberFormat('th-TH');
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const wait = (ms) => new Promise((done) => setTimeout(done, RM ? 0 : ms));
const frames = (count) => new Promise((done) => { const step = () => (count-- > 0 ? requestAnimationFrame(step) : done()); step(); });

function anim(node, keyframes, options = {}) {
  return node.animate(keyframes, {
    fill: 'both', easing: EASE, ...options,
    duration: RM ? 0 : options.duration || 0, delay: RM ? 0 : options.delay || 0,
  });
}
function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  node.append(...kids.filter(Boolean));
  return node;
}

const stage = $('.stage'), frame = $('.frame'), plate = $('.plate'), cut = $('.cut'), trans = $('.trans'), casePlate = $('.caseplate');
const screen = $('.screen'), flash = $('.screen .flash'), wm = $('.frame .wm'), script = $('.frame .script'), badge = $('.frame .badge');
const ticket = $('.ticket'), desc = $('.desc'), prevBtn = $('.nav-case.prev'), sheet = $('.sheet');

let mode = 'hero', busy = false, index = 0, cases = [], site = null, transReady = false, sway = [];
const shots = new Map();
const isMobile = () => innerWidth <= 820;

plate.src = ASSET.plate;
cut.src = ASSET.cut;
casePlate.src = ASSET.casePlate;
$('img', badge).src = ASSET.badge;
$('.ph', badge).style.backgroundImage = `url("${ASSET.cut}")`;
$('.yr', badge).textContent = new Date().getFullYear();

// Kling clips have a single keyframe, so streaming seeks stall. Fetch it whole and play from memory.
trans.addEventListener('loadeddata', () => { transReady = true; });
fetch(ASSET.trans).then((r) => (r.ok ? r.blob() : Promise.reject())).then((blob) => { trans.src = URL.createObjectURL(blob); })
  .catch(() => { trans.src = ASSET.trans; });

// The phone layout shows its own copy of the badge in the fixed UI layer.
const mobileBadge = badge.cloneNode(true);
mobileBadge.classList.remove('pre');
$('.m-badge').append(mobileBadge);
const badges = [badge, mobileBadge];

// ---- frame fitting ----
function pose(m) {
  const W = innerWidth, H = innerHeight;
  if (!isMobile()) {
    const cover = Math.max(W / 1440, H / 810), u = Math.min(W / 1440, H / 900);
    if (m === 'hero') return { s: cover, x: (W - 1440 * cover) / 2, y: 0 };
    const top = 66 * u, fit = (H - top - 28 * u) / (762 - 79);
    if (fit >= cover) return { s: cover, x: (W - 1440 * cover) / 2, y: Math.min(0, Math.max(H - 810 * cover, top - 79 * cover)) };
    return { s: fit, x: (W - 1440 * fit) / 2, y: top - 79 * fit };
  }
  if (m === 'hero') {
    const s = Math.min(W / 650, (0.62 * H) / 810);
    return { s, x: W / 2 - 805 * s, y: H - 790 * s };
  }
  const navH = 0.022 * H + 42 + 22;
  const uiBottom = 62 + ticket.offsetHeight + 18 + Math.max(60, desc.offsetHeight) + 14;
  const s = Math.min((W - 28) / 905, Math.max(0.2, (H - navH - uiBottom) / (762 - 95)));
  return { s, x: W / 2 - 720 * s, y: H - navH - 762 * s };
}

// Keeps the wordmark, badge and handwriting inside the part of the frame that is actually on screen.
function fitHero(p) {
  const W = innerWidth, H = innerHeight;
  const vl = Math.max(0, -p.x / p.s), vr = Math.min(1440, (W - p.x) / p.s), pad = 18 / p.s;
  wm.style.left = `${vl + 0.6 * pad}px`;
  wm.style.width = `${vr - vl - 1.2 * pad}px`;
  const vb = Math.min(810, (H - p.y) / p.s);
  badge.style.left = `${Math.min(986, vr - pad - 417)}px`;
  badge.style.top = `${Math.min(-165, vb - 56 / p.s - 935)}px`;
  script.style.left = `${vl + pad + 70}px`;
}

function place(m) {
  const mobile = isMobile();
  root.style.setProperty('--n', `${mobile ? innerWidth / 430 : Math.min(innerWidth / 1440, innerHeight / 900)}px`);
  if (mobile) {
    root.style.setProperty('--mbs', $('.m-badge').offsetWidth / 582);
    root.style.setProperty('--th', `${ticket.offsetHeight}px`);
  }
  const p = pose(m);
  frame.style.transform = `translate(${p.x}px, ${p.y}px) scale(${p.s})`;
  frame.classList.toggle('d-fade', !mobile);
  frame.classList.toggle('m-fade', mobile);
  frame.classList.toggle('m-case', m === 'case');
  stage.classList.toggle('m-case', m === 'case');
  if (!mobile && m === 'hero') fitHero(p);
}

function setBusy(value) {
  busy = value;
  document.body.classList.toggle('busy', value);
}

// ---- hero: entrance, badge sway, exit and return ----
function startSway() {
  if (RM) return;
  sway.forEach((a) => a.cancel());
  sway = badges.map((b) => b.animate([{ transform: 'rotate(-1.1deg)' }, { transform: 'rotate(1.1deg)' }],
    { duration: 3200, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
}

function entrance() {
  if (root.dataset.in) return;
  root.dataset.in = '1';
  $$('.tag.pre').forEach((tag, i) => anim(tag, [{ opacity: 0, transform: 'translateY(-40px) rotate(-4deg)' }, { opacity: 1, transform: 'none' }],
    { duration: 700, delay: 120 + i * 80, easing: 'cubic-bezier(.3,1.5,.5,1)' }));
  for (const mark of $$('.wm, .m-wm')) {
    anim(mark, [{ opacity: 0, transform: 'translateY(60px)', clipPath: 'inset(100% 0 0 0)' }, { opacity: 1, transform: 'none', clipPath: 'inset(-40% 0 0 0)' }],
      { duration: 1100, delay: 260 });
  }
  for (const word of $$('.script, .m-script')) {
    const base = getComputedStyle(word).transform;
    anim(word, [{ opacity: 0, clipPath: 'inset(-20% 100% -20% 0)', transform: base }, { opacity: 1, clipPath: 'inset(-20% -5% -20% 0)', transform: base }],
      { duration: 900, delay: 1050, easing: 'cubic-bezier(.5,0,.3,1)' });
  }
  const drops = badges.map((b) => anim(b, [
    { opacity: 0, transform: 'translateY(-120%) rotate(8deg)', offset: 0 },
    { opacity: 1, transform: 'translateY(0) rotate(-3deg)', offset: 0.6 },
    { opacity: 1, transform: 'rotate(1.6deg)', offset: 0.8 },
    { opacity: 1, transform: 'rotate(0deg)', offset: 1 }], { duration: 1500, delay: 700 }));
  drops[0].finished.then(() => { if (mode === 'hero' && !busy) startSway(); }).catch(() => {});
  anim($('.hint'), [{ opacity: 0 }, { opacity: 0.85 }], { duration: 600, delay: 1800 });
}

function heroOut() {
  const options = { duration: 380, easing: EXIT, fill: 'forwards' };
  for (const mark of $$('.wm, .m-wm')) anim(mark, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-40px)' }], options);
  for (const word of $$('.script, .m-script')) anim(word, [{ opacity: 1 }, { opacity: 0 }], options);
  sway.forEach((a) => a.cancel());
  sway = [];
  for (const b of badges) anim(b, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-110%) rotate(-6deg)' }], options);
}

function heroIn() {
  for (const mark of $$('.wm, .m-wm')) anim(mark, [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }], { duration: 700, fill: 'forwards' });
  for (const word of $$('.script, .m-script')) {
    anim(word, [{ opacity: 0, clipPath: 'inset(-20% 100% -20% 0)' }, { opacity: 1, clipPath: 'inset(-20% -5% -20% 0)' }], { duration: 700, delay: 250, fill: 'forwards' });
  }
  const drops = badges.map((b) => anim(b, [
    { opacity: 0, transform: 'translateY(-110%) rotate(6deg)', offset: 0 },
    { opacity: 1, transform: 'translateY(0) rotate(-2deg)', offset: 0.7 },
    { opacity: 1, transform: 'rotate(0deg)', offset: 1 }], { duration: 1100, fill: 'forwards' }));
  drops[0].finished.then(() => { if (mode === 'hero') startSway(); }).catch(() => {});
}

for (const b of badges) {
  $('.hit', b).addEventListener('pointerenter', () => {
    if (mode !== 'hero' || busy || RM) return;
    b.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-6deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(-2deg)' }, { transform: 'rotate(0deg)' }],
      { duration: 1400, easing: 'ease-out', composite: 'add' });
  });
}

// ---- the laptop screen and the case UI ----
function contourCover(seedText) {
  const NS = 'http://www.w3.org/2000/svg';
  let seed = [...seedText].reduce((a, c) => (a * 31 + c.codePointAt(0)) >>> 0, 7);
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 320 180');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  for (let peak = 0; peak < 2; peak++) {
    const cx = 60 + rand() * 200, cy = 40 + rand() * 100, phase = rand() * 6, lobes = 3 + Math.floor(rand() * 3);
    for (let ring = 1; ring <= 8; ring++) {
      let d = '';
      for (let a = 0; a <= 64; a++) {
        const th = (a / 64) * Math.PI * 2;
        const r = ring * 16 * (1 + 0.22 * Math.sin(th * lobes + phase) + 0.08 * Math.sin(th * 7 + ring));
        d += `${a ? 'L' : 'M'}${(cx + Math.cos(th) * r * 1.3).toFixed(1)} ${(cy + Math.sin(th) * r).toFixed(1)}`;
      }
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', `${d}Z`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', ring === 1 ? '#cfeee0' : '#1a5a40');
      path.setAttribute('stroke-width', ring % 4 === 0 ? '1.1' : '.6');
      svg.append(path);
    }
  }
  return svg;
}

function shot(i) {
  if (shots.has(i)) return shots.get(i);
  const game = cases[i];
  let node;
  if (!game) node = el('div', { class: 'shot empty', text: 'ยังไม่มีแมพ' });
  else if (game.live?.thumb) node = el('div', { class: 'shot' }, el('img', { src: game.live.thumb, alt: '' }));
  else node = el('div', { class: 'shot' }, contourCover(game.title));
  screen.insertBefore(node, flash);
  shots.set(i, node);
  return node;
}

function ticketRows(game) {
  if (!game) return ['เพิ่มแมพแรกได้ที่หลังบ้าน', '', ''];
  if (game.live) {
    return [`${full.format(game.live.playing)} คนกำลังเล่น`, `เข้าเล่น ${compact.format(game.live.visits)} ครั้ง`, `ถูกใจ ${compact.format(game.live.favorites)}`];
  }
  return [game.status === 'live' ? 'เปิดให้เล่นแล้ว' : 'กำลังสร้าง', game.tags.join(' / ') || 'ROBLOX', game.addedAt];
}

function fillCase(i) {
  const game = cases[i], total = Math.max(1, cases.length);
  const title = $('h2', ticket);
  title.textContent = game ? game.title : 'ยังไม่มีแมพ';
  title.classList.toggle('thai', /[฀-๿]/.test(title.textContent));
  title.style.setProperty('--fit', 1);
  if (title.scrollWidth > title.clientWidth) title.style.setProperty('--fit', (0.98 * title.clientWidth) / title.scrollWidth);
  $$('.rows p', ticket).forEach((row, k) => { row.textContent = ticketRows(game)[k] || ' '; });
  $('.k', desc).textContent = `// ${(game ? game.title : 'แมพ').toLowerCase()}`;
  $('.text', desc).textContent = game?.blurb ? `— ${game.blurb}` : '';
  $('.num', desc).textContent = `${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  const play = $('.play', desc), playable = Boolean(game?.url && game.status === 'live');
  play.hidden = !playable;
  if (playable) play.href = game.url; else play.removeAttribute('href');
  $('.screen-hit').setAttribute('aria-label', playable ? `เข้าเล่น ${game.title} บน Roblox` : 'ดูแมพถัดไป');
  prevBtn.classList.toggle('dim', i === 0);
  if (isMobile() && mode === 'case') place('case');
}

function caseIn(i, first) {
  fillCase(i);
  anim(ticket, [
    { opacity: 0, transform: 'translateY(-60px) rotate(-6deg)', offset: 0 },
    { opacity: 1, transform: 'translateY(6px) rotate(1.2deg)', offset: 0.7 },
    { opacity: 1, transform: 'none', offset: 1 }], { duration: 800, delay: first ? 150 : 0 });
  [...desc.children].forEach((child, k) => anim(child, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
    { duration: 600, delay: (first ? 250 : 80) + k * 70 }));
}

function caseOut() {
  [...desc.children].forEach((child, k) => anim(child, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)' }],
    { duration: 300, delay: k * 40, easing: EXIT }));
  return anim(ticket, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-40px) rotate(4deg)' }], { duration: 380, easing: EXIT }).finished;
}

// ---- hero → laptop ----
function playClip() {
  return new Promise((done) => {
    let finished = false;
    const finish = () => { if (!finished) { finished = true; done(); } };
    trans.addEventListener('ended', finish, { once: true });
    setTimeout(finish, 7000);
    trans.play().catch(finish);
    (function ease() {
      if (finished) return;
      const p = trans.currentTime / (trans.duration || 5.04);
      if (p >= 0.995) return finish();
      // Slow start, about 4.2x in the middle, gentle landing: the 5 s clip plays in roughly 1.7 s.
      trans.playbackRate = Math.max(1.2, 1.8 + 2.4 * Math.sin(Math.PI * Math.min(p * 1.08, 1)));
      requestAnimationFrame(ease);
    })();
  });
}

async function toCase() {
  if (busy || mode !== 'hero') return;
  setBusy(true);
  heroOut();
  await wait(330);
  if (RM || !transReady) {
    place('case');
    await anim(casePlate, [{ opacity: 0 }, { opacity: 1 }], { duration: 500 }).finished;
    casePlate.style.opacity = 1;
    return arriveCase();
  }
  trans.currentTime = 0;
  trans.style.opacity = 1;
  await frames(2);
  plate.style.visibility = 'hidden';
  anim(cut, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out' });
  root.style.setProperty('--glide', '1.6s');
  frame.classList.add('glide');
  place('case');
  await playClip();
  trans.pause();
  casePlate.getAnimations().forEach((a) => a.cancel());
  casePlate.style.opacity = 1;
  trans.style.opacity = 0;
  arriveCase();
}

function arriveCase() {
  mode = 'case';
  index = 0;
  document.body.classList.add('is-case');
  plate.style.visibility = 'hidden';
  cut.style.opacity = 0;
  cut.getAnimations().forEach((a) => a.cancel());
  screen.getAnimations().forEach((a) => a.cancel());
  screen.style.opacity = 1;
  anim(flash, [{ opacity: 0 }, { opacity: 0.55 }, { opacity: 0 }], { duration: 600, easing: 'ease-out' });
  anim(shot(0), [{ opacity: 0, transform: 'scale(1.06)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 700 });
  caseIn(0, true);
  if (cases.length > 1) shot(1);
  setTimeout(() => { setBusy(false); frame.classList.remove('glide'); }, RM ? 0 : 700);
}

async function swapTo(next) {
  if (busy || mode !== 'case' || next === index) return;
  setBusy(true);
  const old = shot(index);
  await Promise.all([caseOut(), anim(old, [{ opacity: 1 }, { opacity: 0 }], { duration: 350 }).finished]);
  anim(flash, [{ opacity: 0 }, { opacity: 0.35 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
  index = next;
  anim(shot(next), [{ opacity: 0, transform: 'scale(1.04)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 500 });
  caseIn(next, false);
  if (cases.length) shot((next + 1) % cases.length);
  setTimeout(() => setBusy(false), RM ? 0 : 520);
}

const nextCase = () => { if (cases.length > 1) swapTo((index + 1) % cases.length); };
const prevCase = () => (index === 0 ? toHero() : swapTo(index - 1));

// ---- laptop → hero ----
async function toHero() {
  if (busy || mode !== 'case') return;
  setBusy(true);
  caseOut();
  await anim(screen, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished;
  screen.getAnimations().forEach((a) => a.cancel());
  screen.style.opacity = 0;
  for (const node of shots.values()) node.getAnimations().forEach((a) => a.cancel());
  mode = 'hero';
  document.body.classList.remove('is-case');
  root.style.setProperty('--glide', '.9s');
  frame.classList.add('glide');
  place('hero');
  plate.style.visibility = '';
  cut.style.opacity = '';
  anim(cut, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 150 });
  anim(casePlate, [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(12px)' }], { duration: 800, easing: 'cubic-bezier(.65,0,.35,1)' })
    .finished.then(() => { casePlate.style.opacity = 0; casePlate.getAnimations().forEach((a) => a.cancel()); });
  anim(plate, [{ transform: 'scale(1.12)', filter: 'blur(8px)' }, { transform: 'scale(1)', filter: 'blur(0px)' }], { duration: 900, fill: 'none' });
  await wait(250);
  heroIn();
  setTimeout(() => { setBusy(false); frame.classList.remove('glide'); }, RM ? 0 : 1000);
}

// ---- contact / updates sheet ----
let sheetOpener = null;
function openSheet(kind, opener) {
  if (!site) return;
  const body = $('.body', sheet);
  if (kind === 'contact') {
    $('#sheet-title').textContent = 'ช่องทางติดต่อ';
    body.replaceChildren(...site.links.map((link) => el('a', { class: 'line', href: link.url, target: '_blank', rel: 'noopener' },
      el('strong', { text: APPS[link.app] || APPS.other }), el('span', { text: `${link.label} ↗` }))));
    if (!site.links.length) body.append(el('p', { class: 'none', text: 'ยังไม่ได้เพิ่มช่องทางติดต่อ' }));
  } else {
    $('#sheet-title').textContent = 'บันทึกอัปเดต';
    body.replaceChildren(...site.updates.map((u) => el('div', { class: 'line' },
      el('strong', { text: u.title }), el('span', { text: u.date }), u.body ? el('p', { text: u.body }) : null)));
    if (!site.updates.length) body.append(el('p', { class: 'none', text: 'ยังไม่มีอัปเดต' }));
  }
  sheetOpener = opener;
  sheet.hidden = false;
  anim($('.panel', sheet), [{ opacity: 0, transform: 'translateY(-50px) rotate(-3deg)' }, { opacity: 1, transform: 'none' }], { duration: 450 });
  $('.close', sheet).focus();
}
function closeSheet() {
  sheet.hidden = true;
  sheetOpener?.focus();
}
sheet.addEventListener('click', (e) => { if (e.target === sheet || e.target.closest('.close')) closeSheet(); });

// ---- input: the page never scrolls, so wheel, touch and keys drive the scenes ----
const forward = () => (mode === 'hero' ? toCase() : nextCase());
const back = () => { if (mode === 'case') prevCase(); };

let wheelLock = 0;
addEventListener('wheel', (e) => {
  if (!sheet.hidden) return;
  e.preventDefault();
  if (Math.abs(e.deltaY) < 18 || performance.now() < wheelLock) return;
  wheelLock = performance.now() + 900;
  e.deltaY > 0 ? forward() : back();
}, { passive: false });

let touchStart = null;
addEventListener('touchstart', (e) => { touchStart = sheet.hidden ? [e.touches[0].clientX, e.touches[0].clientY] : null; }, { passive: true });
addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart[0], dy = e.changedTouches[0].clientY - touchStart[1];
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
  if (Math.abs(dy) >= Math.abs(dx)) dy < 0 ? forward() : back();
  else if (mode === 'case') dx < 0 ? nextCase() : prevCase();
}, { passive: true });

addEventListener('keydown', (e) => {
  if (!sheet.hidden) { if (e.key === 'Escape') closeSheet(); return; }
  const onControl = e.target.closest?.('button, a');
  if (['ArrowDown', 'PageDown'].includes(e.key) || (e.key === ' ' && !onControl)) { e.preventDefault(); forward(); }
  else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); back(); }
  else if (mode === 'case' && e.key === 'ArrowRight') nextCase();
  else if (mode === 'case' && e.key === 'ArrowLeft') prevCase();
});

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]'), opens = e.target.closest('[data-sheet]');
  if (go) go.dataset.go === 'case' ? toCase() : toHero();
  else if (opens) openSheet(opens.dataset.sheet, opens);
  else if (e.target.closest('.nav-case.next')) nextCase();
  else if (e.target.closest('.nav-case.prev')) prevCase();
  else if (e.target.closest('.screen-hit')) {
    const game = cases[index];
    if (game?.url && game.status === 'live') window.open(game.url, '_blank', 'noopener');
    else nextCase();
  }
});

addEventListener('resize', () => {
  frame.classList.remove('glide');
  place(mode);
  if (mode === 'case' && !busy) fillCase(index);
});

// ---- data ----
function applySite(data) {
  site = data;
  cases = data.games;
  const name = data.profile.name;
  document.title = `${name} — แมพ Roblox`;
  for (const node of $$('[data-name]')) node.textContent = name;
  for (const node of $$('[data-wordmark]')) {
    node.textContent = name.toUpperCase();
    node.classList.toggle('thai', /[฀-๿]/.test(name));
  }
  const playing = cases.reduce((n, g) => n + (g.live?.playing || 0), 0);
  const first = data.links[0];
  const rows = [['NAME', name], ['MAPS', String(cases.length)], ['ONLINE', full.format(playing)]];
  if (first) rows.push([(APPS[first.app] || 'LINK').toUpperCase(), first.label || '↗']);
  for (const b of badges) {
    $('.rows', b).replaceChildren(...rows.map(([label, value]) => el('div', { class: 'row' }, el('span', { text: label }), el('b', { text: value }))));
  }
  if (mode === 'case' && !busy) fillCase(index);
}

async function load() {
  try {
    const res = await fetch('/api/site');
    if (res.ok) applySite(await res.json());
  } catch { /* keep showing what we have */ }
}

place('hero');
const plateReady = new Promise((done) => {
  if (plate.complete) done(); else { plate.addEventListener('load', done, { once: true }); plate.addEventListener('error', done, { once: true }); }
});
const start = () => requestAnimationFrame(() => { place(mode); entrance(); });
Promise.race([Promise.all([document.fonts.ready, plateReady, load()]), new Promise((done) => setTimeout(done, 2500))]).then(start);
setTimeout(start, 4000);
setInterval(() => { if (!document.hidden) load(); }, 60_000);
