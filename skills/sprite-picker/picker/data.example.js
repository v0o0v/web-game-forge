/* data.example.js — 피커 주입 데이터 템플릿(v3).
 *
 * 사용법: 이 파일을 같은 폴더의 data.js 로 복사한 뒤, 이번 요청에 맞게 채운다.
 *   - targets:   적용 대상 슬롯(설명 포함). 있으면 "어사인 모드"(슬롯에 이미지 배정). 없으면 "프리 모드"(다중 선택).
 *   - sources:   웹사이트(출처) 메타. '전체' 탭에서 catalog 를 sourceId 로 묶어 웹사이트→팩 접이식 트리로 보여준다.
 *   - catalog:   catalog/packs.json 에서 추린 후보 — 광범위하게(수십~수백 개). 각 카드에 sourceId 필수(웹사이트 그룹핑).
 *   - library:   <작업공간 루트>/assets-library/library.json 중 관련분("다운로드" 탭). 미리보기가 아니라 풀로 렌더된다.
 *   - candidate: 절차 생성 제안 또는 사용자가 준 로컬 파일.
 *
 * 탐색 모델(v3): 하단 카테고리 탭 = [추천 · 전체 · 다운로드 · 후보].
 *   - 추천:   target(슬롯)·request 와 매칭 점수 상위. 피커가 런타임 계산(scoreItem) — 별도 주입 불필요.
 *   - 전체:   sources 웹사이트별 아코디언 → 그 안의 팩 카드. 팩 카드 "펼치기"로 대형 미리보기.
 *   - 다운로드: library 항목을 풀(전체)로 렌더 — SVG 인라인 / PNG 풀해상도 / 시트는 frameConfig 로 프레임 분해.
 *   - 후보:   candidate.
 *
 * 미리보기 우선순위(피커):
 *   1) preview  : 커밋된 오프라인 썸네일. catalog 면 "thumbnails/<id>.png"(→ /catalog/ 로 서빙), library 면 풀파일(→ /library/).
 *   2) previewUrl: 원격 대표 이미지(라이브). 커밋 썸네일이 없을 때 사용 + 카드 "원본 ↗" 링크.
 *   3) 없으면 메타데이터로 플레이스홀더 즉석 렌더(오프라인 보장).
 *   animated:true 면 thumbnail/preview(SVG)를 <object> 로 렌더해 움직이는 미리보기.
 *
 * data.js 는 세션 산출물이라 커밋하지 않는다(.gitignore 등록).
 */
