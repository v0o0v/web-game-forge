# 게임 DNA · 보드게임 아틀라스 — 색인 (INDEX)

> 유명 **보드게임 100종**의 **재미 요소·메카닉**을 게임당 핵심만 압축한 **컴팩트 카탈로그**(2티어)다. 심화 라이브러리([../puzzle/INDEX.md](../puzzle/INDEX.md), 게임당 11섹션 풀 분석)와 달리, 아틀라스는 게임당 **코어·재미요소·핵심 메카닉·웹 번안·조합 훅·IP 주의** 6항목으로 짧게 수록해 넓은 조합 재료를 빠르게 스캔하는 용도다.
> 목적: 게임 제작 명확화 단계에서 검증된 보드게임 메카닉을 제안·조합 재료로 쓰는 것. **물리 보드게임을 디지털 단일플레이 웹 게임으로 번안하는 관점**(휴리스틱 AI 상대 · '남긴 것이 비용' 솔로 변형 · 날짜 시드 데일리 · localStorage 베스트)으로 적었다.
> 분석 대상은 **메카닉·재미뿐** — 이름·아트워크·구성물 디자인 등 저작물은 절대 쓰지 않는다(각 파일의 IP 주의·IP 공통 원칙 참고). 전역 색인은 [../INDEX.md](../INDEX.md), 재미요소 사전은 [../fun-elements.md](../fun-elements.md).

## 이 라이브러리를 쓰는 법 (중요)

- 자동 트리거 스킬이 아니다. frontmatter 없는 **온디맨드 Read** 레퍼런스(스킬 listing 예산 0). 필요할 때만 해당 클러스터 파일을 읽는다.
- **명확화 단계**에서: 요청 단서(덱빌딩·경매·협력·추리·기억 등)에 맞는 클러스터 파일 1~2개를 읽고, 게임 엔트리의 '웹 번안'·'조합 훅'을 [../fun-elements.md](../fun-elements.md) §4 조합 설계법의 재료로 쓴다. 보드게임 계열 신설 태그 4종(`FE-DECKCRAFT`·`FE-AUCTION`·`FE-BLUFF`·`FE-MEMORY`)과 레시피·안티패턴(다인 사회성 솔로 직역 금지, 실물 민첩 정밀 물리 직역 금지)은 전역 사전에 정식 정의돼 있다.
- 깊이가 필요하면 2티어를 오간다: 아틀라스에서 고른 메카닉이 퍼즐 코어라면 [../puzzle/INDEX.md](../puzzle/INDEX.md)의 심화 35종(보드게임 15종 포함)과 교차 참조해 보드모델·재현 노트를 가져온다.
- 각 클러스터 파일의 **'공통 번안 패턴'** 섹션이 그 메카닉 가족의 엔진 구현 표준(보드모델·AI·데일리·입력)을 정리한다 — 개별 게임 엔트리보다 먼저 읽으면 빠르다.

## 클러스터 → 게임 라우팅 (100종)

`재현` 열: ✅ 솔로 로컬 성립(공식 솔로 또는 간단 AI/변형으로 충분) · ⚠️ 다인 인터랙션/콘텐츠 규모/정밀 물리로 설계 보정 필요 · ❌ 코어가 다인 사회성·실물 조작 자체(— 단 **추출 가능한 재미요소를 엔트리에 명시**, 요소 차용 전용).

### [deck-engine.md](./deck-engine.md) — 덱빌딩 · 엔진빌딩
| 게임 | 코어 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|---|
| Dominion (2008) | 매 턴 액션 1·구매 1·5장 드로우 — 공급처에서 산 카드가 덱에 섞여 덱 자체가 강해지는 덱빌딩 원조 | `FE-DECKCRAFT` `FE-BUILD` `FE-COMBO` | `puzzle-game` | ✅ |
| Splendor (2014) | 보석 칩으로 개발 카드를 사면 영구 할인이 쌓여 갈수록 싸게 사는 엔진, 15점 선취 경주 | `FE-BUILD` `FE-DRAFT` `FE-PLANNING` | `puzzle-game` | ✅ |
| Wingspan (2019) | 새 카드를 서식지 줄에 놓을수록 액션이 강해지고 능력이 연쇄 발동, 4라운드 턴 점감(8→5) 콤보 엔진 | `FE-BUILD` `FE-COMBO` `FE-COLLECT` | `puzzle-game` | ⚠️ |
| Star Realms (2014) | 공유 시장 5장에서 함선을 사 덱을 키워 상대 권위 50을 먼저 깎는 2인 대전 덱빌더 | `FE-DECKCRAFT` `FE-COMBO` `FE-POWER-FANTASY` | `puzzle-game` | ✅ |
| Century: Spice Road (2017) | 상인 카드로 향신료 큐브를 상위 등급으로 변환하는 손패 엔진, 캐러밴(상한 10)으로 점수 카드 구매 | `FE-DECKCRAFT` `FE-BUILD` `FE-PLANNING` | `puzzle-game` | ✅ |
| 7 Wonders (2010) | 7장 손패에서 1장 고르고 옆으로 넘기는 동시 드래프트 3시대 — 자원·과학·군사 문명 엔진 | `FE-DRAFT` `FE-BUILD` `FE-PLANNING` | `puzzle-game` | ⚠️ |
| Race for the Galaxy (2007) | 5역할 중 비밀 선택·동시 공개로 라운드를 구성, 카드가 곧 화폐인 은하 타블로 경주(12장/VP 풀 종료) | `FE-BUILD` `FE-COMBO` `FE-RISK-REWARD` | `puzzle-game` | ⚠️ |
| Gizmos (2018) | 디스펜서에서 구슬 에너지를 집어 기즈모를 짓고, 액션이 액션을 부르는 트리거 연쇄 머신 | `FE-BUILD` `FE-COMBO` `FE-JUICE` | `puzzle-game` | ✅ |
| Terraforming Mars (2016) | 프로젝트 카드로 산소·온도·바다 3지표를 올리는 태그 시너지 타블로 — 행성 완성이 곧 종료 | `FE-BUILD` `FE-COMBO` `FE-NARRATIVE` | `puzzle-game` | ⚠️ |
| Res Arcana (2019) | 단 8장 유물 덱으로 에센스 엔진을 조립해 성소를 선점, 10VP 선취 스프린트 | `FE-BUILD` `FE-ELEGANCE` `FE-CONSTRAINT` | `puzzle-game` | ✅ |

