# assets-library — 이전 사용 스프라이트 보관소

`sprite-picker` 스킬이 **실제로 게임에 적용한 스프라이트를 누적 보관**하는 곳이다. 한 번 쓴 에셋을
다른 게임에서도 다운로드 없이 다시 고를 수 있게 한다(피커의 "이전 사용" 탭).

- 레지스트리: [`library.json`](./library.json) — 스키마는
  [skills/sprite-picker/reference/catalog-schema.md](../skills/sprite-picker/reference/catalog-schema.md) §3.
- 항목별 폴더 `<item-id>/` 에 `sheet.png`(+`sheet.json` 아틀라스, `thumb.png`)를 벤더링.
- 운영·재사용 흐름: [skills/sprite-picker/reference/library.md](../skills/sprite-picker/reference/library.md).

> 이건 **사용자 자산**이다(플러그인 동봉 카탈로그와 다름). 함부로 지우지 않는다. 다른 프로젝트로는
> 이 폴더를 통째로 복사하면 이식된다. 모든 항목은 라이선스가 검증된 것만 들어온다(CC0 우선).
