# 이코노미·진행·파워커브·드랍 — ECON (14)

> [`item-architect`](../../SKILL.md)가 **파워 커브·획득(드랍/보상)·통화·진행**을 설계할 때 참조하는 도메인 파일. 색인 [INDEX.md](./INDEX.md), 공통 원칙 [principles.md](./principles.md).
> 아이템 이코노미의 두 힘(faucet 유입 / sink 유출)·예측가능한 우상향 파워커브·획득 심리(가변비율 추진력)를 **작은 웹게임**(Phaser 4 · 단일플레이 · localStorage · 모바일 1~3분 세션 · CC0)으로 코드화한다. AAA/MMO의 서버 경제·인플레이션 통제·loot box/gacha 결제는 **차용하지 않고**, 그 추진력만 취해 천장(pity)·시드·투명성으로 좌절을 흡수한다.

## 프레임워크 요약

- **단일플레이에서 sink/faucet은 인플레이션 통제가 아니라 페이싱 노브다.** Wikipedia가 직접 명시하듯 gold sink는 단일플레이에 거의 무의미하지만, "벌기 대 쓰기" 원리는 진행 속도 조절에 그대로 유효하다 — 우리는 이걸 "다음 업그레이드까지 N판"으로 환산한다(`ECON-FAUCET-SINK`).
- **하나의 곡선식이 보상·난이도·비용을 묶는다.** `powerCurve(i)`(`ECON-CURVE`)·지수 비용(`ECON-COST-CURVE`)·level-architect의 `difficultyOf(i)`가 **같은 진행 인덱스 i**를 공유하면 "보상=난이도 정렬"이 코드로 자동 보장된다. 서버 DDA 없이 데이터 곡선으로 대체.
- **가변비율 드랍의 추진력은 취하되 착취 구조는 버린다.** ★사용자 강조: "획득 동기=몰입의 핵심". VR이 가장 강력한 강화 스케줄이라는 건 강하게 입증됐지만(Skinner), 비과금 단일플레이라 pity(천장)·시드·확률 투명성을 자연스럽게 둘 수 있어 **서프라이즈만 윤리적으로 취한다**(`ECON-VARIABLE-RATIO`·`ECON-PITY`).
- **스케일링은 공짜 무한 진행이지만 의미 부패 위험이 크다.** 짧은 세션엔 하드 업그레이드(Facility)·수평 옵션(sidegrade)·메타 진행을 섞어 "숫자만 커지는" 함정을 피한다(`ECON-HORIZONTAL`·`ECON-META-PROGRESSION`·`ECON-REWARD-TYPE`).
- **localStorage가 메타 진행·게이트·잔액의 완벽한 그릇이다.** 서버 없음 제약이 오히려 roguelite 메타 진행(런 간 영구 성장 + 무료 respec)·prestige 구조에 자연 정합한다.

## 원칙 사전 (ECON)

