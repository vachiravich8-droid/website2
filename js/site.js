import { createScene } from './scene.js';

const APPS = {
  roblox: ['Roblox', '#ece7d6'], discord: ['Discord', '#8c9eff'], youtube: ['YouTube', '#ff5c5c'],
  tiktok: ['TikTok', '#5ff2e8'], facebook: ['Facebook', '#6ea8ff'], instagram: ['Instagram', '#ff7ab8'],
  x: ['X', '#ece7d6'], line: ['LINE', '#5be37d'], email: ['อีเมล', '#ffd166'], other: ['ลิงก์', '#ff5a1f'],
};
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel) => document.querySelector(sel);
const full = new Intl.NumberFormat('th-TH');
const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 });
const SVG = 'http://www.w3.org/2000/svg';

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

function countTo(node, target, format = full) {
  const from = Number(node.dataset.value || 0);
  node.dataset.value = target;
  if (calm || from === target) { node.textContent = format.format(target); return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 1400);
    const eased = 1 - Math.pow(1 - t, 4);
    node.textContent = format.format(Math.round(from + (target - from) * eased));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// A contour-map cover drawn from the title, for maps that have no Roblox thumbnail yet.
function contourCover(seedText) {
  let seed = [...seedText].reduce((a, c) => (a * 31 + c.codePointAt(0)) >>> 0, 7);
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const svg = document.createElementNS(SVG, 'svg');
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
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('d', d + 'Z');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', ring === 1 ? '#ff5a1f' : '#3d5446');
      path.setAttribute('stroke-width', ring % 4 === 0 ? '1.1' : '.6');
      svg.append(path);
    }
  }
  return svg;
}

function mapCard(game, index, total) {
  const live = game.live;
  const cover = el('div', { class: 'cover-in' });
  if (live?.thumb) cover.append(el('img', { src: live.thumb, alt: `ภาพปกแมพ ${game.title}`, loading: 'lazy' }));
  else cover.append(contourCover(game.title));
  const coverWrap = el('div', { class: 'cover' },
    el('span', { class: 'idx', text: `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` }),
    game.pinned ? el('span', { class: 'badge', text: 'แนะนำ' }) : null,
    cover);

  const stats = live ? el('div', { class: 'stats' },
    el('div', { class: 'now' }, el('b', { 'data-stat': `${game.id}:playing`, text: '0' }), 'กำลังเล่น'),
    el('div', {}, el('b', { 'data-stat': `${game.id}:visits`, text: '0' }), 'เข้าเล่น'),
    el('div', {}, el('b', { 'data-stat': `${game.id}:favorites`, text: '0' }), 'ถูกใจ')) : null;

  const playable = game.url && game.status === 'live';
  const play = playable
    ? el('a', { class: 'play', href: game.url, target: '_blank', rel: 'noopener' }, 'เข้าเล่นบน Roblox ', el('span', { text: '↗' }))
    : el('span', { class: 'play soon', text: 'กำลังสร้าง เร็วๆ นี้' });

  return el('article', { class: 'map reveal', 'data-p': '' }, coverWrap,
    el('div', { class: 'info' },
      el('h3', { text: game.title }),
      game.blurb ? el('p', { class: 'blurb', text: game.blurb }) : null,
      game.tags.length ? el('ul', { class: 'tags' }, ...game.tags.map((t) => el('li', { text: t }))) : null,
      stats, play));
}

function renderTitle(name) {
  const title = $('#title');
  title.setAttribute('aria-label', name);
  title.replaceChildren(...name.split(/\s+/).filter(Boolean).map((word, i) => {
    const inner = el('span', { text: word, 'aria-hidden': 'true' });
    inner.style.animationDelay = `${0.12 + i * 0.11}s`;
    return el('span', { class: 'w' }, inner);
  }));
}