### [push-luck-dice.md](./push-luck-dice.md) — 푸시유어럭 · 주사위
| 게임 | 코어 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|---|
| Can't Stop (1980) | 주사위 4개를 두 쌍으로 갈라 2~12 컬럼 3개를 동시 등반 — 멈추면 굳히고, 놓을 수 없으면 이번 턴 전진 전부 상실 | `FE-RISK-REWARD` `FE-JUST-ONE-MORE` `FE-TENSION` | `puzzle-game` | ✅ |
| The Quacks of Quedlinburg (2018) | 가방에서 칩을 뽑아 솥에 쌓다 흰 칩 합이 7을 넘으면 폭발 — 라운드 사이 칩 구매로 가방 분포를 조형하는 9라운드 | `FE-RISK-REWARD` `FE-DECKCRAFT` `FE-ESCALATION` | `puzzle-game` | ✅ |
| Incan Gold / Diamant (2005) | 위험 카드 같은 종류 2장이면 빈손 — 카드 1장 공개마다 '더 들어간다 vs 귀환' 동시 비밀 선택, 혼자 떠나면 독식 | `FE-RISK-REWARD` `FE-TENSION` `FE-JUST-ONE-MORE` | `arcade-classic` | ⚠️ |
| Deep Sea Adventure (2014) | 전원이 한 산소통(25)을 공유 — 보물을 들수록 산소가 빨리 닳고 걸음이 느려지는 3라운드 욕심 회수전 | `FE-RISK-REWARD` `FE-TENSION` `FE-ESCALATION` | `puzzle-game` | ⚠️ |
| Heckmeck / Pickomino (2005) | 주사위 8개에서 한 면을 골라 전부 킵(같은 면 재선택 금지) — 벌레 포함 합으로 21~36 타일을 집고, bust면 타일 반납 | `FE-RISK-REWARD` `FE-CONSTRAINT` `FE-TENSION` | `puzzle-game` | ✅ |
| Zombie Dice (2010) | 컵 13개(초록 6·노랑 4·빨강 3)에서 3개씩 뽑아 굴림 — 색이 위험도, 샷건 3개면 이번 턴 뇌 전부 상실, 13뇌 선취 | `FE-RISK-REWARD` `FE-FAIRNESS` `FE-JUST-ONE-MORE` | `arcade-classic` | ✅ |
| Port Royal (2014) | 덱에서 카드를 한 장씩 공개 — 같은 색 배 2척이면 파산, 멈추면 공개된 색 수만큼 고용/수익, 영향력 12점 경주 | `FE-RISK-REWARD` `FE-BUILD` `FE-TENSION` | `puzzle-game` | ✅ |
| Yahtzee (1956) | 주사위 5개 3굴림(킵 자유) 후 13개 카테고리 중 한 칸에 의무 기입 — 상단 합 63 이상이면 보너스 35점 | `FE-LUCK-TAME` `FE-PLANNING` `FE-RISK-REWARD` | `puzzle-game` | ✅ |
| King of Tokyo (2011) | 야찌식 6주사위 3굴림으로 공격·회복·에너지·점수를 만들고, 도쿄를 점령하면 점수가 쌓이는 대신 모두의 표적 — 20점 선취 or 최후 생존 | `FE-RISK-REWARD` `FE-POWER-FANTASY` `FE-TENSION` | `puzzle-game` | ⚠️ |
| Las Vegas (2012) | 굴린 뒤 한 숫자를 골라 그 숫자 주사위 전부를 카지노에 배치 — 다수결로 지폐 획득, 동률은 전원 상쇄 | `FE-RISK-REWARD` `FE-PLANNING` `FE-TENSION` | `puzzle-game` | ⚠️ |

