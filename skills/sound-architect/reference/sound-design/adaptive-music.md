# 적응형 음악 레퍼런스 — 수직 레이어링 · 수평 리시퀀싱 · 인텐시티 게이트 (ADAPT-*)

> [`sound-architect`](../../SKILL.md) 사운드 설계의 T3 적응형 도메인 파일. 색인 [INDEX.md](./INDEX.md), 공통 원칙 [principles.md](./principles.md).
> **언제 읽나:** 인텐시티 수직 레이어 크로스페이드 또는 섹션 전환(탐험/전투/보스)을 설계할 때. T1·T2이면 이 파일은 불필요하다 — [principles.md](./principles.md) §2 게이트 확인.
> 형제 파일: [mix-mobile.md](./mix-mobile.md) · [genre-timbres.md](./genre-timbres.md) · [mood-music-theory.md](./mood-music-theory.md). 스펙: [consistency-tools.md](./consistency-tools.md). 엔진: [../../../../engine/soundforge.js](../../../../engine/soundforge.js).

---

## 수직 vs 수평 방식 비교 — 우리 엔진에서의 적합도

| 구분 | 수직 레이어링(Vertical Layering) | 수평 리시퀀싱(Horizontal Resequencing) |
|---|---|---|
| **개념** | 같은 박자 위에 스템(pad/bass/drums/lead)을 동시 재생, 게임 인텐시티로 gain 크로스페이드 인/아웃 | 구간(탐험/전투/보스)별로 다른 트랙을 준비해 비트 경계에서 순차 전환 |
| **파일 수** | 0 — 절차 합성이라 "스템" = 코드 분기 | 0 — 트랙도 코드로 정의하므로 파일 추가 없음 |
| **음악적 효과** | 인텐시티 0→1에 따라 밀도가 자연스럽게 차오름(레이어가 순차 등장) | 구간이 바뀔 때 완전히 다른 분위기·BPM·스케일로 전환 가능 |
| **우리 엔진 API** | `SoundForge.setIntensity(v)` → `_applyIntensity` → `Volume.rampTo` | `SoundForge.setSection(name)` → `bgm.sections` 매핑 → BPM `rampTo` |
| **audio.json 표현** | `bgm.tracks[id].layers[].minIntensity` 사다리 | `bgm.sections{ explore, combat, boss }` → 트랙 ID |
| **우리 적합도** | **1순위 채택** — 레이어 = 코드 분기라 구현 비용 0, 가성비 최고 | **경량형만** — 3섹션 이내 트랙 교체 + 마디 경계 BPM 크로스페이드 |
| **모바일 예산** | 레이어 1~4개면 보이스 예산 안에서 충분히 동작 | 전환 중 두 트랙 동시 발음 순간이 없어 예산 안전 |
| **과설계 경계** | 레이어 5개+ 동시는 폴리포니 초과 위험 | 섹션 4개+·전환 조건 복잡화는 FMOD/Wwise 영역(비채택) |

---

## 7가지 원칙 코드 (ADAPT-*)

### `ADAPT-VERTICAL` — 수직 레이어링 (1순위 채택)

**정의:** 같은 BPM·스케일·코드 진행 위에서 pad/bass/drums/lead 스템을 동시 진행시키되, 게임 인텐시티(0..1)에 따라 각 레이어의 gain을 개별 크로스페이드한다.

**출처:** The Game Audio Co — 수직 레이어링 vs 수평 리시퀀싱(동적 음악 구현 선택 가이드). 적응형 음악 Wikipedia.

**우리 엔진 구현(SoundForge):**
`_applyIntensity(ramp)` 내부에서 `intensity >= L.def.minIntensity` 조건으로 레이어 활성 여부를 판정하고 `L.vol.volume.rampTo(target, t)`로 크로스페이드한다. 절차 합성이라 스템 파일이 없고, 레이어는 코드 분기(`_makeInstrument(preset)` 케이스)에 불과하다 — **추가 파일 비용 0**.

