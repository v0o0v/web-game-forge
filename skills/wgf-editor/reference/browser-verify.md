# 브라우저 상호작용 검증 — scenekit-phaser 함정과 올바른 경로

> export 게임(또는 에디터 Play)을 **브라우저에서 직접 조작해 검증**할 때, SceneKit 로직코어와
> Phaser 어댑터(`engine/scenekit-phaser.js`)가 분리돼 있어 **헤드리스와 다르게 동작하는** 두
> 함정이 있다. 모르면 멀쩡한 코드를 "망가졌다"고 오진한다.

## 핵심 원리 — "동작한다"는 3층으로 쪼개진다

| 층 | 무엇 | 검증 경로 |
|----|------|-----------|
| ① 코어 로직 | 이동·충돌·AI·결정성 | **헤드리스** (`SceneKit.load → step(dt) → hashState`) — 진실의 기준점 |
| ② 스텝 구동 | rAF 루프가 코어를 step 하는가 | `?autostart=1` 로 로드 (수동 `setMode('play')` ❌) |
| ③ 입력 채널 | 키 입력이 코어에 닿는가 | **진짜 `KeyboardEvent` dispatch** (합성 `GAME_INPUT` 쓰기 ❌) |

브라우저로 ①을 찌르려 하면 ②③ 때문에 "안 움직이는 것처럼" 보인다. **①은 헤드리스로,
②③만 브라우저로** 확인한다.

## 함정 1 — `window.GAME_INPUT` 직접 쓰기는 클로버된다

어댑터의 play 루프가 **매 프레임 Phaser 키보드 상태로 `GAME_INPUT` 을 덮어쓴다.**

```js
window.GAME_INPUT.right = true;   // ❌ 다음 rAF 프레임에서 false 로 리셋됨
```

코어의 `TopDownController` 는 `GAME_INPUT` 을 읽지만, 그 값을 **채우는 주체가 어댑터(실제
키보드)** 라 외부에서 쓴 값은 무력하다. (참고: 헤드리스에선 `world.meta.inputProvider` 주입
경로를 쓰므로 이 문제가 없다 — 브라우저 어댑터에만 해당.)

## 함정 2 — `setMode('play')` 단독은 스텝 루프를 기동하지 않는다

export 게임의 rAF 스텝 루프는 부트스트랩의 `?autostart=1` → `start()` 경로에서만 확실히 돈다.
빈 페이지에서 수동으로 `inst.setMode('play')` 만 호출하면 코어가 step 되지 않아 입력을 줘도
위치·스폰·`audioEvents` 가 전부 정지한다.

```js
inst.setMode('play');   // ❌ 수동 호출만으로는 rAF 스텝 안 돎
```

## 올바른 검증 절차

1. **코어 로직은 헤드리스로.** `test-scenekit`/`test-demo` 패턴(load → 120프레임 step → 2회
   `hashState` 일치)이 컨트롤러·충돌·결정성의 진실 기준점이다. 브라우저로 재확인하지 않는다.
2. **스텝 구동은 `?autostart=1` 로.** `getWorld().entities.length` 변화·`audioEvents` 증가로
   "스텝이 돈다"를 확인한다(수동 `setMode` 신뢰 금지).
3. **입력 반응은 진짜 키 이벤트로.** autostart 로 스텝이 도는 동안 `window.dispatchEvent` 로
   `KeyboardEvent` 를 쏘고 `transform` 델타를 측정 → 어댑터→`GAME_INPUT`→코어 경로가 실증된다.
4. **죽음 혼동 주의.** 입력 없이 autostart 하면 생존 아레나 데모는 플레이어가 곧 죽는다.
   `hp:0` 이라도 컨트롤러는 적분하므로 이동 검증은 가능하지만, "안 움직임" 을 코너에 몰린
   상태와 혼동하지 말 것(중앙 방향으로 쏴서 확인).

```js
// ✅ autostart 로 스텝 구동 + 진짜 키 이벤트로 입력 실증
//    URL: .../games/<slug>/index.html?autostart=1&seed=777
const P = () => world.entities.find(e => e.id === 'player').transform;
const y0 = P().y;
const fire = (type) => window.dispatchEvent(new KeyboardEvent(type,
  { key:'ArrowUp', code:'ArrowUp', keyCode:38, which:38, bubbles:true }));
fire('keydown');
await new Promise(r => setTimeout(r, 250));   // rAF 몇 프레임 진행
console.assert(P().y < y0, '위로 이동 — 입력 채널 정상');
fire('keyup');
```

## 부수 — SSE 페이지는 동기 eval

에디터 셸(`editor/ui/`)은 SSE 상시연결이라 `preview_screenshot`/async-eval 이 타임아웃한다.
**동기 eval** 로 상태를 읽는다(서버 `no-store` 라 브라우저 캐시 무관). export 게임은 SSE 가
없으므로 스크린샷·async 다 가능하다.

## 연계

- 헤드리스 QA·replay·qa-score: [`game-qa`](../../wgf-game-qa/SKILL.md)
- 워크플로(edit→Play→export): [workflow.md](./workflow.md)
- 동형성 계약 H/H′(edit t=0 = play 0프레임 = export 0프레임): [architecture.md](./architecture.md)
