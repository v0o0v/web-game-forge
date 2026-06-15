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
      // 다운로드 큐 상태: packId → 'queued'|'downloading'|'analyzing'|'done'|'failed'. 낙관적 갱신 + 서버 폴.
      dlStatus: {},
      _data: data, _byId: byId, _items: items
    };
    restore(state);
    if (state.targets.length) state.activeTarget = (firstEmpty(state) || state.targets[0]).id;
    state.view = defaultView(items, state);
    render(data, items, state);
    fetchDownloads(state); // 부팅 시 큐 상태 동기화(비차단). 정적 서버면 조용히 무시.
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
          full: raw.full || '', thumbnail: raw.thumbnail || '', frameConfig: raw.frameConfig || null,
          // ★분석버전2 확장: 다운로드 출처 팩 id / 비균일 프레임 / 명명 애니 / 그리드 제외칸 보존.
          sourcePackId: raw.sourcePackId || '',
          frames: Array.isArray(raw.frames) ? raw.frames : null,
          anims: Array.isArray(raw.anims) ? raw.anims : [],
          excludedFrames: Array.isArray(raw.excludedFrames) ? raw.excludedFrames : [],
          files: Array.isArray(raw.files) ? raw.files : []
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
  function hasFrames(it) { return !!(it.frames && it.frames.length); }  // 비균일/아틀라스 영역 보유
  function isSheet(it) {
    if (it.group !== 'library' || !/\.(png|jpe?g|webp|gif)$/i.test(it.full || '')) return false;
    return hasFrames(it) || !!(it.frameConfig && it.frameConfig.frameWidth);  // frames[] 우선, 없으면 그리드
  }
  // 라이브러리에 이 카탈로그 팩이 이미 받아져 있는지(=sourcePackId 일치 항목 존재).
  function isDownloaded(it, state) {
    return state._items.some(function (x) { return x.group === 'library' && x.sourcePackId && x.sourcePackId === it.id; });
  }
  // 현재 다운로드 큐 상태(낙관적 dlStatus). 없으면 ''.
  function dlStatusOf(it, state) { return state.dlStatus[it.id] || ''; }

  // ── 성능: 이미지 디코드 캐시(url 1회 로드 후 슬라이스 공유) ──────────────────
  // 같은 시트의 여러 프레임 썸네일·라이트박스·에디터가 같은 url 을 반복 new Image() 하던 것을
  // url→디코드 Image 1개로 공유한다(불필요 재디코드 제거). 디코드 이미지는 읽기 전용(drawImage
  // 소스)이라 공유 안전. 콜백은 로드 완료 시(이미 완료면 동기) 1회 호출.
  var _imgCache = {};   // url → { img, state:'load'|'ok'|'err', cbs:[{ok,err}] }
  function loadImage(url, onReady, onErr) {
    if (!url) { if (onErr) onErr(); return; }
    var e = _imgCache[url];
    if (e) {
      if (e.state === 'ok') { if (onReady) onReady(e.img); return; }
      if (e.state === 'err') { if (onErr) onErr(); return; }
      e.cbs.push({ ok: onReady, err: onErr }); return;   // 로딩 중 — 완료 시 함께 호출
    }
    e = _imgCache[url] = { img: new Image(), state: 'load', cbs: [{ ok: onReady, err: onErr }] };
    e.img.onload = function () { e.state = 'ok'; var cbs = e.cbs; e.cbs = []; cbs.forEach(function (c) { if (c.ok) { try { c.ok(e.img); } catch (x) {} } }); };
    e.img.onerror = function () { e.state = 'err'; var cbs = e.cbs; e.cbs = []; cbs.forEach(function (c) { if (c.err) { try { c.err(); } catch (x) {} } }); };
    e.img.src = url;
  }

  // ── 성능: 썸네일 IntersectionObserver lazy + 동시 로드 제한 ──────────────────
  // 화면 밖 카드 썸네일은 보이기 전까지 src 를 설정하지 않고(네트워크 절약), 보이면 동시
  // 요청 한도(_MAX_INFLIGHT) 안에서 순차 로드한다. IO 미지원 환경은 즉시 로드(기존 동작).
  var _MAX_INFLIGHT = 6, _inflight = 0, _lazyQueue = [];
  var _io = (typeof IntersectionObserver !== 'undefined') ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { var img = en.target; _io.unobserve(img); enqueueLazy(img); } });
  }, { rootMargin: '200px' }) : null;
  function enqueueLazy(img) { _lazyQueue.push(img); pumpLazy(); }
  function pumpLazy() {
    while (_inflight < _MAX_INFLIGHT && _lazyQueue.length) {
      var img = _lazyQueue.shift();
      var src = img.getAttribute('data-lazy-src');
      if (!src) continue;
      img.removeAttribute('data-lazy-src');
      _inflight++;
      var release = function () { _inflight--; pumpLazy(); };
      img.addEventListener('load', release, { once: true });
      img.addEventListener('error', release, { once: true });
      img.src = src;
    }
  }
  // 가시영역 진입 시 로드되도록 등록. IO 없으면 즉시 src(기존과 동일). onerror 는 호출 전 설정 전제.
  function lazyImg(img, src) {
    if (!src) return img;
    img.loading = 'lazy';                       // 네이티브 lazy 병용(중복 무해)
    if (!_io) { img.src = src; return img; }
    img.setAttribute('data-lazy-src', src);
    _io.observe(img);
    return img;
  }

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
  // 추천 베이스 목록(필터·검색 적용 전, 점수순 정렬). 토큰은 activeTarget 변경 때만 바뀌므로
  // 토큰 시그니처로 메모이즈한다 — updateNavCounts 가 매 renderBody(검색/페이지/선택)마다 호출해도
  // O(n*m) 재점수를 막는다. 편집(이름 변경 등)은 saveEditor.apply() 가 캐시를 무효화한다.
  function recoList(items, state) {
    var toks = recoTokens(state);
    var sig = (toks.length ? '1:' + toks.join('|') : '0');
    var c = state._recoCache;
    if (c && c.sig === sig && c.items === items) return c.list;
    var pool = items.filter(function (it) { return it.group !== 'candidate' || true; }); // 전 그룹 후보
    var list;
    if (!toks.length) { // 기준 없음: cc0 우선, library 우선
      list = pool.slice().sort(function (a, b) { return tierRank(a) - tierRank(b); });
    } else {
      var scored = pool.map(function (it) { return { it: it, s: scoreItem(it, toks) }; }).filter(function (x) { return x.s > 0; });
      scored.sort(function (a, b) { return b.s - a.s || tierRank(a.it) - tierRank(b.it); });
      list = scored.map(function (x) { return x.it; });
    }
    state._recoCache = { sig: sig, items: items, list: list };
    return list;
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
    // 다운로드 버튼/뱃지(카탈로그·CC0·미보유). Claude 위임 큐로 요청.
    if (it.group === 'catalog' && it.safetyTier === 'cc0' && !isDownloaded(it, state)) {
      el.appendChild(downloadControl(it, state));
    }
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
    if (src) { var img = document.createElement('img'); img.alt = it.name; img.onerror = function () { img.replaceWith(placeholder(it)); }; lazyImg(img, src); wrap.appendChild(img); }
    else { wrap.appendChild(placeholder(it)); }
    if (it.notes) { var n = document.createElement('p'); n.className = 'big-notes muted small'; n.textContent = it.notes; wrap.appendChild(n); }
    return wrap;
  }

  // ── 다운로드(Claude 위임 큐) ────────────────────────────────────
  // 제출 엔드포인트와 같은 origin 을 쓴다(submitUrl 절대경로면 그 origin, 상대면 상대경로 그대로).
  function endpointUrl(state, path) {
    var su = (state._data && state._data.submitUrl) || '';
    if (/^https?:/.test(su)) { try { return new URL(path, su).href; } catch (e) {} }
    return path; // 상대경로 — 피커를 서빙한 origin 기준
  }
  function downloadControl(it, state) {
    var st = dlStatusOf(it, state);
    if (st && st !== 'failed') {
      // 요청됨/진행/완료 — 버튼 대신 상태 뱃지(비활성).
      var labels = { queued: '요청됨', downloading: '받는 중…', analyzing: '분석 중…', done: '분석 완료' };
      var b = document.createElement('span'); b.className = 'dl-state ' + st;
      b.textContent = labels[st] || '요청됨'; b.title = '채팅으로 돌아가면 Claude 가 처리합니다';
      return b;
    }
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dl-btn';
    btn.textContent = (st === 'failed' ? '다시 요청 ⬇' : '⬇ 다운로드');
    btn.addEventListener('click', function (e) { e.stopPropagation(); requestDownload(it, state, btn); });
    return btn;
  }
  function requestDownload(it, state, btn) {
    if (btn) { btn.disabled = true; }
    var payload = {
      packId: it.id, name: it.name, sourceId: it.sourceId, safetyTier: it.safetyTier,
      downloadUrl: it.downloadUrl || it.url || '', url: it.url || it.downloadUrl || ''
    };
    var url = endpointUrl(state, '/__sprite_picker_download_request');
    var done = false;
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    if (ctl) setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 3000);
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctl && ctl.signal })
      .then(function (r) { return r.json().catch(function () { throw new Error('bad'); }); })
      .then(function (res) {
        done = true;
        if (res && res.ok === false) { toast('받을 수 없는 항목이에요: ' + (res.error || '거부됨'), 3000, 'warn'); if (btn) btn.disabled = false; return; }
        state.dlStatus[it.id] = 'queued'; // 낙관적
        toast('받아서 분석할게요 — 채팅으로 돌아가세요', 4200, 'ok');
        renderBody(state._items, state);
      })
      .catch(function () {
        if (done) return;
        if (btn) btn.disabled = false;
        toast('자동 다운로드 요청은 서버가 필요해요 — 채팅에서 "' + it.name + ' 받아줘" 라고 해주세요', 6000, 'warn');
      });
  }
  // 부팅 시 큐 상태를 받아 카드 뱃지에 반영(비차단). 정적 서버면 조용히 무시.
  function fetchDownloads(state) {
    var url = endpointUrl(state, '/__sprite_picker_downloads');
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    if (ctl) setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 3000);
    fetch(url, { signal: ctl && ctl.signal })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (q) {
        if (!q || !Array.isArray(q.requests)) return;
        q.requests.forEach(function (req) { if (req && req.packId) state.dlStatus[req.packId] = req.status || 'queued'; });
        renderBody(state._items, state);
      })
      .catch(function () {}); // 엔드포인트 없음(정적) — 버튼은 클릭 시 안내 토스트.
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
    if (src) { var img = document.createElement('img'); img.className = 'thumb full'; img.alt = it.name; img.onerror = function () { img.replaceWith(placeholder(it)); }; lazyImg(img, src); el.appendChild(img); }
    else el.appendChild(placeholder(it));
    var check = document.createElement('div'); check.className = 'check'; check.textContent = '✓'; el.appendChild(check);
    var dl = document.createElement('span'); dl.className = 'dl-badge'; dl.textContent = '다운로드됨'; el.appendChild(dl);
    el.appendChild(metaEl(it));
    var actions = document.createElement('div'); actions.className = 'card-actions';
    if (isSheet(it)) {
      var fb = document.createElement('button'); fb.type = 'button'; fb.className = 'expand-btn';
      fb.textContent = '프레임 전체 보기 ▸';
      fb.addEventListener('click', function (e) { e.stopPropagation(); openFull(it, state); });
      actions.appendChild(fb);
    } else if (it.full) {
      var vb = document.createElement('button'); vb.type = 'button'; vb.className = 'expand-btn';
      vb.textContent = '전체 보기 ▸';
      vb.addEventListener('click', function (e) { e.stopPropagation(); openFull(it, state); });
      actions.appendChild(vb);
    }
    // 편집 — 시트/단일 모두 프레임·애니·이름을 다듬는 에디터 모달.
    if (it.full) {
      var eb = document.createElement('button'); eb.type = 'button'; eb.className = 'expand-btn edit';
      eb.textContent = '편집 ✎';
      eb.addEventListener('click', function (e) { e.stopPropagation(); openEditor(it, state); });
      actions.appendChild(eb);
    }
    if (actions.childNodes.length) el.appendChild(actions);
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
    if (src) { var img = document.createElement('img'); img.className = 'thumb'; img.alt = it.name; img.onerror = function () { img.replaceWith(placeholder(it)); }; lazyImg(img, src); return img; }
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
  // 프레임 인덱스 → 시트 내 사각 {x,y,w,h}. frames[] 있으면 그 영역, 없으면 frameConfig 그리드(margin/spacing 반영).
  // 그리드 시 img(또는 imgW/imgH) 로 열 수를 계산한다.
  function frameRect(it, frame, imgW, imgH) {
    if (hasFrames(it)) {
      var f = it.frames[frame];
      if (!f) return null;
      return { x: f.x || 0, y: f.y || 0, w: f.w || 0, h: f.h || 0 };
    }
    var fc = it.frameConfig || {};
    var fw = fc.frameWidth, fh = fc.frameHeight;
    if (!fw || !fh) return null;
    var mg = fc.margin || 0, sp = fc.spacing || 0;
    var cols = Math.max(1, Math.floor((imgW - mg + sp) / (fw + sp)));
    var c = frame % cols, r = Math.floor(frame / cols);
    return { x: mg + c * (fw + sp), y: mg + r * (fh + sp), w: fw, h: fh };
  }
  // 시트 총 프레임 수(frames[] 길이 또는 그리드 칸 수).
  function frameCount(it, imgW, imgH) {
    if (hasFrames(it)) return it.frames.length;
    var fc = it.frameConfig || {}; var fw = fc.frameWidth, fh = fc.frameHeight;
    if (!fw || !fh) return 0;
    var mg = fc.margin || 0, sp = fc.spacing || 0;
    var cols = Math.max(1, Math.floor((imgW - mg + sp) / (fw + sp)));
    var rows = Math.max(1, Math.floor((imgH - mg + sp) / (fh + sp)));
    return cols * rows;
  }
  function frameCanvas(it, frame) {
    var cv = document.createElement('canvas'); cv.className = 'thumb';
    if (it.style === 'pixel') cv.style.imageRendering = 'pixelated';
    // 공유 디코드 캐시 사용 — 같은 시트의 여러 프레임을 한 번만 디코드(이미 로드면 동기 슬라이스).
    loadImage(fullUrl(it), function (img) {
      var rect = frameRect(it, frame, img.width, img.height);
      if (!rect || !rect.w || !rect.h) return;
      cv.width = rect.w; cv.height = rect.h;
      try { cv.getContext('2d').drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h); } catch (e) {}
    });
    return cv;
  }

  // ── 풀뷰 라이트박스 ─────────────────────────────────────────────
  function bindLightbox(state) {
    var close = function () { cleanupEditor(); els.lightbox.hidden = true; document.getElementById('lightboxBody').innerHTML = ''; };
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
      // 시트 전체를 1회 디코드(공유 캐시) 후 각 프레임을 슬라이스 — 프레임당 재디코드 없음.
      loadImage(fullUrl(it), function (img) {
        var n = frameCount(it, img.width, img.height);
        var excl = {}; (it.excludedFrames || []).forEach(function (i) { excl[i] = true; });
        var grid = document.createElement('div'); grid.className = 'frame-grid';
        for (var fi = 0; fi < n; fi++) {
          if (excl[fi]) continue; // 제외 프레임은 그리지 않음
          var rect = frameRect(it, fi, img.width, img.height);
          if (!rect || !rect.w || !rect.h) continue;
          var cell = document.createElement('button'); cell.type = 'button'; cell.className = 'frame-cell';
          var cv = document.createElement('canvas'); cv.width = rect.w; cv.height = rect.h; cv.className = 'frame-canvas';
          if (it.style === 'pixel') cv.style.imageRendering = 'pixelated';
          try { cv.getContext('2d').drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h); } catch (e) {}
          cell.appendChild(cv);
          var nm = (hasFrames(it) && it.frames[fi] && it.frames[fi].name) ? it.frames[fi].name : ('#' + fi);
          var lab = document.createElement('span'); lab.className = 'frame-idx'; lab.textContent = nm; cell.appendChild(lab);
          (function (frame) { cell.addEventListener('click', function () { if (assignMode(state)) assignToActive(state, it, frame); else toggleSelect(state, it, frame); state._closeLightbox(); }); })(fi);
          grid.appendChild(cell);
        }
        body.appendChild(grid);
      }, function () { body.innerHTML = '<p class="muted">이미지를 불러오지 못했습니다: ' + fullUrl(it) + '</p>'; });
    } else {
      var big = document.createElement('img'); big.className = 'lightbox-img'; big.alt = it.name; big.src = fullUrl(it);
      if (it.style === 'pixel') big.style.imageRendering = 'pixelated';
      big.onerror = function () { body.innerHTML = '<p class="muted">이미지를 불러오지 못했습니다: ' + fullUrl(it) + '</p>'; };
      body.appendChild(big);
    }
  }

  // ── 에디터 모달(전부 canvas·무의존성) ───────────────────────────
  // 작업 사본(ed)에서 편집 → 저장 시에만 state·서버 반영(비파괴).
  //   ed: { it, img, scale, mode, frameConfig, frames[], excludedFrames[], anims[],
  //         name, sel(선택 인덱스), multi(Set 다중선택), drag, anim(미리보기 타이머) }
  function openEditor(it, state) {
    var lb = els.lightbox;
    var body = document.getElementById('lightboxBody'); var title = document.getElementById('lightboxTitle');
    title.textContent = '편집 — ' + it.name;
    body.innerHTML = '<p class="muted">이미지를 불러오는 중…</p>'; lb.hidden = false;
    // 공유 디코드 캐시 — 이미 본 시트면 재디코드 없이 즉시 에디터 진입.
    loadImage(fullUrl(it), function (img) {
      var ed = {
        it: it, img: img, state: state,
        // 깊은 복사(저장 전까지 원본 불변)
        frameConfig: it.frameConfig ? { frameWidth: it.frameConfig.frameWidth, frameHeight: it.frameConfig.frameHeight, margin: it.frameConfig.margin || 0, spacing: it.frameConfig.spacing || 0 } : null,
        frames: hasFrames(it) ? it.frames.map(function (f) { return { name: f.name || '', x: f.x || 0, y: f.y || 0, w: f.w || 0, h: f.h || 0 }; }) : null,
        excludedFrames: (it.excludedFrames || []).slice(),
        anims: (it.anims || []).map(function (a) { return { name: a.name, frames: (a.frames || []).slice(), frameRate: a.frameRate || 8, repeat: (a.repeat != null ? a.repeat : -1) }; }),
        name: it.name,
        mode: hasFrames(it) ? 'free' : (it.frameConfig ? 'grid' : 'free'),
        sel: -1, multi: [], drag: null, animTimer: null, animIdx: 0, animPlaying: null
      };
      buildEditorUI(ed, body, state);
    }, function () { body.innerHTML = '<p class="muted">이미지를 불러오지 못했습니다: ' + fullUrl(it) + '</p>'; });
  }

  // 작업 사본의 프레임 사각 계산(grid/free 모드 통합) — frameRect 와 동일 규칙이나 ed 기준.
  function edRect(ed, i) {
    if (ed.mode === 'free' && ed.frames) {
      var f = ed.frames[i]; if (!f) return null; return { x: f.x, y: f.y, w: f.w, h: f.h };
    }
    var fc = ed.frameConfig || {}; var fw = fc.frameWidth, fh = fc.frameHeight;
    if (!fw || !fh) return null;
    var mg = fc.margin || 0, sp = fc.spacing || 0;
    var cols = Math.max(1, Math.floor((ed.img.width - mg + sp) / (fw + sp)));
    var c = i % cols, r = Math.floor(i / cols);
    return { x: mg + c * (fw + sp), y: mg + r * (fh + sp), w: fw, h: fh };
  }
  function edCount(ed) {
    if (ed.mode === 'free' && ed.frames) return ed.frames.length;
    var fc = ed.frameConfig || {}; var fw = fc.frameWidth, fh = fc.frameHeight;
    if (!fw || !fh) return 0;
    var mg = fc.margin || 0, sp = fc.spacing || 0;
    var cols = Math.max(1, Math.floor((ed.img.width - mg + sp) / (fw + sp)));
    var rows = Math.max(1, Math.floor((ed.img.height - mg + sp) / (fh + sp)));
    return cols * rows;
  }
  function edFrameName(ed, i) {
    if (ed.mode === 'free' && ed.frames && ed.frames[i] && ed.frames[i].name) return ed.frames[i].name;
    return '#' + i;
  }

  function buildEditorUI(ed, body, state) {
    body.innerHTML = '';
    var wrap = document.createElement('div'); wrap.className = 'editor';

    // ── 좌: 캔버스 스테이지 ──
    var stage = document.createElement('div'); stage.className = 'ed-stage';
    var cw = document.createElement('div'); cw.className = 'ed-canvas-wrap';
    // 표시 배율: 너무 작은 시트는 확대, 큰 시트는 패널 폭에 맞춤.
    var maxW = 520;
    var scale = Math.max(1, Math.min(8, Math.floor(maxW / ed.img.width) || 1));
    if (ed.img.width * scale > maxW) scale = Math.max(1, maxW / ed.img.width);
    ed.scale = scale;
    var base = document.createElement('canvas'); base.className = 'ed-base';
    base.width = ed.img.width; base.height = ed.img.height;
    base.style.width = (ed.img.width * scale) + 'px'; base.style.height = (ed.img.height * scale) + 'px';
    if (ed.it.style === 'pixel') base.style.imageRendering = 'pixelated';
    base.getContext('2d').drawImage(ed.img, 0, 0);
    var overlay = document.createElement('canvas'); overlay.className = 'ed-overlay';
    overlay.width = ed.img.width * scale; overlay.height = ed.img.height * scale;
    overlay.style.width = (ed.img.width * scale) + 'px'; overlay.style.height = (ed.img.height * scale) + 'px';
    cw.appendChild(base); cw.appendChild(overlay);
    stage.appendChild(cw);
    var hint = document.createElement('p'); hint.className = 'muted small ed-hint'; stage.appendChild(hint);
    ed._overlay = overlay; ed._hint = hint;

    // ── 우: 컨트롤 패널 ──
    var panel = document.createElement('div'); panel.className = 'ed-panel';

    // 항목 이름
    panel.appendChild(edField('항목 이름', (function () {
      var inp = document.createElement('input'); inp.type = 'text'; inp.className = 'ed-input'; inp.value = ed.name;
      inp.addEventListener('input', function () { ed.name = inp.value; });
      return inp;
    })()));

    // 모드 전환(그리드 ↔ 자유 영역)
    var modeRow = document.createElement('div'); modeRow.className = 'ed-row';
    ['grid', 'free'].forEach(function (m) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'ed-tab' + (ed.mode === m ? ' on' : '');
      b.textContent = m === 'grid' ? '그리드' : '자유 영역';
      b.addEventListener('click', function () {
        if (m === 'free' && !ed.frames) ed.frames = gridToFrames(ed); // 그리드→자유 변환 시 현재 칸을 frames[] 로 구체화
        if (m === 'grid' && !ed.frameConfig) ed.frameConfig = { frameWidth: 16, frameHeight: 16, margin: 0, spacing: 0 };
        ed.mode = m; ed.sel = -1; ed.multi = [];
        buildEditorUI(ed, body, state);
      });
      modeRow.appendChild(b);
    });
    panel.appendChild(edLabeled('분해 방식', modeRow));

    if (ed.mode === 'grid') {
      var fc = ed.frameConfig || (ed.frameConfig = { frameWidth: 16, frameHeight: 16, margin: 0, spacing: 0 });
      var gridGrid = document.createElement('div'); gridGrid.className = 'ed-grid-fields';
      [['frameWidth', '폭'], ['frameHeight', '높이'], ['margin', '여백'], ['spacing', '간격']].forEach(function (pair) {
        var k = pair[0];
        var inp = document.createElement('input'); inp.type = 'number'; inp.min = (k === 'margin' || k === 'spacing') ? '0' : '1';
        inp.className = 'ed-input num'; inp.value = fc[k] || 0;
        inp.addEventListener('input', function () { fc[k] = Math.max(0, parseInt(inp.value, 10) || 0); drawOverlay(ed); });
        gridGrid.appendChild(edLabeled(pair[1], inp));
      });
      panel.appendChild(gridGrid);
      var et = document.createElement('p'); et.className = 'muted small'; et.textContent = '칸을 클릭하면 빈 프레임으로 제외/포함 토글됩니다.'; panel.appendChild(et);
    } else {
      var ft = document.createElement('p'); ft.className = 'muted small';
      ft.textContent = '캔버스에서 드래그해 새 영역을 만들고, 영역을 클릭해 선택하세요.';
      panel.appendChild(ft);
    }

    // 선택 영역 편집(이름·삭제·병합)
    var selBox = document.createElement('div'); selBox.className = 'ed-selbox'; ed._selBox = selBox;
    panel.appendChild(selBox);

    // 애니메이션
    var animBox = document.createElement('div'); animBox.className = 'ed-animbox'; ed._animBox = animBox;
    panel.appendChild(animBox);

    // 저장 / 닫기
    var foot = document.createElement('div'); foot.className = 'ed-foot';
    var saveBtn = document.createElement('button'); saveBtn.type = 'button'; saveBtn.className = 'btn primary'; saveBtn.textContent = '저장';
    saveBtn.addEventListener('click', function () { saveEditor(ed, saveBtn); });
    var cancelBtn = document.createElement('button'); cancelBtn.type = 'button'; cancelBtn.className = 'btn ghost'; cancelBtn.textContent = '닫기';
    cancelBtn.addEventListener('click', function () { stopAnimPreview(ed); state._closeLightbox(); });
    foot.appendChild(cancelBtn); foot.appendChild(saveBtn);
    panel.appendChild(foot);

    wrap.appendChild(stage); wrap.appendChild(panel);
    body.appendChild(wrap);

    bindEditorCanvas(ed);
    renderSelBox(ed); renderAnimBox(ed);
    drawOverlay(ed);
    setEdHint(ed);
  }

  // 폼 헬퍼
  function edField(label, control) { return edLabeled(label, control); }
  function edLabeled(label, control) {
    var f = document.createElement('label'); f.className = 'ed-field';
    var s = document.createElement('span'); s.className = 'ed-flabel'; s.textContent = label; f.appendChild(s);
    f.appendChild(control); return f;
  }
  function setEdHint(ed) {
    var n = edCount(ed), nExcl = ed.excludedFrames.length, nAnim = ed.anims.length;
    ed._hint.textContent = '프레임 ' + n + (ed.mode === 'grid' && nExcl ? ' (제외 ' + nExcl + ')' : '') + ' · 애니 ' + nAnim +
      (ed.sel >= 0 ? ' · 선택 ' + edFrameName(ed, ed.sel) : '');
  }

  // 그리드 칸을 frames[] 로 구체화(자유 모드 진입용). 제외칸은 빼고, 이름은 인덱스로.
  function gridToFrames(ed) {
    var n = edCount(ed), excl = {}; ed.excludedFrames.forEach(function (i) { excl[i] = true; });
    var out = [];
    for (var i = 0; i < n; i++) { if (excl[i]) continue; var r = edRect(ed, i); if (r) out.push({ name: '', x: r.x, y: r.y, w: r.w, h: r.h }); }
    ed.excludedFrames = [];
    return out;
  }

  // 오버레이 렌더: 프레임 외곽선 + 인덱스 + 선택/제외/다중 표시.
  function drawOverlay(ed) {
    var ov = ed._overlay, x = ov.getContext('2d'), sc = ed.scale;
    x.clearRect(0, 0, ov.width, ov.height);
    var n = edCount(ed);
    var excl = {}; ed.excludedFrames.forEach(function (i) { excl[i] = true; });
    var multi = {}; ed.multi.forEach(function (i) { multi[i] = true; });
    for (var i = 0; i < n; i++) {
      var r = edRect(ed, i); if (!r) continue;
      var px = r.x * sc, py = r.y * sc, pw = r.w * sc, ph = r.h * sc;
      if (excl[i]) { x.fillStyle = 'rgba(255,107,107,.28)'; x.fillRect(px, py, pw, ph); }
      else if (multi[i]) { x.fillStyle = 'rgba(255,210,63,.22)'; x.fillRect(px, py, pw, ph); }
      x.lineWidth = (i === ed.sel) ? 2 : 1;
      x.strokeStyle = (i === ed.sel) ? '#5ad1ff' : (excl[i] ? 'rgba(255,107,107,.7)' : 'rgba(255,255,255,.35)');
      x.strokeRect(px + .5, py + .5, pw - 1, ph - 1);
      if (sc >= 2 && (r.w * sc) > 22) {
        x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(px + 1, py + 1, 16, 11);
        x.fillStyle = '#cfe'; x.font = '9px monospace'; x.textBaseline = 'top'; x.fillText(String(i), px + 2, py + 2);
      }
    }
    // 드래그 중 신규 영역 미리보기
    if (ed.drag && ed.drag.kind === 'new') {
      var d = ed.drag, nx = Math.min(d.x0, d.x1), ny = Math.min(d.y0, d.y1), nw = Math.abs(d.x1 - d.x0), nh = Math.abs(d.y1 - d.y0);
      x.strokeStyle = '#ffd23f'; x.lineWidth = 2; x.setLineDash([4, 3]);
      x.strokeRect(nx * sc + .5, ny * sc + .5, nw * sc, nh * sc); x.setLineDash([]);
    }
    setEdHint(ed);
  }

  // 캔버스 좌표(표시px) → 시트 픽셀 좌표.
  function edPos(ed, e) {
    var rect = ed._overlay.getBoundingClientRect();
    var x = (e.clientX - rect.left) / ed.scale, y = (e.clientY - rect.top) / ed.scale;
    return { x: Math.max(0, Math.min(ed.img.width, Math.round(x))), y: Math.max(0, Math.min(ed.img.height, Math.round(y))) };
  }
  function frameAt(ed, px, py) {
    var n = edCount(ed);
    for (var i = n - 1; i >= 0; i--) { var r = edRect(ed, i); if (r && px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return i; }
    return -1;
  }

  function bindEditorCanvas(ed) {
    var ov = ed._overlay;
    // 모드 전환 시 buildEditorUI 가 재호출되므로, 이전에 붙인 document 핸들러를 먼저 제거(누수 방지).
    detachEditorDocHandlers(ed);
    ov.addEventListener('mousedown', function (e) {
      e.preventDefault();
      var p = edPos(ed, e); var hit = frameAt(ed, p.x, p.y);
      if (ed.mode === 'grid') {
        // 그리드: 칸 클릭 = 제외 토글
        if (hit >= 0) { toggleExcluded(ed, hit); ed.sel = hit; drawOverlay(ed); renderSelBox(ed); }
        return;
      }
      // 자유: 기존 영역이면 선택+(모서리면 리사이즈/내부면 이동), 빈 곳이면 새 영역 드래그
      if (hit >= 0) {
        var r = edRect(ed, hit); var edge = nearEdge(p, r, 6 / ed.scale);
        if (e.shiftKey) { toggleMulti(ed, hit); drawOverlay(ed); renderSelBox(ed); renderAnimBox(ed); return; }
        ed.sel = hit;
        ed.drag = { kind: edge ? 'resize' : 'move', i: hit, edge: edge, sx: p.x, sy: p.y, orig: { x: r.x, y: r.y, w: r.w, h: r.h } };
      } else {
        ed.drag = { kind: 'new', x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        ed.sel = -1;
      }
      drawOverlay(ed); renderSelBox(ed);
    });
    document.addEventListener('mousemove', ed._mm = function (e) {
      if (!ed.drag) return;
      var p = edPos(ed, e); var d = ed.drag;
      if (d.kind === 'new') { d.x1 = p.x; d.y1 = p.y; }
      else if (d.kind === 'move') { var f = ed.frames[d.i]; f.x = clamp(d.orig.x + (p.x - d.sx), 0, ed.img.width - f.w); f.y = clamp(d.orig.y + (p.y - d.sy), 0, ed.img.height - f.h); }
      else if (d.kind === 'resize') { resizeFrame(ed.frames[d.i], d.orig, d.edge, p.x - d.sx, p.y - d.sy, ed.img.width, ed.img.height); }
      drawOverlay(ed);
    });
    document.addEventListener('mouseup', ed._mu = function () {
      if (!ed.drag) return; var d = ed.drag; ed.drag = null;
      if (d.kind === 'new') {
        var nx = Math.min(d.x0, d.x1), ny = Math.min(d.y0, d.y1), nw = Math.abs(d.x1 - d.x0), nh = Math.abs(d.y1 - d.y0);
        if (nw >= 2 && nh >= 2) { ed.frames.push({ name: '', x: nx, y: ny, w: nw, h: nh }); ed.sel = ed.frames.length - 1; }
      }
      drawOverlay(ed); renderSelBox(ed);
    });
    ov.style.cursor = (ed.mode === 'free') ? 'crosshair' : 'pointer';
    // 현재 ed 를 라이트박스 닫기 정리 대상으로 등록.
    _activeEditor = ed;
  }
  var _activeEditor = null;
  function detachEditorDocHandlers(ed) {
    if (ed && ed._mm) { document.removeEventListener('mousemove', ed._mm); ed._mm = null; }
    if (ed && ed._mu) { document.removeEventListener('mouseup', ed._mu); ed._mu = null; }
  }
  function cleanupEditor() {
    if (!_activeEditor) return;
    stopAnimPreview(_activeEditor); detachEditorDocHandlers(_activeEditor);
    _activeEditor = null;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function nearEdge(p, r, tol) {
    var rt = (Math.abs(p.x - (r.x + r.w)) <= tol), lf = (Math.abs(p.x - r.x) <= tol);
    var bt = (Math.abs(p.y - (r.y + r.h)) <= tol), tp = (Math.abs(p.y - r.y) <= tol);
    if (rt && bt) return 'se'; if (rt) return 'e'; if (bt) return 's'; if (lf) return 'w'; if (tp) return 'n';
    return null;
  }
  function resizeFrame(f, orig, edge, dx, dy, maxW, maxH) {
    if (edge.indexOf('e') !== -1) f.w = clamp(orig.w + dx, 1, maxW - orig.x);
    if (edge.indexOf('s') !== -1) f.h = clamp(orig.h + dy, 1, maxH - orig.y);
    if (edge.indexOf('w') !== -1) { var nx = clamp(orig.x + dx, 0, orig.x + orig.w - 1); f.x = nx; f.w = orig.x + orig.w - nx; }
    if (edge.indexOf('n') !== -1) { var ny = clamp(orig.y + dy, 0, orig.y + orig.h - 1); f.y = ny; f.h = orig.y + orig.h - ny; }
  }
  function toggleExcluded(ed, i) {
    var k = ed.excludedFrames.indexOf(i);
    if (k === -1) ed.excludedFrames.push(i); else ed.excludedFrames.splice(k, 1);
  }
  function toggleMulti(ed, i) {
    var k = ed.multi.indexOf(i);
    if (k === -1) ed.multi.push(i); else ed.multi.splice(k, 1);
    ed.multi.sort(function (a, b) { return a - b; });
  }

  // 선택 영역 편집 패널(이름·삭제·병합·다중선택 토글).
  function renderSelBox(ed) {
    var box = ed._selBox; box.innerHTML = '';
    var head = document.createElement('div'); head.className = 'ed-subhead'; head.textContent = '선택 프레임';
    box.appendChild(head);
    if (ed.sel < 0) { var m = document.createElement('p'); m.className = 'muted small'; m.textContent = '캔버스에서 프레임을 선택하세요.'; box.appendChild(m); return; }
    var i = ed.sel;
    // 자유 모드만 이름/삭제/병합 가능(그리드는 제외토글 위주)
    if (ed.mode === 'free' && ed.frames && ed.frames[i]) {
      var nameInp = document.createElement('input'); nameInp.type = 'text'; nameInp.className = 'ed-input'; nameInp.placeholder = '프레임 이름(예: idle_0)';
      nameInp.value = ed.frames[i].name || '';
      nameInp.addEventListener('input', function () { ed.frames[i].name = nameInp.value; });
      box.appendChild(edLabeled('이름', nameInp));
      var coords = document.createElement('p'); coords.className = 'muted small';
      var r = ed.frames[i]; coords.textContent = 'x' + r.x + ' y' + r.y + ' · ' + r.w + '×' + r.h; box.appendChild(coords);
      var row = document.createElement('div'); row.className = 'ed-row';
      var del = document.createElement('button'); del.type = 'button'; del.className = 'ed-btn danger'; del.textContent = '삭제';
      del.addEventListener('click', function () { ed.frames.splice(i, 1); ed.sel = -1; ed.multi = []; reindexAnims(ed, i); drawOverlay(ed); renderSelBox(ed); renderAnimBox(ed); });
      row.appendChild(del);
      var mtoggle = document.createElement('button'); mtoggle.type = 'button'; mtoggle.className = 'ed-btn';
      mtoggle.textContent = (ed.multi.indexOf(i) === -1) ? '다중선택 추가' : '다중선택 해제';
      mtoggle.addEventListener('click', function () { toggleMulti(ed, i); drawOverlay(ed); renderSelBox(ed); renderAnimBox(ed); });
      row.appendChild(mtoggle);
      box.appendChild(row);
      // 병합: 다중선택 2개 이상이면 bounding-box 로 합치기
      if (ed.multi.length >= 2) {
        var merge = document.createElement('button'); merge.type = 'button'; merge.className = 'ed-btn'; merge.textContent = '선택 ' + ed.multi.length + '개 병합';
        merge.addEventListener('click', function () { mergeFrames(ed); drawOverlay(ed); renderSelBox(ed); renderAnimBox(ed); });
        box.appendChild(merge);
      }
    } else {
      // 그리드 모드 선택칸 — 제외 토글만.
      var excluded = ed.excludedFrames.indexOf(i) !== -1;
      var p = document.createElement('p'); p.className = 'muted small'; p.textContent = '칸 #' + i + (excluded ? ' (제외됨)' : ''); box.appendChild(p);
      var tg = document.createElement('button'); tg.type = 'button'; tg.className = 'ed-btn'; tg.textContent = excluded ? '포함하기' : '빈 프레임으로 제외';
      tg.addEventListener('click', function () { toggleExcluded(ed, i); drawOverlay(ed); renderSelBox(ed); });
      box.appendChild(tg);
    }
  }
  function mergeFrames(ed) {
    var idx = ed.multi.slice().sort(function (a, b) { return b - a; }); // 큰 인덱스부터 제거
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, names = [];
    ed.multi.forEach(function (i) { var r = ed.frames[i]; if (!r) return; minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); if (r.name) names.push(r.name); });
    if (minX === Infinity) return;
    idx.forEach(function (i) { ed.frames.splice(i, 1); });
    ed.frames.push({ name: names[0] || '', x: minX, y: minY, w: maxX - minX, h: maxY - minY });
    ed.sel = ed.frames.length - 1; ed.multi = [];
    // 인덱스가 흐트러졌으므로 애니 참조는 사용자가 다시 잡도록 비움 경고는 생략(인덱스 기반 anims 는 깨질 수 있음).
  }
  // 프레임 삭제 시 그 인덱스를 참조하는 anims[] 보정(삭제분 제거, 큰 인덱스 -1).
  function reindexAnims(ed, removed) {
    ed.anims.forEach(function (a) {
      a.frames = a.frames.filter(function (f) { return f !== removed; }).map(function (f) { return f > removed ? f - 1 : f; });
    });
    ed.anims = ed.anims.filter(function (a) { return a.frames.length; });
  }

  // 애니 정의 패널: 다중선택 → 이름+frameRate → anims[] 추가. 각 애니 미리보기 재생.
  function renderAnimBox(ed) {
    var box = ed._animBox; box.innerHTML = '';
    var head = document.createElement('div'); head.className = 'ed-subhead'; head.textContent = '애니메이션';
    box.appendChild(head);
    // 신규 애니 추가 폼(다중선택 기반)
    var add = document.createElement('div'); add.className = 'ed-anim-add';
    var nameInp = document.createElement('input'); nameInp.type = 'text'; nameInp.className = 'ed-input'; nameInp.placeholder = '애니 이름(예: run)';
    var rateInp = document.createElement('input'); rateInp.type = 'number'; rateInp.className = 'ed-input num'; rateInp.min = '1'; rateInp.value = '10'; rateInp.title = 'frameRate';
    var addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.className = 'ed-btn';
    addBtn.textContent = ed.multi.length ? ('선택 ' + ed.multi.length + '프레임으로 추가') : '프레임 다중선택 필요';
    addBtn.disabled = !ed.multi.length;
    addBtn.addEventListener('click', function () {
      if (!ed.multi.length) return;
      var nm = (nameInp.value || '').trim() || ('anim_' + (ed.anims.length + 1));
      ed.anims.push({ name: nm, frames: ed.multi.slice(), frameRate: Math.max(1, parseInt(rateInp.value, 10) || 10), repeat: -1 });
      nameInp.value = ''; ed.multi = [];
      drawOverlay(ed); renderSelBox(ed); renderAnimBox(ed);
    });
    add.appendChild(nameInp); add.appendChild(rateInp); add.appendChild(addBtn);
    box.appendChild(add);
    var ht = document.createElement('p'); ht.className = 'muted small'; ht.textContent = 'Shift+클릭(자유) 또는 다중선택 버튼으로 프레임을 모은 뒤 추가하세요.'; box.appendChild(ht);

    ed.anims.forEach(function (a, ai) {
      var row = document.createElement('div'); row.className = 'ed-anim-row';
      var nm = document.createElement('input'); nm.type = 'text'; nm.className = 'ed-input mini'; nm.value = a.name;
      nm.addEventListener('input', function () { a.name = nm.value; });
      var info = document.createElement('span'); info.className = 'muted small'; info.textContent = '[' + a.frames.join(',') + '] @' + a.frameRate + 'fps';
      var play = document.createElement('button'); play.type = 'button'; play.className = 'ed-btn mini';
      play.textContent = (ed.animPlaying === ai) ? '■' : '▶';
      play.addEventListener('click', function () { if (ed.animPlaying === ai) stopAnimPreview(ed); else playAnimPreview(ed, ai); renderAnimBox(ed); });
      var del = document.createElement('button'); del.type = 'button'; del.className = 'ed-btn mini danger'; del.textContent = '✕';
      del.addEventListener('click', function () { if (ed.animPlaying === ai) stopAnimPreview(ed); ed.anims.splice(ai, 1); renderAnimBox(ed); });
      row.appendChild(nm); row.appendChild(info); row.appendChild(play); row.appendChild(del);
      box.appendChild(row);
    });

    // 미리보기 캔버스(재생 중일 때)
    if (ed.animPlaying != null) {
      var prev = document.createElement('canvas'); prev.className = 'ed-anim-prev'; if (ed.it.style === 'pixel') prev.style.imageRendering = 'pixelated';
      ed._animCanvas = prev; box.appendChild(prev);
    } else { ed._animCanvas = null; }
  }
  function playAnimPreview(ed, ai) {
    stopAnimPreview(ed);
    ed.animPlaying = ai; ed.animIdx = 0;
    renderAnimBox(ed); // 캔버스 생성
    var a = ed.anims[ai]; if (!a || !a.frames.length) return;
    var draw = function () {
      var cvs = ed._animCanvas; if (!cvs) return;
      var fi = a.frames[ed.animIdx % a.frames.length];
      var r = edRect(ed, fi); if (!r) return;
      var disp = Math.max(1, Math.min(6, Math.floor(96 / Math.max(r.w, r.h)) || 1));
      cvs.width = r.w; cvs.height = r.h; cvs.style.width = (r.w * disp) + 'px'; cvs.style.height = (r.h * disp) + 'px';
      try { cvs.getContext('2d').clearRect(0, 0, r.w, r.h); cvs.getContext('2d').drawImage(ed.img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); } catch (e) {}
      ed.animIdx++;
    };
    draw();
    ed.animTimer = setInterval(draw, 1000 / Math.max(1, a.frameRate));
  }
  function stopAnimPreview(ed) {
    if (ed.animTimer) { clearInterval(ed.animTimer); ed.animTimer = null; }
    ed.animPlaying = null;
  }

  // 저장 — patch 를 서버에 POST. 성공 시 working item·state 갱신·재렌더.
  function saveEditor(ed, btn) {
    stopAnimPreview(ed);
    var patch = { name: ed.name };
    if (ed.mode === 'grid') {
      patch.frameConfig = ed.frameConfig;
      patch.frames = null; // 그리드 모드는 frames 비움(grid 우선 규칙은 frames 가 null 일 때)
      patch.excludedFrames = ed.excludedFrames.slice();
    } else {
      patch.frames = (ed.frames || []).map(function (f) { return { name: f.name || '', x: f.x, y: f.y, w: f.w, h: f.h }; });
      patch.excludedFrames = [];
    }
    patch.anims = ed.anims.map(function (a) { return { name: a.name, frames: a.frames.slice(), frameRate: a.frameRate, repeat: (a.repeat != null ? a.repeat : -1) }; });

    var apply = function () {
      // working state 의 항목에 반영(저장 성공/폴백 공통).
      var it = ed.it;
      it.name = patch.name; it.frameConfig = patch.frameConfig != null ? patch.frameConfig : it.frameConfig;
      it.frames = patch.frames; it.excludedFrames = patch.excludedFrames; it.anims = patch.anims;
      ed.state._recoCache = null;   // 이름 변경이 점수에 반영되도록 추천 캐시 무효화
      renderBody(ed.state._items, ed.state);
      if (assignMode(ed.state)) renderSlots(ed.state);
    };

    if (btn) btn.disabled = true;
    var url = endpointUrl(ed.state, '/__sprite_picker_library_edit');
    var body = JSON.stringify({ id: ed.it.id, patch: patch }), done = false;
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    if (ctl) setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 3000);
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, signal: ctl && ctl.signal })
      .then(function (r) { return r.json().catch(function () { throw new Error('bad'); }); })
      .then(function (res) {
        done = true; if (btn) btn.disabled = false;
        if (res && res.ok === false) { toast('저장 실패: ' + (res.error || '서버 오류'), 3000, 'warn'); return; }
        apply(); ed.state._closeLightbox();
        toast('✅ 편집 저장됨', 2400, 'ok');
      })
      .catch(function () {
        if (done) return; if (btn) btn.disabled = false;
        // 정적 서버: 서버 저장 불가 → 메모리에만 반영하고 안내.
        apply(); ed.state._closeLightbox();
        toast('서버에 저장하지 못해 화면에만 반영했어요(정적 서버) — 채팅으로 편집 내용을 전달해 주세요', 6000, 'warn');
      });
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
    if (it.group === 'library') {
      o.full = it.full;
      if (it.frameConfig) o.frameConfig = it.frameConfig;
      if (it.frames && it.frames.length) o.frames = it.frames;
      if (it.anims && it.anims.length) o.anims = it.anims;
      if (it.excludedFrames && it.excludedFrames.length) o.excludedFrames = it.excludedFrames;
      if (it.sourcePackId) o.sourcePackId = it.sourcePackId;
    }
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
