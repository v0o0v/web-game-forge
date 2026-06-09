---
name: virtual-joystick
description: "모바일 가상 조이스틱(아날로그 스틱)을 붙인다 — 360° 방향+세기 이동, 트윈스틱(이동+조준) 슈터, 플로팅/고정 스틱, 멀티터치. 탑다운·트윈스틱·러너처럼 아날로그 입력이 필요할 때. 디지털 D-패드(좌우+점프)는 MobileHarness 를 쓰고 이 킷과 공존한다. 키워드: 가상조이스틱, 조이스틱, virtual joystick, joystick, 트윈스틱, twin-stick, twin stick shooter, 아날로그 스틱, analog stick, 터치 컨트롤, touch control, 모바일 컨트롤, 조준 스틱, 360도 이동, 플로팅 조이스틱"
allowed-tools: Read, Write, Edit, Bash
---

# virtual-joystick — 가상 조이스틱(아날로그/트윈스틱) 터치 컨트롤

JoystickKit(`engine/joystickkit.js`)으로 Phaser 4 멀티터치 포인터를 읽어 **360° 방향 + 세기(force)** 벡터를 만든다. web-game-builder의 전문 스킬. 탑다운·트윈스틱 슈터·러너처럼 아날로그 입력이 어울리는 장르를 연다.

> **D-패드와 공존.** 플랫포머의 좌/우/점프 같은 **디지털** 입력은 기존 `MobileHarness.TouchControls`(이진 left/right/up)를 그대로 쓴다. 가변 방향·가변 세기가 필요할 때만 이 킷을 얹는다 — 둘은 서로 독립이며 장르에 맞게 고른다.

## 언제 사용
- 탑다운 게임에서 360° 아날로그 이동이 필요할 때(걷는 세기까지 반영)
- 트윈스틱 슈터: 좌스틱 이동 + 우스틱 조준/발사
- 러너·레이싱에서 가변 조향이 필요할 때
- 플로팅 조이스틱(엄지를 댄 곳에 스틱 생성)을 원할 때
- 모바일 웹뷰에서 키보드 없이 아날로그 컨트롤이 필요할 때

(디지털 4/8방향만 필요하면 `mobile-webview-tune`/`game-ui-hud`의 D-패드를 쓴다.)

## 엔진 로드

```html
<!-- index.html — joystickkit.js는 phaser.min.js 뒤에 -->
<script src="../../engine/phaser.min.js"></script>
<script src="../../engine/joystickkit.js"></script>
```

JoystickKit은 `window.JoystickKit`으로 노출된다. **카메라가 스크롤/줌 되지 않는 씬(HUD/UI)**의 `create()`에서 생성한다(게임 씬에서 만들면 포인터 월드좌표와 베이스 화면좌표가 어긋난다).

---

## 핵심 API

### JoystickKit.create(scene, opts) → controller
스틱 컨트롤러를 만들어 매 프레임 자동 갱신(씬 `update` 이벤트 훅, `game.step()`에서도 발화)한다.

| opts 키 | 기본값 | 설명 |
|---|---|---|
| `twin` | false | 트윈스틱(이동+조준) 여부. false면 이동 스틱 1개 |
| `radius` | min(W,H)*0.16 | 스틱 반경(디자인 px) |
| `deadzone` | 0.16 | 이 세기 미만은 0으로(지터 방지), 바깥은 0~1 재정규화 |
| `show` | 터치 시 표시 | 시각 표시 여부 |
| `depth` | 1000 | 그래픽 depth |
| `autoUpdate` | true | 씬 update 자동 훅. false면 직접 `joy.update()` 호출 |
| `move` | (좌하단/플로팅) | 이동 스틱 설정(아래) |
| `aim` | (우하단/플로팅) | 조준 스틱 설정(twin일 때) |

스틱별 설정(`move`/`aim`): `{ mode:'floating'|'fixed', x, y, zone:'left'|'right'|'all'|{x,y,w,h}, color, fireThreshold }`
- `mode:'floating'` — 존 안을 처음 누른 지점에 베이스 생성(엄지 따라감). `'fixed'` — `x,y` 고정 베이스, 활성 반경 안만 잡음.
- `zone` — 어느 화면 영역의 터치를 이 스틱이 가져갈지. twin 기본은 move=`left`, aim=`right`.
- `fireThreshold`(aim) — 이 세기 이상이면 `state.fire=true`(기본 0.35).

