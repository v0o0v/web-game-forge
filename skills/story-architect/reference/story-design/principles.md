# 서사 설계 공통 원칙 — 1차 사전 (엔진 제약 · 4채널 압축 · 캐논 · 안티패턴)

> [`story-architect`](../../SKILL.md)가 서사를 설계하기 전에 **가장 먼저 Read** 하는 파일. 우리 엔진 제약을 선적용하고,
> 모든 도메인을 관통하는 공통 캐논과 '섞지 말 것'(안티패턴)을 둔다. 도메인별 깊은 원칙은 [INDEX.md](./INDEX.md) 라우팅으로.
> 코드화 원칙 전체 정의는 각 도메인 파일에 있다 — 여기선 *항상 지키는 북극성*만 요약한다.

---

## 0. 엔진 제약 · 범위 (모든 결정에 선적용)

우리 게임은 **작은 2D 웹/모바일웹 게임**이다(Phaser 4 + PixelForge/VectorForge + ChipAudio). AAA RPG가 아니다.

- **서사 전달은 4채널 + bark.** 컷신·대량 로어·긴 대화 트리는 없다. 이야기는 아래로만 값싸게 실린다.
  | 채널 | 무엇 | 텍스트 예산 | 코드 매핑 |
  |---|---|---|---|
  | **① 인트로/타이틀 카드** | 상황·톤 진입(설정 아닌 *상황 한복판*) | **≤2문장** | Title 씬 `this.add.text()` + 페이드 tween |
  | **② 레벨 사이 막간** | 한 비트 전진 | **≤1문장/회** | Scene 전환 overlay 카드 |
  | **③ 승리/패배/엔딩 카드** | 회수·변화 증명 | **각 ≤2문장** | GameOver/Clear 씬 텍스트 |
  | **④ 환경 단서** | 말없이 보여주기 | 텍스트 0 | 스프라이트 배치·색·소품(PixelForge/VectorForge) |
  | **(+bark)** | 살아있는 세계 | 한 줄 ×변형 3~6 | floating text 풀(`this.add.text` + 상승·소멸 tween) |
- **인물 1~4명 상한.** 화자가 많을수록 작은 게임에선 흐릿해진다. 화자 0명(환경·프레이밍만)도 완결 가능.
- **산출물 단일 진실:** `games/<slug>/STORY.md`. 모든 텍스트·대사는 여기서만 생성한다([consistency-tools.md](./consistency-tools.md)).
- **분위기는 엔진으로 번역:** tone 단어 → 색 팔레트(`WT-COLOR-EMOTION`)·무드 BGM(`WT-AUDIO-PLACE`)·페이싱(`WT-PACING-BREATHE`). 텍스트보다 색·소리·여백이 먼저다.

---

## 1. 4채널 압축 공식 (프레임워크 → 미니게임)

어떤 서사 프레임워크를 골라도 결국 위 4채널로 압축된다. 공통 매핑:

```
프레임워크 비트            →  채널
─────────────────────────────────────────
도입/Setup/Ki/You·Need     →  ① 인트로 카드 (상황 한복판으로, in medias res)
전개·시련/Shō/Search       →  ② 막간 (레벨마다 한 줄, 또는 환경 단서)
중간 반전/Midpoint/Ten     →  ② 막간 강조 1회 (또는 곡선 정점 직전 레벨에서 ④ 환경 변화)
절정/Climax/Take           →  게임플레이 자체(마지막 도전) — 비트=플레이(ST-BEATS-AS-PLAY)
회수/결말/Ketsu/Change     →  ③ 승리·엔딩 카드 (Opening↔Final 거울쌍 ST-MIRROR-FRAME)
```

- **비트는 컷신이 아니라 플레이로.** 가능하면 한 비트를 *플레이어 행동*으로 구현한다(`ST-BEATS-AS-PLAY`·`GN-FRAME-WINLOSE`).
- **시작↔끝 거울쌍.** 인트로 카드와 엔딩 카드를 같은 틀·한 요소만 바꿔 대칭시켜 '변화'를 증명한다(`ST-MIRROR-FRAME`) — 미니게임 최고 가성비 장치.
- **자세한 프레임워크별 공식:** [structure-frameworks.md](./structure-frameworks.md).

