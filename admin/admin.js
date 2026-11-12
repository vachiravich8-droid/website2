const APPS = {
  roblox: 'Roblox', discord: 'Discord', youtube: 'YouTube', tiktok: 'TikTok', facebook: 'Facebook',
  instagram: 'Instagram', x: 'X', line: 'LINE', email: 'อีเมล', other: 'อื่นๆ',
};
const $ = (sel) => document.querySelector(sel);
let content = null;
let tab = 'games';
let dirty = false;

function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...kids.filter(Boolean));
  return node;
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method, headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/admin/login') { showGate(true); throw new Error('กรุณาเข้าสู่ระบบอีกครั้ง'); }
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

function toast(message, bad = false) {
  const node = $('#toast');
  node.textContent = message;
  node.className = `show${bad ? ' bad' : ''}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.className = ''; }, 2600);
}

function setDirty(value) {
  dirty = value;
  const save = $('#save');
  save.disabled = !value;
  save.textContent = value ? 'บันทึกการแก้ไข' : 'บันทึกแล้ว';
  save.classList.toggle('dirty', value);
}

const newId = () => crypto.randomUUID().slice(0, 8);
const today = () => new Date().toLocaleDateString('sv-SE');

// ---- form building blocks ----
function field(label, obj, key, opts = {}) {
  const tag = opts.rows ? 'textarea' : 'input';
  const input = el(tag, {
    type: opts.rows ? null : (opts.type || 'text'), rows: opts.rows, maxlength: opts.max, placeholder: opts.placeholder,
    oninput: () => { obj[key] = input.value; setDirty(true); },
  });
  input.value = obj[key] ?? '';
  return el('label', {}, label, input);
}

function listControls(list, index, noun) {
  const move = (delta) => () => {
    const [item] = list.splice(index, 1);
    list.splice(index + delta, 0, item);
    setDirty(true); render();
  };
  return [
    el('button', { type: 'button', class: 'ghost small', disabled: index === 0, 'aria-label': `เลื่อน${noun}ขึ้น`, onclick: move(-1), text: '↑' }),
    el('button', { type: 'button', class: 'ghost small', disabled: index === list.length - 1, 'aria-label': `เลื่อน${noun}ลง`, onclick: move(1), text: '↓' }),
    el('button', {
      type: 'button', class: 'ghost small danger', text: 'ลบ',
      onclick: () => { if (confirm(`ลบ${noun}นี้?`)) { list.splice(index, 1); setDirty(true); render(); } },
    }),
  ];
}

// ---- tabs ----
function gameCard(game, index) {
  const note = el('p', { class: 'fetch-note', role: 'status' });
  const linkInput = el('input', { type: 'url', placeholder: 'https://www.roblox.com/games/…' });
  linkInput.value = game.url || '';
  const fetchBtn = el('button', {
    type: 'button', class: 'ghost', text: 'ดึงข้อมูลจาก Roblox',
    onclick: async () => {
      fetchBtn.disabled = true; note.className = 'fetch-note'; note.textContent = 'กำลังดึงข้อมูล…';
      try {
        const found = await api('POST', '/api/admin/resolve', { url: linkInput.value });
        Object.assign(game, {
          url: found.url, placeId: found.placeId, universeId: found.universeId,
          title: game.title && game.title !== 'แมพใหม่' ? game.title : found.title,
          blurb: game.blurb || found.blurb, status: 'live',
        });
        game._thumb = found.thumb;
        setDirty(true); render();
        toast('ดึงข้อมูลแล้ว อย่าลืมกดบันทึก');
      } catch (err) {
        note.className = 'fetch-note bad'; note.textContent = err.message; fetchBtn.disabled = false;
      }
    },
  });
  if (game.universeId) { note.className = 'fetch-note ok'; note.textContent = 'เชื่อมกับ Roblox แล้ว หน้าเว็บจะแสดงรูปปกและยอดคนเล่นสด'; }

  const tags = el('input', { placeholder: 'เช่น FPS, 5v5, แมพเล็ก', oninput: () => {
    game.tags = tags.value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 6); setDirty(true);
  } });
  tags.value = game.tags.join(', ');
  const status = el('select', { onchange: () => { game.status = status.value; setDirty(true); } },
    el('option', { value: 'live', text: 'เปิดให้เล่นแล้ว' }), el('option', { value: 'wip', text: 'กำลังสร้าง' }));
  status.value = game.status;
  const pinned = el('input', { type: 'checkbox', onchange: () => { game.pinned = pinned.checked; setDirty(true); } });
  pinned.checked = game.pinned;

  return el('section', { class: 'card' },
    el('div', { class: 'card-head' }, el('strong', { text: `แมพ ${String(index + 1).padStart(2, '0')}` }), ...listControls(content.games, index, 'แมพ')),
    el('div', { class: 'fetch' }, el('label', {}, 'ลิงก์เกมบน Roblox', linkInput), fetchBtn),
    note,
    game._thumb ? el('img', { class: 'thumb', src: game._thumb, alt: 'รูปปกจาก Roblox' }) : null,
    field('ชื่อแมพ', game, 'title', { max: 80 }),
    field('คำอธิบาย', game, 'blurb', { rows: 3, max: 400 }),
    el('div', { class: 'row' }, el('label', {}, 'แท็ก (คั่นด้วยจุลภาค)', tags), el('label', {}, 'สถานะ', status)),
    el('label', { class: 'check' }, pinned, 'ติดป้าย "แนะนำ"'));
}

const views = {
  games: () => [
    el('p', { class: 'hint', text: 'วางลิงก์เกมจาก Roblox แล้วกด "ดึงข้อมูล" ระบบจะเติมชื่อ คำอธิบาย และรูปปกให้เอง' }),
    ...content.games.map(gameCard),
    el('button', { type: 'button', text: '+ เพิ่มแมพ', onclick: () => {
      content.games.push({ id: newId(), title: 'แมพใหม่', blurb: '', url: '', placeId: null, universeId: null, tags: [], pinned: false, status: 'wip', addedAt: today() });
      setDirty(true); render();
    } }),
  ],
  links: () => [
    el('p', { class: 'hint', text: 'ใส่ลิงก์เต็มของแต่ละแอป อีเมลให้พิมพ์แบบ mailto:you@example.com' }),
    ...content.links.map((link, i) => {
      const app = el('select', { onchange: () => { link.app = app.value; setDirty(true); } },
        ...Object.entries(APPS).map(([value, text]) => el('option', { value, text })));
      app.value = link.app;
      return el('section', { class: 'card' },
        el('div', { class: 'card-head' }, el('strong', { text: `ช่องทาง ${String(i + 1).padStart(2, '0')}` }), ...listControls(content.links, i, 'ช่องทาง')),
        el('div', { class: 'row' }, el('label', {}, 'แอป', app), field('ชื่อบัญชีที่จะแสดง', link, 'label', { max: 60, placeholder: '@ชื่อของคุณ' })),
        field('ลิงก์', link, 'url', { max: 300, placeholder: 'https://…' }));
    }),
    el('button', { type: 'button', text: '+ เพิ่มช่องทาง', onclick: () => {
      content.links.push({ id: newId(), app: 'discord', label: '', url: '' }); setDirty(true); render();
    } }),
  ],
  updates: () => [
    el('button', { type: 'button', text: '+ เขียนอัปเดตใหม่', onclick: () => {
      content.updates.unshift({ id: newId(), date: today(), title: '', body: '' }); setDirty(true); render();
    } }),
    ...content.updates.map((u, i) => el('section', { class: 'card' },
      el('div', { class: 'card-head' }, el('strong', { text: u.date || 'อัปเดต' }), ...listControls(content.updates, i, 'อัปเดต')),
      el('div', { class: 'row' }, field('วันที่', u, 'date', { type: 'date' }), field('หัวข้อ', u, 'title', { max: 100 })),
      field('รายละเอียด', u, 'body', { rows: 3, max: 1000 }))),
  ],
  profile: () => [
    el('section', { class: 'card' },
      field('ชื่อที่แสดงตัวใหญ่บนหน้าแรก', content.profile, 'name', { max: 60 }),
      field('คำโปรยใต้ชื่อ', content.profile, 'tagline', { max: 140 }),
      field('แนะนำตัวสั้นๆ (แสดงเหนือรายการแมพ)', content.profile, 'about', { rows: 4, max: 600 })),
  ],
};

function render() {
  for (const btn of document.querySelectorAll('#tabs button')) btn.setAttribute('aria-selected', String(btn.dataset.tab === tab));
  $('#view').replaceChildren(...views[tab]());
}

// ---- login gate ----
let configured = true;
function showGate(isConfigured) {
  configured = isConfigured;
  $('#panel').hidden = true;
  $('#gate').hidden = false;
  $('#gate-title').textContent = configured ? 'เข้าสู่หลังบ้าน' : 'ตั้งรหัสผ่านหลังบ้าน';
  $('#gate-help').textContent = configured
    ? 'ใส่รหัสผ่านที่ตั้งไว้'
    : 'ตั้งครั้งแรกครั้งเดียว ยาวอย่างน้อย 10 ตัวอักษร และอย่าใช้รหัสเดียวกับบัญชี Roblox';
  $('#gate-submit').textContent = configured ? 'เข้าสู่ระบบ' : 'ตั้งรหัสผ่านและเข้าใช้งาน';
  $('#gate-password').autocomplete = configured ? 'current-password' : 'new-password';
  $('#gate-password').minLength = configured ? 1 : 10;
  $('#gate-password').focus();
}

async function openPanel() {
  content = await api('GET', '/api/admin/content');
  $('#gate').hidden = true;
  $('#panel').hidden = false;
  setDirty(false);
  render();
}

$('#gate').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#gate-error').textContent = '';
  try {
    await api('POST', configured ? '/api/admin/login' : '/api/admin/setup', { password: $('#gate-password').value });
    $('#gate-password').value = '';
    await openPanel();
  } catch (err) { $('#gate-error').textContent = err.message; }
});

$('#tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (btn) { tab = btn.dataset.tab; render(); }
});

$('#save').addEventListener('click', async () => {
  try {
    const thumbs = new Map(content.games.map((g) => [g.id, g._thumb]));
    content = await api('PUT', '/api/admin/content', content);
    for (const g of content.games) g._thumb = thumbs.get(g.id);
    setDirty(false); render();
    toast('บันทึกแล้ว หน้าเว็บอัปเดตทันที');
  } catch (err) { toast(err.message, true); }
});

$('#logout').addEventListener('click', async () => {
  if (dirty && !confirm('ยังไม่ได้บันทึกการแก้ไข ออกจากระบบเลยไหม?')) return;
  await api('POST', '/api/admin/logout', {});
  setDirty(false);
  showGate(true);
});

addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });

(async () => {
  const state = await api('GET', '/api/admin/state');
  state.authed ? openPanel() : showGate(state.configured);
})();
