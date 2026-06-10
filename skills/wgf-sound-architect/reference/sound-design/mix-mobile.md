# 믹스 & 모바일 오디오 — MIX-* 원칙 레퍼런스

> [`sound-architect`](../../SKILL.md) · 색인 [INDEX.md](./INDEX.md) · 엔진 [../../../../engine/soundforge.js](../../../../engine/soundforge.js)
>
> 마스터 버스 구성, send 이펙트 재사용, 모바일 폴리포니 예산, 오디오 라이프사이클의 8개 원칙.
> T2~T3는 전체 적용. T1도 `MIX-UNLOCK`·`MIX-LIFECYCLE`·`MIX-VOICE-BUDGET`은 필수.
>
> 형제 파일: [adaptive-music.md](./adaptive-music.md) · [synthesis-recipes.md](./synthesis-recipes.md) · [sfx-design.md](./sfx-design.md)

---

## 마스터 체인 노드 그래프 (Tone.js)

```
모든 보이스 레이어
    └─→ Tone.Volume(master)      ← audio.json master.volume (dB, 기본 -6)
         └─→ Tone.Compressor     ← threshold -24 dB, ratio 4, attack 0.003, release 0.25
              └─→ Tone.Limiter   ← ceiling -1 dB  (audio.json master.limiter)
                   └─→ Tone.getDestination()

send 버스 (1회 구성·재사용)
    revSend(Gain) ─→ Tone.Reverb(decay ≤3s, wet 1) ─→ Volume(master)
    delSend(Gain) ─→ Tone.FeedbackDelay('8n', fb 0.32, wet 1) ─→ Volume(master)
```

**audio.json `master`·`budget` 매핑:**
```json
{
  "master": {
    "volume": -6,
    "limiter": -1,
    "reverb": { "decay": 2.2, "send": 0.18 },
    "delay":  { "send": 0.12 }
  },
  "budget": { "maxVoices": 16 }
}
```

---

## 모바일 오디오 라이프사이클 표

| 상황 | 대응 API | 엔진 구현 |
|---|---|---|
| 첫 제스처 (Tap to start) | `Tone.start()` | `SoundForge.unlock()` |
| 백그라운드·탭 전환 | Transport pause + ctx suspend | `SoundForge.suspend()` ← `MobileHarness.visibilitychange` |
| 잠금 복귀 | ctx resume + BGM 의도 재가동 | `SoundForge.resume()` ← `MobileHarness.visibilitychange` |
| 전화 interruption | ctx `statechange` → resume | `resume()` (visibilitychange 폴백 커버) |
| iOS 복귀 미재개 버그 | 다음 제스처 시 resume 재시도 | `unlock()` 중복 호출 — 안전 noop |
| 무음 스위치 (iOS) | 대응 한계. UI 음소거 버튼 안내 | `toggleMute()` → `getDestination().mute` |
| 페이지 언로드 | suspend | `MobileHarness.pagehide` 리스너 |

---

## 폴리포니 예산 가이드 (프리셋별 추정 보이스)

| 프리셋 | 추정 보이스 | 비고 |
|---|---|---|
| `pad` / `organ` | 5 | PolySynth + fat osc |
| `kit` / `drums` | 3 | kick + snare + hat |
| `fm-bell` / `fm-ep` / `pluck` | 2 | 폴리 2 추정 |
| `supersaw` | 1 | MonoSynth (fat 5osc — CPU 주의) |
| `saw-bass` / `square-lead` / `pulse-lead` / `triangle-bass` | 1 | 모노 |

> `lint-audio.mjs` `PRESET_VOICES` 상수와 정합. `(c) voice-budget` 검사: 레이어 합산 + SFX 헤드룸 4 ≤ maxVoices(16).
> **예산 예시:** pad(5) + kit(3) + supersaw(1) + pluck(2) = 11 + SFX 4 = 15 ≤ 16. 안전.

---

## 원칙 코드 정의

### `MIX-MASTER-CHAIN`

