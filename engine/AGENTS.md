<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-13 (BoardKit) -->

# engine/

## Purpose
생성 게임이 `<script>`로 로드하는 **재사용 엔진 라이브러리**다. vendored Phaser 4를 토대로, 외부 파일 0·CC0/IP-safe 정체성을 지키는 절차적 그래픽/사운드 생성기, 모바일 웹뷰 하니스, Tiled 맵 로더, 그리고 Phaser 4 고급 기능을 한 줄 API로 감싼 선택적 킷 4종을 제공한다. 모든 모듈은 `(function(global){ ... })(window)` IIFE로 전역 네임스페이스(`PixelForge`, `ChipAudio` 등)에 노출되는 **브라우저용 ES5 스타일**이며 빌드 단계가 없다.

## Key Files
| File | Description |
|------|-------------|
| `phaser.min.js` | **vendored Phaser 4.1.0** (MIT, ~1.35MB). Matter.js 번들 포함. 직접 수정 금지 |
| `phaser.LICENSE.txt` | Phaser MIT 라이선스 원문 |
| `pixelforge.js` | **PixelForge** — 문자 그리드 프레임을 Phaser 텍스처로 굽는 절차적 NES풍 픽셀아트 생성기. 라가드 행 자동 패딩. `pixelArt:true` |
| `vectorforge.js` | **VectorForge** — PixelForge의 비-픽셀 짝꿍. 그라데이션·글로우·소프트섀도우·곡선 캐릭터를 supersample 다운샘플로 생성. `pixelArt:false, antialias:true` |
| `audio.js` | **ChipAudio** — Web Audio API만으로 8비트 효과음 + 오리지널 BGM 합성. 파일 0. `unlock()`을 첫 제스처에서 호출(모바일 오디오 언락) |
| `soundforge.js` | **SoundForge** (선택) — Tone.js 래퍼. ADSR·필터·슈퍼소우·FM·노이즈 퍼커션·절차 리버브·적응형 레이어드 BGM. ChipAudio와 동일 인터페이스(`unlock/startBgm/sfx`) → `sound-architect` |
| `tone.js` | **vendored Tone.js v15** (MIT). SoundForge 합성 토대. 직접 수정 금지 |
| `mobile.js` | **MobileHarness** — `scaleConfig()`(FIT+CENTER), `installDomGuards()`(iOS 줌/스크롤 차단), `TouchControls`(멀티터치 D-패드+점프 버튼 Scene) |
| `tiled.js` | **TiledForge** — Tiled `.tmj` 로더/베이커. `bakeTileset()`이 절차 타일셋 아틀라스를 굽고, `loadTiledMap()`이 충돌·오브젝트 스포너·iso/hex·GPU 레이어·라이선스 게이트를 처리 |
| `rngforge.js` | **RngForge** — 시드 결정론 난수 인프라. `create(seed)`가 mulberry32 난수기(callable, `Math.random()` 드롭인)를 만들고 `int/pick/shuffle/weighted`·멀티스트림(`stream(name)`)·직렬화(`state()/setState()`)를 제공. 게임 내 모든 무작위는 이걸로만 — 헤드리스 결정 검증의 "나머지 절반". Node require 가능. 검증: `wgf-game-qa/tools/lint-rng.mjs` → `game-qa` |
| `abilitykit.js` | **AbilityKit** (선택) — `abilities.json` 로드해 능력의 쿨다운·자원(마나/스태미나)·충전·콤보 윈도·능력 게이트·스킬트리 해금을 굴리는 데이터 구동 런타임. 효과 내용은 게임이 `onActivate`에서 실행(타이밍/자원만 킷이 관리). `AbilityKit.attach(scene,spec)`·`tick(dt)` 결정론(Node 헤드리스 검증 가능) → `ability-architect` |
| `fsm.js` | **FSM** — 결정론 유한상태머신. `addState(name,{enter,update,exit})`·명시 전이 `to(name)`·규칙 전이 `when(from,to,cond)`(`*`=전역)·`current()`·`update(dt,ctx)` 단일 진입점. dt 구동·무작위는 RngForge 주입(Math.random 금지)·`update`에 NaN/Infinity 가드 → 같은 시드+같은 dt 시퀀스 = 동일 상태 궤적. **`FSM.forAbility(ability)`** 가 AbilityKit 의 `cast→active→recovery→idle`(초 단위) 페이즈를 dt 로 자동 소비(페이즈 콜백·`startAbility()`·`cancel()`). Node require 가능. 검증: `wgf-game-qa/tools/test-fsm.mjs`(41 checks) |
| `matterkit.js` | **MatterKit** (선택 킷) — Matter.js 래퍼. config·바디 팩토리·상자 스택·슬링샷. Arcade로 못 하는 강체 물리 → `matter-physics` |
| `screenfx.js` | **ScreenFX** (선택 킷) — v4 Filter 포스트FX(블룸·비네트·CRT·글로우·컬러그레이딩). WebGL 전용, Canvas면 no-op → `screen-fx` |
| `juicekit.js` | **JuiceKit** (선택 킷) — 게임필 런타임. trauma^2 스크린셰이크(Eiserloh)·파티클 버스트·히트스톱(freeze)·트윈/이징을 `update(dt)` 한 진입점으로 결정론적으로 굴린다. 모든 무작위는 RngForge 주입 → 헤드리스 검증 가능. 렌더링 안 함(`getShake()`/`forEachParticle()`로 값만 제공). ScreenFX(포스트FX)와 역할 분리 → `juice-fx` |
| `lightingkit.js` | **LightingKit** (선택 킷) — PointLight 발광·Simplex 안개·Gradient 밤하늘·앰비언트 어둠. WebGL 전용 → `lighting-mood` |
| `pathkit.js` | **PathKit** (선택 킷) — Curves/Path/PathFollower 래퍼. 스플라인 패트롤·방사 탄막·타워디펜스 크립 경로 → `path-motion` |
| `boardkit.js` | **BoardKit** (선택 킷) — 논리 보드 좌표계(cellToPixel/pixelToCell·범위 검사) + A* 그리드 길찾기. 장애물 회피·4/8방향·휴리스틱(manhattan/octile/euclidean/chebyshev)·셀 가중 비용·코너컷 방지. 결정론(open-set 동점은 f→h→삽입순 안정 타이브레이크, `Math.random()` 미사용) → 같은 입력 항상 같은 경로. 퍼즐·보드게임·타워디펜스용. Phaser 비의존 순수 로직(Node require·헤드리스 검증 가능). 검증: `wgf-game-qa/tools/test-boardkit.mjs`. **PathKit 과 구분**: PathKit=정해진 곡선 위를 따라가는 *연속 경로추종*(연출), BoardKit=막힌 칸을 피해 목적지까지 밟을 칸을 *계산*하는 논리 격자 길찾기 |
| `joystickkit.js` | **JoystickKit** (선택 킷) — 가상 조이스틱(아날로그/트윈스틱) 터치 컨트롤. 멀티터치 포인터→360° 방향+세기 벡터. 디지털 D-패드(MobileHarness)와 공존 → `virtual-joystick` |

