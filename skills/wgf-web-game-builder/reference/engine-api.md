# 엔진 API 레퍼런스

`engine/` 의 3개 라이브러리 API. 게임 `game.js` 는 이들 + vendored Phaser 4(4.1.0) 만 쓴다.
로드 순서: `phaser.min.js` → `pixelforge.js` → `audio.js` → `mobile.js` → `game.js`.

---

## PixelForge — 절차적 픽셀아트 스프라이트 (`engine/pixelforge.js`)

문자 그리드를 Phaser CanvasTexture(가로 스트립)로 굽는다. 외부 이미지 0. CC0/IP-safe.

### `PixelForge.bake(scene, key, def)`
- `def.frames`: `["row","row",...]` 형태 프레임 배열. **행 길이를 맞출 필요 없음**(가장 긴 행
  기준으로 오른쪽이 투명으로 자동 패딩).
- `def.palette`(선택): `{ 문자: '#hex' }`. 생략 시 공유 팔레트 `PixelForge.PALETTE` 사용.
  `'.'` 와 `' '` 는 항상 투명.
- 반환: `{ key, frameWidth, frameHeight, frameCount }`.
- 같은 key 가 있으면 교체한다.

```js
PixelForge.bake(this, 'star', {
  palette: { '.': null, 'y': '#ffe23f', 'w': '#fff7c0' },
  frames: [
    [ "..y..", ".ywy.", "ywwwy", ".ywy.", "..y.." ],   // frame 0
    [ "..y..", "..y..", "yywyy", "..y..", "..y.." ]    // frame 1
  ]
});
this.add.sprite(x, y, 'star', 0);
```

### `PixelForge.buildAll(scene)`
내장 라이브러리 전체(hero, enemy, coin, ground, dirt, brick, qblock, pipeTop, pipeBody,
mushroom, flag, pole, cloud, hill, bush)를 등록하고 기본 애니메이션
(`hero-idle/run/jump`, `enemy-walk`, `coin-spin`, `qblock-pulse`)을 만든다.
반환: `{ key: {frameWidth,frameHeight,frameCount}, ... }` 매니페스트.

### `PixelForge.LIB`, `PixelForge.PALETTE`
내장 스프라이트 정의 / 공유 팔레트. 새 게임은 여기에 항목을 추가하거나 `bake` 로 별도 정의.

### 애니메이션 직접 정의
```js
scene.anims.create({
  key: 'star-spin',
  frames: [{ key: 'star', frame: 0 }, { key: 'star', frame: 1 }],
  frameRate: 8, repeat: -1
});
```

> 팁: 게임 config 에 `pixelArt: true, roundPixels: true` 를 켜면 확대 시 또렷한 픽셀.
> Phaser 4에서는 `roundPixels` 기본값이 **false**이므로 픽셀아트 게임은 반드시 명시적으로 `true`로 설정할 것.

---

## VectorForge — 절차적 스무스/벡터 그래픽 (`engine/vectorforge.js`)

PixelForge의 비-픽셀 짝꿍. 그라데이션·글로우·소프트섀도우·글래스질·곡선 캐릭터 같은 **미려한**
그래픽을 코드로 생성한다. 외부 0, CC0/IP-safe. drawFn을 슈퍼샘플(기본 3x) 후 고품질 다운샘플 →
부드러운 안티앨리어스 텍스처.

> ⚠ **렌더 스타일은 게임당 하나.** 스무스 게임은 `render: { pixelArt:false, antialias:true,
> roundPixels:false }`. 픽셀 게임은 `pixelArt:true`. 섞지 않는다.

### `VectorForge.buildAll(scene)`
내장 라이브러리 등록: `vf-hero`(카툰 마스코트 4프레임), `vf-coin`(글로시 4프레임), `vf-gem`,
`vf-orb`(네온 2프레임), `vf-platform`, `vf-cloud`, `vf-hill`, `vf-glass`, `vf-button` + 애니
(`vf-hero-idle/run/jump`, `vf-coin-spin`, `vf-orb-pulse`).