### `ECON-CURVE` 파워 커브 정렬 (예측 가능한 우상향)
- **정의:** 플레이어 전투력/효율의 합성치를 진행 인덱스 i에 대해 꾸준하고 예측 가능하게 우상향시킨다. 같은 진행 단계의 모든 아이템·적·보상은 이 커브 위 한 점에 매핑되며, 커브를 크게 벗어나는 개별 아이템은 같은 등급 전체를 무효화하므로 확률·게이팅으로 통제한다(공통 캐논 5: `ECON-CURVE`).
- **출처:** Game Wisdom [3 Forms of Power Curves](https://game-wisdom.com/critical/3-forms-power-curves-game-design)·[Tracking Power Curves](https://game-wisdom.com/critical/power-curves-game-design); gamedesignskills [Game Progression](https://gamedesignskills.com/game-design/game-progression/)("새 능력·장비·아이템이 플레이어 진행과 정렬된 속도로 해금").
- **우리 엔진 구현(작은 웹게임):** 단일 진실원 곡선식 한 줄을 둔다 — `powerCurve(i) = base * (1 + 0.12 * i)`(level-architect `difficultyOf(i)`와 **같은 i** 공유). 아이템 스탯 생성기는 이 목표치에 등급 계수를 곱해 뽑는다(common 0.8x · rare 1.0x · epic 1.2x). localStorage에 누적 파워(장비합)를 저장해 보상=난이도가 자동 정렬. 곡선 파라미터(base·기울기)는 items.json/economy 블록의 단일 노브로.
- **흔한 실패:** 절대 스탯만 보고 손코딩으로 뿌리면 후반에 커브가 들쭉날쭉해져 한 드랍이 5스테이지치 진행을 건너뛴다. 레전더리를 커브 훨씬 위에 두고 확률 통제를 안 하면 같은 등급 전부가 쓰레기가 된다.
- **연관:** `ECON-COST-CURVE`, `ECON-RARITY`, `ECON-REWARD-PACING`, `ECON-HORIZONTAL`

### `ECON-FAUCET-SINK` 수도꼭지·배수구 균형 (페이싱으로서의 이코노미)
- **정의:** 자원이 들어오는 통로(faucet: 드랍·보상·판매)와 빠지는 통로(sink: 구매·강화·수수료·소모)를 명시적으로 매핑하고, 그 비율로 진행 속도를 조절한다. 단일플레이에서는 인플레이션 방지가 아니라 "다음 목표까지의 거리"를 빚는 페이싱 노브다.
- **출처:** [Gold sink — Wikipedia](https://en.wikipedia.org/wiki/Gold_sink)("gold sink는 단일플레이에 거의 적용되지 않는다 … 그러나 벌기 대 쓰기 원리는 진행 페이싱에 유효"); [The F-Words of MMOs: Faucets](https://www.gamedeveloper.com/design/the-f-words-of-mmos-faucets); $150M [Ultimate Handbook](https://www.gamedeveloper.com/production/i-designed-economies-for-150m-games-here-s-my-ultimate-handbook)(Resource Flowchart로 source/spend 매핑).
- **우리 엔진 구현(작은 웹게임):** 게임마다 economy 선언 블록에 faucet(스테이지 클리어 보상·적 드랍률·판매가)과 sink(상점가·강화 비용·부활/리트라이 비용)를 표로 둔다. localStorage `coins` **하나만** 관리하고 sink는 "구매·강화"로 단순화. 균형은 "다음 업그레이드까지 N판" 식 time-equivalence로 환산($150M 핸드북). 잔액 표시=game-ui-hud, 획득/소비 연출=juice-fx.
- **흔한 실패:** sink 없이 faucet만 두면 통화가 무의미(Diablo 2 후반 골드 붕괴 → Stone of Jordan 대체 통화화, [Sink or Swim](https://www.gamespot.com/articles/sink-or-swim-markets-and-money-in-online-games/1100-6394608/)). 반대로 sink만 빡빡하면 1~3분 세션에서 아무것도 못 사 동기 상실. MMO식 다중 통화·경매장 수수료를 복붙하는 것.
- **연관:** `ECON-COST-CURVE`, `ECON-VENDOR`, `ECON-REWARD-PACING`, `ECON-META-PROGRESSION`

### `ECON-COST-CURVE` 비용 곡선 (지수 비용 vs 선형 보상)
- **정의:** 업그레이드/강화 비용은 지수적으로(레벨당 곱셈) 늘리고, 그것이 주는 보상(생산·파워)은 선형/다항으로 늘린다. 그러면 비용이 결국 보상을 따라잡아 "다음 한 단계"가 항상 의미 있는 목표로 남는다(공통 캐논 5: `ECON-COST-CURVE`).
- **출처:** [The Math of Idle Games, Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)(`cost_next = cost_base × rate_growth^owned`, "지수 성장은 어떤 다항 성장도 결국 추월"); [Math — the backbone of Idle Games](https://medvescekmurovec.medium.com/math-the-backbone-of-idle-games-part-1-f46b54706cf1)("0.01 차이가 후반에 거대한 페이싱 차이"); AdVenture Capitalist growth 1.07.
- **우리 엔진 구현(작은 웹게임):** 비용은 한 줄로 데이터화 — `costBase * Math.pow(growth, level)`. growth는 **1.07~1.15** 범위에서 세션 길이에 맞춰 튜닝(모바일 1~3분이므로 작게 둬 첫 몇 단계를 빠르게, 후반 sink는 유지). 보상은 `+flat per level` 선형. 한 곡선식 = 밸런싱 단일 노브 → 스프레드시트 없이 튜닝.
- **흔한 실패:** 비용·보상 둘 다 지수면 진행이 멈추거나 폭주. growth를 눈대중 하드코딩하면 후반 벽 또는 무의미. 짧은 세션에 너무 가파른 growth → 첫 세션에 아무것도 못 올려 이탈.
- **연관:** `ECON-CURVE`, `ECON-FAUCET-SINK`, `ECON-VENDOR`, `ECON-MEANINGFUL-UPGRADE`

### `ECON-RARITY` 희귀도 사다리 (등급=확률·파워의 이중 신호)
- **정의:** 아이템을 소수 등급(common/rare/epic/legendary)으로 나누고, 등급이 곧 ① 드랍 확률(높을수록 희귀)과 ② 파워 기대치(높을수록 강함)를 동시에 신호한다. 색+텍스트로 이중부호화한다.
- **출처:** [Color-Coded Item Tiers — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/Main/ColorCodedItemTiers); [Origins of Color Coded Loot](https://aggronaut.com/2020/09/03/origins-of-color-coded-loot/)(Diablo가 Angband에서 차용: white/blue/gold); [Item Rarity Tiers](https://www.33rdsquare.com/is-legendary-rarer-than-epic/)("레전더리를 천문학적으로 희귀하게 만들어 장기 목표"); [Color Theory Codifies Item Quality](https://medium.com/@ClaireFish/how-color-theory-codifies-item-quality-in-video-games-104d8118044).
- **우리 엔진 구현(작은 웹게임):** 등급 테이블 `{tier, color, dropWeight, powerMult}`을 데이터로. **3~4개 권장**(소화면 변별 한계). 색 단독 금지 — 색+테두리/배지로 이중부호화(상세 시각 규약·다채널 인코딩은 [rarity-affixes.md](./rarity-affixes.md)의 `AFX-VISUAL-DIFF` 소유, 여기선 참조만). sprite-forge/vector-graphics가 같은 베이스 스프라이트를 등급별 팔레트/외곽선으로 재색칠해 CC0 절차생성으로 등급 비주얼을 뽑는다. 등급 색은 game-ui-hud 툴팁이 그대로 소비.
- **흔한 실패:** 등급 6개 이상 → 짧은 세션에서 변별 불가. 색만으로 신호 → 색맹·소화면 실패. 등급이 확률만 바꾸고 파워는 안 바꾸면(또는 반대) 신호가 거짓.
- **연관:** `ECON-VARIABLE-RATIO`, `ECON-CURVE`, `ECON-REWARD-TYPE`, `ECON-TELEGRAPH`

### `ECON-VARIABLE-RATIO` 가변비율 드랍 (불확실성이 끄는 추진) ★
- **정의:** 좋은 드랍을 "정해진 횟수"가 아니라 "평균은 정해졌지만 매 시도는 불확실한" 가변비율(VR)로 준다. 매 시도가 잠재적 대박이라 반복 동기가 강하다. 단, 윤리적 안전장치(pity·천장)를 **반드시** 동반한다(공통 캐논 6: `ECON-VARIABLE-RATIO`, ★사용자 강조 "획득 동기=몰입").
- **출처:** [Skinner Box Mechanics](https://medium.com/design-bootcamp/product-design-and-psychology-the-mechanism-of-skinner-box-techniques-in-video-game-design-5b7315e2d7b4)(VR이 가장 강력한 강화 패턴); [Variable Ratio Schedule Examples](https://helpfulprofessor.com/variable-ratio-schedule-examples/); [Rare Loot Box Rewards — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7882574/)(희귀 드랍이 더 큰 각성·보상 반응·"더 열고 싶은 충동").
- **우리 엔진 구현(작은 웹게임):** 드랍은 등급별 `dropWeight`로 가중 랜덤하되 **결정론 시드**(`Phaser.Math.RND`)로 재현 가능하게 — 런 공유·디버깅·시드 메타 가능. legendary/완벽 롤 확률은 낮게(1~5%) 두고 **체감 연출로 증폭**: juice-fx(화면 흔들림·슬로모) + chip-sound(상승 아르페지오)로 희소 순간을 키운다(`ECON-TELEGRAPH`와 결합). 가챠 결제·확률 은폐는 **절대 금지**(IP-safe·윤리). game-dna FE-SURPRISE/FE-COLLECT/FE-RISK-REWARD와 직결.
- **흔한 실패:** 천장 없는 순수 VR → 불운한 플레이어 영구 박탈(짧은 세션에선 "한 번도 안 뜸"이 치명적 좌절). 비과금 단일게임에 실제 통화·확률 은폐를 들이는 것(불필요·비윤리). 시드 없이 뽑으면 재현/공유/디버깅 불가.
- **연관:** `ECON-PITY`, `ECON-RARITY`, `ECON-TELEGRAPH`, `ECON-REWARD-PACING`

### `ECON-PITY` 천장·불운 바닥 (pity / 비복원으로 박탈 방지) ★
- **정의:** 순수 RNG는 긴 불운 연속(dry streak)을 낳는다. pity timer(N회 실패 후 보장)나 비복원추출(뽑은 건 버킷에서 제거)로 하한을 보장해, 특히 세션이 짧은 게임에서 "빈손 종료"를 막는다. soft pity는 실패할수록 확률을 곡선으로 올린다(공통 캐논 6의 짝: `ECON-VARIABLE-RATIO`의 윤리적 안전장치).
- **출처:** [Loot drop best practices — Daniel Cook](https://www.gamedeveloper.com/design/loot-drop-best-practices)(sampling without replacement, 보장 드롭 가중치 감소식 `100/max rolls`); 가챠 pity(0.5% → 200회 보장, soft/hard pity) 일반 설명; [Rare Loot Box Rewards — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7882574/)(희소 보상의 각성 반응 — pity가 그 보상을 보장 시점에 배치).
- **우리 엔진 구현(작은 웹게임):** 런/세션 단위 pity 카운터를 localStorage에 저장 — K회 연속 common이면 다음 드랍을 rare 이상으로 승급(`meta.pityCount`). 짧은 세션이라 임계를 작게(**5~8회**). 또는 "이번 스테이지 보장 드랍" 풀을 비복원으로 운영. 비과금 단일플레이라 pity·시드·확률 투명성을 자연스럽게 둘 수 있어 VR의 재미만 윤리적으로 취하는 차별점.
- **흔한 실패:** pity 없는 순수 VR로 신규 첫 세션이 전부 흰템 → 이탈. 반대로 pity가 너무 후해 항상 보장되면 VR의 흥분이 죽는다. 천장을 숨겨 신뢰를 깨는 것.
- **연관:** `ECON-VARIABLE-RATIO`, `ECON-RARITY`, `ECON-REWARD-PACING`, `ECON-TELEGRAPH`

### `ECON-REWARD-PACING` 보상 페이싱 (앞치우침 vs 꾸준한 점적)
- **정의:** 화려한 보상의 일부는 도입부에 앞당겨 훅을 걸되(front-load), 새 시각·기능 보상은 세션·진행 전반에 고르게 점적(steady drip)으로 분산한다. 보상 리듬을 난이도 비트에 맞춘다.
- **출처:** Game Wisdom [Pacing Problems](https://game-wisdom.com/critical/pacing-problems-game-design)·[Game Developer 버전](https://www.gamedeveloper.com/design/pacing-problems-in-game-design)(Metroid Prime이 "첫 몇 분에 멋진 아이템을 보여준 뒤 시간에 걸쳐 천천히 되돌려 줌"); [Level Up!](https://dev.to/gamepill/level-up-the-art-of-designing-game-progression-and-player-rewards-2603)("적절히 페이싱된 보상이 좌절을 막고 꾸준한 성취감").
- **우리 엔진 구현(작은 웹게임):** 첫 1~2판에 눈에 띄는 첫 업그레이드/첫 rare를 거의 보장(훅). 이후 보상 인덱스를 level-architect 페이싱 파형(저-고-저-고-정점)에 맞춰 분산 — 고강도 비트 직후에 보상(쉼표=보상). localStorage `rewardLedger`로 "최근 무엇을 줬나"를 기록해 연속 중복 회피. 1~3분 세션이라 "매 세션 최소 1개 의미 있는 진전"을 세션 종료 보상으로 보장.
- **흔한 실패:** 전부 앞당기면 중반 이후 줄 게 없어 지루(The Division식 무의미 스케일링). 전부 뒤로 미루면 초기 이탈. 보상 리듬을 난이도와 무관하게 뿌리면 고난이도 구간에 보상이 비어 좌절.
- **연관:** `ECON-VARIABLE-RATIO`, `ECON-PITY`, `ECON-CURVE`, `ECON-TELEGRAPH`

### `ECON-MEANINGFUL-UPGRADE` 의미 있는 업그레이드 (가짜 선택 금지)
- **정의:** 모든 업그레이드 선택지는 플레이에 실질 영향을 줘야 하고, 한 선택지가 수학적으로 항상 우월해선 안 된다. 핵심 업그레이드(데미지·체력·방어)와 편의 업그레이드(장전속도 등)를 같은 선택지에 섞지 않는다(공통 캐논 도메인 북극성: `ECON-MEANINGFUL-UPGRADE`).
- **출처:** Game Wisdom [How to Power Players Up With Upgrades](https://game-wisdom.com/critical/upgrade-design)·[Game Developer 버전](https://www.gamedeveloper.com/design/how-to-power-up-players-with-upgrades)("전부 메이저 아니면 전부 마이너, 섞지 마라" + respec 권장); gamedesignskills("의미 있어야 하고 어떤 한 선택도 우월해선 안 된다").
- **우리 엔진 구현(작은 웹게임):** 업그레이드 트리를 동질 등급으로 분리('core' 트리 vs 'utility' 트리를 다른 자원/탭으로). Hades Mirror of Night처럼 **무료 respec**(localStorage 한 줄 리셋이라 단일플레이에 자연스러움)으로 빌드 실험 불안 제거. 선택지는 한 화면 **3~5개**로 제한(소화면). 업그레이드 화면 UI=game-ui-hud. strictly-better 금지는 [synergy-balance.md](./synergy-balance.md)의 `SYN-POWER-BUDGET`와 정합.
- **흔한 실패:** 메이저+마이너 혼합 선택지(가짜 선택). 선택지 과다(압도). respec 불가 + 영구 처벌. 모든 업그레이드가 그냥 +수치라 빌드 정체성이 없는 것.
- **연관:** `ECON-HORIZONTAL`, `ECON-COST-CURVE`, `ECON-REWARD-TYPE`, `ECON-META-PROGRESSION`

### `ECON-HORIZONTAL` 수평 진행 (파워크립 완화·옵션 확장)
- **정의:** 진행의 일부를 "더 강함"(수직)이 아니라 "더 많은 선택지·플레이스타일"(수평)로 준다. 신규 옵션이 기존을 무효화하지 않고 트레이드오프로 공존하게 해 파워크립과 구콘텐츠 폐기를 막는다.
- **출처:** [Power Creep — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/Main/PowerCreep); [On Power Creep — Bruno Dias](https://brunodias.dev/2021/11/27/power-creep.html)(수평 진행이 가장 효과적 완화책); Game Wisdom [Impurities of Pure Upgrades](https://game-wisdom.com/critical/impurities-upgrades-game-design)(sidegrade: 고출력이지만 2발만 쏘는 샷건); [Vertical vs Horizontal](https://medium.com/@VideoGameMaster/vertical-vs-horizontal-progression-6349ad8a504d)("최고 장비를 일찍 캡하면 더 정밀한 난이도 곡선").
- **우리 엔진 구현(작은 웹게임):** 후반 보상의 상당수를 sidegrade(트레이드오프 모디파이어: 빠르지만 약함/강하지만 느림)와 코스메틱·새 능력으로 돌린다. 파워 캡을 비교적 일찍 두고 그 위는 수평 옵션으로 → level-architect가 적을 그 캡에 맞춰 정밀 밸런싱. 코스메틱은 sprite-forge/vector-graphics 절차 재색칠로 무한·CC0. 빌드 시너지는 [synergy-balance.md](./synergy-balance.md)와 연결, game-dna FE-BUILD와 직결.
- **흔한 실패:** 끝없는 수직 스케일링만 두면 구 아이템 전부 폐기 + 후반 무의미. 수평을 "그냥 다른 +수치"로 위장(진짜 트레이드오프 없음). 단일플레이에 코스메틱만 잔뜩 두고 게임플레이 영향이 없어 동기 약화.
- **연관:** `ECON-MEANINGFUL-UPGRADE`, `ECON-REWARD-TYPE`, `ECON-CURVE`, `ECON-META-PROGRESSION`

### `ECON-GATE` 게이팅 (진행 차단으로 페이싱·학습 보호)
- **정의:** 특정 지역/콘텐츠를 레벨·아이템·스킬 요건 뒤에 잠가 진행을 단계화하고 한꺼번에 압도하지 않게 한다. 게이트는 노력·실력을 요구할 만큼 도전적이되 좌절시키지 않게.
- **출처:** [Examining Gating — Game Developer](https://www.gamedeveloper.com/design/examining-gating-in-game-design)("스토리·스킬·오브젝트 획득 전까지 지역 접근을 막아 압도 방지"); [Gates — The Level Design Book](https://book.leveldesignbook.com/process/layout/typology/gates)(hard gate vs soft gate); [Mastering Gating](https://www.numberanalytics.com/blog/ultimate-guide-gating-game-design)("충분히 도전적이되 넘을 수 없을 만큼은 아니게").
- **우리 엔진 구현(작은 웹게임):** item gate(특정 아이템 보유 시 다음 스테이지/모드 해금)와 level gate(누적 파워 ≥ 임계치)를 localStorage 플래그로 구현 — 서버 없이 충분. world-map-architect의 노드 해금 위상과 직접 연결: 게이트 = 맵 엣지 잠금. **soft gate 선호**(짧은 세션이라 hard wall은 이탈 위험), 게이트 직전 "필요 조건"을 명확 표시(game-ui-hud, `ECON-TELEGRAPH`와 결합). 열쇠/잠금 의미론은 [utility-consumables.md](./utility-consumables.md)의 `UTIL-LOCK-KEY`·`UTIL-NO-SOFTLOCK`와 정합(키는 영구·비소모).
- **흔한 실패:** grind gate(순수 반복으로만 넘는 벽)는 1~3분 세션 정신과 충돌. 게이트 조건을 안 알려줘 막다른 길 체감. 게이트가 너무 촘촘해 흐름 끊김.
- **연관:** `ECON-TELEGRAPH`, `ECON-META-PROGRESSION`, `ECON-REWARD-TYPE`, `ECON-CURVE`

### `ECON-VENDOR` 상점·가격 합리성 (획득비용 기반 가격)
- **정의:** 상점 가격과 판매가는 아이템의 실제 가치(획득에 드는 시간/노력)를 반영해야 한다. 판매가는 구매가의 일부(예: 25~50%)로 둬 차익거래를 막는다. 단일플레이에선 상점이 곧 통화의 주 sink다.
- **출처:** $150M [Ultimate Handbook](https://www.gamedeveloper.com/production/i-designed-economies-for-150m-games-here-s-my-ultimate-handbook)("갑옷은 비싸고 양배추는 싸야"; "10시간·100코인/시 파밍 검이면 1000코인"); [Dynamic vendor pricing — GameDev.net](https://www.gamedev.net/forums/topic/523158-dynamic-vendor-pricing/4394433/)(RPG는 판매 시 구매가 일부만 환급); 고정 표준가는 누적 부에 비해 0으로 수렴한다는 인플레이션 경고.
- **우리 엔진 구현(작은 웹게임):** 가격 = `획득시간환산 * 코인/분` 한 줄 함수로 생성(스프레드시트 불필요). 판매가 = `구매가 * 0.3` 같은 상수. 상점은 `ECON-FAUCET-SINK` 균형의 주 배수구. 짧은 세션이라 간결한 **3~6칸 그리드**(game-ui-hud), 가격은 등급 색과 함께 표시. 동적 가격(전일 거래가 기반)은 단일플레이엔 과잉이므로 채택 안 함 — 단순 고정/곡선가로 충분.
- **흔한 실패:** 고정 표준가만 두고 후반 통화 폭증 방치(가격 무의미). 판매가=구매가(무한 차익). MMO식 경매장·수요공급 시뮬레이션을 단일플레이에 이식.
- **연관:** `ECON-FAUCET-SINK`, `ECON-COST-CURVE`, `ECON-RARITY`, `ECON-TELEGRAPH`

### `ECON-META-PROGRESSION` 메타 진행 (런 간 영구 성장)
- **정의:** 세션(런)이 끝나도 남는 영구 통화·해금을 둬, 매 세션이 다음 세션을 약간 쉽게/풍부하게 만든다. 동시에 난이도를 함께 올려(heat) 도전을 유지한다.
- **출처:** [Roguelite Best Progression — Game Rant](https://gamerant.com/roguelite-games-with-best-progression-systems/)(Hades Mirror of Night=Darkness로 영구 강화+무료 respec, Pact of Punishment로 난이도 동반 상승; Dead Cells Cells=드랍풀 확장); [Roguelites Where You Get Stronger](https://choostgames.com/blog/best-roguelites-power-fantasy/); [The Math of Idle Games, Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)(prestige: 비용 곡선을 log 취해 다음 런이 더 멀리).
- **우리 엔진 구현(작은 웹게임):** localStorage가 메타 진행의 자연스러운 그릇 — `meta.darkness` · `meta.unlocks[]`. 짧은 세션·서버 없음에 완벽 정합(매 1~3분 런이 메타에 적립). prestige식 리셋+배수 또는 Mirror식 영구 강화 트리 중 택일. **무료 respec 기본**(localStorage 리셋). 메타 강화에 맞춰 `ECON-CURVE`/level-architect 난이도를 heat로 동반 상승. world-map-architect 영구 해금 노드와 직접 연결.
- **흔한 실패:** 메타 없이 매 런이 백지면 짧은 세션의 누적 성취감 상실(이탈). 메타 강화만 하고 난이도를 안 올리면 후반 지루. respec 막아 빌드 실험 불안. 메타 통화가 너무 빨리 천장이면 장기 목표 소멸.
- **연관:** `ECON-CURVE`, `ECON-HORIZONTAL`, `ECON-GATE`, `ECON-REWARD-TYPE`

### `ECON-REWARD-TYPE` 보상 유형 다양화 (영광·자양·접근·능력)
- **정의:** 보상을 단일 통화로만 주지 말고 네 유형 — Glory(과시·코스메틱), Sustenance(현상 유지·회복), Access(새 장소/자원), Facility(새 능력) — 으로 다양화한다. 내재 보상(실력감)과 외재 보상(파워감)을 함께 둔다.
- **출처:** [Typology of Rewards — GameDesignKnowledge](https://www.gamedesignknowledge.com/blog-post/typology-of-rewards); QUT [Videogame Reward Types](https://eprints.qut.edu.au/65011/2/65011.pdf)(Glory·Sustenance·Access·Facility 4유형, 학술 1차 출처); [Intrinsic vs Extrinsic — Game Developer](https://www.gamedeveloper.com/design/intrinsic-vs-extrinsic-rewards-why-you-need-both)("둘 다 필요").
- **우리 엔진 구현(작은 웹게임):** 아이템 카탈로그를 유형 태그로 분류 — Facility(새 능력=하드 업그레이드, world-map 게이트 키), Access(스테이지 해금 키·자원팩), Sustenance(회복·실드 소모품 → [utility-consumables.md](./utility-consumables.md)), Glory(코스메틱 스킨=sprite-forge/vector-graphics 절차 재색칠로 무한·CC0). 짧은 세션이라 유형을 섞어 매 세션 "새로운 종류의 보상"을 체감. game-dna FE-COLLECT는 Glory/Facility에, FE-RISK-REWARD는 Sustenance 베팅에 연결.
- **흔한 실패:** 코인 하나만 주는 단조 보상. Glory(코스메틱)만 잔뜩이고 게임플레이 영향 0(단일플레이에선 사회적 과시 동기가 약해 더 위험). Sustenance 소모품을 너무 흔하게 줘 긴장 소멸.
- **연관:** `ECON-RARITY`, `ECON-HORIZONTAL`, `ECON-GATE`, `ECON-TELEGRAPH`

### `ECON-TELEGRAPH` 보상 예고·기대 곡선 (anticipation → reward 사이클)
- **정의:** 보상을 주기 전에 그 존재·접근 경로를 미리 보여줘(telegraph) 기대(도파민)를 빚고, 획득 순간에 보상(엔도르핀)으로 해소하는 감정 사이클을 설계한다.
- **출처:** $150M [Ultimate Handbook](https://www.gamedeveloper.com/production/i-designed-economies-for-150m-games-here-s-my-ultimate-handbook)("anticipation phase 도파민 → reward phase 엔도르핀"); [Pacing Problems](https://www.gamedeveloper.com/design/pacing-problems-in-game-design)(Metroid Prime이 멋진 아이템을 먼저 보여주고 나중에 줌); gamedesignskills("명확한 목표가 기대를 만든다").
- **우리 엔진 구현(작은 웹게임):** 잠긴 아이템/상점 칸을 실루엣·잠금 아이콘으로 미리 노출(game-ui-hud), 게이트 조건을 명시(`ECON-GATE`와 결합). 획득 순간 juice-fx + chip-sound로 reward phase 증폭(`ECON-VARIABLE-RATIO` 희소 드랍 연출과 같은 채널). 짧은 세션이라 "이번 판 끝나면 살 수 있는 것"을 항상 보이게 해 다음 세션 복귀 동기를 건다. story-architect의 보상 서사(아이템 lore 미리보기)와 연결.
- **흔한 실패:** 예고 없이 불쑥 주면 기대 곡선이 없어 임팩트 약화. 반대로 영원히 예고만 하고 안 주면 좌절. telegraph한 보상의 실제 가치가 기대에 못 미치면 신뢰 붕괴(`ECON-VENDOR` 합리성 위반).
- **연관:** `ECON-VARIABLE-RATIO`, `ECON-PITY`, `ECON-GATE`, `ECON-REWARD-PACING`

## 곡선·데이터 치트 (바로 쓰는 공식·형태)

곡선은 전부 **같은 진행 인덱스 i**(스테이지/노드 깊이)를 입력으로 받아 level-architect `difficultyOf(i)`·world-map-architect 노드 위상과 단일 진실원에서 파생되게 한다.

| 노브 | 공식(형태) | 권장 범위 | 비고 |
|---|---|---|---|
| 파워 커브 | `powerCurve(i) = base * (1 + 0.12*i)` | 기울기 0.08~0.15 | 등급 계수 곱: common 0.8x·rare 1.0x·epic 1.2x (`ECON-CURVE`) |
| 강화/구매 비용 | `cost(lv) = costBase * growth^lv` | growth 1.07~1.15 | 모바일 짧은 세션→작게(초반 빠르게), 후반 sink 유지 (`ECON-COST-CURVE`) |
| 업그레이드 보상 | `reward(lv) = base + flat*lv` (선형) | — | 비용=지수·보상=선형이라 "다음 한 단계"가 늘 의미 (`ECON-COST-CURVE`) |
| 판매가 | `sellPrice = buyPrice * 0.3` | 0.25~0.5 | 차익거래 차단, 상점이 주 sink (`ECON-VENDOR`) |
| 드랍 가중 | `pick(weighted, seededRNG)` → `lerp(min,max,rng())` | legendary 1~5% | 선택→강도 2단 분리, 시드로 재현 (`ECON-VARIABLE-RATIO`) |
| pity 천장 | K회 연속 common → 다음 rare↑ 승급 | K=5~8 | `meta.pityCount` localStorage (`ECON-PITY`) |

localStorage 메타 진행 키 패턴(서버 없이 런 간 영구 성장 — `ECON-META-PROGRESSION`):

```
coins           : 현재 통화(단일, ECON-FAUCET-SINK 잔액)
meta.darkness   : 런 간 영구 통화(Hades Mirror식)
meta.unlocks[]  : 영구 해금 노드/모드/드랍풀 확장(ECON-GATE 플래그)
meta.pityCount  : 불운 카운터(ECON-PITY)
rewardLedger    : 최근 지급 보상 로그(ECON-REWARD-PACING 연속 중복 회피)
runSeed         : 드랍 시드(ECON-VARIABLE-RATIO 재현·공유)
```

## 장르별 이코노미 기본형 (빠른 처방)

[principles.md](./principles.md) §4 장르 처방과 정합. 디폴트일 뿐 인터뷰에서 비틀 수 있다.

| 장르 | 통화·sink | 파워커브 | 드랍/보상 | 메타 |
|---|---|---|---|---|
| **endless-runner** | 코인 → 런간 상점 sink | 메타 캡 + 런내 순간픽업 | 런중 자석·실드(Sustenance), 종료 코인(faucet) | ★ 런간 업그레이드(`ECON-META-PROGRESSION`) |
| **topdown-shooter** | 런내 자원(레벨업) | 런내 급상승 `ECON-CURVE` | 레벨업 3택(`ECON-MEANINGFUL-UPGRADE`)·드랍 VR | 영구 해금 드랍풀 |
| **arcade-classic** | 점수 배율(통화 약) | 짧고 가파름 | 순간 부스트(Sustenance) | 보통 불필요(`SCOPE-DEFAULT-ZERO`) |
| **puzzle-game** | 별/코인 → 부스터 구매 | 평탄(난이도=레벨) | 제한 사용 부스터, 만능키 금지 | 가벼운 해금만 |
| **platformer** | 코인 + 능력 키(Access/Facility) | 하드 업그레이드 중심 | 게이트 해금(`ECON-GATE`) | 능력=영구(메트로배니아) |

## 출처

파워 커브·진행:
- 3 Forms of Power Curves — Game Wisdom: https://game-wisdom.com/critical/3-forms-power-curves-game-design
- Tracking Power Curves — Game Wisdom: https://game-wisdom.com/critical/power-curves-game-design
- Game Progression — gamedesignskills: https://gamedesignskills.com/game-design/game-progression/

이코노미·sink/faucet·인플레이션:
- Gold sink — Wikipedia (단일플레이 번안 명시): https://en.wikipedia.org/wiki/Gold_sink
- The F-Words of MMOs: Faucets — Game Developer: https://www.gamedeveloper.com/design/the-f-words-of-mmos-faucets
- Sink or Swim: Markets and Money in Online Games — GameSpot: https://www.gamespot.com/articles/sink-or-swim-markets-and-money-in-online-games/1100-6394608/
- I Designed Economies for $150M Games (Ultimate Handbook) — Game Developer: https://www.gamedeveloper.com/production/i-designed-economies-for-150m-games-here-s-my-ultimate-handbook

비용 곡선·아이들/인크리멘털:
- The Math of Idle Games, Part I — Game Developer: https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i
- The Math of Idle Games, Part III — Game Developer: https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii
- Math — the backbone of Idle Games — Medium: https://medvescekmurovec.medium.com/math-the-backbone-of-idle-games-part-1-f46b54706cf1

희귀도·색상 등급:
- Color-Coded Item Tiers — TV Tropes: https://tvtropes.org/pmwiki/pmwiki.php/Main/ColorCodedItemTiers
- Origins of Color Coded Loot — Tales of the Aggronaut: https://aggronaut.com/2020/09/03/origins-of-color-coded-loot/
- Is Legendary Rarer Than Epic? (Item Rarity Tiers) — 33rdsquare: https://www.33rdsquare.com/is-legendary-rarer-than-epic/
- How Color Theory Codifies Item Quality — Claire Fishman, Medium: https://medium.com/@ClaireFish/how-color-theory-codifies-item-quality-in-video-games-104d8118044

획득 심리·가변비율·pity (★루트 심리):
- The Mechanism of Skinner Box Techniques — Medium (Design Bootcamp): https://medium.com/design-bootcamp/product-design-and-psychology-the-mechanism-of-skinner-box-techniques-in-video-game-design-5b7315e2d7b4
- Variable Ratio Schedule Examples — Helpful Professor: https://helpfulprofessor.com/variable-ratio-schedule-examples/
- Rare Loot Box Rewards Trigger Larger Arousal and Reward Responses — PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC7882574/
- Loot drop best practices — Daniel Cook, Game Developer (sampling without replacement·pity): https://www.gamedeveloper.com/design/loot-drop-best-practices

보상 페이싱·유형:
- Pacing Problems — Game Wisdom: https://game-wisdom.com/critical/pacing-problems-game-design
- Pacing Problems in Game Design — Game Developer: https://www.gamedeveloper.com/design/pacing-problems-in-game-design
- Level Up! The Art of Designing Game Progression and Player Rewards — dev.to: https://dev.to/gamepill/level-up-the-art-of-designing-game-progression-and-player-rewards-2603
- Typology of Rewards — GameDesignKnowledge: https://www.gamedesignknowledge.com/blog-post/typology-of-rewards
- Videogame Reward Types (학술) — QUT ePrints: https://eprints.qut.edu.au/65011/2/65011.pdf
- Intrinsic vs Extrinsic Rewards: Why You Need Both — Game Developer: https://www.gamedeveloper.com/design/intrinsic-vs-extrinsic-rewards-why-you-need-both

업그레이드·사이드그레이드·파워크립:
- How to Power Players Up With Upgrades — Game Wisdom: https://game-wisdom.com/critical/upgrade-design
- How to Power Up Players With Upgrades — Game Developer: https://www.gamedeveloper.com/design/how-to-power-up-players-with-upgrades
- Impurities of Pure Upgrades — Game Wisdom: https://game-wisdom.com/critical/impurities-upgrades-game-design
- Power Creep — TV Tropes: https://tvtropes.org/pmwiki/pmwiki.php/Main/PowerCreep
- On Power Creep — Bruno Dias: https://brunodias.dev/2021/11/27/power-creep.html
- Vertical vs Horizontal Progression — Medium: https://medium.com/@VideoGameMaster/vertical-vs-horizontal-progression-6349ad8a504d

게이팅:
- Examining Gating in Game Design — Game Developer: https://www.gamedeveloper.com/design/examining-gating-in-game-design
- Gates — The Level Design Book: https://book.leveldesignbook.com/process/layout/typology/gates
- Mastering Gating — Numberanalytics: https://www.numberanalytics.com/blog/ultimate-guide-gating-game-design

상점·가격:
- Dynamic vendor pricing 논의 — GameDev.net: https://www.gamedev.net/forums/topic/523158-dynamic-vendor-pricing/4394433/

메타 진행·로그라이트:
- Roguelite Games With the Best Progression Systems — Game Rant: https://gamerant.com/roguelite-games-with-best-progression-systems/
- Best Roguelites Where You Get Stronger — Choost Games: https://choostgames.com/blog/best-roguelites-power-fantasy/
