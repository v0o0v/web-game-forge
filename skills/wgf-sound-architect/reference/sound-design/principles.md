# 사운드 설계 공통 원칙 — 엔진 제약 · 복잡도 게이트 · 캐논 · 안티패턴

> [`sound-architect`](../../SKILL.md) 사운드 설계의 **항상 먼저 읽는** 토대. 색인 [INDEX.md](./INDEX.md).
> 이 파일은 ① 엔진/플랫폼 하드 제약 → ② 복잡도 4티어 게이트 → ③ 공통 캐논 → ④ '섞지 말 것' 안티패턴 → ⑤ 장르→음색 빠른 처방 순으로, 모든 도메인 파일(`MOOD/SYNTH/SFX/TIMBRE/ADAPT/MIX-*`)의 상위 가드를 정의한다.

---

## 1. 엔진 / 플랫폼 하드 제약 (절대 깨지 않는 것)

1. **오디오 파일 0개 — 100% 절차 합성.** BGM·SFX 모두 코드로 합성한다(`engine/soundforge.js` = Tone.js v15 래퍼, 또는 경량 `engine/audio.js` = ChipAudio). `.mp3`/`.wav`/`.ogg`/사운드폰트 등 외부 음원 파일을 로드하지 않는다 → 음원 저작권·인접권 비해당, 100% CC0. (외부 CC0 음원을 *정말* 쓰려면 `assets.json` 라이선스 게이트 + `CREDITS.txt`, 하지만 기본은 절차 합성.)
2. **모바일 웹뷰 오디오 라이프사이클 필수.** iOS WKWebView·인앱브라우저는 (a) 첫 사용자 제스처 없이 오디오 불가(`MIX-UNLOCK` — 'Tap to start'에서 `unlock()`), (b) 백그라운드/잠금 시 컨텍스트 suspend(`MIX-LIFECYCLE` — `MobileHarness`가 `GAME_AUDIO.suspend()/resume()` 호출). `SoundForge`는 ChipAudio와 동일 인터페이스(`unlock/resume/suspend/toggleMute/startBgm/stopBgm/sfx`)라 `mobile.js`를 수정 없이 쓴다.
3. **동시 보이스 예산(모바일 폴리포니).** 저사양 기기 안전선 = **동시 발음 16보이스**(`MIX-VOICE-BUDGET`). 슈퍼소우(fat 5~7)·패드(폴리)·드럼·SFX가 동시에 터지면 초과하기 쉽다 → 레이어 수·폴리포니를 예산 안에서. 이펙트(리버브/딜레이)·노이즈 버퍼는 **1회 구성해 재사용**(`SYNTH-VOICE-REUSE`/`MIX-SEND-FX`).
4. **샘플정확 스케줄링.** BGM은 `setInterval`(박자 지터)이 아니라 `Tone.Transport`(룩어헤드 스케줄러)로 예약한다 — `SoundForge`가 내부 처리. 직접 `setInterval`로 음악 시퀀싱 금지.
5. **렌더 스타일과 무관, 단 톤은 정합.** 사운드는 픽셀/스무스 어느 아트와도 쓰지만, 무드는 아트·서사(STORY.md)와 같은 말을 해야 한다(`MOOD-LUDO-HARMONY`).

---

## 2. 복잡도 4티어 게이트 (`SCOPE` 정신 — 사운드도 과설계 금지)

item-architect가 아이템 복잡도를 가르듯, 사운드도 **딱 필요한 만큼**만. 디폴트는 "한 무드, 한 음색 패밀리".