```js
// setIntensity 호출 예 (game.js 플레이 루프 안)
var enemies = scene.enemies.getChildren().length;
GAME_AUDIO.setIntensity(Math.min(enemies / 10, 1.0));
// 적 10마리 = 인텐시티 1.0, 0마리 = 0.0
```

**audio.json 표현:**
```json
"layers": [
  { "id": "pad",   "preset": "pad",       "minIntensity": 0,    "vol": -16 },
  { "id": "bass",  "preset": "saw-bass",   "minIntensity": 0.25, "vol": -11 },
  { "id": "drums", "preset": "kit",        "minIntensity": 0.45, "vol": -10 },
  { "id": "lead",  "preset": "supersaw",   "minIntensity": 0.7,  "vol": -13 }
]
```
인텐시티가 0→1로 상승하면 pad(항상) → bass(25% 이상) → drums(45% 이상) → lead(70% 이상) 순으로 진입한다.

**흔한 실패:** 베드 레이어(minIntensity 0)를 빠트려 낮은 인텐시티에서 무음이 되는 것. `ADAPT-LAYER-GATE` 참조.

**연관:** `ADAPT-INTENSITY` `ADAPT-LAYER-GATE` `ADAPT-BEAT-SYNC` `MIX-VOICE-BUDGET`

---

### `ADAPT-HORIZONTAL` — 수평 리시퀀싱 (경량형만 채택)

**정의:** 게임 구간(탐험/전투/보스)마다 서로 다른 트랙(BPM·스케일·분위기 다름)을 정의하고, 구간 전환 시 마디 경계에서 트랙을 교체한다.

**출처:** The Game Audio Co — Adaptive Music in Immersive Game Worlds. Berklee Online — Scoring for Games.

**우리 엔진 구현(SoundForge):**
`setSection(name)` 이 `bgm.sections[name]` 에서 트랙 ID를 조회하고 `_curTrackId`와 `_track`을 교체한다. BPM은 `Tone.Transport.bpm.rampTo(newBpm, 0.5)` 로 0.5초에 걸쳐 부드럽게 변경된다. 레이어 그래프는 `_build()` 시 defaultTrack 기준으로 한 번 구성하므로, **섹션 전환 시 레이어 preset은 교체되지 않고 BPM·스케일·진행만 갱신**된다.

```js
// 게임 상태가 전투 구간에 진입할 때 (game.js)
GAME_AUDIO.setSection('combat');
// 보스 등장
GAME_AUDIO.setSection('boss');
```

**audio.json 표현:**
```json
"bgm": {
  "defaultTrack": "explore",
  "sections": { "explore": "explore", "combat": "combat", "boss": "boss" },
  "tracks": {
    "explore": { "mood": "calm",  "scale": "dorian",        "key": "A", "bpm": 88,  "layers": [...] },
    "combat":  { "mood": "tense", "scale": "phrygian",      "key": "A", "bpm": 148, "layers": [...] },
    "boss":    { "mood": "tense", "scale": "harmonic-minor","key": "A", "bpm": 160, "layers": [...] }
  }
}
```

**흔한 실패:** 전환 시점이 비트 경계에서 어긋나 "딸꾹질"이 생기는 것. `ADAPT-BEAT-SYNC` 로 완화한다. 섹션 수가 4개 이상이거나 전환 조건이 복잡해지면 T3 범위를 넘으므로 `ADAPT-MINIMAL` 재검토.

**연관:** `ADAPT-TRANSITION` `ADAPT-BEAT-SYNC` `ADAPT-MINIMAL`

---

### `ADAPT-INTENSITY` — 게임 상태 → 0..1 인텐시티 매핑

**정의:** 적 수·HP·속도·콤보 등 게임 상태 값을 0..1 범위로 정규화해 `SoundForge.setIntensity(v)`에 넘긴다. 인텐시티는 수직 레이어링의 유일한 입력 파라미터다.

