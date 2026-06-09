/* ============================================================================
 * AbilityKit — 캐릭터 능력/스킬 시스템 런타임 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * `ability-architect` 디렉터 스킬이 설계한 games/<slug>/abilities.json 을 로드해
 * 능력의 **쿨다운·자원(마나/스태미나/에너지)·충전(charges)·콤보 윈도·능력 게이트·
 * 스킬트리 해금**을 굴리는 데이터 구동 런타임. soundforge.js 처럼 "스펙 → 실제 동작".
 *
 * 설계 분리 (중요):
 *  - AbilityKit = **기록·타이밍**만 한다(쿨다운 틱·자원 리젠·콤보 윈도·해금 상태·게이트).
 *  - 능력의 *내용*(대미지·발사체·이동·CC)은 게임이 onActivate 콜백에서 처리한다.
 *    → 효과를 코드에 하드코딩하지 않고 abilities.json(단일 진실)을 읽어 dispatch.
 *
 * 엔진 무관 코어 + 얇은 Phaser 어댑터:
 *  - 코어(생성·canUse·use·tick)는 window/Phaser 없이 Node 에서 그대로 돈다(헤드리스 검증).
 *  - AbilityKit.attach(scene, spec) 는 scene 'update' 에 tick(dt) 를 자동 훅(JoystickKit 패턴).
 *  - tick(dt) 는 결정론적(Date.now 미사용) → game-qa step 하니스로 결정적 검증 가능.
 *
 * abilities.json 계약(요약 — 정식 스펙은 skills/ability-architect/reference/ability-design/
 * consistency-tools.md): { meta, resources[], abilities[], tree?, gates?, sets?, balanceConfig }.
 *   ability: { id,name,kind,input,slot?, resource?,cost?, cooldown?,charges?, cast?,active?,recovery?,
 *              effect{}, scaling?, maxStacks?,cap?, tags[],role, grantsVerb?,unlocks?,requires[]?,
 *              combo?{from[],window,grants{}}, cooldownReset[]?, budget?, flavor?, visual{} }
 *
 * 사용(브라우저):
 *   // index.html: phaser 다음·game 이전  <script src="../../engine/abilitykit.js"></script>
 *   // Boot/Game create():
 *   var KIT = AbilityKit.attach(this, ABILITIES_SPEC, {
 *     onActivate: function (ab, ctx) { applyEffect(ab, ctx); },   // 게임이 효과 실행
 *     unlockedAtStart: ['dash']                                   // 시작 보유 능력
 *   });
 *   window.GAME_ABILITIES = KIT;
 *   // 입력에서:
 *   if (Phaser.Input.Keyboard.JustDown(keyJ)) KIT.use('dash', { dir: facing });
 *   // tick 은 attach 가 자동(씬 update). 수동이면 KIT.tick(dtSeconds).
 * ==========================================================================*/