| 티어 | 무엇 | 엔진 | 언제 |
|---|---|---|---|
| **T0 칩 기본** | ChipAudio 8비트 SFX + 단순 루프 BGM | `chip`(audio.js) | 아주 작은/레트로 의도 게임, 사운드가 부차적. AUDIO.md 불필요. |
| **T1 단일 무드** | SoundForge 한 무드 BGM(고정 레이어) + 레이어드 SFX 팔레트 | `soundforge` | 대부분의 게임 기본. 무드 1개·음색 1패밀리. |
| **T2 다장르·레이어드** | 장르 음색 + 인텐시티 없는 다층 BGM + 레이어드 SFX | `soundforge` | 분위기를 제대로 입히고 싶을 때. |
| **T3 적응형** | 인텐시티 수직 레이어 크로스페이드 + 섹션(탐험/전투/보스) 전환 | `soundforge` | 긴박·전투 강약, 보스 등 *상태가 음악을 바꿔야* 할 때만. |

- **디폴트는 T1**(`MOOD-LOCK-FIRST` 하나 + 음색 1패밀리). 레트로/아주 작은 게임은 T0(chip)로 충분하다 — 적극 안내.
- **T3 적응형은 "음악이 게임 상태를 따라야 하는 이유"가 있을 때만.** 한 판이 짧고 상태 변화가 없으면 T1~T2가 안전(`ADAPT-MINIMAL`).
- 한 칸 올릴 때마다 정당화한다(보이스 예산·제작 비용이 같이 오른다).

---

## 3. 공통 캐논 (모든 도메인 위에 작동)

1. **`MOOD-LOCK-FIRST` 무드를 가장 먼저.** story-architect가 톤을, item-architect가 복잡도를 먼저 못 박듯, 사운드는 **무드 토큰 1개**(따뜻/긴박/쓸쓸/유쾌/긴장/평온/장엄/신비)를 먼저 확정한다. 이 무드가 스케일·BPM·악기·진행·이펙트를 전부 프레이밍한다 — 위가 흔들리면 아래를 정해도 소용없다.
2. **`MOOD-LUDO-HARMONY` 소리가 게임과 같은 말을 한다.** 코어 동사(점프·쏘기·달리기·매치)와 STORY.md 톤이 곧 음악의 의미다. 명랑한 점프 게임에 장송곡, 명상 퍼즐에 EDM 펌핑은 불협(안티패턴).
3. **`TIMBRE-ONE-FAMILY` 한 게임 한 음색 패밀리.** 칩튠과 오케스트라를 한 게임에 섞지 않는다. 음색 스타일가이드(AUDIO.md §6)를 모든 트랙·SFX가 상속.
4. **`AUDIO-SINGLE-SOURCE` 단일 진실 + 작성/검수 분리.** 모든 사운드는 AUDIO.md(의도) + audio.json(기계)에서만 정의하고, 코드에 수치를 하드코딩하지 않는다. 작성과 검수(`lint-audio.mjs` + 청취)는 다른 패스([consistency-tools.md](./consistency-tools.md)).
5. **`CC0-ORIGINAL` 오리지널 보증.** 절차 합성이 음원 저작권을 비켜가도, **작곡(멜로디/진행 결합) 표절**은 코드 규율로 차단한다 — 특정 곡의 식별 가능한 멜로디·리프를 코딩 금지, 멜로디는 스케일+모티프+진행에서 *절차 생성*(`MOOD-ORIGINAL-MELODY`). 코드 진행 관용구(I–V–vi–IV 등)는 공유재라 자유. audio.json에 `originalityNote` 명시.
6. **`SFX-FEEDBACK-CLARITY` SFX는 먼저 '피드백'이다.** 효과음의 1차 목적은 *게임 상태를 귀로 알리는 것*(점프·피격·획득). 멋보다 명료성 — BGM에 묻히지 않게 주파수/타이밍을 분리하고, 중요 이벤트는 덕킹(`SFX-DUCK`).
7. **`MIX-VOICE-BUDGET` 모바일 예산 안에서.** 화려함보다 안 끊김. 동시 16보이스, 이펙트 재사용, 긴 리버브 자제.

---

## 4. '섞지 말 것' — 안티패턴 (인터뷰 내부 가드)