**정의:** 모든 보이스는 `Tone.Volume → Tone.Compressor(threshold -24, ratio 4) → Tone.Limiter(-1) → Destination` 체인을 통과한다. 음량 일관성·피크 방지의 최소 보호망.

**출처:** MDN DynamicsCompressorNode · dossier §이펙트 레시피 F.

**SoundForge 구현:** `_buildBus()` 1회 — `master.chain(comp, limiter, Tone.getDestination())`. **audio.json:** `master.volume`(dB), `master.limiter`(ceiling dB).

**흔한 실패:** 레이어를 `Tone.getDestination()`에 직접 connect → 컴프·리미터 우회. Limiter 상시 개입 = `MIX-HEADROOM` 레벨 초과 신호.

---

### `MIX-SEND-FX`

**정의:** `Tone.Reverb`(절차 IR — 파일 없이 내부 노이즈)와 `Tone.FeedbackDelay`는 send 버스로 **1회 구성·재사용**. 보이스마다 `new Tone.Reverb()` 금지 — ConvolverNode 비용 폭증. `decay ≤ 3s`.

**출처:** gskinner — Making Reverb with the Web Audio API · MDN ConvolverNode · dossier §이펙트 레시피 B.

**SoundForge 구현:** `_buildBus()`의 `revSend`·`delSend` Gain이 send 라우터. `pad`·`pluck`·`fm-bell`만 `vol.connect(revSend)`. **audio.json:** `master.reverb.decay`(≤3s), `.send`, `master.delay.send`.

**흔한 실패:** `.chain(reverb)` insert 오용 → ConvolverNode 중복. decay 4s+ → CPU·진흙탕 믹스.

---

### `MIX-VOICE-BUDGET`

**정의:** 동시 발음 **16보이스** 캡(모바일 저사양 안전선). 슈퍼소우·패드·드럼·SFX 합산이 초과하지 않도록 `PolySynth maxPolyphony`·레이어 수를 관리한다.

**출처:** dossier §모바일 웹뷰 오디오 제약 "동시 발음 캡 16보이스".

**SoundForge 구현:** `spec.budget.maxVoices || 16`. **lint:** `lint-audio.mjs (c) voice-budget`이 `PRESET_VOICES` 합산 자동 추정·경고. **audio.json:** `budget.maxVoices`.

**흔한 실패:** `pad`(5) + `organ`(5) + `kit`(3) + SFX(4) = 17 초과. `PolySynth maxPolyphony` 기본값 32 방치.

---

### `MIX-HEADROOM`

**정의:** 레이어별 `vol`(dB) 합이 클리핑 없이 sum되도록 헤드룸 확보. 개별 레이어 권장 **-16 ~ -9 dB**. Limiter는 최후 보호막이지 상시 압축기가 아니다.

**출처:** 게임 오디오 믹싱 모범 사례 · dossier §이펙트 레시피 F.

**SoundForge 구현:** 레이어 `L.vol` → `Tone.Volume`. DEFAULT_TRACK: pad -16, bass/drums -12, lead -14.

**흔한 실패:** 모든 레이어 `vol: 0` → 합산 +6~+12 dB, Limiter 상시 펌핑. SFX `vel 0.9+` → BGM 위로 튀어 오버.

---

### `MIX-UNLOCK`

**정의:** 첫 사용자 제스처('Tap to start')에서 `Tone.start()`로 AudioContext를 resume. iOS·인앱브라우저는 제스처 없이 컨텍스트를 자동 resume하지 않는다.

**출처:** Matt Montag — Unlock Web Audio in Safari/iOS · WebAudio API issue #1759 · dossier §언락·자동재생.

**SoundForge 구현:** `SoundForge.unlock()` → `Tone.start()` + `_build()`. 'Tap to start' pointerdown 1회에 연결.

**흔한 실패:** `DOMContentLoaded`·`window.onload`에서 `Tone.start()` → iOS 무시. `unlock()` 없이 `startBgm()` → 무음.

---

### `MIX-LIFECYCLE`