### `VectorForge.bake(scene, key, def)`
- `def = { w, h, ss?, draw|frames }`. `draw(ctx, w, h, frameIndex, VF)` 는 **논리 좌표**로 그린다.
- `frames: [fn, ...]` 다중 프레임. `ss`(기본 3) = 슈퍼샘플 배율.

```js
VectorForge.bake(this, 'orb', { w:24, h:24, draw:function(ctx,w,h,t,VF){
  VF.glow(ctx,'rgba(70,220,255,0.9)',9,function(){
    VF.circle(ctx,w/2,h/2,8);
    ctx.fillStyle = VF.radial(ctx,w/2,h/2,9,[[0,'#eaffff'],[0.4,'#66f0ff'],[1,'#2bb6e0']]);
    ctx.fill();
  });
}});
```

### 헬퍼 `VF` (drawFn 5번째 인자, `VectorForge.helpers`)
`rr`(둥근 사각형) · `circle`/`ellipse`/`poly`/`blob`/`star` · `lin`/`radial`(그라데이션) ·
`glow`(발광) · `shadow`(소프트 드롭섀도우) · `glass`(글래스모피즘 패널).
전체화면 배경: `VectorForge.gradientBackground(scene, key, w, h, stops)`.

### 외부 HD CC0 아트 로딩
절차적으로 부족하면 CC0 HD 아트 로딩. SVG는 임의 크기로 또렷: `this.load.svg(key,url,{width,height})`.
HD 래스터/아틀라스: `this.load.image/atlas`. `assets.json` 게이트로 CC0만 허용, `CREDITS.txt` 고지.

---

## ChipAudio — 절차적 8비트 사운드 (`engine/audio.js`)

Web Audio 만으로 효과음 + BGM 합성. 오디오 파일 0. CC0/IP-safe. **BGM 은 오리지널 멜로디만.**

```js
var audio = new ChipAudio();
window.GAME_AUDIO = audio;        // mobile.js 음소거 버튼이 참조

// 첫 사용자 제스처(touchend/click/Tap to start)에서:
audio.unlock();                   // suspended 컨텍스트 resume + iOS 무음버퍼 언락
audio.startBgm();                 // 루프 BGM 시작

audio.sfx('jump');                // 효과음
audio.stopBgm();
audio.suspend();                  // 화면이 가려지면 BGM 타이머 정지 + ctx suspend (모든 소리 멈춤)
audio.resume();                   // 복귀 시 ctx resume + 멈췄던 BGM 자동 재가동
audio.toggleMute();               // 반환: 현재 muted 여부
```

> 가시성 자동 처리: `MobileHarness.installDomGuards()` 가 `visibilitychange`(가려짐)·`pagehide` 에서
> 전역 `GAME_AUDIO.suspend()`, 복귀 시 `resume()` 를 자동 호출한다 → **탭이 가려지거나 페이지를
> 떠나면 소리가 멈추고**(서버를 내려도 무관), 돌아오면 BGM 이 재개된다.

내장 SFX 키: `jump, coin, stomp, bump, brick, powerup, sprout, die, flag, 1up`.
커스텀 톤: `audio.tone({ freq, dur, type:'square'|'triangle'|'sawtooth'|'sine', vol, to(슬라이드 목표 주파수), delay })`.

---

## MobileHarness — 모바일 웹뷰 대응 (`engine/mobile.js`)

### `MobileHarness.scaleConfig(width, height)`
Phaser `config.scale` 에 펼쳐 넣을 객체 반환(`Scale.FIT` + `CENTER_BOTH` + min/max).
```js
scale: Object.assign({ parent: 'game' }, MobileHarness.scaleConfig(384, 224))
```

### `MobileHarness.installDomGuards()`
iOS WKWebView 가 `user-scalable=no` 를 무시하는 것 대비: `gesturestart`/멀티터치/더블탭 줌/
러버밴드 스크롤(`touchmove`)을 `preventDefault`. Boot 에서 1회 호출.

### `MobileHarness.onResume(fn)` / `MobileHarness.onHide(fn)`
`visibilitychange` 처리: 화면이 가려지면 `onHide`(미지정 시 전역 `GAME_AUDIO.suspend()` 자동),
복귀하면 `onResume`(미지정 시 `GAME_AUDIO.resume()` 자동)을 호출. `pagehide` 에서도 자동 `suspend()`.
→ 백그라운드/탭 이탈 시 사운드가 계속 나는 문제를 엔진이 기본 차단한다(게임 코드 추가 작업 불필요).

