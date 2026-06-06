---
name: ip-license-guard
description: "게임의 저작권·라이선스 안전성을 점검합니다 — CC0/절차적 에셋만 허용, 닌텐도 등 IP(스프라이트·이름·시그니처) 미사용 확인, 라이브러리 라이선스 고지. 라이선스/저작권/IP 점검 요청 시 사용. license, copyright, CC0, IP-safe."
allowed-tools: Read, Grep, Glob
---

# ip-license-guard — 저작권·라이선스 안전성 점검 스킬

게임 에셋·코드·캐릭터 이름이 CC0 또는 절차적 생성 기반인지 확인하고,
닌텐도 등 타사 IP와의 충돌 여부와 라이브러리 라이선스 고지 상태를 점검한다. web-game-builder의 전문 스킬.

## 언제 사용
- "이 게임 배포해도 되나요?", "라이선스 문제 없는지 확인해줘"
- "저작권 점검", "IP 안전한지 봐줘", "CC0 맞는지 확인"
- 신규 에셋 추가 후, 외부 스프라이트 도입 전, 상용 배포 전

## 점검 항목

### 1. 외부 에셋 파일 스캔
프로젝트에 외부 이미지·오디오 파일이 있으면 즉시 출처와 라이선스 확인이 필요하다.

```bash
# 이미지 파일 존재 여부
glob: games/**/*.{png,jpg,jpeg,gif,webp,svg}
glob: games/**/*.{mp3,ogg,wav,flac}
```

- 파일이 존재하면 → `assets.json` 에 CC0 라이선스 항목으로 등록됐는지 확인
- PixelForge(`engine/pixelforge.js`)로 절차적 생성된 스프라이트는 CC0, 외부 파일 불필요
- ChipAudio(`engine/audio.js`)로 절차적 생성된 사운드는 CC0, 외부 파일 불필요

### 2. assets.json 라이선스 게이트
```json
// assets.json 형식 — license 필드가 "CC0" 인지 확인
{
  "assets": [
    { "name": "background", "type": "image", "source": "procedural", "license": "CC0" }
  ]
}
```
- `license` 값이 `"CC0"` 이 아닌 항목 → 즉시 플래그
- `source: "procedural"` + `license: "CC0"` 조합만 허용 (외부 URL 에셋 금지)

### 3. 보호된 이름·시그니처 조합 점검

**금지 목록 (절대 사용 금지)**
- 이름: `Mario`, `Luigi`, `Link`, `Pikachu`, `Sonic`, `Kirby`, `Samus` 및 타사 캐릭터명
- 시그니처 조합: 빨간 모자 + 콧수염 + 파란 멜빵 + 배관공 + 이탈리안 (닌텐도 Mario 조합)
- 게임 제목: 타사 등록 상표와 동일하거나 혼동 가능한 명칭

```bash
# 소스코드에서 보호된 이름 검색
grep -r "Mario\|Luigi\|Pikachu\|Sonic\|Kirby\|Link\b" games/ --include="*.js" --include="*.html" --include="*.json"
```

**허용되는 것 (저작권 대상 아님)**
- 게임 메카닉·장르: 플랫포머, 횡스크롤, 점프, 코인 수집은 저작권 보호 대상이 아님
- 오리지널 캐릭터: 색 단서 1개만 활용한 독자 디자인 (예: 파란 달리기 캐릭터)
- 유사 장르 게임플레이: 슈퍼마리오 '느낌'의 플랫포머라도 독자 이름·비주얼이면 허용

### 4. 캐릭터 오리지널리티 가이드
닌텐도 Mario 시그니처 조합 분석:
- 빨간 모자 ✗ + 콧수염 ✗ + 파란 멜빵 ✗ + 배관공 직업 ✗ + 이탈리안 ✗
- 위 5요소 중 2개 이상 조합 → 위험
- 단일 색상 힌트 (예: 파란 달리기 캐릭터) → 허용

### 5. 라이브러리 라이선스 고지 확인
```bash
# 고지 파일 존재 확인
glob: LICENSE
glob: CREDITS.txt
glob: engine/phaser.LICENSE.txt
```

- `engine/phaser.min.js` → Phaser 4, MIT 라이선스 → `engine/phaser.LICENSE.txt` 고지 필수
- `engine/pixelforge.js` → PixelForge, CC0 → `CREDITS.txt` 언급 권장
- `engine/audio.js` → ChipAudio, CC0 → `CREDITS.txt` 언급 권장
- `LICENSE` 파일: 게임 자체 라이선스 명시 (MIT, CC0, 독점 등)

### 6. 점검 결과 판정 기준

| 항목 | 통과 | 실패 |
|------|------|------|
| 외부 에셋 파일 | 없음 또는 CC0 등록 | 라이선스 불명 파일 존재 |
| assets.json | 모든 항목 license=CC0 | CC0 외 라이선스 항목 존재 |
| 보호 이름 | 소스에 미사용 | 타사 캐릭터명 발견 |
| 시그니처 조합 | 오리지널 디자인 | 닌텐도 등 조합 재현 |
| 라이선스 고지 | LICENSE + phaser.LICENSE.txt 존재 | 고지 파일 누락 |

## 주의 사항
- 이 스킬은 **기술적 점검**이며 법률 자문이 아님
- 상용 배포 시 반드시 IP 전문 법률 검토 권고
- "영감을 받은" 게임플레이와 "침해" 의 경계는 법적 회색지대 — 독자 비주얼+이름으로 명확히 구분할 것

## 연계 / 원칙
- 정책 매니페스트: `assets.json` (CC0 게이트)
- 라이선스 고지: `LICENSE`, `CREDITS.txt`, `engine/phaser.LICENSE.txt`
- 참조: `skills/web-game-builder/SKILL.md` (IP 정책 섹션)
- web-game-builder 워크플로의 품질 게이트. 상용 배포 전 필수 통과.
- Phaser 4 엔진 전체 색인: [reference/phaser/INDEX.md](../web-game-builder/reference/phaser/INDEX.md).