충돌 의도가 감지되면 그대로 만들지 말고 **절충 되묻기**한다.

- **무드 불협(ludo 위반):** 명랑 게임 + 단조 장송 BGM, 명상 퍼즐 + 고BPM 펌핑, 따뜻한 이야기 + 금속 불협. → 무드부터 다시(`MOOD-LUDO-HARMONY`).
- **음색 잡탕:** 칩튠 + 오케스트라 + 로파이를 한 게임에. → 한 패밀리로(`TIMBRE-ONE-FAMILY`).
- **보이스 폭발:** 슈퍼소우 패드 여러 겹 + 드럼 + 다발 SFX 동시 → 모바일 끊김. → 레이어 축소·폴리포니 캡(`MIX-VOICE-BUDGET`).
- **SFX 마스킹:** 모든 SFX가 같은 중역대 + BGM과 겹쳐 *뭐가 일어났는지* 안 들림. → 주파수 분리·덕킹(`SFX-FEEDBACK-CLARITY`/`SFX-DUCK`).
- **긴 리버브 남발:** decay 4s+ ConvolverNode 여러 send → CPU·진흙탕 믹스. → send 1개·decay ≤3s(`MIX-SEND-FX`).
- **적응형 과설계:** 한 판 30초인데 5섹션 수평 리시퀀싱 + 7레이어. → T1~T2로(`ADAPT-MINIMAL`).
- **루프 이음새 튐:** 마디 경계가 안 맞아 BGM 루프가 딸꾹질. → 마디 정수배 길이·비트 동기 전환(`ADAPT-BEAT-SYNC`).
- **시그니처 곡 인용:** 마리오/테트리스/젤다 테마 음렬을 그대로. → 절차 생성 오리지널(`CC0-ORIGINAL`).

---

## 5. 장르 스캐폴드 → 음색·무드 빠른 처방 (자세히는 [genre-timbres.md](./genre-timbres.md))

| 장르 | 디폴트 무드 | 음색 패밀리 | 디폴트 티어 | 코어 동사와의 정합 |
|---|---|---|---|---|
| platformer-game | cheerful / heroic | 칩튠/아케이드(square-lead·triangle-bass·kit) | T1~T2 | 경쾌한 점프 = 밝은 펄스 리드 |
| topdown-shooter | tense | 신스웨이브(supersaw·saw-bass·kit four-floor) | T2~T3 | 탄막 긴장 = 추진 비트 + 펌핑 |
| arcade-classic | cheerful | 아케이드(pulse-lead·빠른 arp·noise) | T1 | 즉각 반응 = 짧고 또렷한 블립 |
| puzzle-game | calm / mystic | 앰비언트/명상(pad·pluck·fm-bell) | T1~T2 | 사고 = 방해 없는 베드 + 통찰 벨 |
| endless-runner | tense / heroic | 신스웨이브 추진(supersaw·kit) | T2~T3 | 가속 = 인텐시티로 레이어 쌓기 |

> 처방은 **출발점**일 뿐. 인터뷰에서 사용자가 다른 무드/음색을 원하면 그쪽으로 — 단 한 게임 한 패밀리·무드 정합·모바일 예산은 지킨다.

---

## 출처

- 합성·스케줄링·이펙트·적응형·무드·SFX·모바일의 1차 출처는 리서치 dossier(`.omc/research/sound-research-dossier.md`) + 각 도메인 파일 ## 출처(Web Audio MDN·Chris Wilson 스케줄러·Tone.js·게임 오디오·음악이론·ZzFX·WebKit 오디오 버그).
- 복잡도 게이트·단일 진실·작성/검수 분리는 item-design `SCOPE-*`/`ITEMS-SINGLE-SOURCE`, story-design `ST-TONE-LOCK`/`TL-AUTHOR-VS-REVIEW`를 사운드에 적응.
- IP 안전: [`ip-license-guard`](../../../wgf-ip-license-guard/SKILL.md).