**출처:** 리서치 dossier §적응형 음악 구현안. Berklee Online — Scoring for Games (게임 파라미터 → 음악 파라미터 연결 기법).

**우리 엔진 구현(SoundForge):**
`setIntensity(v, ramp)` 는 `this.intensity = clamp(v, 0, 1)` 후 `_applyIntensity(ramp)` 를 즉시 호출한다. `ramp` 인자(초)를 생략하면 기본값 0.5s 크로스페이드가 적용된다.

```js
// 게임 루프 안 — 인텐시티를 여러 인자로 합산
function updateAdaptiveAudio(scene) {
  var enemies   = scene.enemies.getChildren().length;
  var hpRatio   = 1 - (scene.player.hp / scene.player.maxHp); // HP 낮을수록 긴박
  var combo     = Math.min(scene.combo / 20, 1);
  var intensity = Math.min((enemies / 8) * 0.5 + hpRatio * 0.3 + combo * 0.2, 1.0);
  GAME_AUDIO.setIntensity(intensity);
}
// Phaser Scene.update() 또는 초당 ~4회 호출이면 충분 (매 프레임 불필요)
```

**흔한 실패:** 인텐시티를 매 프레임(60fps) 업데이트해 `rampTo` 가 과도하게 쌓이는 것. 초당 4~10회 갱신으로 충분하다. 또한 단일 지표(적 수만)로 매핑하면 HP 회복 순간 음악이 급격히 조용해져 어색함 — 여러 인자를 가중합으로 혼합할 것.

**연관:** `ADAPT-VERTICAL` `ADAPT-LAYER-GATE`

---

### `ADAPT-LAYER-GATE` — minIntensity 게이트 + 베드 레이어 필수

**정의:** 각 레이어는 `minIntensity` 임계값 이상일 때만 audible하다(`L.vol.volume.rampTo` 로 목표 dB 도달). 그리고 **베드 레이어(minIntensity ≤ 0)가 반드시 1개 이상 있어야 한다** — 어떤 인텐시티에서도 무음이 되지 않도록.

**출처:** 리서치 dossier §적응형 음악 구현안 (pad = minIntensity 0, 항상 깔림). consistency-tools.md 린트 항목 (d)layer-reach.

**우리 엔진 구현(SoundForge):**
`_applyIntensity` 는 레이어마다 `active = self.intensity >= (L.def.minIntensity || 0)` 를 판정한다. 비활성일 때 target은 `-60`(사실상 무음)이다. `lint-audio.mjs` 의 **(d) layer-reach** 검사가 베드 레이어 존재 여부와 minIntensity 분포를 자동 검증한다.

```json
// minIntensity 사다리 권장 예 (4레이어 기준)
{ "id": "pad",   "minIntensity": 0    },  // 베드 — 항상 울림, 필수
{ "id": "bass",  "minIntensity": 0.25 },  // 25% 이상에서 진입
{ "id": "drums", "minIntensity": 0.45 },  // 45% 이상
{ "id": "lead",  "minIntensity": 0.7  }   // 70% 이상 — 절정에서만 터짐
```

**흔한 실패:**
- `minIntensity: 0` 레이어 없이 전 레이어가 0.3 이상 → 고요한 순간 완전 무음. lint (d) 오류.
- 모든 레이어를 `minIntensity: 0` 으로 설정 → 항상 full 밀도, 적응형 의미 없음.
- lead 의 minIntensity 를 0.95+ 로 설정 → 거의 들리지 않아 레이어 낭비.

**연관:** `ADAPT-VERTICAL` `ADAPT-INTENSITY` `MIX-VOICE-BUDGET`

---

### `ADAPT-BEAT-SYNC` — 비트·마디 경계 크로스페이드

**정의:** 인텐시티 레이어 전환과 섹션 전환 모두 **비트 또는 마디 경계에 가깝게** 시작해야 딸꾹질·이음새 튐이 방지된다. `Volume.rampTo` 시간을 마디 길이(박자에 비례)에 맞추는 것이 핵심.

