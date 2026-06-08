# AUDIO.md — sound-lab 사운드 바이블

> `sound-architect` 디렉터 스킬의 산출물 예시(T3 적응형). 단일 진실 = 이 파일(의도) + [`audio.json`](./audio.json)(기계). 검수: `node skills/sound-architect/tools/lint-audio.mjs games/sound-lab/audio.json`.
> 이 데모는 `engine/soundforge.js`(Tone.js v15) 엔진을 보여주는 쇼케이스이자 검증 하니스다.

## 0. 메타
- **slug:** sound-lab · **장르/스캐폴드:** demo(쇼케이스) · **코어 동사:** (없음 — 사운드 데모)
- **렌더 스타일:** smooth · **복잡도 티어:** **T3 적응형** · **엔진:** `soundforge`
- **무드 토큰:** `tense`(긴박) — 기본 전투 트랙 기준 · **STORY.md:** (없음)

## 1. 무드 · 음악 정체성 (`MOOD-LOCK-FIRST`)
- **무드:** 긴박/추격(tense). 데모이지만 "긴박 → 풀어짐(calm) → 절정(boss)"의 무드 대비(`MOOD-CONTRAST`)를 보여준다.
- **스케일/BPM/진행:** 기본 트랙 `drive` = E **phrygian**(이국·긴장 `MOOD-SCALE-MAP`), **132 BPM**(`MOOD-TEMPO` tense 범위), 진행 `i–♭II–i–VII`(♭II가 불안 `MOOD-PROGRESSION`).
- **왜:** 신스웨이브 추격감을 기본으로, 인텐시티·섹션 전환으로 음악이 *상태를 따라가는* 적응형을 시연(`MOOD-LUDO-HARMONY`는 실게임에선 코어 동사와 맞춤).
- 멜로디는 스케일+진행에서 **절차 생성**(오리지널 보증 `MOOD-ORIGINAL-MELODY`).

## 2. BGM 트랙 & 레이어
| 트랙 | 무드 | 스케일 | BPM | 진행 | 레이어(preset·pattern·minIntensity·vol) |
|---|---|---|---|---|---|
| `drive`(기본·전투) | tense | phrygian E | 132 | i–♭II–i–VII | pad·chords·0·-16 / saw-bass·root8·0.2·-12 / kit·four-floor·0.4·-11 / supersaw·arp·0.7·-13 |
| `calm`(탐험) | calm | major-pentatonic A | 76 | i–VI–III–VII | pad·chords·0·-14 / pluck·arp·0.3·-15 |
| `boss`(보스) | tense | harmonic-minor E | 150 | i–VI–V–i | pad·chords·0·-14 / saw-bass·pulse·0·-10 / kit·four-floor·0·-9 / supersaw·arp·0.3·-12 |

> 베드 레이어(pad, minIntensity 0)가 모든 트랙에 있어 어떤 강도에서도 무음이 아니다(`ADAPT-LAYER-GATE`). `drive`에서 인텐시티 0→1이면 pad→bass→drums→lead가 순차 페이드 인.

## 3. SFX 팔레트
| 이벤트 | 카테고리 | 피치방향 | 레이어 구성(`SFX-LAYER-3`) | SoundForge kind |
|---|---|---|---|---|
| `jump` | jump | 상승(`SFX-PITCH-ENV`) | 단일 톤 슬라이드 320→760 | tone |
| `coin` | pickup | 상승 | 2겹(988 + 1319 delay) | tone×2 |
| `hit` | hit | — | 트랜지언트(noise 1200) + 바디(180) | noise+tone |
| `explosion` | explosion | 하강 | 트랜지언트(noise 6000) + 바디(boom C2) + 테일(noise 800) | noise+boom+noise |
| `powerup` | powerup | — | 긴 톤 | tone |
| `laser` | shoot | 하강 | 톱니 1200→300 | tone |
| `chime` | ui | — | FM 벨 | fm |
- 모든 SFX는 `audio.json` `sfx`가 단일 진실(`SFX-DATA-DRIVEN`). ChipAudio 호환 키(stomp/flag 등)는 내장 프리셋으로 폴백(`SFX-COMPAT`).

## 4. 적응형 / 전환
- **수직 레이어(`ADAPT-VERTICAL`/`ADAPT-INTENSITY`):** `setIntensity(0..1)` → 레이어 minIntensity 게이트로 크로스페이드(0.5s).
- **수평 리시퀀싱(`ADAPT-HORIZONTAL`/`ADAPT-TRANSITION`):** `setSection('explore'|'combat'|'boss')` → `calm`/`drive`/`boss` 트랙 전환, BPM 램프.
- 실게임 매핑 예: 적 수 → 인텐시티, 보스 등장 → `setSection('boss')`.

## 5. 믹스 & 모바일 예산
- **마스터 체인(`MIX-MASTER-CHAIN`):** Volume(-6) → Compressor(-24/4:1) → Limiter(-1) → Destination.
- **send(`MIX-SEND-FX`):** 절차 IR 리버브(decay 2.2s, send 0.18) + FeedbackDelay(send 0.12) — 1회 구성 재사용.
- **보이스 예산(`MIX-VOICE-BUDGET`):** maxVoices 16. 피크 추정 `drive`/`boss` = 10(레이어) + 4(SFX) = 14 ≤ 16 ✓(lint c 통과).
- **라이프사이클:** 첫 제스처 `unlock()`(`MIX-UNLOCK`) · 가시성 변화 `suspend()/resume()`(`MIX-LIFECYCLE`) · `toggleMute()`(`MIX-MUTE`).

## 6. 합성 스타일가이드 (헤더 상수)
- **음색 패밀리:** 신스웨이브(`TIMBRE-SYNTHWAVE`) — supersaw 리드 + saw-bass + four-floor kit + 큰 리버브. 탐험만 앰비언트(`TIMBRE-AMBIENT`, pad+pluck)로 대비. 한 데모지만 패밀리는 일관(`TIMBRE-ONE-FAMILY`).
- **사용 프리셋:** pad · saw-bass · kit · supersaw · pluck. **SFX kind:** tone · noise · boom · fm.
- **마스터 dB:** master -6 / limiter -1 / 레이어 -16~-9.

## 7. 검수 로그
- `lint-audio.mjs games/sound-lab/audio.json` → **error 0 · warn 0 · info 0** (✓ 통과).
- 청취(h): 브라우저(`games/sound-lab/index.html`)에서 Tap to start → BGM 재생, SFX 7종 트리거, intensity 슬라이더로 레이어 페이드, 섹션 버튼으로 트랙 전환 확인. 콘솔 에러 0.