**정의:** 백그라운드·잠금 시 Transport pause + ctx suspend. 복귀 시 resume + `_bgmWanted`(BGM 의도) 보존으로 재가동. iOS 복귀 미재개 버그 폴백: 다음 제스처에서 `unlock()` 재시도.

**출처:** WebKit Bug 237878 · PlayCanvas 포럼 iOS 복귀 오디오 미재개 · dossier §백그라운드 suspend.

**SoundForge·mobile.js 구현:** `suspend()`·`resume()`이 ChipAudio와 동일 시그니처 → `mobile.js`([../../../../engine/mobile.js](../../../../engine/mobile.js)) `visibilitychange` 핸들러 무수정 호환. `_bgmWanted`는 `suspend()`가 건드리지 않고 `stopBgm()`만 `false`.

**흔한 실패:** `suspend()`에서 `_bgmWanted = false` → 복귀 후 BGM 미재가동. `interrupted` ctx에 `resume()` 1회 부족 → `unlock()` 폴백.

---

### `MIX-DUCK`

**정의:** 사이드체인 근사 — kick·중요 SFX 타이밍에 음악 버스 gain을 순간 덕킹(ramp down→up). Web Audio에 사이드체인 입력 단자 없으므로 kick 이벤트 시점에 `gain.linearRampToValueAtTime()`으로 흉내낸다. 신스웨이브 펌핑·SFX 명료성 확보.

**출처:** dossier §이펙트 레시피 F "사이드체인(펌핑)".

**구현 패턴:**
```js
function duck(busGain, time) {
  busGain.gain.setValueAtTime(busGain.gain.value, time);
  busGain.gain.linearRampToValueAtTime(0.4, time + 0.01); // 내림
  busGain.gain.linearRampToValueAtTime(1.0, time + 0.18); // 복구
}
// kick 타이밍(_onStep)에: duck(self._nodes.master.input, time);
```

**흔한 실패:** ramp down < 5ms → 클릭 노이즈. 덕킹 없이 SFX·kick 동시 → 임팩트 뭉침.

---

### `MIX-MUTE`

**정의:** 음소거 토글은 `Tone.getDestination().mute = true/false`. `game-ui-hud` 음소거 버튼(♪)이 `window.GAME_AUDIO.toggleMute()` 호출. iOS 무음 스위치는 Web Audio에 부분 영향, 대응 한계 → UI 버튼으로 안내.

**출처:** WebKit iOS 무음 스위치 한계(AudioSession 카테고리 = 브라우저 결정) · dossier §모바일 오디오 제약.

**SoundForge 구현:** `toggleMute()` → `this.muted` 토글 + `getDestination().mute` 동기화. `_build()` 시 unlock 전 muted 상태 반영.

**흔한 실패:** master Gain 0으로 음소거 → resume 시 레벨 복구 누락. iOS 무음 스위치 무소리를 버그로 오해 → 하드웨어 정책, UI 안내.

---

## 출처

- MDN — [ConvolverNode](https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode) · [DynamicsCompressorNode](https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode)
- gskinner — [Making Reverb with the Web Audio API](https://blog.gskinner.com/archives/2019/02/reverb-web-audio-api.html)
- Matt Montag — [Unlock Web Audio in Safari/iOS](https://www.mattmontag.com/web/unlock-web-audio-in-safari-for-ios-and-macos)
- WebKit Bug 237878 — [iOS 백그라운드 AudioContext suspend](https://bugs.webkit.org/show_bug.cgi?id=237878)
- WebAudio API issue #1759 — [resume() 동작](https://github.com/WebAudio/web-audio-api/issues/1759)
- PlayCanvas 포럼 — [iOS 복귀 시 오디오 미재개](https://forum.playcanvas.com/t/ios-audio-playback-does-not-resume-when-minimizing-and-bringing-the-web-browser-back-into-focus/41643)
- dossier §이펙트 레시피 F · §모바일 웹뷰 오디오 제약 · §폴리포니/보이스 예산 (`.omc/research/sound-research-dossier.md`)
