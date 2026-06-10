# 무드 → 음악 매핑 (MOOD-*)

무드 토큰을 가장 먼저 확정하고, 그로부터 스케일·BPM·악기 프리셋·코드 진행·이펙트까지 전부 파생시킨다.
모든 결정의 출발점이며, 아래 코드들은 그 과정의 각 단계를 명문화한다.

> [`sound-architect`](../../SKILL.md) 스킬의 무드·음악이론 레퍼런스.
> 색인 [INDEX.md](./INDEX.md), 공통 원칙 [principles.md](./principles.md).
> 관련: [synthesis-recipes.md](./synthesis-recipes.md) · [genre-timbres.md](./genre-timbres.md) · [adaptive-music.md](./adaptive-music.md) · [consistency-tools.md](./consistency-tools.md) · IP 보호 [ip-license-guard](../../../wgf-ip-license-guard/SKILL.md).

---

## SoundForge 스케일 enum + 진행 해석 방식

`engine/soundforge.js`의 `SCALES` 객체가 지원하는 스케일 식별자(audio.json `scale` 필드 유효값):

| 식별자 | 반음 인터벌 | 정서 한마디 |
|---|---|---|
| `major` / `ionian` | 0 2 4 5 7 9 11 | 밝음·희망 |
| `minor` / `aeolian` | 0 2 3 5 7 8 10 | 멜랑콜리·슬픔 |
| `dorian` | 0 2 3 5 7 9 10 | 어둡지만 그라운디드·블루지 |
| `phrygian` | 0 1 3 5 7 8 10 | 이국·긴장·플라멩코 |
| `lydian` | 0 2 4 6 7 9 11 | 부유·몽환·판타지 |
| `mixolydian` | 0 2 4 5 7 9 10 | 블루지·밝음·록 |
| `locrian` | 0 1 3 5 6 8 10 | 불안·불협 |
| `harmonic-minor` | 0 2 3 5 7 8 11 | 긴박·드라마틱 |
| `major-pentatonic` | 0 2 4 7 9 | 평온·동요 없음 |
| `minor-pentatonic` | 0 3 5 7 10 | 차분·블루스 |
| `whole-tone` | 0 2 4 6 8 10 | 불안·부유·해결 없음 |

**진행(progression) 해석:** `chordMidis()` 함수가 로마 숫자 토큰(i~vii, 대소문자 무관)을 스케일 위 다이어토닉 트라이어드로 해석한다. `b` 또는 `♭` 접두사로 반음 내림(예: `bII` = 내림장2도). 단순 정수도 가능(1=i). 진행은 마디 단위로 순환하며 `pattern: 'chords'` 레이어가 이를 소비한다.

---

## 무드 → 스케일·BPM·프리셋·진행 매핑 표

lint-audio.mjs (b)mood-scale 검사가 이 표의 스케일·BPM 범위를 기계 검증한다.
`preset` 컬럼은 `engine/soundforge.js`의 `_makeInstrument` 프리셋 enum과 1:1 대응한다.