### `MobileHarness.isTouch()`
터치 디바이스 여부(`ontouchstart` / `maxTouchPoints` / `?touch=1`). 데스크톱에선 컨트롤 숨김.

### `MobileHarness.TouchControlsClass(designW, designH, inputState)`
멀티터치 가상 D-패드(◀▶) + 점프(A) 버튼을 그리는 **별도 Scene 클래스**를 반환한다.
매 프레임 활성 포인터 위치로 버튼 상태를 재계산해 `inputState.{left,right,up}` 에 기록한다
(슬라이드/멀티터치에 견고). 항상 최상단 Scene 으로 launch.

```js
// Boot 에서:
var TC = MobileHarness.TouchControlsClass(DESIGN_W, DESIGN_H, GAME_INPUT);
this.scene.add('TouchControls', TC, false);
// 게임 시작 시:
this.scene.launch('TouchControls');
```

> `inputState`(예: `GAME_INPUT = {left,right,up}`)는 터치 전용. 키보드는 게임 씬에서
> `cursors`/`keys` 로 직접 읽어 OR 합친다. (TouchControls 가 매 프레임 inputState 를
> 포인터 기준으로 덮어쓰므로, 키보드 값을 inputState 에 넣지 말 것.)

---

## JoystickKit — 가상 조이스틱 (아날로그/트윈스틱) (`engine/joystickkit.js`)

선택 킷. Phaser 4 멀티터치 포인터를 읽어 **360° 방향 + 세기(force)** 벡터를 만든다.
`MobileHarness.TouchControls`(디지털 좌/우/점프)와 달리 가변 방향·가변 세기를 주며, 둘은
독립적으로 **공존**한다(플랫포머=D-패드, 탑다운/슈터/러너=조이스틱). 전용 스킬: `virtual-joystick`.

### `JoystickKit.create(scene, opts)` → controller
**카메라가 스크롤/줌 되지 않는 씬(HUD/UI)**의 `create()`에서 호출한다(게임 씬에서 만들면
포인터 월드좌표와 베이스 화면좌표가 어긋난다). 매 프레임 자동 갱신(`game.step()`에서도 발화).

| opts 키 | 기본값 | 설명 |
|---|---|---|
| `twin` | false | 트윈스틱(이동+조준). false면 이동 스틱 1개 |
| `radius` | min(W,H)*0.16 | 스틱 반경(디자인 px) |
| `deadzone` | 0.16 | 미만은 0, 바깥은 0~1 재정규화 |
| `show` | 터치 시 | 시각 표시 |
| `autoUpdate` | true | 씬 update 자동 훅(false면 `joy.update()` 직접) |
| `move` / `aim` | 좌하단/우하단 플로팅 | 스틱 설정(아래) |

스틱 설정(`move`/`aim`): `{ mode:'floating'|'fixed', x, y, zone:'left'|'right'|'all'|{x,y,w,h}, color, fireThreshold }`.
`floating`=처음 누른 곳에 베이스 생성, `fixed`=고정 베이스. twin 기본 zone: move=`left`, aim=`right`.

### `controller.state` (게임이 읽는 출력)
```js
joy.state = {
  move: { x, y, angle, force, active },  // x,y ∈ [-1,1], force ∈ [0,1]
  aim:  { x, y, angle, force, active },  // twin일 때
  fire: false                            // aim.force >= fireThreshold(기본 0.35)
};
// 게임 update():
player.setVelocity(joy.state.move.x * SPEED, joy.state.move.y * SPEED);
if (joy.state.fire) shootToward(joy.state.aim.angle);
```

### `controller.inject(spec)` / `controller.clearInject()`
포인터 없이 벡터 주입 → `game-qa` 헤드리스 step 검증용. `clearInject()`로 실 포인터 복귀.
```js
joy.inject({ move:{x:1,y:0}, aim:{x:0,y:-1, fire:true} });  // 우 이동 + 위 조준 발사
```