window.SPRITE_PICKER_DATA = {
  title: "스프라이트 피커 — 내 게임",
  subtitle: "추천/전체/다운로드 탭에서 찾아 각 대상 슬롯에 배정한 뒤 '선택 완료'를 누르세요.",
  request: "(사용자 요청 요약 — 스타일·필요 에셋·라이선스 제약)",

  pageSize: 24,                                               // 갤러리 1페이지 개수. 더 있으면 "더 가져오기" 버튼.
  recommendLimit: 24,                                         // '추천' 탭에 보일 상위 개수(기본 24).
  submitUrl: "http://127.0.0.1:8770/__sprite_picker_submit",  // 선택 완료 POST 대상(컴패니언 서버).

  // 적용 대상(설명 포함). 사용자가 각 슬롯에 이미지를 직접 배정한다. 추천 점수의 기준이기도 하다.
  targets: [
    { id: "player", name: "플레이어", description: "주인공 — 걷기/점프 애니가 있으면 좋음",
      tags: ["player", "character", "run", "jump"], contentTypes: ["character"], style: "pixel" },
    { id: "enemy", name: "적", description: "밟거나 피하는 기본 적",
      tags: ["enemy", "slime"], contentTypes: ["enemy", "character"], style: "pixel" },
    { id: "coin", name: "코인", description: "획득 아이템(반짝임)",
      tags: ["coin", "gold", "pickup"], contentTypes: ["item"], style: "pixel" },
    { id: "tileset", name: "타일셋", description: "지형/플랫폼 블록",
      tags: ["ground", "platform", "tiles"], contentTypes: ["tileset"], style: "pixel" }
  ],

  tiers: {
    "cc0": "CC0/퍼블릭도메인 — 표기 불필요",
    "permissive-attribution": "표기 필요(CC-BY 등)",
    "mixed-per-item": "항목별 라이선스 — 개별 확인",
    "avoid": "사용 금지(불명/제한)"
  },

  // 웹사이트(출처) 메타 — '전체' 탭의 아코디언 헤더. sources.json 에서 추린다.
  sources: [
    { id: "kenney", name: "Kenney.nl", url: "https://kenney.nl/assets", safetyTier: "cc0" },
    { id: "pixel-frog", name: "Pixel Frog (itch.io)", url: "https://pixelfrog-assets.itch.io/", safetyTier: "mixed-per-item" },
    { id: "game-icons-net", name: "game-icons.net", url: "https://game-icons.net/", safetyTier: "mixed-per-item" }
  ],

  // 광범위하게 채운다 — 사용자가 웹사이트→팩으로 좁히거나 검색/필터로 좁힌다. sourceId 필수.
  catalog: [
    {
      id: "kenney-pixel-platformer",
      name: "Pixel Platformer",
      sourceId: "kenney",                             // ← 웹사이트 그룹핑 키(sources[].id)
      sourceName: "Kenney.nl",
      license: "CC0-1.0",
      safetyTier: "cc0",
      style: "pixel",
      contentTypes: ["character", "tileset", "item", "background"],
      tags: ["platformer", "player", "coins", "18x18"],
      preview: "thumbnails/kenney-pixel-platformer.png", // 커밋 썸네일(있으면). prefetch.mjs 가 채운다 → /catalog/ 로 서빙.
      previewUrl: "https://kenney.nl/media/pages/assets/pixel-platformer/cover.png",
      url: "https://kenney.nl/assets/pixel-platformer",
      downloadUrl: "https://kenney.nl/assets/pixel-platformer",
      tileSize: 18,
      notes: "200개 자산, 18x18 타일. 캐릭터·타일·배경·코인."
    },
    {
      id: "kenney-ui-pack",
      name: "UI Pack",
      sourceId: "kenney",
      sourceName: "Kenney.nl",
      license: "CC0-1.0",
      safetyTier: "cc0",
      style: "vector",
      contentTypes: ["ui", "icon"],
      tags: ["button", "panel", "hud"],
      preview: "",                                     // 비면 previewUrl→플레이스홀더 순.
      previewUrl: "https://kenney.nl/media/pages/assets/ui-pack/ab9e396e4d-1718203978/preview.png",
      url: "https://kenney.nl/assets/ui-pack",
      downloadUrl: "https://kenney.nl/media/pages/assets/ui-pack/f651646eab-1718203990/kenney_ui-pack.zip",
      notes: "약 430개 UI 요소."
    },
    {
      id: "pixel-frog-pixel-adventure-1",
      name: "Pixel Adventure 1",
      sourceId: "pixel-frog",
      sourceName: "Pixel Frog",
      license: "CC0-1.0",
      safetyTier: "cc0",
      style: "pixel",
      contentTypes: ["character", "spritesheet", "tileset", "item", "effect"],
      tags: ["platformer", "player", "enemies", "animated", "fruit"],
      preview: "",
      previewUrl: "",
      url: "https://pixelfrog-assets.itch.io/pixel-adventure-1",
      downloadUrl: "https://pixelfrog-assets.itch.io/pixel-adventure-1",
      notes: "플레이어+적+타일+과일. idle/run/jump 애니 완비."
    }
    // … 수십 개 더(캐릭터/적/아이템/타일/UI/이펙트 폭넓게, 모두 sourceId 부여)
  ],

  // 다운로드된(이미 벤더링된) 항목 — 미리보기가 아니라 풀로 렌더. full/thumbnail 은 **작업공간 루트 기준**
  // 경로이며 피커가 /ws/ 로 로드한다(assets-library/ 든 games/<slug>/assets/ 든 무관).
  //   - SVG/단일 이미지: 그대로 인라인 렌더(풀해상도).
  //   - 스프라이트시트(frameConfig 有): 피커가 canvas 로 프레임을 분해해 개별 프레임을 보여주고 개별 선택 가능.
  //
  // analysisVersion 2 확장 필드(analyze-pack.mjs 가 채우고, 피커 "편집" 모달이 다듬음):
  //   - sourcePackId: 이 항목이 나온 카탈로그 packs.json 팩 id. 같으면 '전체' 탭의 그 팩 다운로드 버튼이 사라진다.
  //   - frames[]:     비균일/아틀라스/수동 영역 [{name,x,y,w,h}]. 있으면 frameConfig 보다 우선해 그 영역을 프레임으로 분해.
  //   - anims[]:      명명 애니 [{name,frames:[idx…],frameRate,repeat}]. 프레임 인덱스(또는 frames[].name)를 참조.
  //   - excludedFrames[]: 그리드 모드에서 빈/제외 칸 인덱스(프레임 그리드·라이트박스에서 숨김).
  library: [
    {
      id: "kenney-pixel-platformer__characters",
      name: "Pixel Platformer — 캐릭터",
      sourceId: "kenney",
      sourceName: "Kenney.nl",
      sourcePackId: "kenney-pixel-platformer",   // ← 카탈로그 팩 id. 받아진 팩은 '전체' 탭에서 다운로드 버튼 대신 노출.
      license: "CC0-1.0",
      safetyTier: "cc0",
      style: "pixel",
      contentTypes: ["character"],
      tags: ["player", "run"],
      downloaded: true,
      analysisVersion: 2,
      // 작업공간 루트 기준 경로(→ /ws/ 로 서빙). 시트면 frameConfig/frames 로 분해해 개별 프레임 선택.
      full: "assets-library/kenney-pixel-platformer/characters.png",
      frameConfig: { frameWidth: 18, frameHeight: 18, margin: 0, spacing: 0 },
      excludedFrames: [],                         // 그리드 모드 빈칸 제외(선택)
      anims: [
        { name: "walk", frames: [0, 1, 2, 3], frameRate: 10, repeat: -1 }
      ],
      thumbnail: "assets-library/kenney-pixel-platformer/characters.thumb.png"
    },
    {
      id: "demo-atlas__hero",
      name: "아틀라스 데모 — 히어로",
      sourceId: "demo",
      sourceName: "Demo Atlas",
      sourcePackId: "demo-atlas",
      license: "CC0-1.0",
      safetyTier: "cc0",
      style: "pixel",
      contentTypes: ["character"],
      tags: ["hero", "atlas"],
      downloaded: true,
      analysisVersion: 2,
      full: "assets-library/demo-atlas/hero.png",
      frameConfig: null,                          // 비균일 — frames[] 사용
      frames: [                                   // 아틀라스/수동 영역(grid 보다 우선)
        { name: "idle", x: 0, y: 0, w: 24, h: 32 },
        { name: "run_0", x: 24, y: 0, w: 24, h: 32 },
        { name: "run_1", x: 48, y: 0, w: 24, h: 32 }
      ],
      anims: [
        { name: "run", frames: [1, 2], frameRate: 12, repeat: -1 }
      ],
      thumbnail: "assets-library/demo-atlas/hero.thumb.png"
    },
    {
      id: "gameicons-lorc-emerald",
      name: "에메랄드 (룬 젬)",
      sourceId: "game-icons-net",
      sourceName: "game-icons.net",
      license: "CC-BY-3.0",
      safetyTier: "permissive-attribution",
      style: "vector",
      contentTypes: ["item", "icon"],
      tags: ["gem", "crystal", "match3"],
      downloaded: true,
      full: "games/runeburst/assets/gems/rune0-emerald.svg"  // library.json files[] 를 작업공간 루트 기준으로.
    }
  ],

  candidate: []
};