| 무드 토큰 | 스케일 (권장) | BPM 범위 | 리드 프리셋 | 베이스 프리셋 | 패드/벨 | 드럼 | 코드 진행 예 |
|---|---|---|---|---|---|---|---|
| `cheerful` (유쾌) | `major` · `major-pentatonic` | 120–150 | `square-lead` `pulse-lead` | `triangle-bass` | — | `kit` | `I–V–vi–IV` · `I–IV–V` |
| `warm` (따뜻) | `major` · `mixolydian` | 80–110 | `fm-ep` | `saw-bass` | `pad` | — (선택) | `I–V–vi–IV` · `IV–I–V` |
| `melancholy` (쓸쓸) | `aeolian` · `dorian` | 60–90 | `pluck` · `triangle-bass` | `saw-bass` | `pad` | `kit` (가볍게) | `i–VI–III–VII` · `i–iv–VII–III` |
| `tense` (긴박) | `phrygian` · `harmonic-minor` | 140–180 | `supersaw` | `saw-bass` | — | `kit` (강) | `i–bII–i` · `i–VII–VI–V` |
| `anxious` (긴장) | `locrian` · `whole-tone` | 70–100 | `fm-bell` (불협) | `saw-bass` (드론) | `pad` (저역) | — (불규칙) | tritone·안정 회피·`bII–i` |
| `calm` (평온) | `major-pentatonic` · `lydian` | 50–80 | `pluck` · `fm-bell` | `triangle-bass` | `pad` | — | `I–II` (Lydian) · 느린 변화 |
| `heroic` (장엄) | `major` · `mixolydian` | 90–130 | `supersaw` · `organ` | `saw-bass` | `pad` | `kit` (팀파니풍) | `I–V–vi–IV` · `I–bVII–IV` |
| `mystic` (신비) | `lydian` · `dorian` · `minor-pentatonic` | 70–100 | `fm-bell` | `triangle-bass` | `pad` | — (선택) | `I–II` (Lydian modal) · `i–VI–bVII` |

> **BPM 허용 오차:** lint의 `balanceConfig.bpmTolerance`(기본 ±12)로 엄격도 조절.
> **드럼 "—":** 해당 무드에선 드럼 레이어를 기본 생략한다. T2+ 에서 인텐시티가 올라갈 때 추가.
> **preset 조합:** `kit` 하나가 kick·snare·hihat 세 소스를 내부 관리(`_makeDrums`).

---

## MOOD-LOCK-FIRST

### `MOOD-LOCK-FIRST` 무드 토큰을 가장 먼저 확정한다

**정의:** 인터뷰 첫 단계에서 무드 토큰 1개(위 표의 8종 중 하나)를 확정한다. 이 토큰이 스케일·BPM·악기 프리셋·코드 진행·이펙트 양·믹스 밝기를 전부 프레이밍한다. 무드 없이 스케일이나 BPM을 먼저 고르는 것은 허용하지 않는다 — 이후 모든 결정이 무드에서 파생된다는 뜻이다.

**출처:** 음악 심리학 합의 — 무드(정서 의도)가 음악 형식 파라미터의 상위 제약임. dossier §무드 → 음악 매핑 표.

**우리 엔진 구현(SoundForge/audio.json):** `audio.json`의 `meta.mood`와 `bgm.tracks[id].mood`가 토큰을 공식 저장. lint (b)mood-scale이 track.mood ↔ 스케일/BPM을 자동 검증.

**흔한 실패:** "칩튠 느낌으로 해주세요" → 칩튠은 장르(음색)이지 무드가 아니다. 먼저 "칩튠 게임의 분위기는 유쾌(`cheerful`)인가 긴박(`tense`)인가?"를 물어 무드 토큰부터 확정한 뒤 `TIMBRE-CHIPTUNE` 레시피를 입힌다.

**연관:** `MOOD-SCALE-MAP` · `MOOD-LUDO-HARMONY` · [`principles.md §공통 캐논`](./principles.md)

---

## MOOD-SCALE-MAP

### `MOOD-SCALE-MAP` 무드에서 스케일/모드를 파생한다

**정의:** 확정된 무드 토큰으로 위 매핑 표에서 권장 스케일을 선택한다. 모드별 정서 캐릭터 — `major`=밝음·희망, `aeolian`=멜랑콜리, `dorian`=어둡지만 그라운디드, `phrygian`=이국·긴장, `lydian`=부유·몽환, `mixolydian`=블루지·밝음, `locrian`/`whole-tone`=불안 — 은 음악이론 합의이며 SoundForge `SCALES` 객체에 반음 인터벌로 코드화돼 있다.

**출처:** 음악이론 합의(All Music Modes, Musical U, Berklee Modes). dossier §무드 → 음악 매핑 표.

**우리 엔진 구현(SoundForge/audio.json):** `bgm.tracks[id].scale`이 SCALES 키(예: `"phrygian"`)를 받아 `degreeToMidi`가 음고를 계산한다. `major`와 `ionian`, `minor`와 `aeolian`은 동일 인터벌이라 둘 다 유효값.