function updateNumbers(site) {
  const liveGames = site.games.filter((g) => g.live);
  const playing = liveGames.reduce((n, g) => n + g.live.playing, 0);
  const visits = liveGames.reduce((n, g) => n + g.live.visits, 0);
  countTo($('[data-count="playing"]'), playing);
  countTo($('[data-count="visits"]'), visits, compact);
  countTo($('[data-count="maps"]'), site.games.length);
  const pulse = $('#pulse');
  pulse.hidden = playing === 0;
  pulse.querySelector('span').textContent = `${full.format(playing)} คนกำลังเล่น`;
  for (const g of liveGames) {
    for (const key of ['playing', 'visits', 'favorites']) {
      const node = document.querySelector(`[data-stat="${CSS.escape(g.id)}:${key}"]`);
      if (node) countTo(node, g.live[key], key === 'playing' ? full : compact);
    }
  }
}

function render(site) {
  document.title = `${site.profile.name} — แมพ Roblox`;
  for (const node of document.querySelectorAll('[data-bind]')) node.textContent = site.profile[node.dataset.bind] || '';
  renderTitle(site.profile.name);

  const list = $('#map-list');
  list.replaceChildren(...site.games.map((g, i) => mapCard(g, i, site.games.length)));
  if (!site.games.length) list.append(el('p', { class: 'empty', text: 'ยังไม่มีแมพ เพิ่มแมพแรกได้ที่หลังบ้าน' }));

  const words = [...new Set(site.games.flatMap((g) => [g.title, ...g.tags]))];
  const run = (words.length ? words : [site.profile.name]).map((w) => el('span', { text: `${w}  ✦` }));
  const fill = Math.max(2, Math.ceil(12 / run.length)) * 2;
  $('#ticker').replaceChildren(...Array.from({ length: fill }, () => run.map((n) => n.cloneNode(true))).flat());

  $('#log').hidden = !site.updates.length;
  $('#log-list').replaceChildren(...site.updates.map((u) => el('li', { class: 'reveal' },
    el('time', { text: u.date }),
    el('div', {}, el('h3', { text: u.title }), u.body ? el('p', { text: u.body }) : null))));

  $('#contact').hidden = !site.links.length;
  $('#link-list').replaceChildren(...site.links.map((link, i) => {
    const [appName, tone] = APPS[link.app] || APPS.other;
    const a = el('a', { href: link.url, target: '_blank', rel: 'noopener' },
      el('span', { class: 'mono', text: String(i + 1).padStart(2, '0') }),
      el('span', { class: 'app', text: appName }),
      el('span', { class: 'who', text: link.label }),
      el('span', { class: 'go', text: '↗', 'aria-hidden': 'true' }));
    a.style.setProperty('--tone', tone);
    const row = el('li', { class: 'reveal' }, a);
    row.style.transitionDelay = `${i * 80}ms`;
    return row;
  }));
  $('#outro span').textContent = `${site.profile.name} ✦ `.repeat(4);
  for (const a of document.querySelectorAll('[data-section-link]')) a.hidden = $(`#${a.dataset.sectionLink}`).hidden;

  observe();
  trackScrollLinked();
  bindPointerEffects();
  updateNumbers(site);
}

const watcher = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('in');
    watcher.unobserve(entry.target);
  }
}, { threshold: 0.12 });
function observe() { for (const node of document.querySelectorAll('.reveal:not(.in)')) watcher.observe(node); }

function bindPointerEffects() {
  if (calm || matchMedia('(hover: none)').matches) return;
  for (const cover of document.querySelectorAll('.cover')) {
    const inner = cover.querySelector('.cover-in');
    cover.addEventListener('pointermove', (e) => {
      const r = cover.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      inner.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
      inner.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
      inner.style.setProperty('--mx', `${x * 100}%`);
      inner.style.setProperty('--my', `${y * 100}%`);
    });
    cover.addEventListener('pointerleave', () => { inner.style.setProperty('--rx', '0deg'); inner.style.setProperty('--ry', '0deg'); });
  }
  for (const btn of document.querySelectorAll('a.play')) {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--px', `${(e.clientX - r.left - r.width / 2) * 0.22}px`);
      btn.style.setProperty('--py', `${(e.clientY - r.top - r.height / 2) * 0.3}px`);
    });
    btn.addEventListener('pointerleave', () => { btn.style.setProperty('--px', '0px'); btn.style.setProperty('--py', '0px'); });
  }
}