(function (global) {
  'use strict';

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function arr(v) { return Array.isArray(v) ? v : []; }

  /* AbilityKit(spec, opts)
   *  spec : abilities.json 객체(파싱됨)
   *  opts : {
   *    onActivate(ability, ctx)    // 능력 발동 시(자원·쿨다운 통과 후) — 게임이 효과 실행
   *    onReject(id, reason, ctx)   // 발동 거부 시(쿨다운/자원부족/잠김)
   *    onResourceChange(id, cur, max)
   *    onCooldownStart(id, seconds)
   *    onUnlock(id)
   *    unlockedAtStart : [id...]   // 시작부터 보유한 능력(없으면 requires/tree 없는 능력 자동 보유)
   *  }
   */
  function AbilityKit(spec, opts) {
    if (!(this instanceof AbilityKit)) return new AbilityKit(spec, opts);
    this.spec = spec || {};
    this.opts = opts || {};
    this.time = 0;                 // 누적 초(결정론)
    this._cb = {};

    // 능력 인덱스
    this.byId = {};
    var abilities = arr(this.spec.abilities);
    for (var i = 0; i < abilities.length; i++) {
      var a = abilities[i];
      if (a && a.id != null) this.byId[a.id] = a;
    }

    // 자원 풀
    this.resources = {};
    var resDefs = arr(this.spec.resources);
    for (var r = 0; r < resDefs.length; r++) {
      var rd = resDefs[r];
      if (!rd || rd.id == null) continue;
      var max = num(rd.max, 100);
      this.resources[rd.id] = {
        def: rd,
        max: max,
        cur: rd.startFull === false ? num(rd.start, 0) : num(rd.start, max),
        sinceSpend: 1e9          // rechargeDelay 용(마지막 소비 이후 경과)
      };
    }

    // 쿨다운/충전 상태
    this.cd = {};                  // id -> 남은 쿨다운(초)
    this.charges = {};             // id -> 현재 충전 수
    this.lastUse = {};             // id -> 마지막 사용 시각(콤보 윈도)
    for (var k in this.byId) {
      if (!this.byId.hasOwnProperty(k)) continue;
      this.cd[k] = 0;
      var ch = num(this.byId[k].charges, 0);
      if (ch > 0) this.charges[k] = ch;
      this.lastUse[k] = -1e9;
    }

    // 해금 상태(능력 게이트 / 스킬트리)
    this.unlocked = {};
    this.learnedNodes = {};
    this.points = 0;
    // 스킬트리 start(루트) 노드는 처음부터 학습된 것으로 취급(선행 만족의 기준점)
    if (this.spec.tree && this.spec.tree.start) this.learnedNodes[this.spec.tree.start] = true;
    this._initUnlocks();

    // 콜백 등록
    var map = ['onActivate', 'onReject', 'onResourceChange', 'onCooldownStart', 'onUnlock'];
    for (var m = 0; m < map.length; m++) if (typeof this.opts[map[m]] === 'function') this._cb[map[m]] = this.opts[map[m]];
  }

  // 시작 보유 능력 결정: opts.unlockedAtStart 우선, 없으면 requires/tree 없는 능력 자동 보유.
  AbilityKit.prototype._initUnlocks = function () {
    var start = this.opts.unlockedAtStart;
    if (Array.isArray(start)) {
      for (var i = 0; i < start.length; i++) this.unlocked[start[i]] = true;
      return;
    }
    // 디폴트: requires 없고 tree 노드로 해금되지 않는 능력은 처음부터 보유(단순 게임 친화)
    var grantedByTree = {};
    var nodes = this.spec.tree && arr(this.spec.tree.nodes);
    if (nodes) for (var n = 0; n < nodes.length; n++) {
      var grants = arr(nodes[n].grants);
      for (var g = 0; g < grants.length; g++) grantedByTree[grants[g]] = true;
    }
    for (var id in this.byId) {
      if (!this.byId.hasOwnProperty(id)) continue;
      var ab = this.byId[id];
      var locked = (arr(ab.requires).length > 0) || grantedByTree[id] || ab.unlockedAtStart === false;
      if (!locked) this.unlocked[id] = true;
    }
  };

  // ── 이벤트 ──────────────────────────────────────────────────────────────
  AbilityKit.prototype.on = function (event, fn) { this._cb['on' + event[0].toUpperCase() + event.slice(1)] = fn; return this; };
  AbilityKit.prototype._emit = function (name) {
    var fn = this._cb[name];
    if (!fn) return;
    fn.apply(null, Array.prototype.slice.call(arguments, 1));
  };

  // ── 조회 ────────────────────────────────────────────────────────────────
  AbilityKit.prototype.get = function (id) { return this.byId[id] || null; };
  AbilityKit.prototype.isUnlocked = function (id) { return !!this.unlocked[id]; };
  AbilityKit.prototype.cooldownLeft = function (id) { return Math.max(0, this.cd[id] || 0); };
  AbilityKit.prototype.cooldownFrac = function (id) {
    var ab = this.byId[id]; if (!ab) return 0;
    var full = num(ab.cooldown, 0); if (full <= 0) return 0;
    return clamp((this.cd[id] || 0) / full, 0, 1);   // 1=막 시작, 0=준비
  };
  AbilityKit.prototype.chargesLeft = function (id) {
    var ab = this.byId[id]; if (!ab) return 0;
    if (num(ab.charges, 0) > 0) return this.charges[id] || 0;
    return this.isReady(id) ? 1 : 0;
  };
  AbilityKit.prototype.getResource = function (id) { var r = this.resources[id]; return r ? r.cur : 0; };
  AbilityKit.prototype.getResourceMax = function (id) { var r = this.resources[id]; return r ? r.max : 0; };

  // 콤보 윈도: 이 능력의 combo.from 중 하나가 window 초 안에 사용됐나
  AbilityKit.prototype.inComboWindow = function (id) {
    var ab = this.byId[id];
    if (!ab || !ab.combo) return false;
    var win = num(ab.combo.window, 0);
    var from = arr(ab.combo.from);
    for (var i = 0; i < from.length; i++) {
      var t = this.lastUse[from[i]];
      if (t != null && (this.time - t) <= win) return true;
    }
    return false;
  };

  // ── 사용 가능 판정 ──────────────────────────────────────────────────────
  // → { ok:bool, reason:'locked'|'cooldown'|'resource'|'ok' }
  AbilityKit.prototype.canUse = function (id) {
    var ab = this.byId[id];
    if (!ab) return { ok: false, reason: 'unknown' };
    if (!this.isUnlocked(id)) return { ok: false, reason: 'locked' };
    if (!this.isReady(id)) return { ok: false, reason: 'cooldown' };
    if (ab.resource && ab.cost) {
      var rr = this.resources[ab.resource];
      if (rr && rr.cur < num(ab.cost, 0)) return { ok: false, reason: 'resource' };
    }
    return { ok: true, reason: 'ok' };
  };

  AbilityKit.prototype.isReady = function (id) {
    var ab = this.byId[id]; if (!ab) return false;
    if (num(ab.charges, 0) > 0) return (this.charges[id] || 0) >= 1;
    return (this.cd[id] || 0) <= 0;
  };

  // ── 발동 ────────────────────────────────────────────────────────────────
  // ctx 는 게임이 onActivate 로 받는 임의 컨텍스트(방향·표적 등). 반환: {ok,reason,ability,effect}
  AbilityKit.prototype.use = function (id, ctx) {
    var chk = this.canUse(id);
    if (!chk.ok) { this._emit('onReject', id, chk.reason, ctx); return { ok: false, reason: chk.reason }; }
    var ab = this.byId[id];

    // 자원 소비
    if (ab.resource && ab.cost) {
      var rr = this.resources[ab.resource];
      if (rr) { rr.cur = clamp(rr.cur - num(ab.cost, 0), 0, rr.max); rr.sinceSpend = 0; this._emit('onResourceChange', ab.resource, rr.cur, rr.max); }
    }
    // 쿨다운/충전 소비
    if (num(ab.charges, 0) > 0) {
      this.charges[id] = Math.max(0, (this.charges[id] || 0) - 1);
      if ((this.cd[id] || 0) <= 0) this.cd[id] = num(ab.cooldown, 0);   // 충전 회복 타이머 시작
    } else if (num(ab.cooldown, 0) > 0) {
      this.cd[id] = num(ab.cooldown, 0);
      this._emit('onCooldownStart', id, this.cd[id]);
    }

    // 콤보: 이 사용이 combo.grants 를 주면(콤보 윈도 안일 때) 자원 환급/보상
    var comboHit = this.inComboWindow(id);
    if (comboHit && ab.combo && ab.combo.grants) {
      for (var gid in ab.combo.grants) {
        if (!ab.combo.grants.hasOwnProperty(gid)) continue;
        var gr = this.resources[gid];
        if (gr) { gr.cur = clamp(gr.cur + num(ab.combo.grants[gid], 0), 0, gr.max); this._emit('onResourceChange', gid, gr.cur, gr.max); }
      }
    }
    // cooldownReset: 이 능력 사용이 다른 능력의 쿨다운을 리셋(설계자 의도 — 콤보 루프, 캡은 검증기가 점검)
    var resets = arr(ab.cooldownReset);
    for (var ri = 0; ri < resets.length; ri++) if (this.cd[resets[ri]] != null) this.cd[resets[ri]] = 0;

    this.lastUse[id] = this.time;
    var effect = ab.effect || {};
    this._emit('onActivate', ab, ctx);
    return { ok: true, reason: 'ok', ability: ab, effect: effect, combo: comboHit };
  };

  // ── 매 프레임 진행(초 단위 dt) ───────────────────────────────────────────
  AbilityKit.prototype.tick = function (dt) {
    dt = num(dt, 0);
    if (dt <= 0) return;
    this.time += dt;

    // 쿨다운 감소 + 충전 회복
    for (var id in this.cd) {
      if (!this.cd.hasOwnProperty(id)) continue;
      if (this.cd[id] > 0) {
        var was = this.cd[id];
        this.cd[id] = Math.max(0, this.cd[id] - dt);
        var ab = this.byId[id];
        // 충전형: 쿨다운이 0이 되면 충전 +1, 아직 최대 미만이면 다음 충전 타이머 재시작
        if (ab && num(ab.charges, 0) > 0 && was > 0 && this.cd[id] === 0) {
          this.charges[id] = Math.min(num(ab.charges, 0), (this.charges[id] || 0) + 1);
          if (this.charges[id] < num(ab.charges, 0)) this.cd[id] = num(ab.cooldown, 0);
        }
      }
    }

    // 자원 리젠(rechargeDelay 경과 후)
    for (var rid in this.resources) {
      if (!this.resources.hasOwnProperty(rid)) continue;
      var r = this.resources[rid];
      r.sinceSpend += dt;
      var delay = num(r.def.rechargeDelay, 0);
      var regen = num(r.def.regen, 0);
      if (regen > 0 && r.cur < r.max && r.sinceSpend >= delay) {
        var before = r.cur;
        r.cur = clamp(r.cur + regen * dt, 0, r.max);
        if (r.cur !== before) this._emit('onResourceChange', rid, r.cur, r.max);
      }
    }
  };

  // ── 해금 / 스킬트리 ──────────────────────────────────────────────────────
  AbilityKit.prototype.unlock = function (id) {
    if (this.unlocked[id]) return false;
    this.unlocked[id] = true;
    var ab = this.byId[id];
    if (ab && num(ab.charges, 0) > 0) this.charges[id] = num(ab.charges, 0); // 충전 채워서 해금
    this._emit('onUnlock', id);
    return true;
  };
  AbilityKit.prototype.addPoints = function (n) { this.points += num(n, 0); return this.points; };

  // 스킬트리 노드 학습: 포인트·선행(requires) 충족 시 노드의 grants 능력을 해금
  AbilityKit.prototype.learn = function (nodeId) {
    var tree = this.spec.tree;
    if (!tree) return { ok: false, reason: 'no-tree' };
    var nodes = arr(tree.nodes);
    var node = null;
    for (var i = 0; i < nodes.length; i++) if (nodes[i].id === nodeId) { node = nodes[i]; break; }
    if (!node) return { ok: false, reason: 'unknown-node' };
    if (this.learnedNodes[nodeId]) return { ok: false, reason: 'already' };
    var cost = num(node.cost, 1);
    if (this.points < cost) return { ok: false, reason: 'points' };
    // 선행 노드(edges.requires 또는 node.requires)
    var reqs = arr(node.requires);
    for (var e = 0; e < arr(tree.edges).length; e++) {
      var ed = tree.edges[e];
      if (ed.to === nodeId) reqs = reqs.concat(arr(ed.requires));
    }
    for (var rq = 0; rq < reqs.length; rq++) if (!this.learnedNodes[reqs[rq]]) return { ok: false, reason: 'prereq', need: reqs[rq] };

    this.points -= cost;
    this.learnedNodes[nodeId] = true;
    var grants = arr(node.grants);
    for (var gg = 0; gg < grants.length; gg++) this.unlock(grants[gg]);
    return { ok: true, reason: 'ok', granted: grants };
  };

  // 직렬화(localStorage 영속) — 진행/해금/포인트만(쿨다운·자원은 런 휘발이 자연스러움)
  AbilityKit.prototype.serialize = function () {
    return { unlocked: this.unlocked, learnedNodes: this.learnedNodes, points: this.points };
  };
  AbilityKit.prototype.restore = function (data) {
    if (!data) return this;
    if (data.unlocked) this.unlocked = data.unlocked;
    if (data.learnedNodes) this.learnedNodes = data.learnedNodes;
    if (typeof data.points === 'number') this.points = data.points;
    return this;
  };

  /* AbilityKit.attach(scene, spec, opts) → kit
   *  Phaser 씬 'update' 에 tick(dt) 를 자동 훅(delta ms → 초). game.step() 시에도 발화.
   *  씬 shutdown 에서 자동 해제.
   */
  AbilityKit.attach = function (scene, spec, opts) {
    var kit = new AbilityKit(spec, opts);
    kit._scene = scene;
    kit._updateFn = function (time, delta) { kit.tick((delta || 0) / 1000); };
    scene.events.on('update', kit._updateFn);
    scene.events.once('shutdown', function () {
      scene.events.off('update', kit._updateFn);
    });
    return kit;
  };

  global.AbilityKit = AbilityKit;
  if (typeof module !== 'undefined' && module.exports) module.exports = AbilityKit;
})(typeof window !== 'undefined' ? window : this);