### [tile-route.md](./tile-route.md) — 타일 배치 · 경로 빌딩
| 게임 | 코어 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|---|
| Carcassonne (2000) | 지형 타일을 변 맞춰 이어 붙이고 미플을 놓아 완성된 도시·길·수도원을 점유 점수화 | `FE-SPATIAL` `FE-RISK-REWARD` `FE-EMERGENCE` | `puzzle-game` | ⚠️ |
| Ticket to Ride (2004) | 색 열차 카드를 세트로 모아 도시 간 노선을 점유, 비밀 목적지 티켓을 연결해 보너스 | `FE-COLLECT` `FE-PLANNING` `FE-RISK-REWARD` | `puzzle-game` | ⚠️ |
| Tsuro (2004) | 경로 타일을 놓으면 닿은 말 전원이 강제 이동 — 내 말을 보드 밖으로 내몰리지 않게 끝까지 생존 | `FE-TENSION` `FE-SPATIAL` `FE-EMERGENCE` | `puzzle-game` | ⚠️ |
| Karuba (2015) | 전원이 같은 번호의 정글 타일을 각자 보드에 놓거나 버려 탐험가를 움직여 사원·보물 선점 | `FE-LUCK-TAME` `FE-PLANNING` `FE-OPTIMIZE` | `puzzle-game` | ✅ |
| Isle of Skye (2015) | 뽑은 타일에 스스로 가격을 매겨 사고팔며 변 맞춰 왕국 확장, 매판 바뀌는 채점 타일로 정산 | `FE-AUCTION` `FE-BUILD` `FE-SURPRISE` | `puzzle-game` | ⚠️ |
| Alhambra (2003) | 4색 화폐로 건물 타일 구매 — 정확 지불이면 추가 행동, 성벽 규칙 배치 + 종류별 다수 3회 정산 | `FE-CONSTRAINT` `FE-COMBO` `FE-COLLECT` | `puzzle-game` | ⚠️ |
| Kingdom Builder (2011) | 매 턴 지형 카드가 강제하는 지형에 정착지 3개를 기존 인접 우선으로 확장, 매판 채점 카드 변주 | `FE-CONSTRAINT` `FE-SURPRISE` `FE-PLANNING` | `puzzle-game` | ✅ |
| Galaxy Trucker (2007) | 제한 시간 실시간으로 부품 타일을 집어 우주선 조립 → 사건 덱이 그 배를 검증·파괴 | `FE-BUILD` `FE-TIMING` `FE-RISK-REWARD` | `puzzle-game` | ✅ |
| Cartographers (2019) | 공개로 뒤집힌 탐험 카드의 지형 모양을 각자 지도에 그려 계절마다 칙령 2개로 채점 | `FE-LUCK-TAME` `FE-SPATIAL` `FE-OPTIMIZE` | `puzzle-game` | ✅ |
| Bärenpark (2017) | 폴리오미노 시설로 동물원을 패킹 — 아이콘을 덮으면 새 타일·부지를 받는 연쇄 확장 | `FE-PACKING` `FE-COMBO` `FE-OPTIMIZE` | `puzzle-game` | ✅ |

