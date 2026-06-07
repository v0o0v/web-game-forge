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
2. **온디맨드 다운로드(피커 다운로드 버튼 → 큐 → Claude 실행).** 피커의 카탈로그 카드에 "⬇ 다운로드"
   버튼이 표시된다(`safetyTier:"cc0"` + 아직 다운로드되지 않은 팩). 클릭하면:
   - `POST /__sprite_picker_download_request` 로 서버 큐(`.sprite-picker-downloads.json`)에 적재.
   - 사용자가 채팅으로 돌아오면 Claude(리드)가 큐를 읽고 다음 스크립트를 실행한다.

   **fetch-pack.mjs — 팩 다운로드:**
   ```
   node skills/sprite-picker/catalog/fetch-pack.mjs --pack <packId> [--out <dir=assets-library>] [--dry]
   ```
   - `catalog/packs.json` 에서 packId 를 찾아 CC0 게이트 통과 후 다운로드.
   - 소스별 리졸버(kenney/gameart2d/opengameart/generic)로 실제 파일 URL 추출.
   - `assets-library/<packId>/raw/` 에 ZIP 해제(또는 이미지 직접 저장). 최대 40MB 제한.
   - 결과 마지막 줄: `{"ok":true,"packId":..,"rawDir":..,"files":[...]}`.

   **analyze-pack.mjs — 분석 및 library.json 갱신:**
   ```
   node skills/sprite-picker/catalog/analyze-pack.mjs --pack <packId> [--lib <dir=assets-library>]
   ```
   - `raw/` 의 이미지를 분석(atlas > grid > alpha > single 우선순위).
   - `<packId>/<sheetSlug>.png` + `.thumb.png` 생성.
   - `library.json` 에 항목 upsert(`analysisVersion:2`, `sourcePackId`, `frames[]`, `anims[]` 포함).
   - `analysis.json` 기록, `.sprite-picker-downloads.json` 의 해당 status → `"done"`.
   - 결과 마지막 줄: `{"ok":true,"packId":..,"items":[...],"methods":{...}}`.

   > **검증 메모(2026-06-08).** kenney 리졸버는 라이브로 검증됨(`kenney-pixel-platformer` 실제
   > 다운로드→ZIP 해제→분석: alpha BFS 가 `tilemap`=180·`tilemap-characters`=27·`tilemap-backgrounds`=24
   > 프레임을 정확히 검출). gameart2d/opengameart/generic 리졸버는 구현돼 있으나 라이브 미검증 —
   > 첫 사용 시 페이지 마크업 변동에 대비해 결과를 확인하라.

   **off-catalog 수동 핸드오프 (itch.io 등 게이트·미카탈로그 팩).** itch.io 는 매일 새 에셋이 올라오고
   pay-what-you-want·JS 게이트라 자동 다운로드/자동 발견을 하지 않는다(`fetch-pack` 의 카탈로그 경로는
   itch 호스트에서 `exit 3`). 대신 **사용자가 직접 고른 팩을 받아오는 수동 경로**를 쓴다:

   1. 사용자가 itch 등에서 팩을 고르고, (a) ZIP 을 내려받거나 (b) 게이트를 통과해 얻은 **직접 파일 URL** 을 준다.
   2. `fetch-pack.mjs` 수동 모드로 `raw/` 에 푼다(카탈로그·리졸버·CC0-by-packId 게이트 우회):
      ```
      node skills/sprite-picker/catalog/fetch-pack.mjs --id <slug> --zip <로컬ZIP경로>
      node skills/sprite-picker/catalog/fetch-pack.mjs --id <slug> --url <직접파일URL>
      ```
   3. `analyze-pack.mjs` 로 분석하되, **off-catalog 는 라이선스를 가정하지 않으므로 `--license` 필수**
      (CC0 자동 가정 금지 — IP 안전). 라이선스로 `safetyTier` 를 보수적으로 추론(CC0→cc0,
      CC-BY/OFL/MIT 등→permissive-attribution, 불명→mixed-per-item):
      ```
      node skills/sprite-picker/catalog/analyze-pack.mjs --pack <slug> --license <CC0-1.0|CC-BY-4.0|...> \
        [--name "표시명"] [--source itch] [--tier <safetyTier>] [--style pixel] [--tags "a,b"]
      ```
   4. 이후는 카탈로그 팩과 동일 — 분석된 시트가 `library.json`(다운로드 탭)에 들어가고 편집기로 다듬는다.
      `permissive-attribution` 이면 적용 시 `CREDITS.txt` 표기, 라이선스 불명이면 게이트에서 막힌다.

   > 발견(discovery)은 의도적으로 자동화하지 않는다 — itch 의 churn·항목별 라이선스 때문에 사용자가
   > 직접 고르는 편이 안전하다. 우리는 "받아서 시트별로 분류·편집·영속"만 책임진다.

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
