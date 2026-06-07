/* 스프라이트 피커 로직 v3 — 의존성 없음(vanilla). 오프라인 단독 동작.
 *
 * 탐색 모델: 하단 카테고리 탭 = [추천 · 전체 · 다운로드 · 후보].
 *   - 추천(recommended): targets(슬롯)·request 와 매칭 점수 상위. 런타임 계산(scoreItem).
 *   - 전체(all):         catalog 를 sourceId(웹사이트)별 아코디언 → 팩 카드. 팩 "펼치기"로 대형 미리보기.
 *   - 다운로드(downloaded): library 를 풀(전체)로 렌더 — SVG/PNG 풀해상도, 시트는 canvas 프레임 분해(개별 선택).
 *   - 후보(candidate):   절차 제안·로컬 파일.
 * 모드:
 *   - 어사인 모드: data.targets[] 가 있으면, 각 대상(슬롯)에 이미지/프레임을 배정.
 *   - 프리 모드:   targets 없으면 자유 다중 선택.
 * 데이터: window.SPRITE_PICKER_DATA → ./data.json → 내장 DEMO 순.
 * 미리보기: catalog 는 /catalog/<preview> 또는 previewUrl, library 는 /ws/<thumbnail|full>. 없으면 플레이스홀더.
 * 완료(핸드오프): "선택 완료" → POST(data.submitUrl 또는 /__sprite_picker_submit) → serve.mjs 가 파일 저장.
 *   실패 시 폴백: 선택 코드 클립보드 복사 + 토큰 노출. 막는 팝업 없이 비차단 토스트.
 */
