# 슈터·웨이브·아레나 레벨 디자인

> 탑다운·트윈스틱·불릿헤븐·아레나 슈터의 **레벨 = (시간축 웨이브 시퀀스) × (공간축 아레나 레이아웃)** 두 축을 `LD-*` 원칙으로 설계하는 처방전이다. 공통 원칙은 [principles.md](./principles.md), 색인은 [INDEX.md](./INDEX.md), 실제 빌드는 [`topdown-shooter`](../../../topdown-shooter/SKILL.md) 스킬로 위임한다.
> 재미요소 조합(`FE-*`)은 [fun-elements.md](../../../web-game-builder/reference/game-dna/fun-elements.md), 엔진 API는 [engine-api.md](../../../web-game-builder/reference/engine-api.md) 참고.

이 저장소엔 아직 슈터 장르 게임이 없다(super-runner=플랫포머, runeburst=매치3, is-rule=규칙퍼즐). 그래서 아래 `WAVES`/`ARENA` 선언 블록은 **신규 제안 스키마**이며, 일관성을 위해 runeburst의 `LEVELS` 배열 + `mulberry32` 시드, super-runner의 `features` 선언 패턴을 그대로 차용했다. 새 포맷을 발명한 게 아니라, 검증된 우리 게임의 선언 스타일을 슈터로 확장한 것이다.

## 한눈에 보기 — 이 장르가 다른 점

플랫포머(super-runner)는 공간 진행이 곧 시간 진행인 **1축** 구조다. 매치3(runeburst)는 이동수 예산의 **이산** 구조다. 슈터는 다르다 — **시간축의 강도 곡선**(`LD-CURVE`/`LD-PACING`)과 **공간축의 아레나 공정성**(`LD-FAIR`/`LD-AFFORDANCE`)을 *동시에* 튜닝해야 한다. 한 축만 잘 풀면 나머지가 무너진다.

| 장르 특이점 | 한 줄 요약 | 관련 `LD-*` |
|---|---|---|
| 빌드·경제 게임이지 반응속도 게임이 아니다 | 불릿헤븐/오토슈터는 닷지 실행보다 빌드 의사결정이 핵심. 회피·텔레그래프를 과하게 넣으면 인지부하가 빌드에서 닷지로 옮겨가 장르 정체성을 해친다(Klein의 'Cowardly design' 경고). | `LD-FLOW-CHANNEL` |
| 화면 밖 기습 금지 = 1순위 공정성 | 스폰은 항상 뷰포트 외곽 링 + 예고 + no-spawn 반경. | `LD-FAIR` |
| 탄막 난이도는 '탄 수'가 아니다 | 구조·값대비·색분리가 난이도를 결정한다(Sparen, Boghog). | `LD-AFFORDANCE` |
| 페이싱은 위상 교대 | Build Up → Peak(스폰 중단) → Relax(무스폰) — 정점 직후 쉼표가 다음 헤비를 강렬하게 만든다. | `LD-PACING` |

**모바일 웹뷰·단일플레이 맥락 결론:** 오토파이어 + 이동 회피의 **불릿헤븐 쪽**이 터치 조작에 가장 적합하다(엄지 하나로 이동, 사격은 자동). 트윈스틱은 가상 스틱 2개라 작은 화면에서 손가락이 화면을 가린다 — 채택 시 한쪽 자동조준 권장.

---

## §1. LD-* 원칙별 처방

### LD-CURVE — 톱니형 웨이브 강도 곡선 (시간/킬 기반 에스컬레이션)

**정의.** 웨이브가 진행될수록 적의 수·체력·속도·동시 출현 종류가 단계적으로 상승하되, 매 정점 직후에 의도적 완화 구간을 끼워 **톱니(sawtooth)** 형태로 오르는 구조. 상승 트리거는 보통 경과 시간 또는 누적 킬 수.

**왜 통하나.** 전 Riot 디자이너 Daniel Z. Klein은 'Horde Survivor Survivor' 글에서, Vampire Survivors류 불릿헤븐이 20~30분 고정 타이머로 '적 수·강도의 급증'과 '플레이어 강화의 급증'을 나란히 붙여 **관리된 파워커브**를 만든다고 분석한다. 미관리 스케일링은 두 실패모드를 낳는다 — (a) 뒤처진 플레이어가 XP를 못 모아 영영 추격 불가, (b) 압도적 플레이어가 잔여 콘텐츠를 무의미화. Rogueliker·MacGaming 리뷰도 '특정 타임스탬프에 어려운 웨이브가 스폰되는 시점을 아는 것이 반응속도보다 생존에 더 중요'하다고 명시한다. (Valve는 2026년 5월 이 장르를 'Bullet Heaven'으로 공식 태깅했다.)

**구체 규칙(체크리스트).**
- [ ] 웨이브 강도 노브를 **4축으로 분리**: `spawnRate`(초당 스폰), `maxAlive`(동시 생존 상한), `enemyTypes`(동시 출현 종류 1→2→3), `eliteEvery`(N웨이브마다 정예 1).
- [ ] 상승은 **계단식**: 3~4웨이브 상승 후 1웨이브 완화(`maxAlive`를 직전 정점의 50~60%로 낮춤).
- [ ] 시간 기반이면 30~90초 단위 틱마다 **1노브씩만** 올림(한 틱에 2축 동시 상승 금지 — 체감 난도 폭발 방지).
- [ ] 정점 웨이브의 `maxAlive`는 직전 평균의 **1.5~2배를 넘지 않음**(가독성 붕괴 임계).
- [ ] 플레이어 강화 곡선이 적 곡선보다 **반 박자 먼저** 오게 배치(레벨업/파워업을 정점 웨이브 *직전*에 제공).