**흔한 실패:** `anxious` 무드에 `major`를 고르면 밝고 안정된 소리가 나 무드와 충돌한다. `tense`에 `major-pentatonic`을 쓰면 너무 밝아 긴박감이 없다. 항상 매핑 표를 먼저 참조하고, 이탈 시에는 lint (b)가 경고를 내보낸다.

**연관:** `MOOD-LOCK-FIRST` · `MOOD-TEMPO` · `MOOD-PROGRESSION`

---

## MOOD-TEMPO

### `MOOD-TEMPO` 무드에서 BPM 범위를 파생한다

**정의:** 위 매핑 표의 BPM 범위 안에서 템포를 고른다. `tense`/`cheerful`의 고BPM(140–180/120–150)은 빠른 신체 반응을, `calm`/`melancholy`의 저BPM(50–90)은 여유와 내성을 유도한다. 범위 이탈이 필요하면 AUDIO.md §1에 이유를 명시한다.

**출처:** 음악 심리학 합의(템포–각성 상관). dossier §무드 → 음악 매핑 표.

**우리 엔진 구현(SoundForge/audio.json):** `bgm.tracks[id].bpm`이 `Tone.Transport.bpm.value`로 직접 전달된다. lint (b)mood-scale이 `bpmTolerance`(기본 ±12) 범위 이탈을 경고. `ADAPT-*` 수직 레이어링과 결합하면 같은 BPM 위에 레이어를 쌓아 강약을 표현하므로, 레이어 추가 때마다 BPM을 바꾸지 않아도 된다.

**흔한 실패:** `tense` 무드인데 분위기를 "무겁게" 만들겠다고 BPM을 70으로 낮추면, 저BPM 긴박함이 아니라 그냥 느린 장송곡이 된다. 무거운 긴박함은 BPM은 140+로 유지하면서 `phrygian` 스케일 + `bII–i` 진행 + 저역 드론으로 표현한다.

**연관:** `MOOD-SCALE-MAP` · `MOOD-PROGRESSION` · `ADAPT-VERTICAL`(인텐시티로 밀도 조절)

---

## MOOD-PROGRESSION

### `MOOD-PROGRESSION` 무드에서 코드 진행을 파생한다

**정의:** 위 매핑 표의 진행 예시를 출발점으로, 무드에 맞는 코드 관용구를 audio.json `progression` 배열에 지정한다. 코드 진행 자체는 저작권 비보호 공유재이므로 자유롭게 쓴다. 주요 관용구:
- **I–V–vi–IV**: 향수·대중성·유쾌·장엄 (팝 표준, major 계열)
- **i–VI–III–VII**: 몽환·동경·쓸쓸 (단조 로맨틱)
- **i–iv–VII–III**: 순환형 단조 — 멜랑콜리·내성
- **i–bII–i**: 프리기안 흔들림 — 이국·긴박 (tense/phrygian 표준)
- **i–VII–VI–V**: 하강 시퀀스 — 긴박·화성 운동감 (harmonic-minor)
- **I–II** (Lydian): 올림4도 긴장·몽환 — calm/mystic
- **tritone / 안정 회피**: anxious 전용 — 해결 없이 불협 유지

**출처:** 음악이론 합의(I–V–vi–IV 공유재, emastered synthwave 진행, guitarbased 로파이 진행). 진행 저작권 비보호: dossier §CC0 / IP-safe 가이드 §2.

**우리 엔진 구현(SoundForge/audio.json):** `progression` 배열의 각 토큰을 `chordMidis(token, scaleIv, rootSemi, octave)`가 다이어토닉 트라이어드로 해석. `♭`/`b` 접두로 반음 내림 지원. 패턴 `chords`가 진행을 한 마디 단위로 순환 재생.

**흔한 실패:** `anxious` 무드에 I–V–vi–IV를 쓰면 안정감이 생겨 긴장이 풀린다. 해결되지 않는 진행(tritone 페달, bII–i 반복)을 써야 긴장이 유지된다.

