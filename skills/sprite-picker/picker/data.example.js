/* data.example.js — 피커 주입 데이터 템플릿.
 *
 * 사용법: 이 파일을 같은 폴더의 data.js 로 복사한 뒤, 이번 요청에 맞는 후보로 채운다.
 *   - catalog:   catalog/packs.json 의 부분집합 (요청 스타일/타입으로 추린 것)
 *   - library:   <작업공간 루트>/assets-library/library.json 의 items 중 관련분
 *   - candidate: 절차 생성 제안 또는 사용자가 준 로컬 파일
 * thumbnail 이 없으면 피커가 메타데이터로 플레이스홀더를 즉석 렌더하므로 비워도 동작한다.
 * data.js 는 세션 산출물이라 보통 커밋하지 않는다(.gitignore 등록됨).
 */
window.SPRITE_PICKER_DATA = {
  title: "스프라이트 피커 — 내 게임",
  subtitle: "쓰고 싶은 스프라이트를 클릭하세요. 다 고르면 알려주세요.",
  request: "(여기에 사용자 요청 요약 — 스타일·필요 에셋·라이선스 제약)",
  tiers: {
    "cc0": "CC0/퍼블릭도메인 — 표기 불필요",
    "permissive-attribution": "표기 필요(CC-BY 등) — CREDITS 등록 시 허용",
    "mixed-per-item": "항목별 라이선스 — 개별 확인 필수",
    "avoid": "사용 금지(불명/제한)"
  },
  catalog: [
    {
      id: "kenney-pixel-platformer",
      name: "Pixel Platformer",
      sourceName: "Kenney.nl",
      license: "CC0-1.0",
      safetyTier: "cc0",
      style: "pixel",
      contentTypes: ["tileset", "character"],
      tags: ["platformer", "tiles", "character"],
      thumbnail: "",                                  // 비우면 플레이스홀더 자동 렌더
      previewUrl: "https://kenney.nl/assets/pixel-platformer",
      url: "https://kenney.nl/assets/pixel-platformer",
      downloadUrl: "https://kenney.nl/assets/pixel-platformer",
      notes: "18px 타일."
    }
  ],
  library: [
    // { id, name, sourceName, license, safetyTier, style, contentTypes, thumbnail, ... }
  ],
  candidate: [
    {
      id: "proc-hero",
      name: "절차 생성 러너(제안)",
      sourceName: "PixelForge",
      license: "CC0-1.0",
      safetyTier: "cc0",
      style: "pixel",
      contentTypes: ["character"],
      tags: ["player", "procedural"],
      notes: "코드 생성 — sprite-forge 로 즉석 제작"
    }
  ]
};