**우리 엔진 적용.** runeburst의 `LEVELS` 배열 패턴을 그대로 차용해, game.js 상단에 전역 `WAVES` 선언 블록을 둔다. `moves↓`/`colors↑`가 난이도 노브였듯, 여기선 `spawnRate↑`·`maxAlive↑`·`types.length↑`가 노브다.

```js
// 시간축: 웨이브 시퀀스 (runeburst LEVELS 패턴 차용)
// 난이도 노브 = spawnRate↑ · maxAlive↑ · types.length↑ · elite
var WAVES = [
  // idx, dur(초) 또는 killGoal, spawnRate(/s), maxAlive(동시 상한)
  { idx: 0, dur: 30, spawnRate: 0.8, maxAlive: 5,  types: [{ enemy: 'grunt', weight: 1 }],                          intro: 'grunt', seed: 2001 },
  { idx: 1, dur: 40, spawnRate: 1.2, maxAlive: 8,  types: [{ enemy: 'grunt', weight: 1 }],                          seed: 2002 },
  { idx: 2, dur: 40, spawnRate: 1.4, maxAlive: 10, types: [{ enemy: 'grunt', weight: 3 }, { enemy: 'darter', weight: 1 }], intro: 'darter', seed: 2003 },
  { idx: 3, dur: 45, spawnRate: 1.8, maxAlive: 14, types: [{ enemy: 'grunt', weight: 2 }, { enemy: 'darter', weight: 2 }], elite: { type: 'brute', count: 1 }, seed: 2004 },
  // 정점 직후 의도적 완화(톱니의 하강) — rest 플래그
  { idx: 4, rest: true, dur: 5, spawnRate: 0, maxAlive: 0,                                                            seed: 2005 },
  { idx: 5, dur: 45, spawnRate: 2.0, maxAlive: 16, types: [{ enemy: 'grunt', weight: 1 }, { enemy: 'darter', weight: 2 }, { enemy: 'gunner', weight: 1 }], intro: 'gunner', seed: 2006 }
];
```

`Phaser4` `Scene.time.addEvent`로 `dur` 타이머를, 풀링된 적 그룹의 `countActive(true)`로 `maxAlive` 캡을 강제한다. `seed`는 `mulberry32`(runeburst와 동일 PRNG)로 스폰 좌표·종류를 결정적으로 뽑아 **데일리 시드 재현성**을 확보한다.

**주의/안티패턴.**
- ❌ `spawnRate`와 `maxAlive`를 동시에 올려 한 웨이브에서 체감 난도가 2배 이상 점프.
- ❌ 완화 구간 없이 단조 상승 → 피로 누적·집중력 붕괴.
- ❌ 적 곡선만 올리고 파워업 타이밍을 늦춰 '뒤처지면 영영 추격 불가' 실패모드 유발.

---

### LD-PACING — 라이트↔헤비 위상 교대와 쉼표 (AI Director식 ebb-and-flow)

**정의.** 고밀도 '헤비' 교전 위상과 저밀도 '라이트' 위상을 교대시키고, 정점 직후 적 스폰이 멈추는 **회복 구간(relax)** 을 넣어 강도의 파동을 만드는 페이싱.