### [auction-economy.md](./auction-economy.md) — 경매 · 경제 · 협상
| 게임 | 코어 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|---|
| Modern Art (1992) | 5종 경매 방식(공개·1바퀴·비공개·정가·더블)으로 그림을 사고팔며, 라운드마다 많이 출품된 화가 순으로 시세가 형성·누적된다 | `FE-AUCTION` `FE-EMERGENCE` `FE-TIMING` | `puzzle-game` | ⚠️ |
| Ra (1999) | 공유 트랙에 타일을 쌓다가 원할 때(또는 Ra 타일이 강제할 때) 고정값 태양석으로 1바퀴 1회 입찰 경매를 연다 | `FE-AUCTION` `FE-RISK-REWARD` `FE-TENSION` | `puzzle-game` | ✅ |
| For Sale (1997) | 1부에서 칩 경매로 집을 사고, 2부에서 산 집을 동시 비공개 출품으로 수표와 바꿔 판다 | `FE-AUCTION` `FE-TIMING` `FE-RISK-REWARD` | `puzzle-game` | ✅ |
| High Society (1995) | 거스름돈 없는 돈 카드로 사치품을 경매하되, 종료 시 현금 최소 보유자는 점수와 무관하게 탈락한다 | `FE-AUCTION` `FE-CONSTRAINT` `FE-TENSION` | `puzzle-game` | ✅ |
| Power Grid (2004) | 발전소를 경매로 사고 산 만큼 비싸지는 자원 시장에서 연료를 수급해 도시 네트워크에 전력을 공급한다 | `FE-AUCTION` `FE-BUILD` `FE-OPTIMIZE` | `puzzle-game` | ⚠️ |
| Acquire (1964) | 타일을 놓아 호텔 체인을 키우고 주식을 사 모아, 체인 합병 때 대주주·2대주주 보너스를 챙긴다 | `FE-TIMING` `FE-RISK-REWARD` `FE-PLANNING` | `puzzle-game` | ✅ |
| Monopoly (1935) | 주사위로 돌며 부동산을 사 색 세트를 독점하고 집·호텔로 임대료를 키워 상대를 파산시킨다 | `FE-COLLECT` `FE-ESCALATION` `FE-RISK-REWARD` | `puzzle-game` | ⚠️ |
| Catan (1995) | 주사위 눈에 따라 헥스가 자원을 생산하고, 자원을 교역·조합해 정착지·도시·도로를 지어 10점을 만든다 | `FE-BUILD` `FE-LUCK-TAME` `FE-SOCIAL` | `puzzle-game` | ⚠️ |
| Chinatown (1999) | 건물 부지와 상점 타일을 받아 '무엇이든 교환 가능한' 자유 협상으로 같은 업종 인접 체인을 키워 수입을 얻는다 | `FE-SOCIAL` `FE-AUCTION` `FE-PACKING` | `puzzle-game` | ❌ |
| Sheriff of Nottingham (2014) | 가방에 상품 카드 1~5장을 넣고 합법 상품 한 종류로 신고, 보안관은 뇌물을 받고 통과시키거나 가방을 연다 | `FE-BLUFF` `FE-RISK-REWARD` `FE-TENSION` | `puzzle-game` | ⚠️ |

### [worker-action.md](./worker-action.md) — 워커 플레이스먼트 · 액션 선택
| 게임 | 코어 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|---|
| Agricola (2007) | 일꾼(가족)을 액션 칸에 보내 농장을 키우되 수확마다 가족 1인당 식량 2를 못 대면 구걸 감점 — 14라운드 부양 압박 | `FE-CONSTRAINT` `FE-ESCALATION` `FE-BUILD` | `puzzle-game` | ✅ |
| Stone Age (2008) | 일꾼 수만큼 주사위를 굴려 자원을 캐고(합÷자원값) 도구로 보정, 라운드 끝 식량 부양 | `FE-LUCK-TAME` `FE-RISK-REWARD` `FE-DRAFT` | `puzzle-game` | ✅ |
| Lords of Waterdeep (2012) | 에이전트를 보내 4종 모험가 큐브를 모아 퀘스트 완성, 8라운드 점수전 — 입문형 워커 | `FE-COLLECT` `FE-DRAFT` `FE-PLANNING` | `puzzle-game` | ✅ |
| Viticulture (2013) | 여름/겨울 분할 액션에 일꾼 배치, 포도→양조→숙성→주문 이행 파이프라인으로 20VP 선점 | `FE-TIMING` `FE-PLANNING` `FE-BUILD` | `puzzle-game` | ✅ |
| Everdell (2018) | 일꾼으로 자원을 모아 카드를 도시(15칸)에 건설, 콤보 엔진을 엮으며 계절마다 일꾼 증원 | `FE-COMBO` `FE-BUILD` `FE-COLLECT` | `puzzle-game` | ⚠️ |
| Caylus (2005) | 길 위 건물에 일꾼 배치, 행정관 위치까지만 길 순서로 활성화 — 액션 성사 자체가 흔들리는 수싸움 | `FE-TENSION` `FE-PLANNING` `FE-RISK-REWARD` | `puzzle-game` | ⚠️ |
| Tzolk'in (2012) | 일꾼 놓기/회수 양자택일, 톱니바퀴가 매 턴 일꾼을 더 강한 칸으로 운반 — 오래 둘수록 강하다 | `FE-TIMING` `FE-PLANNING` `FE-TENSION` | `puzzle-game` | ✅ |
| A Feast for Odin (2016) | 60+ 칸 액션판에서 물자 폴리오미노를 벌어 홈보드 빈칸을 덮고, 매 라운드 연회 식탁을 채운다 | `FE-PACKING` `FE-OPTIMIZE` `FE-BUILD` | `puzzle-game` | ⚠️ |
| Raiders of the North Sea (2015) | 일꾼 1명을 놓고 다른 1명을 집는 이중 액션으로 크루를 모아 정착지 약탈 — 보드 일꾼 분포가 계속 변한다 | `FE-PLANNING` `FE-RISK-REWARD` `FE-COLLECT` | `puzzle-game` | ✅ |
| Architects of the West Kingdom (2018) | 같은 칸에 일꾼이 쌓일수록 강해지는 누적 배치 + 일꾼 무리 체포·감옥 회수, 덕 트랙 선악 저울 | `FE-RISK-REWARD` `FE-BUILD` `FE-PLANNING` | `puzzle-game` | ✅ |