**출처:** 리서치 dossier §룩어헤드 스케줄러 (Chris Wilson 패턴). Berklee Online — Scoring for Games (seamless transition 기법).

**우리 엔진 구현(SoundForge):**
`_applyIntensity(ramp)` 의 `ramp` 인자가 크로스페이드 시간이다. 기본 0.5s는 BPM 120(마디 = 2s)에서 마디의 1/4에 해당해 대부분 무난하다. 정밀 비트 동기가 필요하면 Transport 이벤트에서 마디 경계를 감지한 뒤 setIntensity를 호출한다:

```js
// 마디 경계 크로스페이드 예 (1마디 = 4/4박 = 4박)
var bpm = 120;
var barSec = (60 / bpm) * 4; // 2.0s
// ramp = 마디 길이 전후로 설정하면 이음새 자연스러움
GAME_AUDIO.setIntensity(newVal, barSec * 0.5);
```

**흔한 실패:** 인텐시티 변화가 매 프레임 즉각 반영(ramp = 0)되면 gain 클릭 잡음이 발생한다. 항상 `ramp ≥ 0.1s` 이상을 유지할 것. 섹션 전환에서 BPM이 크게 뛰면(예: 88→160) 0.5s ramp 도 짧게 느껴질 수 있어 최대 1s 까지 늘리는 것을 고려.

**연관:** `ADAPT-TRANSITION` `ADAPT-VERTICAL`

---

### `ADAPT-TRANSITION` — 섹션 전환 (explore→combat→boss)

**정의:** `setSection(name)` 호출 시 BPM과 스케일이 교체되며 부드러운 크로스페이드가 이루어진다. 섹션 간 키(key)를 동일하게 유지하거나 5도권 근접 키를 쓰면 전환 시 화성 충돌이 줄어든다.

**출처:** The Game Audio Co — Adaptive Music / Immersive Worlds. Wikipedia — Adaptive music (horizontal resequencing 섹션).

**우리 엔진 구현(SoundForge):**
`setSection(name)` 은 `bgm.sections[name]` 에서 trackId를 얻어 `_track`을 교체하고, `Tone.Transport.bpm.rampTo(newBpm, 0.5)` 로 BPM을 0.5s에 걸쳐 전환한다. 레이어 그래프(preset)는 빌드 시 단일 구성이므로, 섹션 전환은 **시퀀스 파라미터(BPM·스케일·진행) 변경**만 일어난다. 레이어 구성을 섹션마다 완전히 바꾸려면 추가 빌드 로직이 필요하므로 현재 경량형 채택이 적합하다.

```js
// 전투 구간 시작 (game.js 충돌 이벤트 등)
this.physics.add.collider(player, enemyGroup, function () {
  if (!scene.inCombat) {
    scene.inCombat = true;
    GAME_AUDIO.setSection('combat');
    GAME_AUDIO.setIntensity(0.6);
  }
});
// 보스 등장
scene.events.on('boss-spawn', function () {
  GAME_AUDIO.setSection('boss');
  GAME_AUDIO.setIntensity(0.9);
});
// 전투 종료 — 탐험으로 복귀
GAME_AUDIO.setSection('explore');
GAME_AUDIO.setIntensity(0.2);
```

**흔한 실패:** 섹션 전환 후 인텐시티를 갱신하지 않아 새 트랙이 틀린 레이어 구성으로 시작되는 것. `setSection` 후에 반드시 `setIntensity`를 적절한 값으로 호출할 것.

**연관:** `ADAPT-HORIZONTAL` `ADAPT-BEAT-SYNC` `ADAPT-INTENSITY`

---

### `ADAPT-MINIMAL` — 작은 웹게임용 최소형 (과설계 금지)