**왜 통하나.** Touhou류 단마쿠는 라이트 페이즈(테마·완급)와 헤비 페이즈(폐소적·강이동 유발)를 교대시킨다(Boghog's shmup 101). Valve의 *Left 4 Dead* AI Director는 **Build Up → Peak(정점에서 적 스폰 중단) → Relax(Wanderer·Mob·Special 모두 미스폰)** 3위상으로 ebb-and-flow를 만들어 회복을 허용한다(Left 4 Dead Wiki 'The Director'). Michael Booth의 GDC 2009 발표 'The AI Systems of Left 4 Dead' 1차 슬라이드는 Relax 지속을 **30~45초**(정확히는 "30-45 seconds, 또는 Survivor가 다음 세이프룸 쪽으로 충분히 이동할 때까지")로 명시한다 — 흔히 도는 '35-40초'는 2차 정리본 변형 수치이니 1차 값 30~45초를 기준으로 삼는다. The Level Design Book에 따르면 Valve 디자이너는 레벨 페이싱 비트를 Explore/Combat/Choreo/Puzzle 4종으로 분류하고 X축=시간(분)·Y축=강도(intensity)로 그래프를 그렸는데, 강도 척도는 '0-100%, 0-5, 또는 0-10' 중 택일하는 단순 수치이고 그 값은 "게임 감각과 플레이테스트에서 나오는 직관(gut feeling)"이라고 명시한다(GDC China 2014 'Level Design Workshop: Pacing', White Forest Inn intensity graph 출처). 'trough(골)가 peak만큼 중요하며 잘 배치된 쉼이 액션을 다시 강렬하게 만든다'는 명제는 Gamasutra 'Harnessed Pacing & Intensity'가 정식화했다. 강도 상대성 원리 — "항상 11로 틀어놓으면 11이 새로운 5가 된다(eleven becomes the new five)" — 는 Mike Stout의 'Trinity, Part 6 - Intensity Ramps'(2015) Principle #5다.

**구체 규칙(체크리스트).**
- [ ] 정점 웨이브가 끝나면 다음 웨이브 시작 전 **3~6초 완전 무스폰 쉼표**(화면 클리어 보상).
- [ ] 헤비:라이트 길이 비를 대략 **2:1~3:1** — 헤비가 너무 길면 피로, 너무 짧으면 긴장 안 쌓임.
- [ ] 정점에서는 신규 스폰을 멈추고 '남은 적 처치'로 위상을 끝냄(L4D Peak 규칙 차용).
- [ ] 쉼표 중 비주얼을 어둡게/오디오 다운 → 대비로 다음 헤비를 강조.
- [ ] 보스/정예 웨이브 직후엔 반드시 저강도 수집·이동 구간 배치(보상 체감).

**우리 엔진 적용.** `WAVES` 항목의 `rest:true` 웨이브는 `spawnRate=0`, `maxAlive=0`을 강제하고 잔존 적만 정리한다. relax 진입 시 `ChipAudio`로 음 피치/볼륨을 낮춰(runeburst의 콤보 피치 스택을 역으로 사용) **청각적 쉼**을 만든다. '스트레스 미터'(피격·근접 적 수 누적)를 두고 임계 초과 시 강제 relax를 트리거하면 L4D식 동적 페이싱이 된다(`LD-DDA`와 결합).

**주의/안티패턴.**
- ❌ 쉼표 없이 헤비 연속 배치 → 강도 평탄화로 '항상 빡셈 = 어디도 안 빡셈'(Stout의 eleven-becomes-five).
- ❌ 쉼표가 너무 길어(10초+) 흐름이 끊기고 지루함.
- ❌ 정점에서 계속 스폰해 화면이 무한정 채워져 가독성·공정성 붕괴.

---

### LD-FAIR — 공정 스폰 (화면 밖 기습 금지·읽히는 출현)

**정의.** 적이 플레이어 시야·화면 안 또는 명확히 예고된 가장자리에서만 출현하고, 출현 직후 즉시 위협을 가하지 않도록 준비시간을 두는 스폰 규칙. 트라이얼앤에러를 강요하는 **불가피 기습을 배제**한다.

**왜 통하나.** Game Developer '7 twin-stick shooters to study'는 매복 적이 '나오자마자 총질하면 좌절을 주므로 무기를 갖추는 데 시간이 걸려야 하고, 그 사이 플레이어가 엄폐·선제사격할 수 있어야 한다'고 본다. The Level Design Book(Encounter)은 '반복된 죽음·시행착오 + 플레이어 통제 불능이 결합된 매복은 grating·불공정하게 느껴진다'며, 교전 전 아레나를 둘러보게 해 적 위치·교전 지점·탈출로를 예측시키라 한다(Andrew Yoder의 'door problem of combat'). 단마쿠에서도 '단발 미아 탄은 읽기 어렵고 불공정'하다(Boghog).

**구체 규칙(체크리스트).**

| 규칙 | 값 |
|---|---|
| 스폰 위치 | 화면 가장자리 **바깥 1~2타일 링**에서만 |
| 출현 예고 | 스폰 전 **0.4~0.8초** 텔레그래프(마커/그림자/페이드인) |
| no-spawn 반경 | 플레이어 위치 반경 R(화면 짧은변의 25%) 안엔 **직접 스폰 금지** |
| 준비 프레임 | 스폰 직후 0.5초 이동만, **공격 비활성** |
| 원거리 적 | 첫 사격 전 반드시 조준선/경고선 표시(`LD-TELEGRAPH` 연계) |
| 신규 종류 첫 등장 | 항상 저강도 웨이브에서 **1마리만**(`LD-TEACH` 연계) |

**우리 엔진 적용.** 스폰 좌표는 카메라 뷰포트(`this.cameras.main.worldView`)를 기준으로 외곽 링에서만 샘플한다. 'no-spawn 반경' 체크를 `mulberry32` 시드 샘플 루프에 넣어 플레이어 근처 좌표를 **reject-resample**한다. 출현 예고는 `VectorForge` 글로우 마커를 0.5초 먼저 그린 뒤 적 스폰. runeburst의 '교착 자동 셔플'이 항상 수가 있게 보장하듯, 여기선 **'항상 회피 경로가 존재'** 하도록 동시 `maxAlive`와 스폰 링 밀도를 캡한다.

```js
// 공정 스폰: 뷰포트 외곽 링 + no-spawn 반경 reject-resample
function fairSpawnPoint(scene, rng, player) {
  var view = scene.cameras.main.worldView;
  var noSpawnR = Math.min(view.width, view.height) * 0.25;
  for (var tries = 0; tries < 16; tries++) {
    var edge = (rng() * 4) | 0;       // 0~3: 상/우/하/좌
    var t = rng();
    var x = (edge === 0 || edge === 2) ? view.x + t * view.width
          : (edge === 1) ? view.right + 32 : view.x - 32;
    var y = (edge === 1 || edge === 3) ? view.y + t * view.height
          : (edge === 2) ? view.bottom + 32 : view.y - 32;
    if (Phaser.Math.Distance.Between(x, y, player.x, player.y) >= noSpawnR) {
      return { x: x, y: y };          // 플레이어 근처면 reject, 멀면 채택
    }
  }
  return { x: view.x - 32, y: view.y - 32 }; // 폴백(좌상단 바깥)
}
```

**주의/안티패턴.**
- ❌ 플레이어 등 뒤 화면 안에 적을 순간이동 스폰 → 통제 불능 죽음.
- ❌ 예고 프레임 없이 즉시 발사하는 원거리 적 → 첫 사격 회피 불가.
- ❌ 정점에서 스폰 링을 360도 꽉 채워 회피 경로가 0이 되는 순간 발생.

---

### LD-TELEGRAPH — 공격 예고 (색·경고선·예비동작)

**정의.** 강한 공격(레이저·돌진·광역탄)에 반드시 예비동작/경고 비주얼을 선행시키고, **일관된 예고 길이와 색 코드**를 써서 회피 가능성을 보장하는 규칙.

**왜 통하나.** Boghog는 '레이저는 강해 보이므로 발사 전 얇은 경고선만 띄워도 게임이 훨씬 플레이 가능해진다'고 한다. The Level Design Book은 *God of War*(2018) Valkyrie 사례로 **노란 FX=패리 유도, 빨간 FX=회피 필수 무방어 공격**, 그리고 ~2~3초의 '일관된 예비동작 윈도우'를 든다(Jason de Heras 귀속). 색 코드(노랑/빨강)의 **의미 일관성**이 학습을 가능케 한다. 비정형 궤도 탄은 trail 같은 추가 이펙트로 읽기를 도와야 공정하다(Boghog).

**구체 규칙(체크리스트).**
- [ ] 레이저/관통/광역: 발사 **0.6~1.0초 전** 경고선·확장 링 표시, 예고 길이는 공격 종류별로 항상 동일.
- [ ] **색 코드 고정**: 빨강=무방어/회피 필수, 노랑=패리/반격 가능, 시안=안전·아이템 — 게임 전체에서 불변.
- [ ] 돌진형 적: 돌진 직전 **0.3~0.5초 '웅크림'** 예비동작 + 궤적선.
- [ ] 비정형 궤도 탄엔 trail/잔상 부여, 단발 탄은 묶어서(스택) 패턴으로.
- [ ] 동시 진행 중인 텔레그래프는 화면당 **2~3개로 제한**(인지 과부하 방지).

**우리 엔진 적용.** `VectorForge`로 경고선/확장 링/웅크림 프레임을 절차 생성한다. 공격마다 `telegraph:{ leadMs, color, shape }` 메타를 적 정의에 두고, `Phaser4` Tween으로 `leadMs` 동안 경고 비주얼 알파/스케일을 보간한 뒤 hitbox 활성. 색 코드는 전역 상수(`RED`/`YELLOW`/`CYAN`)로 고정해 모든 적·아이템이 공유한다 — runeburst가 `RUNES` 색을 전역으로 고정해 가독성을 유지한 방식과 동형이다.

```js
// 색 코드는 게임 전역 불변 상수 (의미 일관성 = 학습 가능성)
var TELE = { RED: 0xff3b3b, YELLOW: 0xffd23b, CYAN: 0x3be0ff };

// 적 정의에 텔레그래프 메타를 박는다
var ENEMY_DEFS = {
  laser:  { role: 'gunner', telegraph: { leadMs: 800, color: TELE.RED,    shape: 'beamLine' } },
  charger:{ role: 'speed',  telegraph: { leadMs: 400, color: TELE.YELLOW, shape: 'crouch'   } }
};
```

**주의/안티패턴.**
- ❌ 예고 길이를 공격마다 다르게 해 학습 불가(같은 레이저인데 0.2초 vs 1초).
- ❌ 색 코드 혼용(빨강이 어떨 땐 위험, 어떨 땐 보상) → 신뢰 붕괴.
- ❌ 텔레그래프를 너무 많이 동시 표시해 화면이 경고선으로 뒤덮임.

---

### LD-AFFORDANCE — 탄막·적 가독성 (청킹·값대비·색 분리)

**정의.** 탄과 적을 보기만 해도 궤도·위협·상호작용이 읽히도록, 탄을 **라인/패턴으로 청킹**하고 **밝은 코어·어두운 테두리**로 값(value) 대비를 주며, 배경·이펙트와 충돌하지 않는 색을 쓰는 규칙.

**왜 통하나.** Boghog: '탄을 라인·명확한 패턴으로 묶어라 — 단발 미아 탄은 읽기 어렵고 불공정.' 청킹은 숨은 부분의 위치를 정신적으로 그룹화·예측하게 한다. 탄 색은 **빨강·핑크·보라**가 선호되는데, 노랑·주황은 폭발·황금 아이템과 겹치기 때문이다(Boghog, npaka 15패턴 정리). 값 대비(밝은 코어 + 어두운 테두리)와 저대비 중간톤 배경이 중요 요소를 띄운다. Sparen DDSGA4: '탄 수가 많다고 어려운 게 아니다 — 구조·타이밍이 더 중요'하며, **안전지대(이동하는 음의 공간)** 를 시간차 스폰으로 만들면 명시적 장애물 없이 플레이어 동선을 유도한다.

**구체 규칙(체크리스트).**
- [ ] 탄은 **부채꼴·링·라인** 등 패턴 단위로만 발사, 패턴당 탄을 시각적으로 한 덩어리로 묶기.
- [ ] 탄 색 팔레트는 **빨강/핑크/보라 우선**, 폭발·아이템(노랑/주황/시안)과 색 분리.
- [ ] 모든 탄에 **밝은 코어 + 어두운 테두리**, 빠른/작은 탄을 크고 느린 탄 위에 그림(깊이 정렬).
- [ ] 화면 전체를 막는 패턴 금지 — 항상 통과 가능한 **'레인' 1개 이상** 보장.
- [ ] 적·탄·배경의 명도 차를 충분히(배경은 중간톤·저채도)로 둬 전경 분리.

**우리 엔진 적용.** 탄/적 스프라이트를 `VectorForge`로 베이크할 때 밝은 fill + 어두운 stroke를 강제한다. `Phaser4` `depth`로 (작고 빠른 탄 = 높은 depth)를 정렬한다. 배경은 절차생성 중간톤·저채도로 깔아 전경 대비를 확보(runeburst가 네온 글로우 룬을 어두운 배경에 띄운 것과 동일 전략). 패턴 발사는 '한 번에 N개 부채꼴' 헬퍼로 묶어 단발 탄 남발을 **코드 레벨에서 차단**한다.

```js
// 청킹: 단발 금지, 항상 패턴 단위로 발사 (+ 통과 레인 보장)
function fireFan(scene, x, y, baseAngle, count, spreadDeg, speed, laneGap) {
  var half = Phaser.Math.DegToRad(spreadDeg) / 2;
  for (var i = 0; i < count; i++) {
    var t = count === 1 ? 0.5 : i / (count - 1);
    if (laneGap && Math.abs(t - 0.5) < laneGap) continue; // 가운데 '레인' 1개 비움
    var a = baseAngle - half + t * 2 * half;
    var b = scene.bullets.get(x, y);                       // 오브젝트 풀에서 재사용
    if (b) { b.setActive(true).setVisible(true); b.setDepth(20);
             scene.physics.velocityFromRotation(a, speed, b.body.velocity); }
  }
}
```

**주의/안티패턴.**
- ❌ 노랑·주황 탄이 폭발/코인 이펙트와 겹쳐 위협을 못 읽음.
- ❌ 단발 탄을 무작위로 흩뿌려 궤도 예측 불가(불공정 체감).
- ❌ 고채도·고대비 배경이 전경 탄과 경쟁해 가독성 저하.

---

### LD-VARIETY — 적 조합 (단순·구별되는 종류 1~3개의 관계 디자인)

**정의.** 각 적은 단순하고 명확히 구별되는 행동 하나를 갖되, 웨이브에서 **1~3종을 조합**해 종류 간 '관계'로 도전을 만드는 구성. 4종 이상은 난투(brawl)로 흐려진다.

**왜 통하나.** The Level Design Book(Encounter): '명료함을 위해 적 종류는 1~3개. 1종=튜토리얼/쉼, 2종=적 간 흥미로운 관계, 3종+는 파싱 곤란, 4종+는 난투/혼돈. 적 종류가 너무 많은 건 등장인물 너무 많은 영화 같아 초점을 잃는다.' Game Developer twin-stick 가이드도 각 적이 '행동은 단순하되 서로 뚜렷이 구별'(느린 예측가능 졸개 vs 불규칙 이동 거구)되어야 하고, 일관된 행동이 군중 전체의 흐름을 읽어 flow에 들게 한다고 본다.

**구체 규칙(체크리스트).**
- [ ] 동시 출현 적 종류를 웨이브당 **1~3종으로 캡**, 4종 이상은 보스/난투 웨이브에만 의도적으로.
- [ ] 각 적은 **단일 역할**(돌격형/포격형/방패형/속도형)을 갖고 실루엣·색으로 즉시 구별.
- [ ] 조합은 '관계'로 설계: 느린 방패형(엄폐) + 빠른 측면 돌격형(우회 강요) 같은 **보완 쌍**.
- [ ] 새 종류 도입 시 **기존 종류 1개를 빼서** 동시 인지 부하를 일정하게 유지.
- [ ] 정예/보스는 기존 졸개 행동을 증폭/변주한 형태로(완전 신규 패턴 남발 금지).

**우리 엔진 적용.** 적 정의를 `enemy` 테이블(`{ id, role, silhouette, speed, telegraph }`)로 두고, `WAVES[i].types`에서 `weight`로 조합한다. role별 실루엣·색을 `VectorForge`로 절차 생성해 구별성을 확보한다. runeburst가 `colors`를 5→6으로 늘리며 기믹을 하나씩 가르쳤듯, `types.length`를 1→2→3으로 천천히 늘리고 **한 번에 한 역할만** 추가한다.

| 역할(role) | 행동 | 실루엣 단서 | 조합 상대 |
|---|---|---|---|
| 돌격형(grunt) | 직진 추적 | 둥근 덩어리 | 기본 — 어떤 것과도 |
| 속도형(darter) | 불규칙 지그재그 | 뾰족·작음 | 방패형(우회 강요) |
| 포격형(gunner) | 정지 후 조준 사격 | 각진·정적 | 돌격형(접근 압박) |
| 방패형(brute) | 느린 전진·고체력 | 크고 두꺼움 | 속도형(시선 분산) |

**주의/안티패턴.**
- ❌ 한 웨이브에 4종+를 던져 위협 우선순위를 못 정함.
- ❌ 실루엣·색이 비슷한 적 2종을 섞어 구별 실패.
- ❌ 조합이 '관계' 없이 그냥 수만 늘린 것 → 흥미로운 결정 부재.

---

### LD-FLOW-CHANNEL — 몰입 채널 (압도와 통제 사이 칼날 균형)

**정의.** 플레이어를 '압도됨'과 '지루함' 사이의 좁은 채널에 머물게 도전 강도를 실력에 맞춰 유지하는 것. 트윈스틱·불릿헤븐에선 **'통제와 압도 사이 칼날 위'** 에 두는 것이 목표다.

**왜 통하나.** 도전(challenge)과 실력(skill)의 균형이 boredom(실력>도전)과 anxiety(도전>실력)를 가르는 flow(몰입) 채널 개념은 심리학자 Mihály Csikszentmihalyi가 1970년대에 정식화한 flow 이론에서 비롯된다 — 기원 저작은 1975년 'Beyond Boredom and Anxiety: Experiencing Flow in Work and Play'이고, 1990년 'Flow: The Psychology of Optimal Experience'는 이를 체계화·대중화한 대표작이다. 원본 1975년 도식은 challenge-skill 평면을 anxiety/flow/boredom **3구역**으로 나눴고, 1987년 Massimini·Csikszentmihalyi·Carli가 이를 8가지 정서 상태로 세분한 **8채널 모델(Eight Channel Model)** 로 발전시켰다(흔히 쓰는 '3채널 모델'이라는 명칭은 비표준이다). Game Developer twin-stick 가이드: '조준·사격이 좋게 느껴져야 하고, 플레이어를 압도됨과 통제됨 사이 칼날 위에 균형 잡힌 느낌으로 둬야 한다.' Daniel Z. Klein도 flow 이론을 직접 인용해 '마찰이 몰입할 만큼은 높되 압도될 만큼은 아니어야 하며, 성공적 런의 최소 80%에서 이 마찰을 유지하면서 자비살(패배 불가피)과 폭주승리(승리 기정사실)를 모두 피하는 것'이 미해결 과제라 한다.

> 참고: Jesse Schell의 'The Art of Game Design'은 flow를 도전 상승→보상→완화가 반복되는 **'tense and release(긴장과 이완)'** 사이클로 설명하며 이 진동으로 플레이어를 flow 채널에 유지하라고 처방한다. 이는 'flow 유지의 대안'이 아니라 flow를 실현하는 방식 그 자체이며, 흔히 도는 'Oscillation Method'라는 명칭은 Schell 본인의 용어가 아니라 2차 해설의 라벨이다.

**구체 규칙(체크리스트).**
- [ ] 성공적 런의 **80% 이상** 구간에서 '동시 위협 수'를 플레이어 처리량 부근에 유지(여유도 위기도 아님).
- [ ] 회피 가능한 안전지대를 **항상 ≥1개** 남겨 '통제 가능' 감각 보장(완전 봉쇄 금지).
- [ ] 플레이어 화력 성장에 맞춰 적 압력을 **반 박자 뒤따르게**(`LD-CURVE` 연동).
- [ ] **자비살 방지**: 뒤처져도 XP/킬로 추격 가능한 최소 보상 흐름 유지.
- [ ] **폭주승리 방지**: 압도 시 적 압력을 소폭 상향(`LD-DDA`)해 채널 복귀.

**우리 엔진 적용.** 런타임에 '플레이어 처리량 추정치'(최근 5초 킬 수)와 '동시 위협 수'(`maxAlive`·근접 적)를 비교해 `spawnRate`를 ±20% 미세 조정한다. runeburst의 별 1~3 판정처럼 '여유/적정/위기'를 내부 상태로 분류해 다음 웨이브 노브에 피드백한다. `Phaser4` `update` 루프에서 **매 웨이브 경계마다만** 조정한다(프레임마다 흔들지 않음).

**주의/안티패턴.**
- ❌ 채널을 무시하고 고정 곡선만 따라 일부 실력대에선 지루/일부에선 압도.
- ❌ 안전지대를 0으로 만들어 '통제 가능' 감각 상실 → 불공정.
- ❌ 미세조정을 너무 자주/세게 해 난이도가 출렁여 학습 불가.

---

### LD-TEACH — 안전한 도입에서 새 적·기믹 무텍스트 학습

**정의.** 새 적 종류·공격 패턴·아레나 기믹을 저강도·안전한 웨이브에서 **1개만, 다른 위협 없이 단독 노출**해 플레이어가 직접 체험으로 학습하게 하는 규칙.

**왜 통하나.** The Level Design Book은 '1종 적' 웨이브의 용도를 튜토리얼/쉼으로 규정한다. Game Developer twin-stick 가이드는 적의 일관된 행동이 학습·flow의 전제라고 본다. 단마쿠 설계(Boghog)에서도 비정형 위협은 먼저 읽기 보조(trail/경고선)와 함께 안전하게 소개해야 공정하다. 이는 무텍스트 학습(안전한 환경에서 메카닉을 먼저 체험)의 슈터 적용이며, 닌텐도의 Koichi Hayashida가 정식화한 kishōtenketsu 4단 구조(도입→전개→비틀기→마무리, `LD-4BEAT`)의 '도입' 비트에 해당한다(Mark Brown의 GMTK 영상은 이를 대중화한 2차 해설이다).

**구체 규칙(체크리스트).**
- [ ] 신규 적/패턴 첫 등장은 항상 rest 직후 저강도 웨이브에서 **단독 1마리**.
- [ ] 신규 위협 소개 웨이브엔 다른 신규 요소 **0개**(한 번에 한 개념 — `LD-ONE-IDEA` 연동).
- [ ] 원거리/레이저 신규 적은 첫 등장 시 예고 길이를 평소보다 **1.3배 길게**(학습 여유).
- [ ] 소개 후 1~2웨이브 뒤 같은 적을 기존 적과 조합해 '시험'.
- [ ] 보스 패턴은 졸개 단계에서 **축소판으로 미리 예고**(`LD-FORESHADOW` 연동).

**우리 엔진 적용.** `WAVES`에 `intro:'enemyId'` 필드를 두면(위 스키마 참고) 해당 웨이브는 `spawnRate`·`maxAlive`를 자동 하향하고 그 적만 단독 스폰하도록 스폰러가 강제한다. runeburst가 12레벨로 기믹(라인 블래스터→컬러 코어→젤리→얼음→…)을 하나씩 가르친 커리큘럼을 그대로 **웨이브 시퀀스에 매핑**한다.

**주의/안티패턴.**
- ❌ 신규 적을 고강도 정점 웨이브에서 처음 등장시켜 학습 없이 죽임.
- ❌ 한 웨이브에 신규 요소 2개 이상 → 무엇이 죽였는지 귀인 실패.
- ❌ 소개만 하고 이후 활용 안 해 학습이 휘발.

---

### LD-FAIR(공간) — 아레나 레이아웃 (엄폐·동선·시야선·정찰 기회)

**정의.** 아레나 형상(엄폐물 형태·배치, 시야선, 수직성, 공격 벡터 수)을 설계해 안전지대와 위험지대를 만들고, 교전 시작 전 플레이어가 공간을 정찰해 교전 지점·탈출로를 계획하게 하는 규칙. (탑다운/2D에서도 동일 원리.)

**왜 통하나.** The Level Design Book(Cover): 엄폐는 '형태(개별 오브젝트 기하)'와 '배치(아레나 전체 레이아웃)' 두 측면이며, 안전지대를 제공하고 스폰을 공평한 거리에 두라 한다. My.Games/War Robots의 탑다운 슈터 글은 시야선을 끊거나 장거리용으로 쓰고, 수직성으로 공격 벡터를 다양화하되 **'공격 벡터 수를 관리해 플레이어가 압도되지 않게'** 하라고 본다. Encounter 항목은 교전 전 아레나를 둘러보게 해 적 위치 예측·탈출 계획을 세우게 하라고 명시한다.

**구체 규칙(체크리스트).**
- [ ] 엄폐물은 '엄폐 뒤=안전, 측면=노출'이 **보기만 해도 읽히게** 배치(전방위 엄폐는 1~2개로 제한).
- [ ] 동시 공격 벡터(적이 들어오는 방향) 수를 **2~3개로 캡**, 정점에서만 일시적으로 4.
- [ ] 맵에 명확한 **'코어 안전지대'(중앙) + '고위험 고보상 외곽'(아이템/XP)** 이분 구조(`LD-RISK-PATH` 연동).
- [ ] 웨이브 시작 전 **1~2초 정찰 순간**(카메라가 아레나·다음 스폰 가장자리를 보여줌).
- [ ] 막다른 코너 최소화 — 모든 엄폐 지점에 **탈출 동선 ≥2**.

**우리 엔진 적용.** 아레나를 super-runner의 `LEVEL` 선언(`features:[{t,c,r}]`, `pits`, …) 스타일로 `ARENA` 블록에 인코딩한다. `Phaser4` Arcade Physics 정적 바디로 엄폐물, 카메라 팬으로 정찰 순간. '코어 안전 / 외곽 보상' 이분은 `pickups`를 외곽 `spawnEdges` 근처에 배치해 표현한다(XP를 줍기 위해 위험을 감수 — Klein의 'tactical movement').

```js
// 공간축: 아레나 레이아웃 (super-runner LEVEL features 선언 스타일 차용)
var ARENA = {
  width: 960, height: 960,
  // 엄폐물: '뒤=안전, 측면=노출'이 읽히게. 전방위는 중앙 1개로 제한
  cover: [
    { x: 480, y: 480, w: 160, h: 40 },   // 중앙 코어 엄폐(가로 벽)
    { x: 240, y: 300, w: 40,  h: 160 },  // 좌측 세로 엄폐
    { x: 720, y: 660, w: 40,  h: 160 }   // 우측 세로 엄폐
  ],
  hazards:    [{ type: 'spike', x: 480, y: 120, r: 48 }],   // 고정 위험지대
  spawnEdges: ['N', 'E', 'S', 'W'],                          // 활성 스폰 방향(웨이브가 부분 활성)
  pickups:    [{ type: 'xp', x: 120, y: 120 }, { type: 'xp', x: 840, y: 840 }], // 외곽=고보상
  safeCore:   { x: 480, y: 480, r: 180 }                    // 코어 안전지대(이분 구조)
};
```

**주의/안티패턴.**
- ❌ 전방위 엄폐물 남발로 적 압력 무력화(지루) 또는 적이 끼어 못 오는 교착.
- ❌ 공격 벡터를 4+로 상시 열어 둬 어디를 봐야 할지 모름.
- ❌ 정찰 순간 없이 바로 교전 → 탈출 계획 불가, 통제 상실감.

---

## §2. 모바일 제약 — 오브젝트 풀과 동시 적 상한

슈터는 우리 엔진에서 **가장 오브젝트가 많이 생성되는 장르**다(탄 + 적 + 파티클). 모바일 웹뷰에서 가비지 컬렉션 스파이크와 오버드로로 프레임이 죽지 않게, 아래 캡을 레벨 데이터 단계에서부터 강제한다.

| 자원 | 모바일 캡(권장) | 강제 방법 |
|---|---|---|
| 동시 생존 적 `maxAlive` | **24** 이하 | `group.countActive(true)` 체크 후 스폰 차단 |
| 동시 활성 탄 | **120** 이하 | 오브젝트 풀(`group.get()`) 재사용, 초과 시 가장 오래된 것 회수 |
| 동시 파티클 emitter | **2~3개** | juice-fx 모바일 가이드 준수 |
| 동시 텔레그래프 | **2~3개** | `LD-TELEGRAPH` 규칙 — 초과 시 다음 프레임으로 큐잉 |

**핵심 원칙 — 비주얼 역설(Klein).** 불릿헤븐은 성공할수록 이펙트 스팸으로 자기 화면이 안 보이게 되는 게 장르의 파탄점이다. 모바일 작은 화면에선 이펙트 예산을 더 엄격히 캡하고, **플레이어 캐릭터/적 실루엣을 이펙트 위 `depth`로 강제 정렬**한다.

```js
// 오브젝트 풀 + 동시 적 상한: GC 스파이크·오버드로 방어
this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 120 }); // 풀 상한
this.enemies = this.physics.add.group({ defaultKey: 'enemy',  maxSize: 24 });

function trySpawn(scene, wave, rng, player) {
  if (scene.enemies.countActive(true) >= wave.maxAlive) return;  // maxAlive 캡
  var p = fairSpawnPoint(scene, rng, player);                    // 공정 스폰
  var e = scene.enemies.get(p.x, p.y);
  if (!e) return;                                                // 풀 고갈 → 조용히 스킵
  e.setActive(true).setVisible(true).setDepth(30);              // 적은 탄(20)보다 위
}
```

depth 권장 순서: 배경(0) < 탄(20) < 적(30) < 플레이어(40) < 텔레그래프 경고선(45) < UI(100). 이펙트/파티클은 탄과 같은 20대에 두되 플레이어·적 실루엣을 가리지 않게 한다.

---

## §3. 12웨이브 worked example — 커리큘럼 매핑

runeburst가 12레벨로 기믹을 하나씩 가르쳤듯, 슈터도 12웨이브로 적 어휘를 점증 도입하면서 `LD-*` 비트를 깐다. 아래는 **시간축 커리큘럼**의 한 예다.

| W | 비트 | 신규 | `maxAlive` | 적용 `LD-*` |
|---|---|---|---|---|
| 0 | 도입 | grunt 단독 | 5 | `LD-TEACH` `LD-4BEAT`(도입) |
| 1 | 전개 | — | 8 | `LD-CURVE`(상승) |
| 2 | 전개 | +darter | 10 | `LD-VARIETY`(2종 관계) `LD-TEACH` |
| 3 | 정점 | +brute(정예) | 14 | `LD-CURVE`(정점) `LD-TELEGRAPH` |
| 4 | **쉼표** | — | 0 | `LD-REST` `LD-PACING`(relax) |
| 5 | 전개 | +gunner | 16 | `LD-TEACH`(원거리) `LD-FAIR`(경고선) |
| 6 | 비틀기 | gunner+darter | 16 | `LD-VARIETY`(보완 쌍) |
| 7 | 정점 | brute×2 | 20 | `LD-FLOW-CHANNEL`(칼날) |
| 8 | **쉼표** | 수집 구간 | 4 | `LD-REST` `LD-REWARD` |
| 9 | 전개 | 3종 동시 | 22 | `LD-VARIETY`(상한) `LD-AFFORDANCE` |
| 10 | 정점 | 보스 축소판 예고 | 22 | `LD-FORESHADOW` |
| 11 | 마무리 | 보스 | — | `LD-4BEAT`(마무리) `LD-MASTERY-CEILING` |

각 정점 직후 쉼표(W4, W8)가 톱니의 하강이자 다음 헤비를 강조하는 `LD-PACING` 골이다. 신규 적은 항상 쉼표 다음 저강도 웨이브에서 단독 도입(W0/2/5)하고, 한 웨이브에 신규 요소는 하나만 넣는다.

---

## IP 안전 메모

레벨디자인 **원칙·기법·메카닉**(톱니 강도 곡선, AI Director식 ebb-and-flow, 텔레그래프 색 코드, 공정 스폰 링, 탄막 청킹, 1~3종 적 조합, 아레나 엄폐 이분 구조)은 저작권 보호 대상이 아니므로 자유롭게 차용한다. 단 다음은 금지한다 — *Vampire Survivors*·*Touhou*·*Left 4 Dead*·*God of War* 등의 **고유명·캐릭터·음원·UI**, 특정 상용 슈터의 **고유 보스 패턴 시퀀스나 아레나 레이아웃을 그대로 복제**하는 것. 적·탄·아레나는 전부 `VectorForge`/`PixelForge` 절차생성 오리지널로 환기하고, 색 코드(빨강=위험)는 장르 관습이라 안전하되 특정 게임의 시그니처 비주얼(예: 특정 보스의 탄막 도형 배열)을 베끼지 않는다. 스폰 좌표·웨이브 구성은 `mulberry32` 시드 절차생성으로 만들어 '오리지널 배치'를 보장한다. 상세 게이트는 [`ip-license-guard`](../../../ip-license-guard/SKILL.md). (본 자료는 GDC 강연·GMTK 등 공개 분석과 디자인 통념을 한글로 소화한 것이며 법률 자문이 아니다.)

---

## 연계

- **공통 원칙 먼저:** [principles.md](./principles.md) §1(`LD-*` 사전)·§2(난이도 곡선). 이 파일은 그 공통 원칙을 슈터 데이터(`WAVES`/`ARENA`)로 구체화한 처방전이다.
- **빌드 위임:** [`topdown-shooter`](../../../topdown-shooter/SKILL.md) — 탑다운/트윈스틱/불릿헤븐 아레나 슈터의 실제 메카닉(오토파이어, 탄 풀, 적 AI, 아레나 충돌)을 빌드한다. 본 문서의 `WAVES`/`ARENA` 선언 블록을 그대로 입력 스키마로 쓴다.
- **레벨 빌드 메카닉:** [`level-designer`](../../../level-designer/SKILL.md) — 웨이브 타이머·스폰러·정찰 카메라 등 레벨 빌드 공통 메카닉.
- **재미요소 조합:** [fun-elements.md](../../../web-game-builder/reference/game-dna/fun-elements.md)(`FE-*`)·[game-dna/INDEX.md](../../../web-game-builder/reference/game-dna/INDEX.md) — `FE-FLOW`·`FE-TENSION`·`FE-JUST-ONE-MORE`와 본 문서의 `LD-FLOW-CHANNEL`·`LD-PACING`을 짝지어 설계.
- **엔진:** [engine-api.md](../../../web-game-builder/reference/engine-api.md)·[phaser/INDEX.md](../../../web-game-builder/reference/phaser/INDEX.md) — `VectorForge` 베이크, `ChipAudio` 피치 스택, `physics.add.group` 풀, `cameras.main.worldView` 등 구체 API.
- **인접 장르 파일:** [platformer-levels.md](./platformer-levels.md)(공간=시간 1축) · [puzzle-levels.md](./puzzle-levels.md)(이동수 예산) · [runner-procedural-levels.md](./runner-procedural-levels.md)(절차생성 스폰) · [arcade-levels.md](./arcade-levels.md)(픽스드 슈터).
- **인터뷰 플레이북:** [../level-interview.md](../level-interview.md).
