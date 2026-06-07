# 소싱 절차 — 선택을 실제 게임에 적용하는 법

피커에서 회수한 선택([picker-protocol.md](./picker-protocol.md))을 4가지 경로로 처리한다. 모든
경로의 공통 원칙: **CC0/IP-safe 우선 · `games/<slug>/assets/` 벤더링 · `assets.json` 등록 ·
`assets-library/` 누적 · Phaser 4 로드 · 검증.**

> **배정대로 적용한다.** 어사인 모드 선택은 `assignments[].targetId`(적용 대상)에 그 `image` 를 매핑한다 —
> 슬롯 설명이 곧 "어디에 쓸지"다. 각 이미지의 `safetyTier`/소스(group)에 따라 아래 경로 중 하나로 처리하고,
> `unassignedTargets` 는 절차 생성으로 채우거나 다시 묻는다.

## 경로 A — 웹 카탈로그 (catalog/candidate-web)

1. **라이선스 재확인.** 선택의 `safetyTier` 가 `cc0` 면 통과. `permissive-attribution` 이면
   `CREDITS.txt` 표기 약속, `mixed-per-item`/`avoid` 면 항목 라이선스를 직접 확인하거나 제외.
2. **온디맨드 다운로드.** `downloadUrl` 에서 필요한 팩/파일만 받는다(매번이 아니라 선택 시 1회).
   ```powershell
   Invoke-WebRequest -Uri "<downloadUrl>" -OutFile "games/<slug>/assets/<pack>.zip"
   ```
   ```bash
   curl -L "<downloadUrl>" -o "games/<slug>/assets/<pack>.zip"
   ```
   압축이면 풀어 필요한 스프라이트시트/아틀라스만 `games/<slug>/assets/` 에 남기고 나머지는 정리.
3. **`assets.json` 등록(라이선스 게이트).** 루트 `assets.json` 의 `entries[]` 에 추가:
   ```json
   { "name": "hero", "type": "spritesheet", "source": "kenney-pixel-platformer",
     "license": "CC0", "url": "games/<slug>/assets/hero.png" }
   ```
   게이트는 `license` 가 `policy.allow` 에 있을 때만 허용한다.
4. **Phaser 4 로드.** 형식에 맞게:
   ```js
   // 그리드/스트립 스프라이트시트
   this.load.spritesheet('hero', 'assets/hero.png', { frameWidth: 18, frameHeight: 18 });
   // 텍스처 아틀라스(+ JSON)
   this.load.atlas('chars', 'assets/chars.png', 'assets/chars.json');
   // 단일 이미지 / SVG(임의 크기 래스터화)
   this.load.image('bg', 'assets/bg.png');
   this.load.svg('icon', 'assets/icon.svg', { width: 64, height: 64 });
   ```
   애니메이션 등록:
   ```js
   this.anims.create({ key: 'hero-run',
     frames: this.anims.generateFrameNumbers('hero', { start: 0, end: 3 }),
     frameRate: 10, repeat: -1 });
   ```
5. **라이브러리 누적.** `assets-library/` 에 복사 + `library.json` 에 항목 추가([library.md](./library.md)).
6. **`CREDITS.txt`** 에 출처·라이선스 기록(표기 필요 시 필수).

> 정확한 Phaser 4 로딩 API·Gotcha 는
> [loading-assets](../../web-game-builder/reference/phaser/loading-assets.md) ·
> [sprites-and-images](../../web-game-builder/reference/phaser/sprites-and-images.md) ·
> [animations](../../web-game-builder/reference/phaser/animations.md) 참고.

## 경로 B — 로컬 파일 (candidate-local)

사용자가 가진 이미지/시트를 적용한다.
1. 파일을 `games/<slug>/assets/` 로 복사(벤더링). 형식(스프라이트시트 그리드 크기, 아틀라스 JSON 유무)을 확인.
2. **출처/라이선스를 사용자에게 확인** — 사용자 본인 제작/CC0/구매 라이선스인지. 불명이면 `assets.json`
   에 `license: "unknown"` 으로 두면 게이트에서 막히므로, 확인된 라이선스로만 등록한다.
3. 이후 경로 A 의 4~6단계와 동일(로드·애니·라이브러리·CREDITS).

## 경로 C — 이전 사용분 재사용 (library)

이미 `assets-library/` 에 있으므로 다운로드 불필요.
1. `library.json` 항목의 `files`·`frameConfig` 로 바로 로드하거나, `games/<slug>/assets/` 로 복사.
2. `usedIn` 에 이번 게임 슬러그를 추가. 라이선스는 이미 검증돼 있음.

## 경로 D — 절차 생성 (candidate-procedural)

사용자가 글로 설명했고 실제 에셋을 안 쓰기로 했으면 **코드 생성**으로 위임:
- 픽셀아트 → [`sprite-forge`](../../sprite-forge/SKILL.md) (`PixelForge.bake` 문자 그리드).
- 미려한 스무스/벡터 → [`vector-graphics`](../../vector-graphics/SKILL.md) (`VectorForge.bake` drawFn).
- 외부 파일 0, CC0/IP-safe. 라이브러리 누적은 선택(절차 정의는 코드에 남으므로 `sourceId:"procedural"`로 기록 가능).

## 적용 후 검증 (필수)
- 로컬 서버로 띄워 스프라이트가 의도대로 보이는지, 애니가 도는지 확인(`?autostart=1` 또는 미리보기 라인).
- 콘솔 에러 0(특히 로드 실패 404, 프레임 크기 불일치).
- 스타일 일관성(한 게임 한 스타일), 모바일에서 텍스처 크기/필레이트 과부하 없는지([`perf-60fps`](../../perf-60fps/SKILL.md)).
- 최종 라이선스 게이트는 [`ip-license-guard`](../../ip-license-guard/SKILL.md) 로 점검.