**연관:** `MOOD-SCALE-MAP` · `MOOD-ORIGINAL-MELODY` · [`ip-license-guard`](../../../wgf-ip-license-guard/SKILL.md)

---

## MOOD-LUDO-HARMONY

### `MOOD-LUDO-HARMONY` 음악이 코어 동사·STORY.md 톤과 같은 말을 한다

**정의:** "루도(ludo)·하모니" — 게임플레이 동사(점프·쏘기·달리기·매치)와 STORY.md 서사 톤이 음악의 의미와 같은 방향을 향해야 한다. 유쾌한 점프 게임에 단조 장송곡은 불협, 명상 퍼즐에 EDM 펌핑은 불협. 무드 토큰이 동사·톤을 반영하는지를 인터뷰 단계에서 검증한다.

**출처:** 게임 오디오 이론 합의 — 루도-내러티브 하모니의 사운드 확장(Game Audio Co, Berklee Scoring for Games). dossier §무드 → 음악 매핑 표.

**우리 엔진 구현(SoundForge/audio.json):** `meta.mood`가 STORY.md `tone`·`coreVerb`와 정합하는지는 lint가 아닌 **인터뷰 패스**에서 사람이 확인한다. AUDIO.md §1 "왜 이 무드인가" 란에 코어 동사·STORY 톤 연결 이유를 한 문장으로 적는다.

**흔한 실패:** STORY.md 톤이 "희망차고 따뜻한 모험"인데 분위기를 "강하게" 만들겠다고 `phrygian`+고BPM을 선택 → 서사와 불협. 강인함은 `heroic`+`major`+`mixolydian`+I–bVII–IV로 표현할 수 있다.

**연관:** `MOOD-LOCK-FIRST` · `MOOD-CONTRAST` · [`principles.md §안티패턴`](./principles.md)

---

## MOOD-CONTRAST

### `MOOD-CONTRAST` 섹션·레벨 간 무드 대비로 단조로움을 회피한다

**정의:** 한 게임 안의 여러 섹션(탐험/전투/보스)·여러 레벨 간에 무드 또는 인텐시티의 대비를 설계한다. 같은 무드가 끝없이 반복되면 청각 피로("habituation")가 오고 감정적 하이라이트가 사라진다. 대비 방법:
- **인텐시티 수직 레이어링**: 같은 무드 안에서 레이어 수(0→4)로 강약을 표현 (`ADAPT-VERTICAL`)
- **섹션 전환**: 탐험(calm/mystic) → 전투(tense) → 보스(heroic)처럼 무드를 교체 (`ADAPT-HORIZONTAL`)
- **일관성 유지**: 대비는 "같은 음색 패밀리 안에서" — 칩튠 게임은 칩튠 범위 내에서 강약·무드를 바꾼다 (`TIMBRE-ONE-FAMILY`)

**출처:** 적응형 음악 이론(Game Audio Co 수직/수평 전환). dossier §적응형 음악.

**우리 엔진 구현(SoundForge/audio.json):** `bgm.tracks`에 섹션별 트랙을 정의하고 `bgm.sections` 매핑으로 게임 상태 → 트랙을 라우팅. `setIntensity(0..1)`이 수직 레이어 게이트를, `setSection('boss')`이 수평 전환을 처리. 비트 동기 크로스페이드는 SoundForge 내부가 처리.

**흔한 실패:** 한 판이 30초인데 섹션을 5개로 쪼개면 전환이 너무 잦아 오히려 단절감. T1 게임은 인텐시티 레이어링만으로 대비를 충분히 만들 수 있다 (`ADAPT-MINIMAL`).

**연관:** `MOOD-LOCK-FIRST` · `MOOD-LUDO-HARMONY` · [`adaptive-music.md`](./adaptive-music.md)

---

## MOOD-ORIGINAL-MELODY

### `MOOD-ORIGINAL-MELODY` 멜로디를 절차 생성해 표절 우연 일치를 원천 회피한다