### [coop-comm.md](./coop-comm.md) — 협력 · 제한 소통
| 게임 | 코어 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|---|
| Pandemic (2008) | 4행동으로 도시 질병 큐브를 억제하며 같은 색 카드 세트로 4종 치료제 발견, 턴 끝 감염 덱이 자동 확산·아웃브레이크 연쇄 | `FE-ESCALATION` `FE-EMERGENCE` `FE-PLANNING` | `puzzle-game` | ✅ |
| Forbidden Island (2010) | 3행동으로 가라앉는 섬에서 보물 4개를 회수해 전원 착륙장 탈출, 턴 끝 침수 덱이 타일을 적시고 소실시킴 | `FE-ESCALATION` `FE-TENSION` `FE-COLLECT` | `puzzle-game` | ✅ |
| Hanabi (2010) | 내 패만 못 보는 손패로 단서 토큰을 아껴 쓰며 5색 불꽃을 1→5 순서로 쌓는 단서 경제 협력 | `FE-HIDDEN-INFO` `FE-CONSTRAINT` `FE-DEDUCTION` | `puzzle-game` | ❌ |
| The Mind (2018) | 1~100 카드를 무언·무턴으로 전원이 오름차순으로 내려놓는 침묵 동기화 | `FE-TIMING` `FE-TENSION` `FE-SOCIAL` | `arcade-classic` | ❌ |
| The Crew (2019) | 트럼프 트릭테이킹으로 '이 카드를 이 사람이 딴다' 과제를 1인당 임무당 1회의 제한 소통만으로 50임무 클리어 | `FE-PLANNING` `FE-HIDDEN-INFO` `FE-CONSTRAINT` | `puzzle-game` | ⚠️ |
| Spirit Island (2017) | 정령 권능을 성장·콤보해 침략자의 탐험→건설→약탈 컨베이어를 끊고 공포로 승리 조건 완화 | `FE-COMBO` `FE-BUILD` `FE-POWER-FANTASY` | `puzzle-game` | ✅ |
| Flash Point: Fire Rescue (2011) | AP로 화염·연기를 진압하며 희생자를 구출, 턴 끝 주사위가 연기를 추가하고 폭발이 벽을 부수며 확산 | `FE-ESCALATION` `FE-EMERGENCE` `FE-RISK-REWARD` | `puzzle-game` | ✅ |
| Magic Maze (2017) | 실시간·무언으로 각자 동작 하나(북·동·에스컬레이터…)만 담당해 4영웅을 절도 후 출구로 — 모래시계 소진 전 | `FE-CONSTRAINT` `FE-TIMING` `FE-TENSION` | `arcade-classic` | ⚠️ |
| Mysterium (2015) | 유령이 초현실 환상 카드만으로 각 심령술사의 용의자→장소→흉기를 암시, 7라운드 안에 전원 적중 | `FE-DEDUCTION` `FE-NARRATIVE` `FE-HIDDEN-INFO` | `puzzle-game` | ⚠️ |
| Sky Team (2023) | 파일럿·부조종사가 비공개 주사위를 교대로 계기판 슬롯에 놓아 7라운드 만에 기체를 활주로에 착륙 | `FE-LUCK-TAME` `FE-TENSION` `FE-HIDDEN-INFO` | `puzzle-game` | ⚠️ |

### [hidden-deduction.md](./hidden-deduction.md) — 은닉 정보 · 추리 · 블러프
| 게임 | 코어 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|---|
| Stratego (1946) | 계급 은닉 40개 말 전면전 — 충돌로만 드러나는 정보로 적 깃발을 추리·탈취 | `FE-HIDDEN-INFO` `FE-DEDUCTION` `FE-BLUFF` | `puzzle-game` | ⚠️ |
| Battleship (1967) | 가려진 격자에 좌표 포격 — 힛/미스 피드백으로 함대 배치를 좁혀 전멸 | `FE-HIDDEN-INFO` `FE-DEDUCTION` `FE-TENSION` | `puzzle-game` | ✅ |
| Mastermind (1970) | 6색 4펙 비밀 코드를 흑/백 핀 피드백으로 10회 안에 연역 | `FE-DEDUCTION` `FE-CONSTRAINT` `FE-AHA` | `puzzle-game` | ✅ |
| Cluedo / Clue (1949) | 봉투 속 용의자·무기·방 3장을 제안-반증 소거로 추리해 고발 | `FE-DEDUCTION` `FE-HIDDEN-INFO` `FE-NARRATIVE` | `puzzle-game` | ✅ |
| Coup (2012) | 역할을 증명 없이 주장해 행동, 의심되면 도전 — 영향력 2장을 지키는 최후 생존 | `FE-BLUFF` `FE-RISK-REWARD` `FE-TENSION` | `puzzle-game` | ⚠️ |
| Skull (2011) | 장미/해골 원판 적립 후 '몇 장을 장미로 깔까' 호가 — 해골이면 원판 손실 | `FE-BLUFF` `FE-RISK-REWARD` `FE-ESCALATION` | `puzzle-game` | ⚠️ |
| Love Letter (2012) | 16장 덱에서 매턴 draw-1-play-1 — 카드 효과 추리·제거로 라운드 생존 | `FE-DEDUCTION` `FE-HIDDEN-INFO` `FE-RISK-REWARD` | `puzzle-game` | ✅ |
| Liar's Dice / Perudo (고전) | 비밀 주사위 전체에 '눈 N개 이상' 호가를 올리다 dudo 도전으로 판가름 | `FE-BLUFF` `FE-ESCALATION` `FE-LUCK-TAME` | `puzzle-game` | ⚠️ |
| Cockroach Poker (2004) | 벌레 카드를 엎어 건네는 참/거짓 주장 — 판별하거나 떠넘기기, 같은 벌레 4장이면 패배 | `FE-BLUFF` `FE-MEMORY` `FE-TENSION` | `puzzle-game` | ❌ |
| Spyfall (2014) | 스파이만 장소를 모름 — 질문·답변 심리전으로 색출 vs 장소 추리 | `FE-HIDDEN-INFO` `FE-BLUFF` `FE-DEDUCTION` | `puzzle-game` | ❌ |