---

## 2. 공통 캐논 (모든 도메인을 관통하는 북극성)

설계 결정마다 아래 코드 근거를 한 줄로 단다. 깊은 정의는 괄호의 도메인 파일에.

1. **`GN-LUDOHARMONY` — 코어 동사가 곧 메시지.** 주제는 플레이어가 *매 순간 하는 행동*과 같은 말을 해야 한다. 쏘는 게임의 평화 메시지는 따로 논다(ludonarrative dissonance). → 0단계에서 코어 동사를 먼저 뽑는다. ([narrative-in-games.md](./narrative-in-games.md))
2. **`ST-TONE-LOCK` / `WT-MOOD-THROUGHLINE` — 톤을 먼저 못 박는다.** 끝낸 플레이어의 한 감정을 단어 1~2개로 먼저 고정. 어휘·색·BGM·프레임워크를 전부 프레이밍. ([world-tone.md](./world-tone.md))
3. **`ST-SPINE-FIRST` / `WT-PREMISE-ONE` — 한 문단·한 문장 먼저.** Story Spine 빈칸 한 문단 + '무엇이 어떻게·왜 변하나' premise 한 문장으로 전체를 압축. 이게 사실상 미니게임 각본. ([structure-frameworks.md](./structure-frameworks.md))
4. **`ST-PICK-ONE` / `ST-NO-OVERFIT` — 하나만 강하게.** 메인 프레임워크는 하나, 나머지는 부분 차용. 구조에 봉사당하지 말 것. ([structure-frameworks.md](./structure-frameworks.md))
5. **`AR-ONE-TWIST` / `AR-EXPECT-FIRST` — 전복은 하나, 기대를 먼저 세운다.** 전부 비틀면 기댈 전형이 없어 전복이 안 읽힌다. 전형으로 기대를 세우고 한 군데만 깬다. ([characters-arcs.md](./characters-arcs.md))
6. **`CH-WANT-NEED` — 겉욕망과 속필요를 분리.** 표면 목표=게임 승리 조건, 내면 필요=엔딩 한 줄 각성. 짧아도 변화가 생긴다. ([characters-arcs.md](./characters-arcs.md))
7. **`TW-PLANT-PAY` / `TW-FAIR-PLAY` — 심고 회수하되 공정하게.** 엔딩 반전부터 역산해 단서를 인트로·환경에 미리 심고, 숨기지 말고 시선만 돌린다(되읽으면 보이게). ([twist-foreshadow.md](./twist-foreshadow.md))
8. **`ST-ENV-CLUE` / `WT-ACTION-ARGUES` — 말하지 말고 보여준다.** 설교·설명 대신 환경 단서·행동·서브텍스트로. 텍스트 예산을 아낀다. ([world-tone.md](./world-tone.md))
9. **`DL-DUAL` / `DL-VOICEBIBLE` — 대사는 두 일을 하고, 보이스는 고정한다.** 모든 대사는 성격+서사전진 동시. 인물별 voice bible로 장면마다 흔들리지 않게. ([dialogue-voice.md](./dialogue-voice.md))
10. **`WT-COHERENCE` — 모든 표현이 같은 의미를 반복.** 색·음악·대사·UI가 한 무드를 향하게(따로 놀면 몰입이 깨진다 `GN-CONSISTENCY`). ([world-tone.md](./world-tone.md))
11. **`TL-CANON-SINGLE-SOURCE` / `TL-AUTHOR-VS-REVIEW` — 단일 진실 + 작성/검수 분리.** STORY.md가 유일한 출처. 작성과 연속성 린트는 다른 패스로(자기검수 금지). ([consistency-tools.md](./consistency-tools.md))

---

## 3. 섞지 말 것 (안티패턴 가드 — 인터뷰·설계의 내부 가드레일)

아래 충돌이 감지되면 그대로 만들지 말고 **절충 되묻기**(구간 분리·우선순위 확정)로 해소한다. 인터뷰 §1.5 가드와 연동.