**정의:** 한 판이 짧고(30~40초 이내) 상태 변화가 단순한 게임에는 T1~T2(고정 트랙)가 충분하다. FMOD·Wwise의 풀 파라미터 시스템, 5개 이상의 섹션, 복잡한 전환 조건 등은 비채택한다. T3 선택을 위한 정당화 기준: "음악이 게임 상태를 따라가야 하는 명확한 이유가 있는가?"

**출처:** 리서치 dossier TL;DR §4 (적응형 최소형 권고). principles.md §2 복잡도 게이트.

**T3 채택 기준 vs 기각 기준:**

| T3 채택하는 경우 | T1~T2로 충분한 경우 |
|---|---|
| 전투 강약이 핵심 재미(탑다운 슈터·엔들리스 러너) | 한 판 30초 이내, 단순 루프 무방 |
| 보스 등장 등 감정적 전환점이 뚜렷 | 상태 변화 없는 퍼즐·점프 게임 |
| 인텐시티가 실시간으로 자주 변하는 게임 | 사용자가 음악 차이를 느끼기 어려운 게임 |
| 배경음악이 게임 몰입에 직결 | 음향 효과(SFX)가 훨씬 중요한 게임 |

**흔한 실패:** "어차피 만들어두면 좋지 않나?"는 잘못된 판단이다. T3는 레이어 수·섹션 트랙 수만큼 보이스 예산을 추가로 소모하고, audio.json 복잡도가 올라가 린트·청취 검수 비용도 증가한다. 제작 비용 대비 사용자 인지 효과가 작은 게임에는 T1 단일 무드 BGM이 더 낫다.

**연관:** `MIX-VOICE-BUDGET` `ADAPT-LAYER-GATE` principles.md §2

---

## 종합 예시 — audio.json 적응형 표현 (T3 topdown-shooter)

아래는 `explore → combat → boss` 3섹션 + 4레이어 수직을 결합한 실전 예시다:

```json
{
  "version": 1,
  "meta": { "slug": "neon-assault", "tier": 3, "mood": "tense", "genre": "topdown-shooter",
            "engine": "soundforge",
            "originalityNote": "전 트랙 절차 합성 오리지널 — 어떤 곡의 멜로디/진행도 인용하지 않음" },
  "master": { "volume": -6, "limiter": -1,
              "reverb": { "decay": 2.2, "send": 0.18 }, "delay": { "send": 0.12 } },
  "budget": { "maxVoices": 16 },
  "bgm": {
    "defaultTrack": "explore",
    "defaultIntensity": 0.2,
    "sections": { "explore": "explore", "combat": "combat", "boss": "boss" },
    "tracks": {
      "explore": {
        "mood": "calm", "scale": "dorian", "key": "A", "bpm": 92,
        "progression": ["i", "VII", "VI", "VII"],
        "layers": [
          { "id": "pad",   "preset": "pad",          "pattern": "chords",    "minIntensity": 0,    "vol": -16 },
          { "id": "bass",  "preset": "triangle-bass", "pattern": "root8",    "minIntensity": 0.25, "vol": -13 },
          { "id": "drums", "preset": "kit",           "pattern": "backbeat", "minIntensity": 0.45, "vol": -12 },
          { "id": "lead",  "preset": "pluck",         "pattern": "arp",      "minIntensity": 0.7,  "vol": -15 }
        ]
      },
      "combat": {
        "mood": "tense", "scale": "phrygian", "key": "A", "bpm": 148,
        "progression": ["i", "bII", "i", "VII"],
        "layers": [
          { "id": "pad",   "preset": "pad",       "pattern": "chords",    "minIntensity": 0,    "vol": -16 },
          { "id": "bass",  "preset": "saw-bass",   "pattern": "root8",    "minIntensity": 0.2,  "vol": -11 },
          { "id": "drums", "preset": "kit",        "pattern": "four-floor","minIntensity": 0.4, "vol": -10 },
          { "id": "lead",  "preset": "supersaw",   "pattern": "arp",      "minIntensity": 0.7,  "vol": -13 }
        ]
      },
      "boss": {
        "mood": "tense", "scale": "harmonic-minor", "key": "A", "bpm": 162,
        "progression": ["i", "VI", "V", "i"],
        "layers": [
          { "id": "pad",   "preset": "pad",       "pattern": "chords",    "minIntensity": 0,   "vol": -14 },
          { "id": "bass",  "preset": "saw-bass",   "pattern": "pulse",    "minIntensity": 0,   "vol": -10 },
          { "id": "drums", "preset": "kit",        "pattern": "four-floor","minIntensity": 0,  "vol": -9  },
          { "id": "lead",  "preset": "supersaw",   "pattern": "arp",      "minIntensity": 0.3, "vol": -12 }
        ]
      }
    }
  }
}
```