## For AI Agents

### Working In This Directory
- **`phaser.min.js`는 절대 수정하지 않는다.** 버전 업그레이드 시 통째 교체 + `phaser.LICENSE.txt`·README 배지·`docs/설계.md` 동기화.
- 모든 엔진 모듈은 **빌드 없는 브라우저 전역 스크립트**다. ES 모듈/번들러/`import`를 도입하지 말 것 — 게임은 `<script src>`로 직접 로드한다.
- **선택 킷(matterkit·screenfx·lightingkit·pathkit·boardkit·joystickkit)은 선택적**이다. 미사용 게임에 부담 0 — 필요할 때만 `index.html`에 phaser 다음으로 추가한다(boardkit 은 순수 로직이라 phaser 없이도 동작).
- **입력 킷은 장르로 고른다.** 아날로그/트윈스틱은 `joystickkit.js`, 디지털 좌우+점프는 `mobile.js`의 `MobileHarness.TouchControls`. 둘은 독립이며 공존한다 — 플랫포머=D-패드, 탑다운/슈터/러너=조이스틱.
- WebGL 전용 킷(ScreenFX·LightingKit)은 Canvas 폴백에서 **graceful no-op(null 반환)** 계약을 반드시 유지한다.
- 새 절차 그래픽은 PixelForge(픽셀) 또는 VectorForge(스무스) 중 하나로. 외부 이미지 다운로드를 추가하지 않는다.
- 각 파일 상단 블록 주석에 사용 예제·주의사항(특히 Matter 단위·Path 호길이 보정·v4 Filter 합성)이 정리돼 있으니 수정 전 반드시 읽는다.

### Testing Requirements
- 게임에 로드해 부팅 콘솔 에러 0 확인 → `game-qa` 헤드리스 step 하니스로 결정적 검증.
- WebGL 킷은 WebGL 컨텍스트에서 검증(데모 `nocturne`이 4종 통합 검증 케이스).
- Tiled 변경은 `super-runner ?tiled=1`(절차 경로와 동치)·`tiled-topdown`·`tiled-iso`·`tiled-pack`로 회귀 확인.

### Common Patterns
```js
PixelForge.buildAll(scene);                  // 내장 스프라이트 + 애니 등록
VectorForge.bake(scene, 'orb', { w:24, h:24, draw:(ctx,w,h,t,VF)=>{ ... } });
audio.unlock();                              // 첫 제스처에서 모바일 오디오 언락
// Tiled: 절차 타일셋 → 맵 로드 → 충돌 연결
TiledForge.bakeTileset(this, tileDefs, { key:'forge-tiles', tileSize:16, columns:3 });
var res = TiledForge.loadTiledMap(this, 'map', { tilesetKey:'forge-tiles', spawners:{...} });
// FSM × AbilityKit: use()는 쿨다운·자원(즉발), FSM.forAbility 가 cast→active→recovery 시간을 소비
var dashPhase = FSM.forAbility(KIT.get('dash'), { onActive:function(c){ doDash(c.dir); } });
if (KIT.use('dash', { dir: facing }).ok) dashPhase.startAbility({ dir: facing });  // 입력에서 시동
// scene update: dashPhase.update(delta/1000, ctx);  피격 선딜 캔슬: dashPhase.cancel();
```

## Dependencies

### Internal
- 각 킷 파일은 대응 스킬과 1:1 — `engine/matterkit.js`↔`skills/wgf-matter-physics/`, `screenfx.js`↔`wgf-screen-fx/`, `lightingkit.js`↔`wgf-lighting-mood/`, `pathkit.js`↔`wgf-path-motion/`, `joystickkit.js`↔`wgf-virtual-joystick/`, `juicekit.js`↔`wgf-juice-fx/`. (`boardkit.js` 는 전용 스킬 없이 `wgf-puzzle-game`·보드게임 스캐폴드가 직접 소비한다.)
- 상세 API 계약: `skills/wgf-web-game-builder/reference/engine-api.md`.
- Tiled 저작 가이드: `skills/wgf-level-designer/reference/tiled/authoring.md`.

### External
- **Phaser 4.1.0** (vendored) — 모든 모듈의 런타임 토대.
- **Matter.js** — Phaser 4 번들. MatterKit이 `this.matter`로 접근.

<!-- MANUAL: -->