### controller.state — 게임이 읽는 출력
```js
joy.state = {
  move: { x, y, angle, force, active },  // x,y ∈ [-1,1], angle=라디안, force ∈ [0,1]
  aim:  { x, y, angle, force, active },  // twin일 때만 갱신
  fire: false                            // aim.active && aim.force >= fireThreshold
}
```

```js
// 게임 씬 update()에서:
var m = joy.state.move;
player.setVelocity(m.x * SPEED, m.y * SPEED);     // 아날로그 이동(세기까지 반영)
if (joy.state.fire) shootToward(joy.state.aim.angle);
```

### controller.inject(spec) / clearInject()
포인터 없이 스틱 벡터를 **프로그램으로 주입**한다 — `game-qa` 헤드리스 step 하니스의 결정적 검증용.
```js
joy.inject({ move:{x:1,y:0}, aim:{x:0,y:-1, fire:true} }); // 우 이동 + 위 조준 발사
// ... game.step() 반복 후 상태 검증 ...
joy.clearInject();  // 실제 포인터 모드 복귀
```

### controller.setVisible(v) / destroy()
표시 토글 / 정리(그래픽 제거 + update 훅 해제). 씬 `shutdown` 시 자동 destroy.

### JoystickKit.SceneClass(opts) → Phaser.Scene 클래스
`MobileHarness.TouchControlsClass`처럼 **독립 최상단 씬**으로 쓰고 싶을 때. 인스턴스의 `.joy`로 컨트롤러 접근, `opts.onReady(joy)` 콜백 지원.

---

## 레시피

### ① 싱글 스틱 아날로그 이동 (탑다운)

```js
// HUD/UI 씬 create()
var joy = JoystickKit.create(this, { twin: false });   // 이동 스틱 1개(화면 전체 플로팅)
window.MyGame.joy = joy;

// 게임 씬 update()
var m = JOY.state.move;
if (m.active && m.force > 0) {
  player.setVelocity(m.x * SPEED, m.y * SPEED);  // force가 작으면 살살 걷기
} else {
  player.setVelocity(0, 0);
}
```

### ② 트윈스틱 슈터 (이동 + 조준/발사)

데모: `games/tiled-topdown/index.html?stick=1` (GEM DUNGEON 트윈스틱 모드 — 좌스틱 이동, 우스틱 조준·마법볼트 발사).

```js
// HUD 씬 create()
var joy = JoystickKit.create(this, { twin: true });   // 좌:이동 / 우:조준

// 게임 씬 update()
var m = joy.state.move, a = joy.state.aim;
player.setVelocity(m.x * SPEED, m.y * SPEED);
if (joy.state.fire && fireCd <= 0) {
  fireBolt(a.angle);            // 조준 각도로 발사
  fireCd = 11;                  // 프레임 단위 쿨다운(헤드리스 결정성)
}
```

> 발사 쿨다운은 `this.time.now` 대신 **프레임 카운터**로 두면 `game.step()` 헤드리스 검증에서 결정적이다.

### ③ 고정 위치 스틱

```js
var joy = JoystickKit.create(this, {
  move: { mode: 'fixed', x: 70, y: H - 70 },        // 좌하단 고정
  twin: true,
  aim:  { mode: 'fixed', x: W - 70, y: H - 70 }     // 우하단 고정
});
```

### ④ 디지털 D-패드와 장르별 공존

```js
// 같은 게임 엔진에서 장르에 따라 컨트롤을 고른다
if (genre === 'platformer') {
  // 디지털: 좌/우/점프 — 기존 MobileHarness
  var TC = MobileHarness.TouchControlsClass(W, H, GAME_INPUT);
  this.scene.add('TouchControls', TC, false); this.scene.launch('TouchControls');
} else { // topdown / shooter / runner
  JOY = JoystickKit.create(this, { twin: genre === 'shooter' });
}
```

---

## 헤드리스 검증 (game-qa 연계)