### [abstract-duel.md](./abstract-duel.md) — 추상 전략 듀얼
| 게임 | 코어 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|---|
| Hive (2001) | 곤충 타일을 이어 붙여 상대 여왕벌을 6방향 완전 포위 — 보드 없는 체스 | `FE-SPATIAL` `FE-PLANNING` `FE-EMERGENCE` | `puzzle-game` | ✅ |
| Onitama (2014) | 5×5에서 이동 카드로 기물을 움직이고, 쓴 카드는 상대 손으로 순환 | `FE-PLANNING` `FE-CONSTRAINT` `FE-SURPRISE` | `puzzle-game` | ✅ |
| Santorini (2016) | 일꾼 이동+건설을 반복해 먼저 3층 위에 올라서면 승리 | `FE-SPATIAL` `FE-PLANNING` `FE-POWER-FANTASY` | `puzzle-game` | ✅ |
| Quoridor (1997) | 벽을 세워 상대 길을 늘리며 내 폰을 반대편에 먼저 도착 | `FE-SPATIAL` `FE-PLANNING` `FE-CONSTRAINT` | `puzzle-game` | ✅ |
| Othello / Reversi (1973) | 양끝을 내 돌로 감싸 사이 줄을 일괄 뒤집기, 종국에 다수 점유 | `FE-PLANNING` `FE-TENSION` `FE-AHA` | `puzzle-game` | ✅ |
| Connect Four (1974) | 기둥에 디스크를 떨어뜨려 가로·세로·대각 4목 선취 | `FE-PLANNING` `FE-CONSTRAINT` `FE-JUST-ONE-MORE` | `puzzle-game` | ✅ |
| Gomoku / 오목 (고전) | 교차점에 돌을 번갈아 놓아 먼저 5목 정렬 | `FE-SPATIAL` `FE-PLANNING` `FE-TENSION` | `puzzle-game` | ✅ |
| Mancala / Kalah (고전) | 구덩이 씨앗을 반시계로 뿌려 셈·연속턴·맞은편 포획으로 저장고 채우기 | `FE-PLANNING` `FE-COMBO` `FE-RISK-REWARD` | `puzzle-game` | ✅ |
| Backgammon (고전) | 주사위 2개로 15말 레이스, 외돌(블롯) 타격과 베어오프 | `FE-LUCK-TAME` `FE-RISK-REWARD` `FE-TENSION` | `puzzle-game` | ✅ |
| YINSH (2003) | 링을 움직여 마커를 남기고 뒤집어 5정렬마다 링 1개 제거, 3개 선취 | `FE-PLANNING` `FE-RISK-REWARD` `FE-EMERGENCE` | `puzzle-game` | ✅ |