- **젠·명상·사색 톤 × 극한 시간압박/과한 주스.** 감상할 여유가 사라져 분위기가 죽는다. → 압박 구간과 호흡 구간을 페이싱으로 분리(`WT-PACING-BREATHE`)하거나 톤을 하나로.
- **갈등 없는 평화 톤 × 억지 악당.** 톤이 깨진다. → 적 없이 Kishōtenketsu의 '転'(시점 전환 하나)으로 서사를 완결(`ST-KISHO-NOCONFLICT`·`TW-RECONTEXT`).
- **코어 동사 × 싸우는 주제(ludonarrative dissonance).** 미니게임에서 가장 흔한 구조적 실패. → 0단계 코어 동사를 뽑아 주제를 거기 맞춘다(`GN-LUDOHARMONY`).
- **여러 프레임워크 동시 적용.** 5분 게임이 3막+Hero's Journey+15비트로 과적재. → 메인 하나만(`ST-PICK-ONE`), 나머지는 비트 1~2개만 차용.
- **전복 인플레(다 비틀기).** 모든 게 참신하면 기댈 전형이 없어 무엇도 전복으로 안 읽힌다. → 전복은 하나(`AR-ONE-TWIST`).
- **lore dump / 텍스트 예산 초과.** 인트로에 세계관을 쏟으면 안 읽힌다. → 빙산의 일각만(`WT-ICEBERG`), 채널 예산(인트로 ≤2·막간 ≤1·엔딩 ≤2) 준수(`ST-TEXT-BUDGET`).
- **on-the-nose 대사 / 감정 직설.** "나는 너무 슬퍼"는 서브텍스트를 죽인다. → 행동·환경으로(`DL-SUBTEXT`·`DL-NOTNOSE`).
- **불공정한 반전(cheat).** 단서 없이 튀어나오는 반전은 배신감을 준다. → Fair-Play 감사(`TW-FAIR-PLAY`) — 1회차에 근거가 다 노출됐는지 검수.
- **한국어 변수 연결 비문.** `'{name}가 {item}를'` 식 문자열 조립은 조사에서 비문(은/는, 이/가, 을/를). → 문장 단위 보존, 조사 변수 회피(`DL-L10N`). (단, 산출 문서 본문은 한글 — 코드·고유명사만 원문.)

---

## 4. 빠른 처방 (톤 → 프레임워크 디폴트)

| 톤·게임 결 | 메인 프레임워크(디폴트) | 캐릭터 무게 | 반전 |
|---|---|---|---|
| 평화·퍼즐·사색·따뜻 | **Kishōtenketsu** (`ST-KISHO-NOCONFLICT`) | 가벼움(화자 0~1) | 시점 전환 '転'(`TW-RECONTEXT`) |
| 긴박·액션·아케이드·생존 | **Fichtean** (`ST-ESCALATE`) | 주인공+적 | 정체/배신(`TW-BETRAYAL`) |
| 루프·반복·한 판 더 | **Story Circle** (`ST-WANT-NEED`) | 주인공 1 | Want↔Need 각성(`CH-REVEAL`) |
| 갈등 영웅담·구출 | **3막/Hero's Journey 압축** | 주인공+멘토/적 | 깨달음(`TW-PERI-ANAG`) |

> 항상 **하나만** 메인으로(`ST-PICK-ONE`). 자세한 셀렉터(장르·길이·갈등 3질문)는 [structure-frameworks.md](./structure-frameworks.md).

---

## 출처
- 본 원칙은 [structure-frameworks.md](./structure-frameworks.md)·[narrative-in-games.md](./narrative-in-games.md)·[characters-arcs.md](./characters-arcs.md)·[twist-foreshadow.md](./twist-foreshadow.md)·[dialogue-voice.md](./dialogue-voice.md)·[world-tone.md](./world-tone.md)·[consistency-tools.md](./consistency-tools.md)의 코드화 원칙(각 파일 출처 절)을 공통 캐논으로 추린 것이다.
- 게임 매체 정합(ludonarrative)·환경 서사·4채널 압축은 우리 엔진(Phaser 4 · 작은 2D 웹게임) 제약에 맞춘 적응이다.