**game.js 호출 위치 예:**

```js
// Scene.create() — 탐험 시작
GAME_AUDIO.startBgm();
GAME_AUDIO.setIntensity(0.1);

// Scene.update() — 적 수 비례 인텐시티
function update() {
  var count = enemies.getChildren().length;
  GAME_AUDIO.setIntensity(Math.min(count / 8, 1.0));
}

// 전투 구역 진입 콜라이더
this.physics.add.overlap(player, combatZone, function () {
  GAME_AUDIO.setSection('combat');
});

// 보스 이벤트
this.events.on('boss-appear', function () {
  GAME_AUDIO.setSection('boss');
  GAME_AUDIO.setIntensity(0.85);
});

// 전투 종료
this.events.on('room-clear', function () {
  GAME_AUDIO.setSection('explore');
  GAME_AUDIO.setIntensity(0.15);
});
```

---

## T3에서만 권장하는 이유 — 보이스 예산·제작 비용

T3 적응형 음악은 다음 비용을 수반한다:

1. **보이스 예산 증가:** 레이어 4개(pad PolySynth + saw-bass + kit 3드럼 노드 + supersaw)는 동시에 최대 ~12 보이스를 사용한다. SFX 스파이크와 겹치면 16 보이스 상한(`MIX-VOICE-BUDGET`)에 근접한다.
2. **audio.json 복잡도:** 3섹션 × 4레이어 = 12 레이어 레코드 + sections 맵. 린트 (a)~(d) 항목 검사 범위가 넓어지고, 청취 검수도 "3섹션 × 인텐시티 4단계 = 12가지 조합"을 확인해야 한다.
3. **전환 품질 관리:** 섹션 전환 타이밍이 어긋나면 사용자가 바로 인지하는 불쾌감이 생긴다(`ADAPT-BEAT-SYNC` 필수).

**T1~T2로 충분한 경우 가이드:**
- 한 판 30~40초 이하이고 상태 변화가 없으면 정적 1트랙(T1)으로 충분하다.
- 장르가 퍼즐·아케이드 클래식·짧은 플랫포머이면 고정 BGM + 무드 맞춤 음색(T1~T2)이 더 경량하고 안정적이다.
- 인텐시티만 필요하고 섹션 전환이 없으면 T2(수직 레이어링만)를 채택하고 `bgm.sections` 는 생략한다.

---

## 출처

- The Game Audio Co — Making Your Game's Music More Dynamic: Vertical Layering vs Horizontal Resequencing: https://www.thegameaudioco.com/making-your-game-s-music-more-dynamic-vertical-layering-vs-horizontal-resequencing
- The Game Audio Co — The Role of Adaptive Music in Creating Immersive Game Worlds: https://www.thegameaudioco.com/the-role-of-adaptive-music-in-creating-imersive-game-worlds
- Berklee Online — Scoring for Games: Top Techniques for Composing Music for Interactive Media: https://online.berklee.edu/takenote/scoring-for-games-top-techniques-for-composing-music-for-interactive-media/
- Wikipedia — Adaptive music: https://en.wikipedia.org/wiki/Adaptive_music
- 리서치 dossier §적응형 음악 구현안 — 작은 웹게임용 최소형: `.omc/research/sound-research-dossier.md`