### [word-party.md](./word-party.md) — 단어 · 파티 · 연상
| 게임 | 코어 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|---|
| Scrabble (1948) | 7타일 랙에서 글자를 꺼내 보드의 기존 단어에 교차로 잇고, 배수 칸·7타일 보너스로 점수를 극대화하는 크로스워드 만들기 | `FE-OPTIMIZE` `FE-PLANNING` `FE-MASTERY` | `puzzle-game` | ✅ |
| Boggle (1972) | 4x4 글자 주사위 격자에서 제한 시간 동안 인접 경로로 이어지는 단어를 최대한 많이 찾아 길이별 점수 획득 | `FE-AHA` `FE-FLOW` `FE-MASTERY` | `puzzle-game` | ✅ |
| Bananagrams (2006) | 보드 없이 각자 타일로 개인 크로스워드를 실시간으로 짓고 허물며, 타일을 다 쓰면 'Peel'로 전원에게 새 타일을 강제하는 속도전 | `FE-REARRANGE` `FE-FLOW` `FE-ESCALATION` | `puzzle-game` | ✅ |
| Codenames (2015) | 스파이마스터가 '한 단어 + 숫자' 단서로 5x5 단어판의 아군 요원 여러 개를 동시에 암시하고, 팀이 암살자를 피해 지목 | `FE-AHA` `FE-RISK-REWARD` `FE-TENSION` | `puzzle-game` | ❌ |
| Just One (2018) | 전원이 비공개로 한 단어 단서를 쓰고 중복 단서는 전부 소거된 뒤, 남은 단서만으로 한 명이 제시어를 맞히는 협력 | `FE-EXPRESSION` `FE-RISK-REWARD` `FE-SOCIAL` | `puzzle-game` | ❌ |
| Dixit (2008) | 이야기꾼이 자기 그림 카드에 모호한 단서를 붙이고 전원의 카드가 섞여 투표 — 전원 적중도 전원 실패도 이야기꾼 0점 | `FE-EXPRESSION` `FE-NARRATIVE` `FE-RISK-REWARD` | `puzzle-game` | ❌ |
| Wavelength (2019) | 양극 개념 스펙트럼 위 숨은 과녁 위치를 사이킥이 단서 하나로 암시하고, 팀이 다이얼을 돌려 과녁에 가까울수록 득점 | `FE-EXPRESSION` `FE-TENSION` `FE-SOCIAL` | `puzzle-game` | ❌ |
| Telestrations (2009) | 제시어를 그림으로, 그림을 글로 번갈아 전달하고 체인 끝에서 원형과 변질된 결과를 공개해 웃는 전언 게임 | `FE-SURPRISE` `FE-EMERGENCE` `FE-SOCIAL` | `puzzle-game` | ❌ |
| Concept (2013) | 말 없이 보드의 보편 아이콘들 위에 마커를 조합 배치해 단어·문구를 설명하고 나머지가 자유 추측 | `FE-AHA` `FE-DEDUCTION` `FE-CONSTRAINT` | `puzzle-game` | ⚠️ |
| Taboo (1989) | 제한 시간 안에 카드의 금지어 5개를 피해 제시어를 말로 설명하고 팀이 연속으로 맞히는 속도 설명 | `FE-CONSTRAINT` `FE-EXPRESSION` `FE-TENSION` | `puzzle-game` | ❌ |

### [speed-memory.md](./speed-memory.md) — 순발력 · 기억 · 민첩
| 게임 | 코어 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|---|
| Dobble / Spot It! (2009) | 두 카드 사이 단 하나뿐인 공통 심볼을 먼저 찾기 — 55장 전 쌍이 공통 1개(사영평면) | `FE-AHA` `FE-FLOW` `FE-SET-LOGIC` | `arcade-classic` | ✅ |
| Ghost Blitz / Geistesblitz (2010) | 카드 공개 — 올바른 색 물건이 있으면 그것, 없으면 색·형태 모두 무관한 물건을 잡기 | `FE-AHA` `FE-SET-LOGIC` `FE-MASTERY` | `arcade-classic` | ✅ |
| Jungle Speed (1997) | 차례로 카드 공개, 같은 무늬가 뜨면 중앙 토템 먼저 잡기 — 진 쪽이 카드 인수 | `FE-TENSION` `FE-TIMING` `FE-SURPRISE` | `arcade-classic` | ✅ |
| Halli Galli (1990) | 공개 카드의 같은 과일 합이 '정확히 5'가 되는 순간 종 먼저 치기 | `FE-TENSION` `FE-TIMING` `FE-FLOW` | `arcade-classic` | ✅ |
| Memory / Concentration (고전) | 뒷면 카드를 턴마다 2장 뒤집어 짝 맞추기 — 위치 기억이 전부 | `FE-MEMORY` `FE-AHA` `FE-JUST-ONE-MORE` | `puzzle-game` | ✅ |
| Simon (1978) | 빛·소리 시퀀스를 그대로 따라 누르기 — 성공할수록 1개씩 길어진다 | `FE-MEMORY` `FE-ESCALATION` `FE-FLOW` | `arcade-classic` | ✅ |
| Jenga (1983) | 54블록 타워에서 한 손으로 블록을 빼 꼭대기에 올리기 — 무너뜨리면 패배 | `FE-TENSION` `FE-ESCALATION` `FE-RISK-REWARD` | `arcade-classic` | ⚠️ |
| Rhino Hero (2011) | 벽 카드를 세우고 지붕 카드를 올려 탑 쌓기 — 손 소진 레이스, 붕괴 즉패 | `FE-TENSION` `FE-ESCALATION` `FE-SPATIAL` | `arcade-classic` | ⚠️ |
| Crokinole (1876) | 디스크를 튕겨 중앙 20점 홀을 노리고 상대 디스크를 장외로 쳐내기 | `FE-MASTERY` `FE-RISK-REWARD` `FE-JUICE` | `arcade-classic` | ⚠️ |
| ICECOOL (2016) | 오뚝이 펭귄 피겨를 튕겨 문을 통과시키는 추격전 — 커브·점프 샷이 기술 | `FE-JUICE` `FE-MASTERY` `FE-TENSION` | `arcade-classic` | ❌ |