**정의:** 멜로디 라인을 ① 선택한 스케일의 음 + ② 모티프 변형(전위·역행·시퀀스) + ③ 유클리드 리듬으로 절차 생성한다. 특정 상용 곡의 식별 가능한 멜로디·리프를 코드에 넣지 않는다. 절차 생성 로직 자체가 오리지널이므로 CC0를 코드 레벨에서 보증한다.

모티프 변형 기법:
- **전위(inversion)**: 음정을 상하 반전 (올라가는 걸 내리게)
- **역행(retrograde)**: 음렬을 역순으로 재생
- **시퀀스(sequence)**: 모티프를 일정 음정 간격씩 평행 이동하며 반복
- **유클리드 리듬**: `bjorklund(hits, steps)` 알고리즘으로 hits개의 음을 steps개 슬롯에 최대한 균등 배치 → 문화적으로 자연스러운 리듬, 특정 곡과 우연 일치 최소화

**출처:** 절차 멜로디 생성 합의(유클리드 리듬 — Toussaint/sndkit; 마르코프 절차 음악 생성; 모티프 변형 이론). dossier §CC0 / IP-safe 가이드 §3.

**우리 엔진 구현(SoundForge/audio.json):** `pattern: 'arp'` 레이어가 스케일·진행 위에서 절차 아르페지오를 생성한다. 특정 멜로디 음렬을 `progression` 배열에 하드코딩하지 않는다 — 진행(화음 도수)만 지정하고 음렬은 엔진이 생성. audio.json `meta.originalityNote`에 "전 트랙 절차 합성 오리지널" 명시 → lint (g)cc0 검사.

**흔한 실패:** "마리오 느낌 주려고" 마리오 테마 음렬을 `arp` 패턴 시퀀스에 그대로 넣는다. → `CC0-ORIGINAL` 위반. 대신 `major`+고BPM+`square-lead`+유클리드 리듬으로 "유쾌한 플랫포머 느낌"을 오리지널로 생성.

**연관:** `MOOD-PROGRESSION` · `MOOD-SCALE-MAP` · [`ip-license-guard`](../../../wgf-ip-license-guard/SKILL.md) · [`consistency-tools.md §(g)cc0`](./consistency-tools.md)

---

## 출처

음악이론·모드 정서
- All Music Modes — 모드별 정서 레퍼런스: https://allmusicmodes.com/
- Musical U — Many Moods of Musical Modes: https://www.musical-u.com/learn/the-many-moods-of-musical-modes/
- Berklee Online — Music Modes (major/minor): https://online.berklee.edu/takenote/music-modes-major-and-minor/
- Wikipedia — Mode (music): https://en.wikipedia.org/wiki/Mode_(music)

코드 진행 관용구
- I–V–vi–IV 설명 (Musical Grammar): https://musicalgrammar.com/unlock-the-magic-of-pop-hits-the-i-v-vi-iv-chord-progression-explained/
- Synthwave 코드 진행 (eMastered): https://emastered.com/blog/synthwave-chord-progressions
- Lo-Fi 코드 진행 (Guitar Based): https://www.guitarbased.com/lo-fi-chord-progressions/

절차 멜로디 생성
- Euclidean Rhythms (sndkit / Paul Batchelor): https://paulbatchelor.github.io/sndkit/euclid/
- Euclidean Rhythms 설명 (Medium): https://medium.com/code-music-noise/euclidean-rhythms-391d879494df
- Markov Chain 절차 음악 생성 (논문): https://www.jstage.jst.go.jp/article/adada/21/1/21_19/_pdf

적응형 음악·게임 오디오
- Game Audio Co — 수직 레이어링 vs 수평 리시퀀싱: https://www.thegameaudioco.com/making-your-game-s-music-more-dynamic-vertical-layering-vs-horizontal-resequencing
- Berklee Online — Scoring for Games: https://online.berklee.edu/takenote/scoring-for-games-top-techniques-for-composing-music-for-interactive-media/