### `controller.setVisible(v)` / `controller.destroy()`
표시 토글 / 정리(그래픽 제거 + update 훅 해제). 씬 `shutdown` 시 자동 destroy.

### `JoystickKit.SceneClass(opts)` → Phaser.Scene 클래스
`TouchControlsClass`처럼 독립 최상단 씬으로. 인스턴스 `.joy`로 접근, `opts.onReady(joy)` 콜백.

```js
// index.html: <script src="../../engine/joystickkit.js"></script> (phaser 다음)
// HUD 씬 create():
var joy = JoystickKit.create(this, { twin: true });
window.MyGame.joy = joy;
```

> 데모: `games/tiled-topdown/index.html?stick=1` (GEM DUNGEON 트윈스틱 모드 — 좌스틱 이동,
> 우스틱 조준·마법볼트 발사). 기본 경로(`?stick=1` 없음)는 디지털 D-패드 그대로.
> 멀티터치는 `game.input.manager.pointers`를 스틱별 id 로 바인딩한다(씬-로컬 input.pointers 금지).

---

## RngForge — 시드 결정론 난수 (`engine/rngforge.js`)

게임 내 모든 무작위의 단일 진실. 같은 시드 → 항상 같은 수열(mulberry32, 의존성 0). `Math.random()`
을 대체해 헤드리스 step 하니스가 재현 가능한 검증을 하게 한다. **게임 무작위는 RngForge 로만** —
검증: `node skills/wgf-game-qa/tools/lint-rng.mjs games/<slug>/game.js`.

### `RngForge.create(seed)` → `rng`
- `seed`: 숫자 또는 문자열(문자열은 FNV-1a 로 해싱). 미지정 시 고정 기본 시드.
- 반환 `rng` 은 **callable** — `rng()` 가 float `[0,1)` (Math.random 드롭인). 메서드도 부착:

| 메서드 | 동작 |
|--------|------|
| `rng()` / `rng.next()` | float `[0,1)` |
| `rng.float(min,max)` | float `[min,max)` (인자 1개면 `[0,min)`) |
| `rng.int(min,max)` | 정수 `[min,max]` 양끝 포함 |
| `rng.bool(p)` / `rng.chance(p)` | 확률 p(기본 .5)로 `true` |
| `rng.sign()` | `-1` 또는 `1` |
| `rng.pick(arr)` | 배열에서 하나(빈 배열 → undefined) |
| `rng.shuffle(arr)` | Fisher–Yates 제자리 셔플(같은 배열 반환) |
| `rng.weighted(items, weights)` | 가중 선택(또는 `[{value,weight}]`) |
| `rng.stream(name)` | 이름별 독립 난수기(캐싱·원본 시드에서 파생) |
| `rng.state()` / `rng.setState(s)` | 직렬화/복원(상태=32-bit 정수) |
| `rng.clone()` | 현재 상태 그대로 독립 복제 |
| `rng.reseed(s)` | 새 시드로 리셋(스트림 캐시 비움) |

### `RngForge.fromUrl(defaultSeed[, param])` → `rng`
URL `?seed=` 를 읽어 생성, 없으면 `defaultSeed`(Node 등 location 없으면 기본값 폴백). QA 시드 주입용.

### `RngForge.hashSeed(str)` → int
문자열(날짜키·이름 등) → 32-bit 정수 시드.

```js
// index.html: phaser 다음, game.js 이전에 로드
// <script src="../../engine/rngforge.js"></script>
this.rng = RngForge.fromUrl(20260613);          // ?seed=N 재현 지원
var loot = this.rng.weighted(DROPS, WEIGHTS);   // 가중 드랍
var fx = this.rng.stream('particles');          // 시각 효과는 게임플레이 RNG와 분리
var snap = this.rng.state();                    // 값-스냅샷에 포함 → 무작위 경로까지 고정 검증
```

> 멀티스트림은 "용도별 주사위 통" — 파티클 스트림을 아무리 굴려도 전투 스트림 결과가 밀리지 않아
> 검증이 안정적이다. 절차 레벨 생성 킷(`genkit.js`, 로드맵)은 이 RngForge 위에 청크 조립을 얹는다.