```js
var joy = window.MyGame.joy, g = window.MyGame.game;
var FRAME = 1000/60, t = 0; function step(n){ for(var i=0;i<n;i++){ g.step(t,FRAME); t+=FRAME; } }

// 이동 검증
var x0 = scene.player.x;
joy.inject({ move:{x:1,y:0} }); step(30);
console.assert(scene.player.x > x0, '아날로그 우이동 실패');

// 발사 검증
joy.inject({ move:{x:0,y:0}, aim:{x:1,y:0, fire:true} }); step(1);
var bolt = scene.bolts.getChildren()[0];
console.assert(bolt && bolt.body.velocity.x > 0, '조준 발사 방향 실패');
joy.clearInject();
```

---

## Phaser 4 레퍼런스 라우팅
- 입력·포인터·멀티터치: [`reference/phaser/input.md`](../web-game-builder/reference/phaser/input.md)
- 씬 라이프사이클(update/shutdown 이벤트): [`reference/phaser/scenes.md`](../web-game-builder/reference/phaser/scenes.md)
- Graphics 렌더링(스틱 베이스/썸): [`reference/phaser/graphics-and-shapes.md`](../web-game-builder/reference/phaser/graphics-and-shapes.md)
- 전체 색인: [`reference/phaser/INDEX.md`](../web-game-builder/reference/phaser/INDEX.md)

---

## Gotcha

1. **HUD/UI 씬에서 생성한다.** 카메라가 플레이어를 따라가는(스크롤/줌) 게임 씬에서 만들면 포인터 좌표(월드)와 베이스 좌표(스크롤0)가 어긋나 스틱이 엉뚱한 곳을 가리킨다.

2. **멀티터치는 `game.input.manager.pointers`.** 씬-로컬 `scene.input.pointers`가 아니라 InputManager 의 포인터 배열을 스틱별 id 로 바인딩한다(`game-qa` D-패드 버그 교훈과 동일). `create()`가 내부에서 `addPointer(3)`을 호출한다.

3. **마우스는 포인터 1개.** 데스크톱에선 한 번에 한 스틱만 구동된다 — 트윈을 마우스로 동시에 못 움직인다. 데스크톱/헤드리스 트윈 검증은 `inject()`로 한다.

4. **데드존 재정규화.** `force`는 데드존 바깥을 0~1로 다시 편다. 따라서 스틱을 살짝 밀면 0, 충분히 밀면 1까지 부드럽게 오른다. 게임 속도엔 `force`를 곱해 쓰면 가변 속도가 공짜다.

5. **`group.children.each`는 Phaser 4에 없다.** 볼트 등 그룹 순회·정리는 `group.getChildren()` 배열을 역순으로 돌며 `destroy()` 한다(순회 중 삭제 안전).

6. **발사 쿨다운은 프레임 카운터로.** `this.time.now` 기반 쿨다운은 헤드리스 `game.step()`에서 시간 누적에 의존해 흔들린다. 프레임 단위 카운터가 결정적이다.

---

## 연계 / 원칙
- web-game-builder 워크플로의 일부. JoystickKit 엔진 소스: `engine/joystickkit.js`.
- 동작 확인 데모: `games/tiled-topdown/index.html?stick=1` (GEM DUNGEON 트윈스틱 모드 — 기본 경로는 디지털 D-패드, `?stick=1`이면 트윈스틱). 헤드리스 step 하니스로 이동·조준·발사·명중 결정적 검증 통과.
- 공존: 디지털 입력은 [mobile-webview-tune](../mobile-webview-tune/SKILL.md)·[game-ui-hud](../game-ui-hud/SKILL.md)의 D-패드, 아날로그는 이 킷.
- 장르 연계: [topdown-shooter](../topdown-shooter/SKILL.md)(트윈스틱), [endless-runner](../endless-runner/SKILL.md)(가변 조향), [path-motion](../path-motion/SKILL.md)(탄막과 조합).
- IP-safe: 외부 에셋 0 — 스틱은 Graphics 로 그리고, 발사체는 절차 텍스처(PixelForge/VectorForge)와 함께 쓴다.
- 검증: [game-qa](../game-qa/SKILL.md) 헤드리스 step 하니스 + `joy.inject()`.
