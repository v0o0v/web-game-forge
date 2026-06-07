/* data.example.js — 피커 주입 데이터 템플릿(v2).
 *
 * 사용법: 이 파일을 같은 폴더의 data.js 로 복사한 뒤, 이번 요청에 맞게 채운다.
 *   - targets:   적용 대상 슬롯(설명 포함). 있으면 "어사인 모드"(슬롯에 이미지 배정). 없으면 "프리 모드"(다중 선택).
 *   - catalog:   catalog/packs.json 에서 추린 후보 — 광범위하게(수십~수백 개, 사용자가 필터로 좁힘).
 *   - library:   <작업공간 루트>/assets-library/library.json 중 관련분("이전 사용" 탭).
 *   - candidate: 절차 생성 제안 또는 사용자가 준 로컬 파일.
 * thumbnail 이 없으면 피커가 메타데이터로 플레이스홀더를 즉석 렌더한다(오프라인). 실제 이미지 URL을 넣으면 그대로 보인다.
 * data.js 는 세션 산출물이라 커밋하지 않는다(.gitignore 등록).
 */
window.SPRITE_PICKER_DATA = {
  title: "스프라이트 피커 — 내 게임",
  subtitle: "각 대상 슬롯에 쓰고 싶은 이미지를 배정한 뒤 '선택 완료'를 누르세요.",
  request: "(사용자 요청 요약 — 스타일·필요 에셋·라이선스 제약)",

  pageSize: 24,                                          // 갤러리 1페이지 개수. 더 있으면 "더 가져오기" 버튼.
  submitUrl: "http://127.0.0.1:8770/__sprite_picker_submit",  // 선택 완료 POST 대상(기본은 같은 origin).
                                                              //   컴패니언 서버 포트에 맞춰 절대 URL 로 두면 어느 탭에서든 회수됨.

  // 적용 대상(설명 포함). 사용자가 각 슬롯에 이미지를 직접 배정한다.
  targets: [
    { id: "player", name: "플레이어", description: "주인공 — 걷기/점프 애니가 있으면 좋음" },
    { id: "enemy", name: "적", description: "밟거나 피하는 기본 적" },
    { id: "coin", name: "코인", description: "획득 아이템(반짝임)" },
    { id: "tileset", name: "타일셋", description: "지형/플랫폼 블록" }
  ],

  tiers: {
    "cc0": "CC0/퍼블릭도메인 — 표기 불필요",
    "permissive-attribution": "표기 필요(CC-BY 등)",
    "mixed-per-item": "항목별 라이선스 — 개별 확인",
    "avoid": "사용 금지(불명/제한)"
  },

  // 광범위하게 채운다 — 사용자가 검색/필터(스타일·타입·라이선스)로 좁힌다.
  catalog: [
    {
      id: "kenney-pixel-platformer-hero",
      name: "픽셀 히어로",
      sourceName: "Kenney.nl",
      license: "CC0-1.0",
      safetyTier: "cc0",
      style: "pixel",
      contentTypes: ["character"],
      tags: ["platformer", "player", "run"],
      thumbnail: "",                                  // 실제 이미지 URL 권장(없으면 플레이스홀더)
      previewUrl: "https://kenney.nl/assets/pixel-platformer",
      url: "https://kenney.nl/assets/pixel-platformer",
      downloadUrl: "https://kenney.nl/assets/pixel-platformer",
      notes: "18px."
    }
    // … 수십 개 더(캐릭터/적/아이템/타일/UI/이펙트 폭넓게)
  ],
  library: [],
  candidate: []
};