// ---- crosshair that follows the pointer and reports its grid position ----
const pointer = { x: -999, y: -999 };
(function reticle() {
  if (calm || matchMedia('(hover: none)').matches) return;
  const node = $('#reticle'), label = node.querySelector('span');
  let x = 0, y = 0, shown = false;
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    if (!shown) { shown = true; x = e.clientX; y = e.clientY; node.classList.add('on'); }
    node.classList.toggle('lock', Boolean(e.target.closest('a, button')));
    label.textContent = `X ${String(Math.round(e.clientX)).padStart(4, '0')}  Y ${String(Math.round(e.clientY + scrollY)).padStart(5, '0')}`;
  });
  (function follow() {
    x += (pointer.x - x) * 0.2; y += (pointer.y - y) * 0.2;
    node.style.transform = `translate(${x}px, ${y}px)`;
    requestAnimationFrame(follow);
  })();
})();

// ---- scroll engine: one loop feeds the 3D camera and every scroll-linked element ----
const scene = createScene($('#terrain'), calm);
if (!scene) document.documentElement.classList.add('no-gl');

const tracked = new Set();
const nearViewport = new IntersectionObserver((entries) => {
  for (const entry of entries) entry.isIntersecting ? tracked.add(entry.target) : tracked.delete(entry.target);
}, { rootMargin: '15% 0px' });
function trackScrollLinked() {
  for (const node of document.querySelectorAll('[data-p]:not([data-tracked])')) {
    node.dataset.tracked = '';
    nearViewport.observe(node);
  }
}

(function scrollLoop() {
  const hero = $('.hero'), veil = $('.veil'), progress = $('#progress'), rail = $('#rail'), alt = $('#alt'), ticker = $('#ticker');
  let lastY = scrollY, velocity = 0, tickerX = 0, shownAlt = '';
  const setVar = (node, name, value) => {
    const text = value.toFixed(4);
    if (node.style.getPropertyValue(name) !== text) node.style.setProperty(name, text);
  };
  (function frame() {
    const vh = innerHeight, y = scrollY;
    const page = Math.min(1, y / Math.max(1, document.documentElement.scrollHeight - vh));
    const heroOut = Math.min(1, y / vh);
    velocity += (y - lastY - velocity) * 0.18;
    lastY = y;

    setVar(hero, '--hero', heroOut);
    setVar(veil, '--hero', heroOut);
    setVar(progress, '--s', page);
    setVar(rail, '--s', page);
    const altText = `ALT ${String(Math.round(56 + page * 780)).padStart(4, '0')} M`;
    if (altText !== shownAlt) alt.textContent = shownAlt = altText;

    for (const node of tracked) {
      const r = node.getBoundingClientRect();
      setVar(node, '--p', Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))));
    }

    const loopWidth = ticker.scrollWidth / 2;
    if (loopWidth > 0 && !calm) {
      tickerX = (tickerX + 0.7 + Math.abs(velocity) * 0.6) % loopWidth;
      const skew = Math.max(-14, Math.min(14, velocity * 0.35));
      ticker.style.transform = `translateX(${-tickerX}px) skewX(${-skew}deg)`;
    }

    scene?.set(page, calm ? 0 : velocity);
    requestAnimationFrame(frame);
  })();
})();

function tickClock() {
  $('#clock').textContent = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';
}
tickClock();
setInterval(tickClock, 1000);

async function load(first) {
  try {
    const res = await fetch('/api/site');
    if (!res.ok) throw new Error(res.status);
    const site = await res.json();
    first ? render(site) : updateNumbers(site);
  } catch {
    if (first) $('#title').textContent = 'โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง';
  }
}
load(true);
setInterval(() => { if (!document.hidden) load(false); }, 60_000);