(function () {
  'use strict';

  var DEMO = {
    title: '스프라이트 피커 (데모)',
    subtitle: 'data.js 가 없어 내장 데모를 표시합니다.',
    request: 'platformer player run jump coin tiles',
    tiers: { 'cc0': 'CC0', 'permissive-attribution': '표기 필요', 'mixed-per-item': '항목별', 'avoid': '주의' },
    sources: [
      { id: 'kenney', name: 'Kenney.nl', url: 'https://kenney.nl/assets', safetyTier: 'cc0' },
      { id: 'pixel-frog', name: 'Pixel Frog (itch.io)', url: 'https://pixelfrog-assets.itch.io/', safetyTier: 'mixed-per-item' }
    ],
    targets: [
      { id: 'player', name: '플레이어', description: '주인공 — 걷기/점프', tags: ['player', 'run', 'jump'], contentTypes: ['character'], style: 'pixel' },
      { id: 'enemy', name: '적', description: '기본 적', tags: ['enemy', 'slime'], contentTypes: ['enemy', 'character'], style: 'pixel' },
      { id: 'coin', name: '코인', description: '획득 아이템', tags: ['coin', 'gold'], contentTypes: ['item'], style: 'pixel' },
      { id: 'tiles', name: '타일셋', description: '지형/플랫폼', tags: ['ground', 'tiles'], contentTypes: ['tileset'], style: 'pixel' }
    ],
    catalog: [
      { id: 'kenney-pixel-platformer', name: 'Pixel Platformer', sourceId: 'kenney', sourceName: 'Kenney.nl', license: 'CC0-1.0', safetyTier: 'cc0', style: 'pixel', contentTypes: ['character', 'tileset', 'item'], tags: ['platformer', 'player', 'coin', 'tiles'] },
      { id: 'kenney-ui-pack', name: 'UI Pack', sourceId: 'kenney', sourceName: 'Kenney.nl', license: 'CC0-1.0', safetyTier: 'cc0', style: 'vector', contentTypes: ['ui', 'icon'], tags: ['button', 'panel', 'hud'] },
      { id: 'kenney-particle-pack', name: 'Particle Pack', sourceId: 'kenney', sourceName: 'Kenney.nl', license: 'CC0-1.0', safetyTier: 'cc0', style: 'vector', contentTypes: ['effect'], tags: ['fire', 'smoke', 'spark'] },
      { id: 'pixel-frog-pixel-adventure-1', name: 'Pixel Adventure 1', sourceId: 'pixel-frog', sourceName: 'Pixel Frog', license: 'CC0-1.0', safetyTier: 'cc0', style: 'pixel', contentTypes: ['character', 'enemy', 'tileset', 'item'], tags: ['platformer', 'player', 'enemy', 'fruit', 'animated'] }
    ],
    library: [
      { id: 'demo-gem', name: '에메랄드 (데모)', sourceId: 'game-icons-net', sourceName: 'game-icons.net', license: 'CC-BY-3.0', safetyTier: 'permissive-attribution', style: 'vector', contentTypes: ['item', 'icon'], tags: ['gem', 'coin'], downloaded: true, full: '' }
    ],
    candidate: []
  };

  function boot(data) {
    var items = normalize(data);
    var byId = {}; items.forEach(function (it) { byId[it.id] = it; });
    var pageSize = data.pageSize || 24;
    var state = {
      view: 'recommended',
      search: '', facets: { style: new Set(), contentType: new Set(), safetyTier: new Set() },
      selected: new Map(),
      targets: (data.targets || []).map(function (t) {
        return { id: String(t.id), name: t.name || t.id, description: t.description || '', hint: t.hint || '',
          tags: t.tags || [], contentTypes: t.contentTypes || [], style: t.style || '', assigned: null };
      }),
      activeTarget: null,
      pageSize: pageSize, shownLimit: pageSize, recommendLimit: data.recommendLimit || pageSize,
      expandedSources: new Set(), expandedPacks: new Set(),
      _data: data, _byId: byId, _items: items
    };
    restore(state);
    if (state.targets.length) state.activeTarget = (firstEmpty(state) || state.targets[0]).id;
    state.view = defaultView(items, state);
    render(data, items, state);
  }

  function defaultView(items, state) {
    if (recoList(items, state).length) return 'recommended';
    if (countGroup(items, 'catalog')) return 'all';
    if (countGroup(items, 'library')) return 'downloaded';
    if (countGroup(items, 'candidate')) return 'candidate';
    return 'all';
  }
  function countGroup(items, g) { return items.filter(function (it) { return it.group === g; }).length; }
  function assignMode(state) { return state.targets.length > 0; }
  function firstEmpty(state) { for (var i = 0; i < state.targets.length; i++) if (!state.targets[i].assigned) return state.targets[i]; return null; }
  function targetById(state, id) { for (var i = 0; i < state.targets.length; i++) if (state.targets[i].id === id) return state.targets[i]; return null; }
  function activeTargetObj(state) { return targetById(state, state.activeTarget); }

  function normalize(data) {
    var out = [];
    ['catalog', 'library', 'candidate'].forEach(function (group) {
      (data[group] || []).forEach(function (raw) {
        out.push({
          id: String(raw.id || raw.name), name: raw.name || raw.id || '(이름 없음)', group: group,
          sourceId: raw.sourceId || raw.source || '', sourceName: raw.sourceName || raw.source || '',
          license: raw.license || '?', safetyTier: raw.safetyTier || 'mixed-per-item',
          style: raw.style || 'pixel', contentTypes: raw.contentTypes || [], tags: raw.tags || [],
          preview: raw.preview || '', previewUrl: raw.previewUrl || '', animated: !!raw.animated,
          url: raw.url || raw.packUrl || '', downloadUrl: raw.downloadUrl || '', notes: raw.notes || '',
          downloaded: !!raw.downloaded || group === 'library',
          full: raw.full || '', thumbnail: raw.thumbnail || '', frameConfig: raw.frameConfig || null
        });
      });
    });
    return out;
  }

  // ── URL/미리보기 헬퍼 ───────────────────────────────────────────
  function assetUrl(group, p) {
    if (!p) return '';
    if (/^(https?:|data:|blob:)/.test(p)) return p;
    p = p.replace(/^\/+/, '');
    return (group === 'library' ? '/ws/' : '/catalog/') + p;
  }
  function previewSrc(it) {
    if (it.group === 'library') { return (it.thumbnail ? assetUrl('library', it.thumbnail) : '') || (it.full ? assetUrl('library', it.full) : ''); }
    if (it.preview) return assetUrl('catalog', it.preview);
    if (it.previewUrl) return it.previewUrl;
    return '';
  }
  function fullUrl(it) { return assetUrl('library', it.full || it.thumbnail || ''); }
  function isSheet(it) { return it.group === 'library' && it.frameConfig && it.frameConfig.frameWidth && /\.(png|jpe?g|webp|gif)$/i.test(it.full || ''); }

  // ── 추천 점수 ───────────────────────────────────────────────────
  function recoTokens(state) {
    var toks = [];
    var t = activeTargetObj(state);
    if (t) { toks = toks.concat(t.tags || [], t.contentTypes || [], String(t.name || '').split(/\s+/)); if (t.style) toks.push(t.style); }
    else if (state.targets.length) { state.targets.forEach(function (tt) { toks = toks.concat(tt.tags || [], tt.contentTypes || []); }); }
    if (state._data && state._data.request) toks = toks.concat(String(state._data.request).split(/\s+/));
    return uniq(toks.filter(Boolean).map(function (s) { return String(s).toLowerCase(); }).filter(function (s) { return s.length > 1; }));
  }
  function scoreItem(it, toks) {
    var hay = (it.name + ' ' + (it.tags || []).join(' ') + ' ' + (it.contentTypes || []).join(' ') + ' ' + it.style + ' ' + it.sourceName).toLowerCase();
    var s = 0; toks.forEach(function (tk) { if (hay.indexOf(tk) !== -1) s += 1; });
    if (it.group === 'library') s += 0.5;       // 이미 검증·다운로드된 것 우대
    if (it.safetyTier === 'cc0') s += 0.25;
    return s;
  }
  function recoList(items, state) {
    var toks = recoTokens(state);
    var pool = items.filter(function (it) { return it.group !== 'candidate' || true; }); // 전 그룹 후보
    if (!toks.length) { // 기준 없음: cc0 우선, library 우선
      return pool.slice().sort(function (a, b) { return tierRank(a) - tierRank(b); });
    }
    var scored = pool.map(function (it) { return { it: it, s: scoreItem(it, toks) }; }).filter(function (x) { return x.s > 0; });
    scored.sort(function (a, b) { return b.s - a.s || tierRank(a.it) - tierRank(b.it); });
    return scored.map(function (x) { return x.it; });
  }
  function tierRank(it) { return ({ 'cc0': 0, 'permissive-attribution': 1, 'mixed-per-item': 2, 'avoid': 3 })[it.safetyTier] != null ? ({ 'cc0': 0, 'permissive-attribution': 1, 'mixed-per-item': 2, 'avoid': 3 })[it.safetyTier] : 2; }

  // ── 렌더 ────────────────────────────────────────────────────────
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
    els.viewHint = document.getElementById('viewHint');
    els.lightbox = document.getElementById('lightbox');

    if (data.title) els.title.textContent = data.title;
    if (data.subtitle) els.subtitle.textContent = data.subtitle;
    if (assignMode(state)) document.body.classList.add('assign-mode');

    buildFacets(items, state);
    bindNav(items, state);
    bindFilters(items, state);
    bindTray(data, items, state);
    bindLightbox(state);

    if (assignMode(state)) { els.assignBoard.hidden = false; renderSlots(state); }
    syncNav(state);
    renderBody(items, state);
    updateTray(data, state);
    updateNavCounts(items, state);
  }

  function bindNav(items, state) {
    document.querySelectorAll('.nav-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        state.view = t.getAttribute('data-view'); state.shownLimit = state.pageSize;
        syncNav(state); renderBody(state._items, state);
      });
    });
  }
  function syncNav(state) {
    document.querySelectorAll('.nav-tab').forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-view') === state.view); });
    var hints = {
      recommended: '대상·요청에 가장 잘 맞는 후보를 점수순으로 보여줍니다.',
      all: '웹사이트별로 펼쳐 그 안의 팩을 찾아보세요. 팩 카드의 "펼치기"로 크게 미리봅니다.',
      downloaded: '이미 받아 둔 에셋입니다 — 미리보기가 아니라 전체로 보이며, 스프라이트시트는 프레임을 개별 선택할 수 있습니다.',
      candidate: '이번 요청용 절차 생성 제안·로컬 파일입니다.'
    };
    if (els.viewHint) els.viewHint.textContent = hints[state.view] || '';
  }
  function updateNavCounts(items, state) {
    var counts = {
      recommended: Math.min(recoList(items, state).length, state.recommendLimit),
      all: countGroup(items, 'catalog'), downloaded: countGroup(items, 'library'), candidate: countGroup(items, 'candidate')
    };
    Object.keys(counts).forEach(function (v) { var el = document.querySelector('.count[data-count="' + v + '"]'); if (el) el.textContent = counts[v]; });
    document.querySelectorAll('.nav-tab').forEach(function (t) { var v = t.getAttribute('data-view'); t.classList.toggle('empty', !counts[v]); });
  }

  function matchesFilters(it, state) {
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

  function renderBody(items, state) {
    var g = els.gallery; g.innerHTML = ''; g.classList.remove('as-accordions');
    if (state.view === 'all') return renderAll(items, state);
    if (state.view === 'downloaded') return renderGrid(items.filter(function (it) { return it.group === 'library'; }), state, '이전에 받아 둔 에셋이 아직 없습니다.', true);
    if (state.view === 'candidate') return renderGrid(items.filter(function (it) { return it.group === 'candidate'; }), state, '이번 후보가 없습니다.', false);
    // recommended
    var reco = recoList(items, state).filter(function (it) { return matchesFilters(it, state); }).slice(0, state.recommendLimit);
    renderGrid(reco, state, '추천할 후보가 없습니다. 필터를 줄이거나 다른 탭을 보세요.', false, true);
  }

  function renderGrid(list, state, emptyMsg, full, noPaginate) {
    var g = els.gallery;
    var shown = list.filter(function (it) { return matchesFilters(it, state); });
    if (els.shownCount) els.shownCount.textContent = (noPaginate ? shown.length : Math.min(shown.length, state.shownLimit)) + ' / ' + shown.length + '개';
    if (!shown.length) { var e = document.createElement('div'); e.className = 'empty'; e.textContent = emptyMsg; g.appendChild(e); return; }
    var assignedSet = assignedIdSet(state);
    var limit = noPaginate ? shown.length : state.shownLimit;
    shown.slice(0, limit).forEach(function (it) { g.appendChild(full ? downloadedCard(it, state, assignedSet) : card(it, state, assignedSet)); });
    if (!noPaginate && shown.length > limit) {
      var remain = shown.length - limit;
      var more = document.createElement('button'); more.className = 'load-more'; more.type = 'button';
      more.textContent = '더 가져오기  (+' + Math.min(state.pageSize, remain) + ' · 남은 ' + remain + ')';
      more.addEventListener('click', function () { state.shownLimit += state.pageSize; renderBody(state._items, state); });
      g.appendChild(more);
    }
  }

  function renderAll(items, state) {
    var g = els.gallery; g.classList.add('as-accordions');
    var cat = items.filter(function (it) { return it.group === 'catalog' && matchesFilters(it, state); });
    if (!cat.length) { var e = document.createElement('div'); e.className = 'empty'; e.textContent = '조건에 맞는 팩이 없습니다. 필터를 줄여보세요.'; g.appendChild(e); return; }
    if (els.shownCount) els.shownCount.textContent = cat.length + '개 팩';
    var assignedSet = assignedIdSet(state);
    var sources = (state._data.sources || []).slice();
    // sources 에 없는 sourceId 도 자동 그룹으로 추가
    var seen = {}; sources.forEach(function (s) { seen[s.id] = true; });
    uniq(cat.map(function (it) { return it.sourceId || '기타'; })).forEach(function (sid) { if (!seen[sid]) sources.push({ id: sid, name: sid || '기타', url: '', safetyTier: '' }); });

    sources.forEach(function (src) {
      var packs = cat.filter(function (it) { return (it.sourceId || '기타') === src.id; });
      if (!packs.length) return;
      var open = !state.expandedSources.size || state.expandedSources.has(src.id) || state._allDefaultOpen !== false;
      // 기본은 모두 펼침. 사용자가 접으면 expandedSources 에서 제외(아래 토글).
      var collapsed = state.expandedSources.has('__closed__' + src.id);
      var acc = document.createElement('section'); acc.className = 'acc' + (collapsed ? ' collapsed' : '');
      var head = document.createElement('button'); head.type = 'button'; head.className = 'acc-head';
      head.innerHTML = '<span class="acc-caret">▾</span>';
      var nm = document.createElement('span'); nm.className = 'acc-name'; nm.textContent = src.name || src.id; head.appendChild(nm);
      if (src.safetyTier) { var tb = document.createElement('span'); tb.className = 'badge ' + src.safetyTier; tb.textContent = facetLabel('safetyTier', src.safetyTier); head.appendChild(tb); }
      var cnt = document.createElement('span'); cnt.className = 'acc-count'; cnt.textContent = packs.length + '팩'; head.appendChild(cnt);
      if (src.url) { var a = document.createElement('a'); a.className = 'acc-link'; a.href = src.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '사이트 ↗'; a.addEventListener('click', function (e) { e.stopPropagation(); }); head.appendChild(a); }
      head.addEventListener('click', function () {
        var key = '__closed__' + src.id;
        if (state.expandedSources.has(key)) state.expandedSources.delete(key); else state.expandedSources.add(key);
        renderBody(state._items, state);
      });
      acc.appendChild(head);
      var grid = document.createElement('div'); grid.className = 'acc-grid';
      packs.forEach(function (it) { grid.appendChild(card(it, state, assignedSet)); });
      acc.appendChild(grid);
      g.appendChild(acc);
    });
  }

  function assignedIdSet(state) { var s = {}; state.targets.forEach(function (t) { if (t.assigned) s[t.assigned.id] = true; }); return s; }

  // ── 카드(미리보기 기반: catalog/candidate/recommended) ──────────
  function card(it, state, assignedSet) {
    var el = document.createElement('article');
    el.className = 'card' + (it.style !== 'pixel' ? ' smooth' : '');
    if (assignMode(state)) el.classList.add('assignable-hint');
    if (isSelected(state, it)) el.classList.add('selected');
    el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', it.id); e.dataTransfer.effectAllowed = 'copy'; });
    el.appendChild(previewEl(it));
    var check = document.createElement('div'); check.className = 'check'; check.textContent = '✓'; el.appendChild(check);
    var liveUrl = it.previewUrl || it.url;
    if (liveUrl) { var live = document.createElement('a'); live.className = 'live'; live.href = liveUrl; live.target = '_blank'; live.rel = 'noopener'; live.textContent = '원본 ↗'; live.addEventListener('click', function (e) { e.stopPropagation(); }); el.appendChild(live); }
    el.appendChild(metaEl(it));
    // 팩 펼치기(카탈로그) — 대형 미리보기 토글
    if (it.group === 'catalog') {
      var exp = document.createElement('button'); exp.type = 'button'; exp.className = 'expand-btn';
      var isOpen = state.expandedPacks.has(it.id); exp.textContent = isOpen ? '접기 ▴' : '펼치기 ▾';
      exp.addEventListener('click', function (e) { e.stopPropagation(); if (state.expandedPacks.has(it.id)) state.expandedPacks.delete(it.id); else state.expandedPacks.add(it.id); renderBody(state._items, state); });
      el.appendChild(exp);
      if (isOpen) el.appendChild(bigPreview(it));
    }
    el.addEventListener('click', function () { act(state, it); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(state, it); } });
    return el;
  }

  function bigPreview(it) {
    var wrap = document.createElement('div'); wrap.className = 'big-preview';
    var src = previewSrc(it);
    if (src) { var img = document.createElement('img'); img.src = src; img.alt = it.name; img.loading = 'lazy'; img.onerror = function () { img.replaceWith(placeholder(it)); }; wrap.appendChild(img); }
    else { wrap.appendChild(placeholder(it)); }
    if (it.notes) { var n = document.createElement('p'); n.className = 'big-notes muted small'; n.textContent = it.notes; wrap.appendChild(n); }
    return wrap;
  }

  // ── 다운로드 카드(풀 렌더) ──────────────────────────────────────
  function downloadedCard(it, state, assignedSet) {
    var el = document.createElement('article');
    el.className = 'card full' + (it.style !== 'pixel' ? ' smooth' : '');
    if (assignMode(state)) el.classList.add('assignable-hint');
    if (isSelected(state, it)) el.classList.add('selected');
    el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', it.id); e.dataTransfer.effectAllowed = 'copy'; });
    var src = fullUrl(it) || previewSrc(it);
    if (src) { var img = document.createElement('img'); img.className = 'thumb full'; img.alt = it.name; img.loading = 'lazy'; img.src = src; img.onerror = function () { img.replaceWith(placeholder(it)); }; el.appendChild(img); }
    else el.appendChild(placeholder(it));
    var check = document.createElement('div'); check.className = 'check'; check.textContent = '✓'; el.appendChild(check);
    var dl = document.createElement('span'); dl.className = 'dl-badge'; dl.textContent = '다운로드됨'; el.appendChild(dl);
    el.appendChild(metaEl(it));
    if (isSheet(it)) {
      var fb = document.createElement('button'); fb.type = 'button'; fb.className = 'expand-btn';
      fb.textContent = '프레임 전체 보기 ▸';
      fb.addEventListener('click', function (e) { e.stopPropagation(); openFull(it, state); });
      el.appendChild(fb);
    } else if (it.full) {
      var vb = document.createElement('button'); vb.type = 'button'; vb.className = 'expand-btn';
      vb.textContent = '전체 보기 ▸';
      vb.addEventListener('click', function (e) { e.stopPropagation(); openFull(it, state); });
      el.appendChild(vb);
    }
    el.addEventListener('click', function () { act(state, it); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(state, it); } });
    return el;
  }

  function metaEl(it) {
    var meta = document.createElement('div'); meta.className = 'meta';
    var name = document.createElement('div'); name.className = 'name'; name.textContent = it.name; name.title = it.name;
    var sub = document.createElement('div'); sub.className = 'sub';
    var badge = document.createElement('span'); badge.className = 'badge ' + it.safetyTier; badge.textContent = it.license; sub.appendChild(badge);
    if (it.sourceName) { var src = document.createElement('span'); src.className = 'src'; src.textContent = it.sourceName; sub.appendChild(src); }
    meta.appendChild(name); meta.appendChild(sub); return meta;
  }

  function previewEl(it) {
    var src = previewSrc(it);
    if (it.animated && src) { var obj = document.createElement('object'); obj.className = 'thumb anim'; obj.type = 'image/svg+xml'; obj.data = src; obj.setAttribute('aria-label', it.name); return obj; }
    if (src) { var img = document.createElement('img'); img.className = 'thumb'; img.alt = it.name; img.loading = 'lazy'; img.src = src; img.onerror = function () { img.replaceWith(placeholder(it)); }; return img; }
    return placeholder(it);
  }

  // ── 선택/배정 동작 ──────────────────────────────────────────────
  function act(state, it) {
    if (assignMode(state)) assignToActive(state, it, null);
    else toggleSelect(state, it, null);
  }
  function selKey(id, frame) { return (frame === undefined || frame === null) ? id : id + '#' + frame; }
  function isSelected(state, it) {
    if (assignMode(state)) return state.targets.some(function (t) { return t.assigned && t.assigned.id === it.id; });
    var keys = Array.from(state.selected.keys());
    return keys.some(function (k) { return k === it.id || k.indexOf(it.id + '#') === 0; });
  }
  function toggleSelect(state, it, frame) {
    var k = selKey(it.id, frame);
    if (state.selected.has(k)) state.selected.delete(k); else state.selected.set(k, { item: it, frame: frame });
    saveAndUpdate(state); renderBody(state._items, state);
  }
  function advanceActive(state, justFilled) { var nxt = firstEmpty(state); state.activeTarget = nxt ? nxt.id : justFilled.id; }
  function assignToActive(state, item, frame) {
    var t = activeTargetObj(state) || firstEmpty(state) || state.targets[0]; if (!t) return;
    t.assigned = { id: item.id, frame: (frame === undefined ? null : frame) }; advanceActive(state, t);
    renderSlots(state); renderBody(state._items, state); saveAndUpdate(state);
  }

  function renderSlots(state) {
    var c = els.slots; c.innerHTML = '';
    state.targets.forEach(function (t) {
      var slot = document.createElement('div');
      slot.className = 'slot' + (t.assigned ? ' filled' : '') + (state.activeTarget === t.id ? ' active' : '');
      slot.setAttribute('data-target', t.id);
      var thumb = document.createElement('div'); thumb.className = 'slot-thumb';
      if (t.assigned && state._byId[t.assigned.id]) thumb.appendChild(slotThumb(state._byId[t.assigned.id], t.assigned.frame)); else thumb.textContent = '비어 있음';
      slot.appendChild(thumb);
      var nm = document.createElement('div'); nm.className = 'slot-name'; nm.textContent = t.name; nm.title = t.name; slot.appendChild(nm);
      if (t.description) { var ds = document.createElement('div'); ds.className = 'slot-desc'; ds.textContent = t.description; ds.title = t.description; slot.appendChild(ds); }
      var clr = document.createElement('button'); clr.className = 'slot-clear'; clr.textContent = '✕'; clr.title = '배정 해제';
      clr.addEventListener('click', function (e) { e.stopPropagation(); t.assigned = null; state.activeTarget = t.id; renderSlots(state); renderBody(state._items, state); saveAndUpdate(state); });
      slot.appendChild(clr);
      slot.addEventListener('click', function () { state.activeTarget = t.id; renderSlots(state); });
      slot.addEventListener('dragover', function (e) { e.preventDefault(); slot.classList.add('dragover'); });
      slot.addEventListener('dragleave', function () { slot.classList.remove('dragover'); });
      slot.addEventListener('drop', function (e) {
        e.preventDefault(); slot.classList.remove('dragover');
        var id = e.dataTransfer.getData('text/plain');
        if (id && state._byId[id]) { t.assigned = { id: id, frame: null }; advanceActive(state, t); renderSlots(state); renderBody(state._items, state); saveAndUpdate(state); }
      });
      c.appendChild(slot);
    });
    var filled = state.targets.filter(function (t) { return t.assigned; }).length;
    els.assignProgress.textContent = filled + '/' + state.targets.length;
  }
  function slotThumb(it, frame) {
    if (frame != null && isSheet(it)) return frameCanvas(it, frame);
    return previewEl(it);
  }
  function frameCanvas(it, frame) {
    var fw = it.frameConfig.frameWidth, fh = it.frameConfig.frameHeight;
    var cv = document.createElement('canvas'); cv.width = fw; cv.height = fh; cv.className = 'thumb';
    if (it.style === 'pixel') cv.style.imageRendering = 'pixelated';
    var img = new Image();
    img.onload = function () { var cols = Math.max(1, Math.floor(img.width / fw)); var c = frame % cols, r = Math.floor(frame / cols); try { cv.getContext('2d').drawImage(img, c * fw, r * fh, fw, fh, 0, 0, fw, fh); } catch (e) {} };
    img.src = fullUrl(it);
    return cv;
  }

  // ── 풀뷰 라이트박스 ─────────────────────────────────────────────
  function bindLightbox(state) {
    var close = function () { els.lightbox.hidden = true; document.getElementById('lightboxBody').innerHTML = ''; };
    document.getElementById('lightboxClose').addEventListener('click', close);
    document.getElementById('lightboxBackdrop').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !els.lightbox.hidden) close(); });
    state._closeLightbox = close;
  }
  function openFull(it, state) {
    var body = document.getElementById('lightboxBody'); var title = document.getElementById('lightboxTitle');
    title.textContent = it.name + (isSheet(it) ? ' — 프레임 클릭으로 선택' : '');
    body.innerHTML = ''; els.lightbox.hidden = false;
    if (isSheet(it)) {
      var img = new Image();
      img.onload = function () {
        var fw = it.frameConfig.frameWidth, fh = it.frameConfig.frameHeight;
        var cols = Math.max(1, Math.floor(img.width / fw)), rows = Math.max(1, Math.floor(img.height / fh));
        var grid = document.createElement('div'); grid.className = 'frame-grid'; var idx = 0;
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
          var fi = idx++;
          var cell = document.createElement('button'); cell.type = 'button'; cell.className = 'frame-cell';
          var cv = document.createElement('canvas'); cv.width = fw; cv.height = fh; cv.className = 'frame-canvas';
          if (it.style === 'pixel') cv.style.imageRendering = 'pixelated';
          try { cv.getContext('2d').drawImage(img, c * fw, r * fh, fw, fh, 0, 0, fw, fh); } catch (e) {}
          cell.appendChild(cv);
          var lab = document.createElement('span'); lab.className = 'frame-idx'; lab.textContent = '#' + fi; cell.appendChild(lab);
          (function (frame) { cell.addEventListener('click', function () { if (assignMode(state)) assignToActive(state, it, frame); else toggleSelect(state, it, frame); state._closeLightbox(); }); })(fi);
          grid.appendChild(cell);
        }
        body.appendChild(grid);
      };
      img.onerror = function () { body.innerHTML = '<p class="muted">이미지를 불러오지 못했습니다: ' + fullUrl(it) + '</p>'; };
      img.src = fullUrl(it);
    } else {
      var big = document.createElement('img'); big.className = 'lightbox-img'; big.alt = it.name; big.src = fullUrl(it);
      if (it.style === 'pixel') big.style.imageRendering = 'pixelated';
      big.onerror = function () { body.innerHTML = '<p class="muted">이미지를 불러오지 못했습니다: ' + fullUrl(it) + '</p>'; };
      body.appendChild(big);
    }
  }

  // ── 플레이스홀더(오프라인) ──────────────────────────────────────
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

  // ── 필터/검색/패싯 ──────────────────────────────────────────────
  function buildFacets(items, state) {
    facetChips('styleChips', 'style', uniq(items.map(function (i) { return i.style; })), state, items);
    facetChips('typeChips', 'contentType', uniq(items.flatMap(function (i) { return i.contentTypes; })), state, items);
    facetChips('tierChips', 'safetyTier', uniq(items.map(function (i) { return i.safetyTier; })), state, items);
  }
  function facetChips(containerId, facet, values, state, items) {
    var c = document.getElementById(containerId); if (!c) return; c.innerHTML = '';
    values.filter(Boolean).forEach(function (v) {
      var b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.textContent = facetLabel(facet, v);
      b.addEventListener('click', function () { var set = state.facets[facet]; if (set.has(v)) set.delete(v); else set.add(v); b.classList.toggle('on'); state.shownLimit = state.pageSize; renderBody(items, state); });
      c.appendChild(b);
    });
  }
  function facetLabel(facet, v) {
    if (facet === 'safetyTier') return ({ 'cc0': 'CC0', 'permissive-attribution': '표기필요', 'mixed-per-item': '항목별', 'avoid': '주의' })[v] || v;
    if (facet === 'style') return ({ 'pixel': '픽셀', 'vector': '벡터', 'flat': '플랫', 'hd': 'HD', 'hand-drawn': '손그림', 'mixed': '혼합' })[v] || v;
    return ({ 'character': '캐릭터', 'enemy': '적', 'tileset': '타일', 'spritesheet': '시트', 'ui': 'UI', 'icon': '아이콘', 'background': '배경', 'effect': '이펙트', 'item': '아이템' })[v] || v;
  }
  function bindFilters(items, state) {
    els.search.addEventListener('input', function () { state.search = els.search.value.trim().toLowerCase(); state.shownLimit = state.pageSize; renderBody(items, state); });
  }

  // ── 트레이/완료 ─────────────────────────────────────────────────
  function bindTray(data, items, state) {
    state._data = data;
    document.getElementById('clearBtn').addEventListener('click', function () {
      if (assignMode(state)) { state.targets.forEach(function (t) { t.assigned = null; }); state.activeTarget = state.targets[0] && state.targets[0].id; renderSlots(state); }
      else state.selected.clear();
      renderBody(items, state); saveAndUpdate(state);
    });
    document.getElementById('completeBtn').addEventListener('click', function () { complete(state); });
    var cb = document.getElementById('copyBtn'); if (cb) cb.addEventListener('click', function () { copyToken(); });
    els.note.addEventListener('input', function () { saveAndUpdate(state); });
  }

  function selectionObject(state) {
    var base = { version: 3, request: (state._data && state._data.request) || '', note: (els.note && els.note.value) || '' };
    if (assignMode(state)) {
      base.assignments = state.targets.filter(function (t) { return t.assigned; }).map(function (t) { return { targetId: t.id, targetName: t.name, image: slim(state._byId[t.assigned.id], t.assigned.frame) }; });
      base.unassignedTargets = state.targets.filter(function (t) { return !t.assigned; }).map(function (t) { return { targetId: t.id, targetName: t.name }; });
    } else {
      base.selected = Array.from(state.selected.values()).map(function (v) { return slim(v.item, v.frame); });
    }
    return base;
  }
  function slim(it, frame) {
    if (!it) return null;
    var o = { id: it.id, name: it.name, group: it.group, license: it.license, safetyTier: it.safetyTier, sourceId: it.sourceId, sourceName: it.sourceName, url: it.url, downloadUrl: it.downloadUrl, style: it.style, contentTypes: it.contentTypes };
    if (it.group === 'library') { o.full = it.full; if (it.frameConfig) o.frameConfig = it.frameConfig; }
    if (frame !== undefined && frame !== null) o.frame = frame;
    return o;
  }

  function saveAndUpdate(state) { try { localStorage.setItem('spritePickerSelection', JSON.stringify(selectionObject(state))); } catch (e) {} updateTray(state._data, state); updateNavCounts(state._items, state); }

  function updateTray(data, state) {
    var obj = selectionObject(state); els.token.value = JSON.stringify(obj, null, 2);
    els.selList.innerHTML = '';
    if (assignMode(state)) {
      els.trayLabel.textContent = '배정됨 ' + (obj.assignments || []).length + '/' + state.targets.length;
      (obj.assignments || []).forEach(function (a) { var p = document.createElement('span'); p.className = 'pill'; p.textContent = a.targetName + ' ← ' + (a.image ? a.image.name : '?') + (a.image && a.image.frame != null ? ' #' + a.image.frame : ''); els.selList.appendChild(p); });
    } else {
      els.trayLabel.textContent = '선택됨 ' + (obj.selected || []).length + '개';
      (obj.selected || []).forEach(function (s) {
        var p = document.createElement('span'); p.className = 'pill'; p.textContent = s.name + (s.frame != null ? ' #' + s.frame : '') + ' ';
        var b = document.createElement('button'); b.type = 'button'; b.textContent = '✕';
        b.addEventListener('click', function () { state.selected.delete(selKey(s.id, s.frame)); saveAndUpdate(state); renderBody(state._items, state); });
        p.appendChild(b); els.selList.appendChild(p);
      });
    }
  }

  function restore(state) {
    try {
      var raw = localStorage.getItem('spritePickerSelection'); if (!raw) return; var obj = JSON.parse(raw);
      if (obj.note && document.getElementById('note')) document.getElementById('note').value = obj.note;
      if (assignMode(state) && obj.assignments) obj.assignments.forEach(function (a) { var t = targetById(state, a.targetId); if (t && a.image && state._byId[a.image.id]) t.assigned = { id: a.image.id, frame: (a.image.frame != null ? a.image.frame : null) }; });
      else if (obj.selected) obj.selected.forEach(function (s) { if (state._byId[s.id]) state.selected.set(selKey(s.id, s.frame), { item: state._byId[s.id], frame: (s.frame != null ? s.frame : null) }); });
    } catch (e) {}
  }

  // 선택 완료 — POST 자동 핸드오프 → 실패 시 비차단 폴백(복사).
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
    var mw = document.querySelector('.more-wrap'); if (mw) mw.open = true;
    copyText(text);
    toast('📋 자동 전송이 안 돼요 — 선택 코드를 복사했어요. 아래 코드를 채팅에 붙여넣어 주세요', 7000, 'warn');
    if (mw) mw.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function copyToken() { copyText(els.token.value); toast('선택 코드 복사됨', 1500, 'ok'); }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).catch(manual); } else manual();
    function manual() { try { els.token.removeAttribute('readonly'); els.token.select(); document.execCommand('copy'); els.token.setAttribute('readonly', ''); } catch (e) {} }
  }
  function toast(msg, ms, kind) {
    var t = document.createElement('div'); t.className = 'toast' + (kind ? ' ' + kind : ''); t.textContent = msg; document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 280); }, ms || 1500);
  }

  window.__spritePickerSelection = function () { try { return localStorage.getItem('spritePickerSelection') || '{"version":3}'; } catch (e) { return '{"version":3}'; } };
  function uniq(a) { return Array.from(new Set(a)); }

  if (window.SPRITE_PICKER_DATA) boot(window.SPRITE_PICKER_DATA);
  else fetch('data.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(boot).catch(function () { boot(DEMO); });
})();
