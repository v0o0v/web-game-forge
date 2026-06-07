/* 스프라이트 피커 로직 — 의존성 없음(vanilla). 오프라인 단독 동작.
 *
 * 데이터 우선순위:
 *   1) window.SPRITE_PICKER_DATA  (Claude가 data.js 로 주입 — 정상 경로)
 *   2) ./data.json               (있으면 fetch)
 *   3) 내장 DEMO                  (둘 다 없을 때)
 *
 * 선택 결과: localStorage['spritePickerSelection'] 에 JSON 저장 + 화면 토큰 노출.
 *   Claude 는 preview MCP 로 window.__spritePickerSelection() 를 eval 하거나,
 *   사용자가 토큰을 복사-붙여넣기 한다(폴백).
 */
(function () {
  'use strict';

  var DEMO = {
    title: '스프라이트 피커 (데모)',
    subtitle: 'data.js 가 없어 내장 데모를 표시합니다. 실제로는 Claude 가 후보를 주입합니다.',
    request: '',
    tiers: {
      'cc0': 'CC0/퍼블릭도메인 — 표기 불필요, 자유 사용',
      'permissive-attribution': '표기 필요(CC-BY 등) — CREDITS 등록 시 허용',
      'mixed-per-item': '항목별 라이선스 — 개별 확인 필수',
      'avoid': '사용 금지(불명/제한)'
    },
    catalog: [
      { id: 'demo-hero', name: '러너 캐릭터', sourceName: 'PixelForge(절차)', license: 'CC0-1.0', safetyTier: 'cc0', style: 'pixel', contentTypes: ['character'], tags: ['player', 'run', 'jump'] },
      { id: 'demo-slime', name: '슬라임 적', sourceName: 'PixelForge(절차)', license: 'CC0-1.0', safetyTier: 'cc0', style: 'pixel', contentTypes: ['character', 'enemy'], tags: ['enemy'] },
      { id: 'demo-coin', name: '코인', sourceName: 'PixelForge(절차)', license: 'CC0-1.0', safetyTier: 'cc0', style: 'pixel', contentTypes: ['item'], tags: ['coin', 'pickup'] },
      { id: 'demo-tiles', name: '플랫폼 타일셋', sourceName: 'Kenney(예시)', license: 'CC0-1.0', safetyTier: 'cc0', style: 'pixel', contentTypes: ['tileset'], tags: ['ground', 'tiles'] },
      { id: 'demo-orb', name: '네온 오브', sourceName: 'VectorForge(절차)', license: 'CC0-1.0', safetyTier: 'cc0', style: 'vector', contentTypes: ['item', 'effect'], tags: ['glow'] },
      { id: 'demo-ui', name: 'HUD 버튼셋', sourceName: 'Kenney UI(예시)', license: 'CC0-1.0', safetyTier: 'cc0', style: 'vector', contentTypes: ['ui'], tags: ['button', 'hud'] }
    ],
    library: [],
    candidate: []
  };

  // ---- 데이터 로드 ----
  function boot(data) {
    var state = {
      group: 'catalog',
      search: '',
      facets: { style: new Set(), contentType: new Set(), safetyTier: new Set() },
      selected: new Map() // id -> normalized item
    };
    var items = normalize(data);
    restoreSelection(state, items);
    render(data, items, state);
  }

  // ---- 정규화 ----
  function normalize(data) {
    var out = [];
    ['catalog', 'library', 'candidate'].forEach(function (group) {
      (data[group] || []).forEach(function (raw) {
        out.push({
          id: String(raw.id || raw.name),
          name: raw.name || raw.id || '(이름 없음)',
          group: group,
          sourceName: raw.sourceName || raw.source || '',
          license: raw.license || '?',
          safetyTier: raw.safetyTier || 'mixed-per-item',
          style: (raw.style || 'pixel'),
          contentTypes: raw.contentTypes || [],
          tags: raw.tags || [],
          thumbnail: raw.thumbnail || null,
          previewUrl: raw.previewUrl || '',
          url: raw.url || raw.packUrl || '',
          downloadUrl: raw.downloadUrl || '',
          notes: raw.notes || ''
        });
      });
    });
    return out;
  }

  // ---- 렌더 ----
  var els = {};
  function render(data, items, state) {
    els.title = document.getElementById('title');
    els.subtitle = document.getElementById('subtitle');
    els.gallery = document.getElementById('gallery');
    els.search = document.getElementById('search');
    els.selCount = document.getElementById('selCount');
    els.selList = document.getElementById('selList');
    els.note = document.getElementById('note');
    els.token = document.getElementById('token');

    if (data.title) els.title.textContent = data.title;
    if (data.subtitle) els.subtitle.textContent = data.subtitle;
    if (data.request) { els.note.value = els.note.value || ''; }

    buildFacets(items, state);
    bindTabs(items, state);
    bindFilters(items, state);
    bindTray(data, items, state);

    drawGallery(items, state);
    updateTray(data, state);
    updateTabCounts(items);
  }

  function updateTabCounts(items) {
    ['catalog', 'library', 'candidate'].forEach(function (g) {
      var n = items.filter(function (it) { return it.group === g; }).length;
      var el = document.querySelector('.count[data-count="' + g + '"]');
      if (el) el.textContent = n;
    });
  }

  function buildFacets(items, state) {
    facetChips('styleChips', 'style', uniq(items.flatMap(function (i) { return [i.style]; })), state, items);
    facetChips('typeChips', 'contentType', uniq(items.flatMap(function (i) { return i.contentTypes; })), state, items);
    facetChips('tierChips', 'safetyTier', uniq(items.map(function (i) { return i.safetyTier; })), state, items);
  }
  function facetChips(containerId, facet, values, state, items) {
    var c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = '';
    values.filter(Boolean).forEach(function (v) {
      var b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = facetLabel(facet, v);
      b.addEventListener('click', function () {
        var set = state.facets[facet];
        if (set.has(v)) set.delete(v); else set.add(v);
        b.classList.toggle('on');
        drawGallery(items, state);
      });
      c.appendChild(b);
    });
  }
  function facetLabel(facet, v) {
    if (facet === 'safetyTier') {
      return { 'cc0': 'CC0', 'permissive-attribution': '표기필요', 'mixed-per-item': '항목별', 'avoid': '주의' }[v] || v;
    }
    if (facet === 'style') {
      return { 'pixel': '픽셀', 'vector': '벡터', 'flat': '플랫', 'hd': 'HD', 'hand-drawn': '손그림' }[v] || v;
    }
    return { 'character': '캐릭터', 'enemy': '적', 'tileset': '타일', 'spritesheet': '시트', 'ui': 'UI', 'icon': '아이콘', 'background': '배경', 'effect': '이펙트', 'item': '아이템' }[v] || v;
  }

  function bindTabs(items, state) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        state.group = t.getAttribute('data-group');
        drawGallery(items, state);
      });
    });
  }
  function bindFilters(items, state) {
    els.search.addEventListener('input', function () {
      state.search = els.search.value.trim().toLowerCase();
      drawGallery(items, state);
    });
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
    var g = els.gallery;
    g.innerHTML = '';
    var shown = items.filter(function (it) { return matches(it, state); });
    if (!shown.length) {
      var e = document.createElement('div');
      e.className = 'empty';
      e.textContent = state.group === 'library'
        ? '이전에 사용한 스프라이트가 아직 없습니다. 카탈로그/후보에서 골라 적용하면 여기에 쌓입니다.'
        : '조건에 맞는 항목이 없습니다. 필터를 줄여보세요.';
      g.appendChild(e);
      return;
    }
    shown.forEach(function (it) { g.appendChild(card(it, items, state)); });
  }

  function card(it, items, state) {
    var el = document.createElement('article');
    el.className = 'card' + (it.style !== 'pixel' ? ' smooth' : '') + (state.selected.has(it.id) ? ' selected' : '');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');

    var thumb;
    if (it.thumbnail) {
      thumb = document.createElement('img');
      thumb.className = 'thumb';
      thumb.alt = it.name;
      thumb.loading = 'lazy';
      thumb.src = it.thumbnail;
      thumb.onerror = function () {
        var cv = placeholder(it);
        thumb.replaceWith(cv);
      };
    } else {
      thumb = placeholder(it);
    }
    el.appendChild(thumb);

    var check = document.createElement('div');
    check.className = 'check';
    check.textContent = '✓';
    el.appendChild(check);

    var liveUrl = it.previewUrl || it.url;
    if (liveUrl) {
      var live = document.createElement('a');
      live.className = 'live';
      live.href = liveUrl;
      live.target = '_blank';
      live.rel = 'noopener';
      live.textContent = '원본 ↗';
      live.addEventListener('click', function (e) { e.stopPropagation(); });
      el.appendChild(live);
    }

    var meta = document.createElement('div');
    meta.className = 'meta';
    var name = document.createElement('div');
    name.className = 'name';
    name.textContent = it.name;
    name.title = it.name;
    var sub = document.createElement('div');
    sub.className = 'sub';
    var badge = document.createElement('span');
    badge.className = 'badge ' + it.safetyTier;
    badge.textContent = it.license;
    sub.appendChild(badge);
    if (it.sourceName) {
      var src = document.createElement('span');
      src.className = 'src';
      src.textContent = it.sourceName;
      sub.appendChild(src);
    }
    meta.appendChild(name);
    meta.appendChild(sub);
    el.appendChild(meta);

    function toggle() {
      if (state.selected.has(it.id)) state.selected.delete(it.id);
      else state.selected.set(it.id, it);
      el.classList.toggle('selected');
      saveAndUpdate(state);
    }
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    return el;
  }

  // 오프라인 플레이스홀더 썸네일 — id 해시 색 + 스타일별 모양 + 머리글자
  function placeholder(it) {
    var cv = document.createElement('canvas');
    cv.className = 'thumb';
    cv.width = 168; cv.height = 168;
    var x = cv.getContext('2d');
    var h = hash(it.id);
    var hue = h % 360;
    var g = x.createLinearGradient(0, 0, 168, 168);
    g.addColorStop(0, 'hsl(' + hue + ',55%,32%)');
    g.addColorStop(1, 'hsl(' + ((hue + 40) % 360) + ',55%,20%)');
    x.fillStyle = g; x.fillRect(0, 0, 168, 168);

    var fg = 'hsl(' + hue + ',80%,72%)';
    if (it.style === 'pixel') {
      // 블록 모자이크 (픽셀 느낌)
      x.fillStyle = fg;
      var n = 6, s = 168 / (n + 2);
      for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
          if (((h >> ((i * n + j) % 24)) & 1) === 0) continue;
          x.globalAlpha = 0.18 + ((i + j) % 3) * 0.12;
          x.fillRect((i + 1) * s, (j + 1) * s, s - 2, s - 2);
        }
      }
      x.globalAlpha = 1;
    } else {
      // 부드러운 원 (벡터 느낌)
      var rg = x.createRadialGradient(84, 74, 6, 84, 84, 70);
      rg.addColorStop(0, fg);
      rg.addColorStop(1, 'hsla(' + hue + ',80%,60%,0)');
      x.fillStyle = rg;
      x.beginPath(); x.arc(84, 84, 64, 0, Math.PI * 2); x.fill();
    }
    // 머리글자
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.font = '700 30px system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(initials(it.name), 84, 132);
    return cv;
  }
  function initials(s) {
    var m = s.replace(/[^0-9A-Za-z가-힣 ]/g, '').trim().split(/\s+/);
    if (!m[0]) return '?';
    return (m[0][0] + (m[1] ? m[1][0] : (m[0][1] || ''))).toUpperCase();
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
  }

  // ---- 선택 트레이 ----
  function bindTray(data, items, state) {
    document.getElementById('clearBtn').addEventListener('click', function () {
      state.selected.clear();
      document.querySelectorAll('.card.selected').forEach(function (c) { c.classList.remove('selected'); });
      saveAndUpdate(state);
    });
    document.getElementById('copyBtn').addEventListener('click', function () {
      var t = els.token.value;
      navigator.clipboard && navigator.clipboard.writeText(t).then(showToast, function () {
        els.token.removeAttribute('readonly'); els.token.select(); document.execCommand('copy'); els.token.setAttribute('readonly', '');
        showToast();
      });
    });
    els.note.addEventListener('input', function () { saveAndUpdate(state); });
    // 선택 변경 시 data.request 보존을 위해 클로저에 저장
    state._data = data;
  }

  function selectionObject(state) {
    return {
      version: 1,
      request: (state._data && state._data.request) || '',
      note: (els.note && els.note.value) || '',
      selected: Array.from(state.selected.values()).map(function (it) {
        return {
          id: it.id, name: it.name, group: it.group,
          license: it.license, safetyTier: it.safetyTier,
          sourceName: it.sourceName, url: it.url, downloadUrl: it.downloadUrl,
          style: it.style, contentTypes: it.contentTypes
        };
      })
    };
  }

  function saveAndUpdate(state) {
    var obj = selectionObject(state);
    try { localStorage.setItem('spritePickerSelection', JSON.stringify(obj)); } catch (e) {}
    updateTray(state._data, state);
  }

  function updateTray(data, state) {
    var obj = selectionObject(state);
    els.selCount.textContent = obj.selected.length;
    els.token.value = JSON.stringify(obj, null, 2);
    els.selList.innerHTML = '';
    obj.selected.forEach(function (s) {
      var p = document.createElement('span');
      p.className = 'pill';
      p.textContent = s.name + ' ';
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = '✕'; b.title = '해제';
      b.addEventListener('click', function () {
        state.selected.delete(s.id);
        var card = Array.from(document.querySelectorAll('.card')).find(function (c) {
          var nm = c.querySelector('.name'); return nm && nm.textContent === s.name;
        });
        if (card) card.classList.remove('selected');
        saveAndUpdate(state);
      });
      p.appendChild(b);
      els.selList.appendChild(p);
    });
  }

  function restoreSelection(state, items) {
    try {
      var raw = localStorage.getItem('spritePickerSelection');
      if (!raw) return;
      var obj = JSON.parse(raw);
      (obj.selected || []).forEach(function (s) {
        var it = items.find(function (i) { return i.id === s.id; });
        if (it) state.selected.set(it.id, it);
      });
      if (obj.note && document.getElementById('note')) document.getElementById('note').value = obj.note;
    } catch (e) {}
  }

  function showToast() {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = '선택 코드 복사됨';
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 250); }, 1400);
  }

  // preview MCP 가 읽을 수 있는 전역 훅
  window.__spritePickerSelection = function () {
    try { return localStorage.getItem('spritePickerSelection') || '{"version":1,"selected":[]}'; }
    catch (e) { return '{"version":1,"selected":[]}'; }
  };
  function uniq(a) { return Array.from(new Set(a)); }

  // ---- 부팅 (모든 var 초기화 후 맨 마지막에 실행) ----
  if (window.SPRITE_PICKER_DATA) {
    boot(window.SPRITE_PICKER_DATA);
  } else {
    fetch('data.json').then(function (r) {
      if (!r.ok) throw 0;
      return r.json();
    }).then(boot).catch(function () { boot(DEMO); });
  }
})();
