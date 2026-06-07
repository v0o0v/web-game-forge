/* 스프라이트 피커 로직 v2 — 의존성 없음(vanilla). 오프라인 단독 동작.
 *
 * 모드:
 *   - 어사인 모드: data.targets[] 가 있으면, 각 대상(슬롯)에 이미지를 배정(클릭/드래그).
 *   - 프리 모드:   targets 없으면, 이미지를 자유 다중 선택.
 *
 * 데이터: window.SPRITE_PICKER_DATA → ./data.json → 내장 DEMO 순.
 * 갤러리: pageSize 만큼 보여주고 "더 가져오기"로 더 로드(페이지네이션).
 * 완료(핸드오프): "선택 완료" → POST (data.submitUrl 또는 /__sprite_picker_submit) → serve.mjs 가 파일 저장.
 *   실패 시 폴백: 선택 코드 클립보드 복사 + 토큰 노출(붙여넣기). 막는 팝업 없이 비차단 토스트로 안내.
 */
(function () {
  'use strict';

  var DEMO = {
    title: '스프라이트 피커 (데모)',
    subtitle: 'data.js 가 없어 내장 데모를 표시합니다.',
    request: '',
    tiers: { 'cc0': 'CC0', 'permissive-attribution': '표기 필요', 'mixed-per-item': '항목별', 'avoid': '주의' },
    targets: [
      { id: 'player', name: '플레이어', description: '주인공 — 걷기/점프' },
      { id: 'enemy', name: '적', description: '기본 적' },
      { id: 'coin', name: '코인', description: '획득 아이템' },
      { id: 'tiles', name: '타일셋', description: '지형/플랫폼' }
    ],
    catalog: [
      { id: 'demo-hero', name: '러너', sourceName: 'PixelForge', license: 'CC0-1.0', safetyTier: 'cc0', style: 'pixel', contentTypes: ['character'], tags: ['player'] },
      { id: 'demo-knight', name: '나이트', sourceName: 'Kenney', license: 'CC0-1.0', safetyTier: 'cc0', style: 'pixel', contentTypes: ['character'], tags: ['player'] },
      { id: 'demo-slime', name: '슬라임', sourceName: 'PixelForge', license: 'CC0-1.0', safetyTier: 'cc0', style: 'pixel', contentTypes: ['enemy'], tags: ['enemy'] },
      { id: 'demo-coin', name: '코인', sourceName: 'PixelForge', license: 'CC0-1.0', safetyTier: 'cc0', style: 'pixel', contentTypes: ['item'], tags: ['coin'] },
      { id: 'demo-tiles', name: '타일셋', sourceName: 'Kenney', license: 'CC0-1.0', safetyTier: 'cc0', style: 'pixel', contentTypes: ['tileset'], tags: ['ground'] }
    ],
    library: [], candidate: []
  };

  function boot(data) {
    var items = normalize(data);
    var byId = {}; items.forEach(function (it) { byId[it.id] = it; });
    var pageSize = data.pageSize || 24;
    var state = {
      group: (['catalog', 'candidate', 'library'].filter(function (g) { return items.some(function (it) { return it.group === g; }); })[0] || 'catalog'),
      search: '', facets: { style: new Set(), contentType: new Set(), safetyTier: new Set() },
      selected: new Map(),
      targets: (data.targets || []).map(function (t) { return { id: String(t.id), name: t.name || t.id, description: t.description || '', hint: t.hint || '', assigned: null }; }),
      activeTarget: null,
      pageSize: pageSize, shownLimit: pageSize,
      _data: data, _byId: byId, _items: items
    };
    restore(state);
    if (state.targets.length) state.activeTarget = (firstEmpty(state) || state.targets[0]).id;
    render(data, items, state);
  }

  function assignMode(state) { return state.targets.length > 0; }
  function firstEmpty(state) { for (var i = 0; i < state.targets.length; i++) if (!state.targets[i].assigned) return state.targets[i]; return null; }
  function targetById(state, id) { for (var i = 0; i < state.targets.length; i++) if (state.targets[i].id === id) return state.targets[i]; return null; }

  function normalize(data) {
    var out = [];
    ['catalog', 'library', 'candidate'].forEach(function (group) {
      (data[group] || []).forEach(function (raw) {
        out.push({
          id: String(raw.id || raw.name), name: raw.name || raw.id || '(이름 없음)', group: group,
          sourceName: raw.sourceName || raw.source || '', license: raw.license || '?',
          safetyTier: raw.safetyTier || 'mixed-per-item', style: raw.style || 'pixel',
          contentTypes: raw.contentTypes || [], tags: raw.tags || [],
          thumbnail: raw.thumbnail || null, animated: !!raw.animated,
          previewUrl: raw.previewUrl || '', url: raw.url || raw.packUrl || '',
          downloadUrl: raw.downloadUrl || '', notes: raw.notes || ''
        });
      });
    });
    return out;
  }

  var els = {};
  function render(data, items, state) {
    els.title = document.getElementById('title');
    els.subtitle = document.getElementById('subtitle');
    els.gallery = document.getElementById('gallery');
    els.search = document.getElementById('search');
    els.selList = document.getElementById('selList');
    els.note = document.getElementById('note');
    els.token = document.getElementById('token');
    els.trayLabel = document.getElementById('trayLabel');
    els.assignBoard = document.getElementById('assignBoard');
    els.slots = document.getElementById('slots');
    els.assignProgress = document.getElementById('assignProgress');
    els.shownCount = document.getElementById('shownCount');

    if (data.title) els.title.textContent = data.title;
    if (data.subtitle) els.subtitle.textContent = data.subtitle;
    if (assignMode(state)) document.body.classList.add('assign-mode');

    buildFacets(items, state);
    bindTabs(items, state);
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-group') === state.group); });
    bindFilters(items, state);
    bindTray(data, items, state);

    if (assignMode(state)) { els.assignBoard.hidden = false; renderSlots(state); }
    drawGallery(items, state);
    updateTray(data, state);
    updateTabCounts(items);
  }

  function updateTabCounts(items) {
    ['catalog', 'library', 'candidate'].forEach(function (g) {
      var n = items.filter(function (it) { return it.group === g; }).length;
      var el = document.querySelector('.count[data-count="' + g + '"]'); if (el) el.textContent = n;
    });
  }

  function renderSlots(state) {
    var c = els.slots; c.innerHTML = '';
    state.targets.forEach(function (t) {
      var slot = document.createElement('div');
      slot.className = 'slot' + (t.assigned ? ' filled' : '') + (state.activeTarget === t.id ? ' active' : '');
      slot.setAttribute('data-target', t.id);
      var thumb = document.createElement('div'); thumb.className = 'slot-thumb';
      if (t.assigned && state._byId[t.assigned]) thumb.appendChild(thumbEl(state._byId[t.assigned])); else thumb.textContent = '비어 있음';
      slot.appendChild(thumb);
      var nm = document.createElement('div'); nm.className = 'slot-name'; nm.textContent = t.name; nm.title = t.name; slot.appendChild(nm);
      if (t.description) { var ds = document.createElement('div'); ds.className = 'slot-desc'; ds.textContent = t.description; ds.title = t.description; slot.appendChild(ds); }
      var clr = document.createElement('button'); clr.className = 'slot-clear'; clr.textContent = '✕'; clr.title = '배정 해제';
      clr.addEventListener('click', function (e) { e.stopPropagation(); t.assigned = null; state.activeTarget = t.id; renderSlots(state); drawGallery(state._items, state); saveAndUpdate(state); });
      slot.appendChild(clr);
      slot.addEventListener('click', function () { state.activeTarget = t.id; renderSlots(state); });
      slot.addEventListener('dragover', function (e) { e.preventDefault(); slot.classList.add('dragover'); });
      slot.addEventListener('dragleave', function () { slot.classList.remove('dragover'); });
      slot.addEventListener('drop', function (e) {
        e.preventDefault(); slot.classList.remove('dragover');
        var id = e.dataTransfer.getData('text/plain');
        if (id && state._byId[id]) { t.assigned = id; advanceActive(state, t); renderSlots(state); drawGallery(state._items, state); saveAndUpdate(state); }
      });
      c.appendChild(slot);
    });
    var filled = state.targets.filter(function (t) { return t.assigned; }).length;
    els.assignProgress.textContent = filled + '/' + state.targets.length;
  }
  function advanceActive(state, justFilled) { var nxt = firstEmpty(state); state.activeTarget = nxt ? nxt.id : justFilled.id; }
  function assignToActive(state, item) {
    var t = targetById(state, state.activeTarget) || firstEmpty(state) || state.targets[0]; if (!t) return;
    t.assigned = item.id; advanceActive(state, t); renderSlots(state); drawGallery(state._items, state); saveAndUpdate(state);
  }

  function buildFacets(items, state) {
    facetChips('styleChips', 'style', uniq(items.map(function (i) { return i.style; })), state, items);
    facetChips('typeChips', 'contentType', uniq(items.flatMap(function (i) { return i.contentTypes; })), state, items);
    facetChips('tierChips', 'safetyTier', uniq(items.map(function (i) { return i.safetyTier; })), state, items);
  }
  function facetChips(containerId, facet, values, state, items) {
    var c = document.getElementById(containerId); if (!c) return; c.innerHTML = '';
    values.filter(Boolean).forEach(function (v) {
      var b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.textContent = facetLabel(facet, v);
      b.addEventListener('click', function () {
        var set = state.facets[facet]; if (set.has(v)) set.delete(v); else set.add(v);
        b.classList.toggle('on'); state.shownLimit = state.pageSize; drawGallery(items, state);
      });
      c.appendChild(b);
    });
  }
  function facetLabel(facet, v) {
    if (facet === 'safetyTier') return ({ 'cc0': 'CC0', 'permissive-attribution': '표기필요', 'mixed-per-item': '항목별', 'avoid': '주의' })[v] || v;
    if (facet === 'style') return ({ 'pixel': '픽셀', 'vector': '벡터', 'flat': '플랫', 'hd': 'HD', 'hand-drawn': '손그림' })[v] || v;
    return ({ 'character': '캐릭터', 'enemy': '적', 'tileset': '타일', 'spritesheet': '시트', 'ui': 'UI', 'icon': '아이콘', 'background': '배경', 'effect': '이펙트', 'item': '아이템' })[v] || v;
  }

  function bindTabs(items, state) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active'); state.group = t.getAttribute('data-group'); state.shownLimit = state.pageSize; drawGallery(items, state);
      });
    });
  }
  function bindFilters(items, state) {
    els.search.addEventListener('input', function () { state.search = els.search.value.trim().toLowerCase(); state.shownLimit = state.pageSize; drawGallery(items, state); });
  }

  function matches(it, state) {
    if (it.group !== state.group) return false;
    var f = state.facets;
    if (f.style.size && !f.style.has(it.style)) return false;
    if (f.safetyTier.size && !f.safetyTier.has(it.safetyTier)) return false;
    if (f.contentType.size && !it.contentTypes.some(function (c) { return f.contentType.has(c); })) return false;
    if (state.search) {
      var hay = (it.name + ' ' + it.sourceName + ' ' + it.tags.join(' ') + ' ' + it.contentTypes.join(' ')).toLowerCase();
      if (hay.indexOf(state.search) === -1) return false;
    }
    return true;
  }

  function drawGallery(items, state) {
    var g = els.gallery; g.innerHTML = '';
    var shown = items.filter(function (it) { return matches(it, state); });
    var groupTotal = items.filter(function (it) { return it.group === state.group; }).length;
    var visible = Math.min(shown.length, state.shownLimit);
    if (els.shownCount) els.shownCount.textContent = visible + ' / ' + shown.length + '개 표시' + (shown.length !== groupTotal ? ' (그룹 ' + groupTotal + ')' : '');
    if (!shown.length) {
      var e = document.createElement('div'); e.className = 'empty';
      e.textContent = state.group === 'library' ? '이전에 사용한 스프라이트가 아직 없습니다.' : '조건에 맞는 항목이 없습니다. 필터를 줄여보세요.';
      g.appendChild(e); return;
    }
    var assignedSet = {}; state.targets.forEach(function (t) { if (t.assigned) assignedSet[t.assigned] = true; });
    shown.slice(0, state.shownLimit).forEach(function (it) { g.appendChild(card(it, items, state, assignedSet)); });
    if (shown.length > state.shownLimit) {
      var remain = shown.length - state.shownLimit;
      var more = document.createElement('button');
      more.className = 'load-more'; more.type = 'button';
      more.textContent = '더 가져오기  (+' + Math.min(state.pageSize, remain) + ' · 남은 ' + remain + ')';
      more.addEventListener('click', function () { state.shownLimit += state.pageSize; drawGallery(items, state); });
      g.appendChild(more);
    }
  }

  function thumbEl(it) {
    if (it.thumbnail && it.animated) {
      var obj = document.createElement('object'); obj.className = 'thumb anim'; obj.type = 'image/svg+xml'; obj.data = it.thumbnail; obj.setAttribute('aria-label', it.name); return obj;
    }
    if (it.thumbnail) {
      var img = document.createElement('img'); img.className = 'thumb'; img.alt = it.name; img.loading = 'lazy'; img.src = it.thumbnail;
      img.onerror = function () { var cv = placeholder(it); img.replaceWith(cv); }; return img;
    }
    return placeholder(it);
  }

  function card(it, items, state, assignedSet) {
    var el = document.createElement('article');
    el.className = 'card' + (it.style !== 'pixel' ? ' smooth' : '');
    if (assignMode(state)) el.classList.add('assignable-hint');
    if (!assignMode(state) && state.selected.has(it.id)) el.classList.add('selected');
    if (assignMode(state) && assignedSet[it.id]) el.classList.add('selected');
    el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', it.id); e.dataTransfer.effectAllowed = 'copy'; });
    el.appendChild(thumbEl(it));
    var check = document.createElement('div'); check.className = 'check'; check.textContent = '✓'; el.appendChild(check);
    var liveUrl = it.previewUrl || it.url;
    if (liveUrl) {
      var live = document.createElement('a'); live.className = 'live'; live.href = liveUrl; live.target = '_blank'; live.rel = 'noopener'; live.textContent = '원본 ↗';
      live.addEventListener('click', function (e) { e.stopPropagation(); }); el.appendChild(live);
    }
    var meta = document.createElement('div'); meta.className = 'meta';
    var name = document.createElement('div'); name.className = 'name'; name.textContent = it.name; name.title = it.name;
    var sub = document.createElement('div'); sub.className = 'sub';
    var badge = document.createElement('span'); badge.className = 'badge ' + it.safetyTier; badge.textContent = it.license; sub.appendChild(badge);
    if (it.sourceName) { var src = document.createElement('span'); src.className = 'src'; src.textContent = it.sourceName; sub.appendChild(src); }
    meta.appendChild(name); meta.appendChild(sub); el.appendChild(meta);
    function act() {
      if (assignMode(state)) assignToActive(state, it);
      else { if (state.selected.has(it.id)) state.selected.delete(it.id); else state.selected.set(it.id, it); el.classList.toggle('selected'); saveAndUpdate(state); }
    }
    el.addEventListener('click', act);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
    return el;
  }

  function placeholder(it) {
    var cv = document.createElement('canvas'); cv.className = 'thumb'; cv.width = 168; cv.height = 168;
    var x = cv.getContext('2d'); var h = hash(it.id); var hue = h % 360;
    var g = x.createLinearGradient(0, 0, 168, 168); g.addColorStop(0, 'hsl(' + hue + ',55%,32%)'); g.addColorStop(1, 'hsl(' + ((hue + 40) % 360) + ',55%,20%)');
    x.fillStyle = g; x.fillRect(0, 0, 168, 168);
    var fg = 'hsl(' + hue + ',80%,72%)';
    if (it.style === 'pixel') {
      x.fillStyle = fg; var n = 6, s = 168 / (n + 2);
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) { if (((h >> ((i * n + j) % 24)) & 1) === 0) continue; x.globalAlpha = 0.18 + ((i + j) % 3) * 0.12; x.fillRect((i + 1) * s, (j + 1) * s, s - 2, s - 2); }
      x.globalAlpha = 1;
    } else {
      var rg = x.createRadialGradient(84, 74, 6, 84, 84, 70); rg.addColorStop(0, fg); rg.addColorStop(1, 'hsla(' + hue + ',80%,60%,0)');
      x.fillStyle = rg; x.beginPath(); x.arc(84, 84, 64, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '700 30px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(initials(it.name), 84, 132);
    return cv;
  }
  function initials(s) { var m = String(s).replace(/[^0-9A-Za-z가-힣 ]/g, '').trim().split(/\s+/); if (!m[0]) return '?'; return (m[0][0] + (m[1] ? m[1][0] : (m[0][1] || ''))).toUpperCase(); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }

  function bindTray(data, items, state) {
    state._data = data;
    document.getElementById('clearBtn').addEventListener('click', function () {
      if (assignMode(state)) { state.targets.forEach(function (t) { t.assigned = null; }); state.activeTarget = state.targets[0] && state.targets[0].id; renderSlots(state); drawGallery(items, state); }
      else { state.selected.clear(); document.querySelectorAll('.card.selected').forEach(function (c) { c.classList.remove('selected'); }); }
      saveAndUpdate(state);
    });
    document.getElementById('completeBtn').addEventListener('click', function () { complete(state); });
    var cb = document.getElementById('copyBtn'); if (cb) cb.addEventListener('click', function () { copyToken(); });
    els.note.addEventListener('input', function () { saveAndUpdate(state); });
  }

  function selectionObject(state) {
    var base = { version: 2, request: (state._data && state._data.request) || '', note: (els.note && els.note.value) || '' };
    if (assignMode(state)) {
      base.assignments = state.targets.filter(function (t) { return t.assigned; }).map(function (t) { return { targetId: t.id, targetName: t.name, image: slim(state._byId[t.assigned]) }; });
      base.unassignedTargets = state.targets.filter(function (t) { return !t.assigned; }).map(function (t) { return { targetId: t.id, targetName: t.name }; });
    } else { base.selected = Array.from(state.selected.values()).map(slim); }
    return base;
  }
  function slim(it) { if (!it) return null; return { id: it.id, name: it.name, group: it.group, license: it.license, safetyTier: it.safetyTier, sourceName: it.sourceName, url: it.url, downloadUrl: it.downloadUrl, style: it.style, contentTypes: it.contentTypes }; }

  function saveAndUpdate(state) { try { localStorage.setItem('spritePickerSelection', JSON.stringify(selectionObject(state))); } catch (e) {} updateTray(state._data, state); }

  function updateTray(data, state) {
    var obj = selectionObject(state); els.token.value = JSON.stringify(obj, null, 2);
    if (assignMode(state)) {
      var filled = (obj.assignments || []).length;
      els.trayLabel.textContent = '배정됨 ' + filled + '/' + state.targets.length;
      els.selList.innerHTML = '';
      (obj.assignments || []).forEach(function (a) { var p = document.createElement('span'); p.className = 'pill'; p.textContent = a.targetName + ' ← ' + (a.image ? a.image.name : '?'); els.selList.appendChild(p); });
    } else {
      els.trayLabel.textContent = '선택됨 ' + (obj.selected || []).length + '개';
      els.selList.innerHTML = '';
      (obj.selected || []).forEach(function (s) {
        var p = document.createElement('span'); p.className = 'pill'; p.textContent = s.name + ' ';
        var b = document.createElement('button'); b.type = 'button'; b.textContent = '✕';
        b.addEventListener('click', function () { state.selected.delete(s.id); var card = Array.from(document.querySelectorAll('.card')).find(function (c) { var nm = c.querySelector('.name'); return nm && nm.textContent === s.name; }); if (card) card.classList.remove('selected'); saveAndUpdate(state); });
        p.appendChild(b); els.selList.appendChild(p);
      });
    }
  }

  function restore(state) {
    try {
      var raw = localStorage.getItem('spritePickerSelection'); if (!raw) return; var obj = JSON.parse(raw);
      if (obj.note && document.getElementById('note')) document.getElementById('note').value = obj.note;
      if (assignMode(state) && obj.assignments) obj.assignments.forEach(function (a) { var t = targetById(state, a.targetId); if (t && a.image && state._byId[a.image.id]) t.assigned = a.image.id; });
      else if (obj.selected) obj.selected.forEach(function (s) { if (state._byId[s.id]) state.selected.set(s.id, state._byId[s.id]); });
    } catch (e) {}
  }

  // 선택 완료 — POST 자동 핸드오프 → 실패 시 비차단 폴백(복사). 막는 팝업 없음.
  function complete(state) {
    var obj = selectionObject(state);
    var nEmpty = assignMode(state) ? (obj.unassignedTargets || []).length : 0;
    var nSel = assignMode(state) ? (obj.assignments || []).length : (obj.selected || []).length;
    if (nSel === 0) { toast('아직 아무것도 고르지 않았어요', 2000, 'warn'); return; }
    if (nEmpty > 0 && !confirm('아직 비어 있는 대상이 ' + nEmpty + '개 있어요. 그래도 전송할까요?')) return;
    try { localStorage.setItem('spritePickerSelection', JSON.stringify(obj)); } catch (e) {}
    var url = (state._data && state._data.submitUrl) || '/__sprite_picker_submit';
    var body = JSON.stringify(obj), done = false;
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    if (ctl) setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 3000);
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, signal: ctl && ctl.signal })
      .then(function (r) { if (!r.ok) throw new Error('bad'); return r.text(); })
      .then(function () { done = true; toast('✅ 선택 전송 완료 — 채팅으로 돌아가세요', 4200, 'ok'); })
      .catch(function () { if (!done) fallbackCopy(obj); });
  }

  function fallbackCopy(obj) {
    var text = JSON.stringify(obj, null, 2); els.token.value = text;
    var tw = document.getElementById('tokenWrap'); if (tw) tw.open = true;
    copyText(text);
    toast('📋 자동 전송이 안 돼요 — 선택 코드를 복사했어요. 아래 코드를 채팅에 붙여넣어 주세요', 7000, 'warn');
    if (tw) tw.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function copyToken() { copyText(els.token.value); toast('선택 코드 복사됨', 1500, 'ok'); }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).catch(manual); }
    else manual();
    function manual() { try { els.token.removeAttribute('readonly'); els.token.select(); document.execCommand('copy'); els.token.setAttribute('readonly', ''); } catch (e) {} }
  }

  function toast(msg, ms, kind) {
    var t = document.createElement('div'); t.className = 'toast' + (kind ? ' ' + kind : ''); t.textContent = msg; document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 280); }, ms || 1500);
  }

  window.__spritePickerSelection = function () { try { return localStorage.getItem('spritePickerSelection') || '{"version":2}'; } catch (e) { return '{"version":2}'; } };
  function uniq(a) { return Array.from(new Set(a)); }

  if (window.SPRITE_PICKER_DATA) boot(window.SPRITE_PICKER_DATA);
  else fetch('data.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(boot).catch(function () { boot(DEMO); });
})();
