# WebGameForge

> **"슈퍼마리오 게임 만들어줘"** 한마디로, 모바일 웹뷰에서 잘 돌아가는 완성도 높은 2D 웹 게임을 자동으로 벼려내는 **Claude Code 플러그인**.

![License](https://img.shields.io/badge/license-MIT-green)
![Phaser](https://img.shields.io/badge/engine-Phaser%204.1-blueviolet)
![Skills](https://img.shields.io/badge/skills-16-orange)
![Phaser refs](https://img.shields.io/badge/phaser--refs-28-informational)
![Assets](https://img.shields.io/badge/assets-CC0%20%2F%20IP--safe-success)
![Mobile](https://img.shields.io/badge/mobile--webview-ready-success)

기존 클로드 코드에 "웹 게임 만들어줘"라고 하면 바닐라 JS 수준의 투박한 결과가 나옵니다.
**WebGameForge는 게임 제작 의도를 자동 감지**해, 검증된 엔진 스택(Phaser 4(4.1.0) + 절차적 에셋/사운드 +
모바일 하니스)과 전문 스킬 14종으로 **스프라이트 애니메이션·HUD·터치 컨트롤·8비트 사운드까지 갖춘
게임**을 만들어 줍니다.

> 플러그인 내부 식별자는 `web-game-builder` 입니다(슬래시 커맨드·스킬 네임스페이스에 사용).
> **WebGameForge** 는 프로젝트/저장소 브랜드명입니다.

<p align="center">
  <img src="docs/img/title.png" width="49%" alt="타이틀 화면">
  <img src="docs/img/gameplay.png" width="49%" alt="게임플레이">
</p>

---

## ✨ 주요 특징

- **🪄 자동 발동** — "슈퍼마리오 만들어줘", "make a platformer", "탑다운 슈팅 만들어줘" 같은 자연어만으로
  관련 스킬이 자동 트리거됩니다. 별도 명령 암기가 필요 없습니다.
- **🎮 Phaser 4 기반** — Arcade 물리·타일맵·스프라이트 애니메이션·카메라 추적·HUD가 전부 1급 API로
  내장된 엔진(vendored `engine/phaser.min.js`, v4.1.0, MIT)을 사용합니다.
- **📱 모바일 웹뷰 대응** — iOS WKWebView, 카카오/인스타 인앱 브라우저까지 커버하는 Scale.FIT,
  'Tap to start' 오디오 언락, 멀티터치 가상 D-패드+점프 버튼이 기본 포함됩니다.
- **🎨 두 가지 아트 스타일** — 픽셀아트(`PixelForge`)와 **미려한 스무스/벡터**(`VectorForge` —
  그라데이션·글로우·소프트섀도우·글래스모피즘·곡선 캐릭터)를 모두 코드로 생성합니다. 게임당 한 스타일.
- **⚖️ CC0 / IP-safe 에셋** — 외부 파일 없이 절차적으로 생성하거나, 외부 HD CC0 아트를 라이선스
  게이트(`assets.json`, CC0만)로 로딩합니다. 닌텐도 등 타사 에셋·이름·시그니처 조합을 쓰지 않습니다.
- **🔊 8비트 사운드** — `ChipAudio`가 Web Audio API로 효과음과 **오리지널** BGM을 코드 합성합니다.
  오디오 파일 0개, 100% CC0.
- **🧩 15종 스킬 체계** — 장르 스캐폴드 5 + 제작요소 5 + 품질·운영 4 + 메인 오케스트레이터.
- **✅ 실제 실행 검증** — 헤드리스 step 하니스로 이동·충돌·메카닉을 결정적 검증. 데모 `super-runner`
  는 600프레임 연속 플레이 콘솔 에러 0으로 통과했습니다.
- **현재 범위: 2D 전용** — 플랫포머가 플래그십, 슈팅·아케이드·퍼즐·러너로 확장.

---

## 🚀 빠른 시작

### 설치

마켓플레이스를 등록합니다:

```
/plugin marketplace add v0o0v/web-game-forge
```

플러그인을 설치합니다:

```
/plugin install web-game-builder@web-game-builder-marketplace
```

로컬 개발 환경에서 유효성 검사:

```
claude plugin validate ./ --strict
```

### 사용

자연어로 그냥 요청하면 됩니다:

```
슈퍼마리오류 플랫포머 게임 만들어줘
```

또는:

```
make a top-down shooter with waves of enemies
```

명시적 슬래시 커맨드로도 호출할 수 있습니다:

```
/web-game-builder:make-game 벽돌깨기 게임
```

세부 작업도 해당 전문 스킬이 자동으로 잡습니다 — "효과음 추가해줘", "레벨 하나 더 만들어줘",
"모바일에서 최적화해줘", "60fps로 만들어줘" 등.

### 데모 실행

프로젝트 루트에서 로컬 서버를 실행합니다:

```
python -m http.server 8766
```

브라우저에서 접속합니다:

```
http://127.0.0.1:8766/games/super-runner/index.html
```

---

## 🕹 데모: super-runner

`games/super-runner/`에 포함된 슈퍼마리오류 플랫포머 데모입니다. 100% 절차적(CC0/IP-safe) 에셋.

### 조작법

| 입력 | 동작 |
|------|------|
| ← / → | 좌우 이동 |
| ↑ / A / Space | 점프 |
| 화면 터치 | 모바일 가상 D-패드 + A 버튼 |

### 구현된 메카닉

- **이동**: 가속·마찰 기반 좌우 이동, 달리는 애니메이션
- **점프**: 가변 높이(버튼을 오래 누를수록 높이), 코요테 타임, 점프 버퍼
- **카메라**: 플레이어를 부드럽게 추적하는 수평 스크롤
- **코인**: 획득 +100점 + 효과음
- **물음표 블록**: 아래서 치면 코인 팝업(+200점) 또는 버섯 등장
- **적(보라 슬라임)**: 밟아 처치 +100점, 부딪히면 목숨 감소(큰 상태면 작아짐)
- **파워업(초록 버섯)**: 먹으면 몸집이 커짐(+1000점)
- **HUD**: 코인 카운트 / SCORE / WORLD / TIME / 목숨(주인공 아이콘 ×N)
- **타이틀 화면**: 'TAP TO START' → 오디오 언락 후 게임 시작
- **목숨·구덩이·게임오버**: 구덩이 추락/피격 시 목숨 감소, 0이면 게임오버(registry 영속)
- **캐릭터**: '빨간 모자 러너' — 오리지널(닌텐도 마리오 미사용)

---

## 🎨 아트 스타일

게임당 한 가지 렌더 스타일을 택합니다 — 둘 다 외부 다운로드 0, 코드 생성(CC0/IP-safe).

- **픽셀아트** (`PixelForge`, `pixelArt:true`) — NES풍 레트로. 데모 `games/super-runner/` 참고.
- **미려한 스무스/벡터** (`VectorForge`, `pixelArt:false`) — 그라데이션·글로우·소프트섀도우·
  글래스모피즘·곡선 캐릭터. 4가지 스타일 쇼케이스: `games/style-preview/`.

![VectorForge 스무스 그래픽 쇼케이스](docs/img/vectorforge.png)

필요하면 외부 HD CC0 아트(SVG/래스터)도 `assets.json` 라이선스 게이트로 로딩합니다.

---

## 🧩 스킬 카탈로그 (16종)

메인 `web-game-builder`가 전체 흐름을 조율하고, 요청 성격에 따라 전문 스킬이 자동 발동합니다.
**장르로 스캐폴드 → 제작요소로 살붙이기 → 품질로 검증·최적화** 순서로 협력합니다.

| 분류 | 스킬 | 역할 |
|------|------|------|
| 메인 | `web-game-builder` | 게임 제작 요청 감지·오케스트레이션 |
| 🎮 장르 | `platformer-game` | 옆스크롤 플랫포머(마리오류) |
| | `topdown-shooter` | 탑다운/트윈스틱 슈팅 |
| | `arcade-classic` | 벽돌깨기·뱀·퐁·인베이더 |
| | `puzzle-game` | 테트리스·매치3·2048 |
| | `endless-runner` | 무한 러너·플래피류 |
| 🛠 제작요소 | `sprite-forge` | PixelForge 픽셀아트 스프라이트·애니메이션 |
| | `vector-graphics` | VectorForge 미려한 스무스/벡터 그래픽 + 외부 HD CC0 로딩 |
| | `chip-sound` | ChipAudio 효과음·BGM |
| | `level-designer` | 레벨·맵·타일맵 설계 |
| | `game-ui-hud` | HUD·메뉴·UI 화면 |
| | `juice-fx` | 파티클·스크린셰이크·게임필 |
| ✅ 품질·운영 | `mobile-webview-tune` | 모바일 웹뷰 최적화·감사 |
| | `game-qa` | 헤드리스 step 하니스 동작 검증 |
| | `ip-license-guard` | 저작권·라이선스 안전 점검 |
| | `perf-60fps` | 60fps 성능 최적화 |

각 전문 스킬은 tight한 description으로 관련 요청에만 발동하도록 설계해 스킬 listing 예산
(컨텍스트 ~1%)을 관리합니다(총 ≈2.4k자, 개별 캡 1,536자 내).

### 📚 Phaser 4 API 레퍼런스 라이브러리

`skills/web-game-builder/reference/phaser/` 디렉터리에 **Phaser 공식 v4 에이전트용 스킬 문서
28종 + INDEX.md** 를 벤더링하고 있습니다. 게임 생성 시 우리 스킬들이 이 레퍼런스를 직접 참조해
Phaser 4 API 의 정확한 사용법(씬 라이프사이클·물리·스케일·입력·파티클 등)을 LLM 코드생성에
반영합니다. 벤더링 출처: Phaser 공식 skills(MIT 라이선스). v3 API 혼용으로 인한 코드생성 오류를
원천 차단합니다.

---

## ⚙️ 엔진 라이브러리 4종 (`engine/`)

### PixelForge (`pixelforge.js`)
문자 그리드로 정의한 스프라이트를 Phaser 텍스처로 굽는 절차적 픽셀아트 생성기. 외부 이미지 0,
CC0/IP-safe. 라가드 행 자동 패딩으로 픽셀 작업이 덜 실수납니다.

```js
PixelForge.bake(this, 'star', {
  palette: { 'y': '#ffe23f', 'w': '#fff7c0' },
  frames: [ ["..y..", ".ywy.", "ywwwy", ".ywy.", "..y.."] ]
});
```

### VectorForge (`vectorforge.js`)
PixelForge의 비-픽셀 짝꿍. 그라데이션·글로우·소프트섀도우·글래스질·곡선 캐릭터 같은 **미려한**
그래픽을 코드로 생성(슈퍼샘플 안티앨리어스). 외부 0, CC0/IP-safe.

```js
VectorForge.bake(this, 'orb', { w:24, h:24, draw:(ctx,w,h,t,VF) => {
  VF.glow(ctx, 'rgba(70,220,255,0.9)', 9, () => {
    VF.circle(ctx, w/2, h/2, 8);
    ctx.fillStyle = VF.radial(ctx, w/2, h/2, 9, [[0,'#eaffff'],[0.4,'#66f0ff'],[1,'#2bb6e0']]);
    ctx.fill();
  });
}});
```

### ChipAudio (`audio.js`)
Web Audio API만으로 8비트 효과음과 **오리지널** BGM을 코드 합성. 오디오 파일 0, 100% CC0.
첫 사용자 제스처에서 `audio.unlock()`으로 모바일 오디오 언락.

### MobileHarness (`mobile.js`)
모바일 웹뷰 베스트프랙티스를 한 곳에: `scaleConfig()`(FIT+CENTER), `installDomGuards()`(iOS 줌/스크롤
차단), `TouchControlsClass()`(멀티터치 D-패드+점프 버튼 Scene).

> 자세한 API는 [skills/web-game-builder/reference/engine-api.md](skills/web-game-builder/reference/engine-api.md).

---

## 🔌 자동 트리거 동작 방식

게임 제작 요청 시 3계층 중 하나(또는 복수)가 발동합니다:

1. **1차 — SKILL.md description (의미 기반)** — 한/영 고밀도 키워드로 Claude가 요청 의미를 파악해
   스킬 자동 선택.
2. **2차 — UserPromptSubmit 훅 (결정론적)** — `scripts/detect-game-intent.js`(Node, 크로스플랫폼)가
   정규식으로 의도를 감지하면 `additionalContext`를 `<system-reminder>`로 주입(넛지). `decision:block`이
   아니라 사용자 프롬프트는 보존됩니다.
3. **3차 — 슬래시 커맨드 (명시적)** — `/web-game-builder:make-game <설명>`.

---

## 📁 프로젝트 구조

```
web-game-forge/
├── .claude-plugin/  plugin.json · marketplace.json   # 플러그인 매니페스트
├── skills/                                            # 15종 스킬 (메인 1 + 전문 14)
│   ├── web-game-builder/  (+ reference/engine-api · mobile-webview)
│   ├── platformer-game/  topdown-shooter/  arcade-classic/  puzzle-game/  endless-runner/
│   ├── sprite-forge/  vector-graphics/  chip-sound/  level-designer/  game-ui-hud/  juice-fx/
│   └── mobile-webview-tune/  game-qa/  ip-license-guard/  perf-60fps/
├── hooks/hooks.json                                   # UserPromptSubmit 의도 감지 등록
├── scripts/detect-game-intent.{js,ps1,sh}            # 한/영 의도 감지(크로스플랫폼)
├── commands/make-game.md                              # /web-game-builder:make-game
├── engine/  phaser.min.js · pixelforge.js · vectorforge.js · audio.js · mobile.js   # 재사용 엔진
├── games/  super-runner/(픽셀 데모) · style-preview/(스무스 4스타일 쇼케이스)
├── assets.json                                        # CC0 라이선스 게이트 매니페스트
├── docs/  설계.md · img/                              # 아키텍처 명세 · 스크린샷
├── README.md · LICENSE
```

---

## ⚖️ 라이선스 및 IP 안전 정책

- **코드**: MIT (`LICENSE`) · **Phaser 4.1.0**: MIT (vendored, `engine/phaser.LICENSE.txt`)
- **에셋**: 전부 CC0 또는 절차적 생성 (외부 저작물 미사용)
- **닌텐도 미사용 원칙**: 마리오 스프라이트·사운드·이름 'Mario'·시그니처 조합(빨간모자+콧수염+
  파란 멜빵+배관공+이탈리안)을 절대 사용하지 않습니다.
- **장르·메카닉은 자유**: 옆스크롤·점프·밟기·코인·깃발 골인 등은 저작권 보호 대상이 아닙니다.
- **CC0 팩 사용 시**: `assets.json` 라이선스 게이트로 CC0만 허용, `CREDITS.txt`에 출처 명시.

---

## 🔍 검증 결과

chrome-devtools MCP로 실제 실행 검증 (super-runner):
- 타이틀/게임/HUD 렌더 정상
- 이동·가속·마찰·가변 점프·코요테·버퍼·카메라 추적·애니메이션 정상
- 코인(+100)·적 밟기(+100)·물음표블록 코인팝(+200) 메카닉 결정적 검증 통과
- 600프레임 연속 플레이 **콘솔 에러 0**
- 검증 중 실버그 2건 발견·수정(TouchControls 포인터 배열, 목숨 registry 영속화)

---

## 🗺 로드맵

현재 **2D 전용, 플래그십은 슈퍼마리오류 플랫포머**입니다. 향후 검토:

- ~~Phaser 4 업그레이드~~ — **완료** (v4.1.0 vendored + 공식 v4 레퍼런스 28종 벤더링)
- 장르 템플릿을 동작 데모까지 승격 (현재 지침형 → super-runner 같은 실동작 코드)
- Tiled 맵 에디터(.tmj) 연동
- Phaser 가상조이스틱 플러그인 검토 (현재 자체 D-패드)
- Capacitor/Cordova 네이티브 래퍼(앱스토어 배포) 가이드
- CC0 실제 팩(Kenney/Pixel Frog) 벤더링 옵션
- CC-BY 에셋 자동 attribution 생성

---

## 🙋 기여 / 문의

- 작성자: v0o0v (v0o0v2@gmail.com) · 라이선스: MIT
- 자세한 아키텍처: [docs/설계.md](docs/설계.md)

🤖 [Claude Code](https://claude.com/claude-code)로 제작·검증되었습니다.