> **재현도 분포: ✅55 · ⚠️33 · ❌12.** ⚠️는 대부분 '다인 인터랙션(드래프트 견제·턴 경쟁·표적 선택)이 코어 재미의 큰 축'이라 휴리스틱 AI·솔로 변형·날짜 시드 데일리로 설계 보정이 필요하다는 뜻이고, 일부는 콘텐츠 규모(Wingspan·Terraforming Mars 카드 풀) 또는 실물 물리(Jenga·Crokinole)가 사유다. ❌ 12종은 코어가 **사람 사이의 사회성**(파티 연상·무언 동기화·거짓말 떠넘기기·자유 협상) 또는 **실물 조작**(ICECOOL 피겨 튕기기) 자체라 직역이 불가능하다 — 단 각 엔트리에 '추출할 재미요소'를 명시했으므로 **요소 차용은 전부 가능**하다(예: Codenames의 '한 단서 다중 적중' → 단서 설계 퍼즐, The Mind의 침묵 타이밍 → FE-TIMING 동기화 게임).

## 신설 재미요소 빠른 색인 — 정의는 [../fun-elements.md](../fun-elements.md) §1

`FE-DECKCRAFT`(덱 조형 — 무작위 풀 편집으로 확률 분포를 설계) · `FE-AUCTION`(경매·가치 평가) · `FE-BLUFF`(심리전·은닉 — 솔로는 AI 텔 해독·확률 추론으로 번안) · `FE-MEMORY`(기억 — 위치·시퀀스·변화 암기)

기존 태그와의 교차가 잦은 것: 워커 플레이스먼트의 자리 선점=`FE-DRAFT` 친족, 푸시유어럭=`FE-RISK-REWARD`의 순수형, 공유 무작위 동시 플레이(Karuba·Cartographers·Yahtzee)=`FE-LUCK-TAME` 데일리 직결, 폴리오미노 수납(Bärenpark·A Feast for Odin)=`FE-PACKING`.

## 조합 레시피 빠른 색인 — 자세한 내용은 [../fun-elements.md](../fun-elements.md) §2

**(보드게임 계열 신규)** 덱조형 런 슈터 · 시스템 경매 타이쿤 · 텔 읽기 듀얼 · 시퀀스 폭주 암기 — **섞지 말 것**은 [../fun-elements.md](../fun-elements.md) §3 안티패턴, 특히 **다인 사회성 코어 솔로 직역 금지**(협상·정체 은닉·제한 소통·파티 연상)와 **실물 민첩 코어 정밀 물리 직역 금지**(타이밍 탭 추상화로 번안).

## 범위 밖 — 단일플레이 웹 전제로 축소되는 부분

- **다인 견제·경쟁 인터랙션** (드래프트 뺏기·워커 자리 선점·경매 호가·도쿄 표적) → 휴리스틱 AI 상대(탐욕 1수 평가, '왜 그 수인지' 읽히게) · '남긴 것이 비용' 솔로 변형 · 날짜 시드 데일리 비동기 경쟁.
- **사람 사이의 사회성** (자유 협상·정체 은닉 심리전·제한 소통·파티 연상) → 직역 불가(❌) — 요소 추출로 변환: 블러프→AI 텔 패턴 해독+기대값 추론, 단서 경제→횟수 제약, 연상 적정 모호성→단서 설계 퍼즐.
- **실물 구성물의 촉각·민첩** (블록 빼기·디스크 튕기기·피겨 플리킹) → 타이밍 탭 추상화(흔들림 게이지·파워/각도 2탭) 또는 단순 임펄스 근사(`matter-physics` ⚠️)로 긴장·타이밍의 정수만 번안.
- **대량 카드 풀·확장 콘텐츠** (Wingspan 170종·Terraforming Mars 200+) → 30~60종 자체 디자인 카드 + 태그 시너지 골격 유지.

## 출처 · 원칙

- 잘 알려진 보드게임의 공개된 규칙·디자인 통념을 정리한 것이다(법률 자문 아님). 컴팩트 포맷 특성상 세부 수치는 골격 수준으로 서술했고, 단정 수치는 웹 교차 확인을 거쳤다.
- **IP 안전:** 메카닉·규칙 시스템은 저작권 보호 대상이 아니므로 자유 차용. 게임명(상표)·아트워크·구성물 디자인·캐릭터·고유 명칭은 복제 금지 — 전부 `PixelForge`/`VectorForge`/`ChipAudio` 절차 생성 오리지널 + 자체 타이틀로 환기하고, 게임명은 메카닉 설명 맥락에서만 표기한다. 상세는 각 파일의 **IP 주의·IP 공통 원칙** 및 [`ip-license-guard`](../../../../wgf-ip-license-guard/SKILL.md).
