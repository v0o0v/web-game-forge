<div align="right">

**🇰🇷 한국어** · [🌐 English](README.en.md)

</div>

# 🎮 WebGameForge

> **"슈퍼마리오 게임 만들어줘"** — 이 한마디면 됩니다.
> 모바일 웹뷰에서도 잘 돌아가는 완성도 높은 2D 웹 게임을 자동으로 벼려내는 **Claude Code 플러그인**.

![License](https://img.shields.io/badge/license-MIT-green)
![Phaser](https://img.shields.io/badge/engine-Phaser%204.1-blueviolet)
![Skills](https://img.shields.io/badge/skills-31-orange)
![Assets](https://img.shields.io/badge/assets-CC0%20%2F%20IP--safe-success)
![Mobile](https://img.shields.io/badge/mobile--webview-ready-success)

<p align="center">
  <img src="docs/img/title.png" width="49%" alt="타이틀 화면">
  <img src="docs/img/gameplay.png" width="49%" alt="게임플레이">
</p>

---

## 👋 처음 오셨나요?

**WebGameForge는 Claude Code에게 "게임 만들어줘"라고 말만 하면 진짜 플레이 가능한 2D 웹 게임을 만들어 주는 플러그인입니다.**

코딩을 몰라도 됩니다. 게임 엔진을 배울 필요도 없습니다. 그냥 한국어(또는 영어)로 *어떤 게임을 원하는지* 말하면, WebGameForge가 알아서:

- 🎨 캐릭터·배경 그래픽을 **코드로 생성**하고 (외부 파일 0개, 저작권 안전)
- 🔊 효과음·배경음악을 **합성**하고
- 📱 **모바일 터치 컨트롤**까지 붙여서
- ✅ 실제로 돌려보고 **버그까지 잡은** 완성품을 내줍니다.

> 💡 일반 Claude Code에게 "웹 게임 만들어줘"라고 하면 투박한 바닐라 JS 결과가 나옵니다.
> WebGameForge는 게임 제작 의도를 **자동으로 감지**해, 검증된 엔진 스택과 전문 스킬 31종으로
> 한 단계 위의 결과를 만들어 줍니다.

---

## 🚀 3분 만에 시작하기

### 1️⃣ 설치 (Claude Code 안에서)

마켓플레이스를 등록하세요:

```
/plugin marketplace add v0o0v/web-game-forge
```

플러그인을 설치하세요:

```
/plugin install web-game-builder@web-game-builder-marketplace
```

### 2️⃣ 게임 만들기 (그냥 말로)

설치가 끝나면, 평소처럼 Claude Code에게 자연어로 말하면 됩니다:

```
슈퍼마리오류 플랫포머 게임 만들어줘
```

영어도 됩니다:

```
make a top-down shooter with waves of enemies
```

별도의 명령어를 외울 필요가 없습니다. WebGameForge가 "게임을 만들고 싶구나"를 알아서 감지해
관련 전문 스킬을 자동으로 켭니다. 만들어진 게임은 `games/<게임이름>/` 폴더에 들어갑니다.

### 3️⃣ 브라우저에서 플레이

프로젝트 루트에서 로컬 서버를 켜고:

```
python -m http.server 8766
```

브라우저에서 열어보세요 (게임 이름은 만든 것에 맞게):

```
http://127.0.0.1:8766/games/super-runner/index.html
```

🎉 끝입니다! 키보드 방향키와 점프로 바로 플레이할 수 있고, 휴대폰으로 열면 터치 컨트롤이 뜹니다.

---

## 🕹 먼저 데모부터 보고 싶다면

설치 직후에도 곧바로 플레이할 수 있는 데모 `super-runner`가 들어 있습니다.
슈퍼마리오류 플랫포머이고, 그래픽·사운드 전부 절차적으로 생성된 100% 저작권-안전(CC0) 에셋입니다.

위 3️⃣번처럼 로컬 서버를 켠 뒤 접속하세요:

```
http://127.0.0.1:8766/games/super-runner/index.html
```

| 입력 | 동작 |
|------|------|
| ← / → | 좌우 이동 |
| ↑ / A / Space | 점프 (오래 누르면 더 높이) |
| 화면 터치 | 모바일 가상 D-패드 + 점프 버튼 |

코인 먹기(+100), 적 밟기, 물음표 블록, 버섯 파워업, 목숨/게임오버까지 — 작지만 "진짜 게임"의
감을 바로 느낄 수 있습니다.

---

## 🎯 무엇을 만들 수 있나요?

자연어로 요청하면 장르에 맞는 스캐폴드가 자동으로 잡힙니다. 이렇게 말해보세요:

| 만들고 싶은 것 | 이렇게 말하면 됩니다 |
|------|------|
| 🏃 **플랫포머** (마리오류) | `"옆스크롤 점프 게임 만들어줘"` |
| 🔫 **탑다운/트윈스틱 슈팅** | `"적이 몰려오는 탑다운 슈팅 만들어줘"` |
| 🧱 **클래식 아케이드** | `"벽돌깨기 게임 만들어줘"` (뱀·퐁·인베이더도) |
| 🧩 **퍼즐** | `"테트리스 만들어줘"` (매치3·2048도) |
| ♾️ **무한 러너** | `"플래피버드 같은 러너 만들어줘"` |

게임을 만든 뒤에도 세부 요청을 계속 자연어로 하면 됩니다:

```
효과음 추가해줘
```

```
레벨 하나 더 만들어줘
```

```
모바일에서 60fps로 최적화해줘
```

각 요청을 해당 전문 스킬이 알아서 잡습니다.

---

## ✨ 왜 WebGameForge인가요?

<table>
<tr>
<td width="50%">

**🪄 명령어 암기 불필요**
"슈퍼마리오 만들어줘" 같은 자연어만으로 관련 스킬이 자동 발동합니다.

**🎮 검증된 엔진 스택**
Phaser 4 (v4.1.0, MIT) 기반. 물리·타일맵·애니메이션·카메라·HUD가 전부 1급 API.

**📱 모바일 웹뷰 대응**
iOS WKWebView, 카카오/인스타 인앱 브라우저까지. 화면 맞춤·오디오 언락·터치 컨트롤 기본 포함.

</td>
<td width="50%">

**🎨 그래픽을 코드로 생성**
픽셀아트(`PixelForge`)와 미려한 벡터(`VectorForge`) 모두 외부 파일 없이 코드로 생성.

**🔊 8비트 너머 사운드**
칩튠부터 신스웨이브·앰비언트·적응형 음악까지 코드 합성. 오디오 파일 0개.

**⚖️ 저작권 안전 (IP-safe)**
전부 CC0 또는 절차적 생성. 닌텐도 등 타사 에셋·이름·시그니처를 쓰지 않습니다.

</td>
</tr>
</table>

> **✅ 그냥 그럴듯한 게 아니라 진짜 돌아갑니다** — 헤드리스 step 하니스로 이동·충돌·메카닉을
> 결정적으로 검증합니다. 데모 `super-runner`는 600프레임 연속 플레이에서 콘솔 에러 0으로 통과했습니다.

---

## 🖥 GUI로 편집하고 싶다면 — WGF Studio 에디터

코드뿐 아니라 **브라우저 게임 에디터**도 들어 있습니다. 유니티식 GUI로 씬·게임오브젝트를 직접
편집하고, 에디터 안에서 Claude와 함께 편집하며, Play로 확인한 뒤 빌드 없이 정적 게임으로
export 할 수 있습니다.

```
WGF Studio 에디터 켜줘
```

---

## 📚 더 깊이 알아보기

> 아래는 좀 더 자세히 파고들고 싶은 분을 위한 레퍼런스입니다.
> 처음이라면 위 "3분 만에 시작하기"만으로 충분합니다 — 펼쳐 보는 건 나중에 해도 됩니다.

<details>
<summary><b>🧩 스킬 카탈로그 (31종)</b> — 어떤 전문 스킬들이 협력하나요?</summary>

<br>

메인 `web-game-builder`가 전체 흐름을 조율하고, 요청 성격에 따라 전문 스킬이 자동 발동합니다.
**장르로 스캐폴드 → 제작요소로 살붙이기 → 품질로 검증·최적화** 순서로 협력합니다.

| 분류 | 스킬 | 역할 |
|------|------|------|
| 메인 | `web-game-builder` | 게임 제작 요청 감지·오케스트레이션 |
| 🖥 에디터 | `editor` | **WGF Studio** 브라우저 게임 에디터 — 유니티식 GUI 씬 편집·Claude 협업·무빌드 export |
| 🎮 장르 | `platformer-game` | 옆스크롤 플랫포머(마리오류) |
| | `topdown-shooter` | 탑다운/트윈스틱 슈팅 |
| | `arcade-classic` | 벽돌깨기·뱀·퐁·인베이더 |
| | `puzzle-game` | 테트리스·매치3·2048 + 퍼즐 보드게임 |
| | `endless-runner` | 무한 러너·플래피류 |
| 🎨 비주얼 | `style-architect` | **게임 전체 아트 디렉션** 정의·강제(팔레트·셰이딩·무드) — 단일 시각 언어 |
| | `sprite-picker` | 실제 CC0 스프라이트/시트/애니를 **브라우저 갤러리에서 시각적으로 골라 적용** |
| | `sprite-forge` | PixelForge 픽셀아트 스프라이트·애니메이션(절차 생성) |
| | `vector-graphics` | VectorForge 미려한 스무스/벡터 그래픽 + 외부 HD CC0 로딩 |
| 🔊 사운드 | `sound-architect` | 무드·BGM·효과음·**적응형 음악** 사운드 설계(8비트 너머, Tone.js v15) |
| | `chip-sound` | ChipAudio 8비트(칩튠) 경량 효과음·BGM |
| 📐 설계 | `world-map-architect` | 스테이지를 잇는 **진행 맵 위상** 설계 + 맵 화면 빌드 |
| | `level-architect` | 난이도 곡선·재미 극대화 레벨 **설계** |
| | `level-designer` | 레벨·맵(타일맵) **빌드**(구현) |
| | `story-architect` | 톤·스토리·캐릭터·대사·반전 **서사 설계** (`STORY.md` 바이블) |
| | `ability-architect` | 액티브·패시브·이동기·궁극기·콤보·스킬트리 **캐릭터 능력 시스템 설계** |
| | `item-architect` | 소모품·장비·통화·시너지 **아이템 설계** (`ITEMS.md` + `items.json`) |
| 🛠 연출 | `game-ui-hud` | HUD·메뉴·UI 화면 |
| | `juice-fx` | 파티클·스크린셰이크·게임필 |
| 🧩 Phaser 고급 | `matter-physics` | Matter 강체 물리(슬링샷·쌓기·래그돌) |
| | `screen-fx` | 포스트FX 화면 룩(블룸·비네트·CRT·네온) |
| | `lighting-mood` | 동적 라이팅·분위기(점광원·안개·밤하늘) |
| | `path-motion` | 경로·모션(스플라인 패트롤·방사 탄막) |
| | `virtual-joystick` | 가상 조이스틱(아날로그/트윈스틱) 터치 컨트롤 |
| ✅ 품질·운영 | `mobile-webview-tune` | 모바일 웹뷰 최적화·감사 |
| | `game-qa` | 헤드리스 step 하니스 동작 검증 |
| | `ip-license-guard` | 저작권·라이선스 안전 점검 |
| | `perf-60fps` | 60fps 성능 최적화 |
| | `sprite-catalog-refresh` | sprite-picker의 CC0 소스 카탈로그 재조사·갱신 |

각 전문 스킬은 tight한 description으로 관련 요청에만 발동하도록 설계해 스킬 listing 예산
(컨텍스트 ~1%)을 관리합니다.

</details>

<details>
<summary><b>⚙️ 엔진 라이브러리 (<code>engine/</code>)</b> — 게임을 떠받치는 재사용 모듈들</summary>

<br>

게임이 필요한 모듈만 `index.html`에 스크립트로 추가해 씁니다. 미사용 게임엔 부담 0.

| 모듈 | 역할 |
|------|------|
| **PixelForge** (`pixelforge.js`) | 문자 그리드로 정의한 스프라이트를 Phaser 텍스처로 굽는 절차적 픽셀아트 생성기 |
| **VectorForge** (`vectorforge.js`) | 그라데이션·글로우·소프트섀도우·곡선 캐릭터 등 미려한 그래픽을 코드 생성 |
| **SoundForge** (`soundforge.js` + `tone.js`) | 8비트 너머 게임 사운드 엔진 — ADSR·필터·FM·적응형 레이어드 BGM (Tone.js v15) |
| **ChipAudio** (`audio.js`) | Web Audio API만으로 8비트 칩튠 효과음·BGM 합성 (경량 레인) |
| **MobileHarness** (`mobile.js`) | 화면 맞춤·iOS 줌/스크롤 차단·멀티터치 D-패드+점프 버튼 |
| **JoystickKit** (`joystickkit.js`) | 가상 조이스틱(아날로그/트윈스틱) — 360° 방향+세기·이동/조준 분리 |
| **RngForge** (`rngforge.js`) | 시드 결정론 난수 — 같은 시드 → 항상 같은 수열(재현·검증 가능) |
| **TiledForge** (`tiled.js`) | Tiled 맵 포맷(.tmj)을 외부 PNG 없이 연동 + 애니메이션/등각·육각/GPU 레이어 |
| **AbilityKit** (`abilitykit.js`) | 캐릭터 능력 런타임 — 쿨다운·자원·콤보·스킬트리 해금을 데이터 구동 |
| **MatterKit / ScreenFX / LightingKit / PathKit** | Phaser 4 고급 기능(강체 물리·포스트FX·라이팅·경로)을 한 줄 API로 |
| **StyleKit** (`stylekit.js`) | `style-architect`가 정의한 게임 전체 시각 언어를 엔진에 배선 |
| **SceneKit** (`scenekit*.js`) | WGF Studio 에디터의 선언형 씬(scene.json) 로직 코어 + Phaser 어댑터 |

예) 픽셀아트 별 스프라이트 한 줄로 굽기:

```js
PixelForge.bake(this, 'star', {
  palette: { 'y': '#ffe23f', 'w': '#fff7c0' },
  frames: [ ["..y..", ".ywy.", "ywwwy", ".ywy.", "..y.."] ]
});
```

> 자세한 API: [skills/wgf-web-game-builder/reference/engine-api.md](skills/wgf-web-game-builder/reference/engine-api.md)

</details>

<details>
<summary><b>🎨 아트 스타일 — 픽셀 vs 벡터</b></summary>

<br>

게임당 한 가지 렌더 스타일을 택합니다 — 둘 다 외부 다운로드 0, 코드 생성(CC0/IP-safe).

- **픽셀아트** (`PixelForge`, `pixelArt:true`) — NES풍 레트로. 데모 `games/super-runner/`.
- **미려한 스무스/벡터** (`VectorForge`, `pixelArt:false`) — 그라데이션·글로우·소프트섀도우·
  글래스모피즘·곡선 캐릭터. 쇼케이스: `games/style-preview/`.

![VectorForge 스무스 그래픽 쇼케이스](docs/img/vectorforge.png)

**🖼 스프라이트 직접 고르기** — 화면 비주얼은 재미를 크게 좌우하므로, `sprite-picker` 스킬이
라이선스-안전(CC0) 스프라이트를 **브라우저 갤러리에서 클릭으로 골라** 적용 슬롯(플레이어·적·코인…)에
배정하게 합니다. 출처는 ① 큐레이션 CC0 카탈로그 ② 로컬 파일 ③ 이전 사용분 ④ 절차 생성 중 선택.
한 번 쓴 스프라이트는 `assets-library/`에 보관됩니다. 게임 전체 룩(팔레트·셰이딩·무드)은
`style-architect`가 한 번 정의해 강제합니다.

</details>

<details>
<summary><b>🔌 자동 트리거는 어떻게 동작하나요?</b></summary>

<br>

게임 제작 요청 시 3계층 중 하나(또는 복수)가 발동합니다:

1. **1차 — SKILL.md description (의미 기반)** — 한/영 고밀도 키워드로 Claude가 요청 의미를
   파악해 스킬 자동 선택.
2. **2차 — UserPromptSubmit 훅 (결정론적)** — `scripts/detect-game-intent.js`가 정규식으로
   의도를 감지하면 `additionalContext`를 `<system-reminder>`로 주입(넛지). 프롬프트는 보존됩니다.
3. **3차 — 슬래시 커맨드 (명시적)** — `/web-game-builder:wgf-make-game <설명>`.

</details>

<details>
<summary><b>🧬 게임 DNA & Phaser 4 레퍼런스 라이브러리</b></summary>

<br>

**📚 Phaser 4 API 레퍼런스** — `skills/wgf-web-game-builder/reference/phaser/`에 Phaser 공식 v4
에이전트용 스킬 문서 28종 + INDEX를 벤더링. 게임 생성 시 우리 스킬들이 이를 직접 참조해 v3/v4
혼용 오류를 원천 차단합니다(출처: Phaser 공식 skills, MIT).

**🧬 게임 DNA 레퍼런스** — `skills/wgf-web-game-builder/reference/game-dna/`에 인기 2D 게임들의
재미 요소 분석을 담았습니다. 플랫포머·러너·아케이드·퍼즐·슈터·물리 게임을 **코어 루프·재미요소
(`FE-*` 태그)·메카닉·난이도 곡선·우리 엔진 재현도** 템플릿으로 분해. 퍼즐 35종 심화
(`game-dna/puzzle/`)와 보드게임 아틀라스 100종(`game-dna/board/`)까지 합쳐 **총 164작**이
"어떤 게임 만들지" 명확화 단계의 조합 재료가 됩니다. **메카닉·재미만 분석** — 이름·캐릭터·
스프라이트·음악 등 저작물은 쓰지 않습니다.

</details>

<details>
<summary><b>📁 프로젝트 구조</b></summary>

<br>

```
web-game-forge/
├── .claude-plugin/  plugin.json · marketplace.json   # 플러그인 매니페스트
├── skills/                                            # 31종 스킬 (메인 + 전문)
│   ├── wgf-web-game-builder/   (+ reference/engine-api · phaser/ 28종 · game-dna/ 164작 분석)
│   ├── wgf-editor/             (WGF Studio 브라우저 에디터)
│   ├── wgf-platformer-game/  wgf-topdown-shooter/  wgf-arcade-classic/  wgf-puzzle-game/  wgf-endless-runner/
│   ├── wgf-style-architect/  wgf-sprite-picker/  wgf-sprite-forge/  wgf-vector-graphics/
│   ├── wgf-sound-architect/  wgf-chip-sound/
│   ├── wgf-world-map-architect/  wgf-level-architect/  wgf-level-designer/
│   ├── wgf-story-architect/  wgf-ability-architect/  wgf-item-architect/
│   ├── wgf-game-ui-hud/  wgf-juice-fx/
│   ├── wgf-matter-physics/  wgf-screen-fx/  wgf-lighting-mood/  wgf-path-motion/  wgf-virtual-joystick/
│   └── wgf-mobile-webview-tune/  wgf-game-qa/  wgf-ip-license-guard/  wgf-perf-60fps/  wgf-sprite-catalog-refresh/
├── engine/                                            # 재사용 엔진(PixelForge·VectorForge·SoundForge·SceneKit 등)
├── editor/                                            # WGF Studio 에디터 런타임·UI
├── hooks/hooks.json                                   # UserPromptSubmit 의도 감지 등록
├── scripts/detect-game-intent.{js,ps1,sh}            # 한/영 게임 의도 감지(크로스플랫폼)
├── commands/wgf-make-game.md                          # /web-game-builder:wgf-make-game
├── games/                                             # super-runner · nocturne · tiled-* · style-preview 등 데모
├── assets-library/ · assets.json                      # 이전 사용 스프라이트 · CC0 라이선스 게이트
├── docs/  설계.md · img/                              # 아키텍처 명세 · 스크린샷
└── README.md · README.en.md · LICENSE
```

</details>

<details>
<summary><b>🔍 검증 결과</b></summary>

<br>

chrome-devtools MCP로 실제 실행 검증 (super-runner):
- 타이틀/게임/HUD 렌더 정상, 이동·가변 점프·코요테·버퍼·카메라·애니메이션 정상
- 코인(+100)·적 밟기(+100)·물음표블록 코인팝(+200) 메카닉 결정적 검증 통과
- 600프레임 연속 플레이 **콘솔 에러 0** (검증 중 실버그 2건 발견·수정)

chrome-devtools MCP로 실제 실행 검증 (nocturne — Phaser 고급 4종 통합 데모, **WebGL**):
- Matter 슬링샷 한 발에 상자 7개 토폴(결정적 스텝 검증), 스플라인 등불 4/4 명중
- 점광원·Simplex 안개 + 블룸·비네트 WebGL 렌더 정상

</details>

---

## ⚖️ 라이선스 및 IP 안전 정책

- **코드**: MIT (`LICENSE`)
- **Phaser 4.1.0** · **Tone.js v15**: MIT (vendored)
- **에셋**: 전부 CC0 또는 절차적 생성 (외부 저작물 미사용)
- **닌텐도 미사용 원칙**: 마리오 스프라이트·사운드·이름 'Mario'·시그니처 조합(빨간모자+콧수염+
  파란 멜빵+배관공+이탈리안)을 절대 사용하지 않습니다.
- **장르·메카닉은 자유**: 옆스크롤·점프·밟기·코인 등은 저작권 보호 대상이 아닙니다.

> 플러그인 내부 식별자는 `web-game-builder`입니다(슬래시 커맨드·스킬 네임스페이스).
> **WebGameForge**는 프로젝트/저장소 브랜드명입니다.

---

## 🙋 기여 / 문의

- 작성자: v0o0v (v0o0v2@gmail.com) · 라이선스: MIT
- 자세한 아키텍처: [docs/설계.md](docs/설계.md)

🤖 [Claude Code](https://claude.com/claude-code)로 제작·검증되었습니다.
