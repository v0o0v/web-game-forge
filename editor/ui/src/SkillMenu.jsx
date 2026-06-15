/* ============================================================================
 * SkillMenu — 2-트랙 스킬 메뉴 (P4)
 * ----------------------------------------------------------------------------
 * 설계서 §1(스킬 적용 2-트랙)·§5 P4.
 *
 *  - 결정형 트랙(에디터 직접): lint-scene·qa-score 등 버튼 → controller.runSkill
 *    → 브리지 POST /api/skill/run(화이트리스트·인자스키마·execFile) → 결과(exit·findings) 표시.
 *    현재 씬 대상 도구(lint-scene)는 file="current" 로 보내 브리지가 현재 씬을 임시
 *    직렬화해 실행한다.
 *  - 창작형 트랙(Claude 디스패치): "스토리 입혀줘"·"능력 추가" 등 → controller.dispatchCreative
 *    → 현재 씬 문맥을 포함한 챗 메시지를 P3 챗 큐로 enqueue(역채널). Claude /loop 가 받아 편집.
 *
 * remote(브리지)에서만 활성. local(P1)에선 비활성 안내.
 * ========================================================================== */
import { useState } from 'preact/hooks';

// 결정형 트랙 버튼 정의(화이트리스트 5종 전부 — bridge.mjs SKILL_TOOLS 와 1:1).
//  브리지가 화이트리스트·인자스키마·execFile(셸 미경유)로 최종 강제한다. 인자 형태:
//   - current=true       → file="current"(현재 씬 임시 직렬화 후 검증).
//   - needsInput:'file'  → game.js 등 리포 내 경로를 사용자가 입력(positional file).
//   - needsInput:'target'→ qa-score 의 games/<slug> 또는 slug 입력(positional target).
//   - 입력 불필요(lint-kit-deps) → 기본 manifest 로 실행.
const DETERMINISTIC = [
  { tool: 'lint-scene', label: 'lint-scene', desc: '현재 씬 정적 검증(스키마·댕글링·화이트리스트)', current: true },
  { tool: 'lint-rng', label: 'lint-rng', desc: 'game.js 결정론 검증(RngForge·Math.random 금지)',
    needsInput: 'file', placeholder: '예: games/super-runner/game.js' },
  { tool: 'lint-juice', label: 'lint-juice', desc: 'game.js 게임필(juice) 정적 린트',
    needsInput: 'file', placeholder: '예: games/super-runner/game.js' },
  { tool: 'lint-kit-deps', label: 'lint-kit-deps', desc: '엔진 킷 의존성 그래프 검증(기본 manifest)' },
  { tool: 'qa-score', label: 'qa-score', desc: '종합 QA 점수(BH/VU/IA) — games/<slug>',
    needsInput: 'target', placeholder: '예: super-runner' }
];

// 창작형 트랙 프리셋(Claude 디스패치 — 현재 씬 문맥 자동 동봉).
//  콘텐츠 디렉터 스킬(sprite-picker·story-architect·style-architect)을 에디터에서 직접
//  디스패치: dispatchCreative 가 현재 씬 요약을 챗 큐에 enqueue → Claude 가 editor_next_message
//  로 받아 해당 스킬로 처리한다. prompt 머리에 스킬명을 명시해 라우팅을 돕는다.
const CREATIVE = [
  { label: '스프라이트 고르기', prompt: 'wgf-sprite-picker 로 이 게임에 어울리는 스프라이트/타일/아이콘을 골라 적용해줘.' },
  { label: '스토리 입히기', prompt: 'wgf-story-architect 로 이 게임에 어울리는 스토리·분위기·캐릭터를 설계해 입혀줘.' },
  { label: '아트 스타일 잡기', prompt: 'wgf-style-architect 로 이 게임 전체의 아트 스타일(팔레트·셰이딩·무드)을 정의해 강제해줘.' },
  { label: '능력 추가', prompt: '플레이어에게 어울리는 능력(대시/발사 등)을 하나 추가해줘.' },
  { label: '적 다양화', prompt: '적의 종류·행동(추격/순찰/사격)을 다양하게 만들어줘.' }
];

export function SkillMenu({ controller }) {
  const remote = controller.isRemote;
  const [result, setResult] = useState(null);      // 결정형 실행 결과
  const [running, setRunning] = useState(false);
  const [creativeInput, setCreativeInput] = useState('');
  const [dispatchMsg, setDispatchMsg] = useState('');
  // needsInput 도구별 입력값(file/target) — tool 명을 키로 보관.
  const [detInputs, setDetInputs] = useState({});

  async function runDeterministic(entry) {
    if (running) return;
    const args = Object.assign({}, entry.args || {});
    if (entry.current) args.file = 'current';
    // needsInput('file'|'target') 도구 — 사용자가 입력한 경로/슬러그를 positional 인자로.
    if (entry.needsInput) {
      const v = (detInputs[entry.tool] || '').trim();
      if (!v) { setResult({ tool: entry.tool, ok: false, error: (entry.needsInput === 'target' ? 'target(슬러그)' : 'file(경로)') + ' 를 입력하세요' }); return; }
      args[entry.needsInput] = v;
    }
    if (args.json === undefined) args.json = true;
    setRunning(true); setResult(null);
    let r;
    try { r = await controller.runSkill(entry.tool, args); }
    catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    setResult({ tool: entry.tool, ...r });
    setRunning(false);
  }

  async function dispatchCreative(prompt) {
    if (!prompt || !prompt.trim()) return;
    setDispatchMsg('');
    let r;
    try { r = await controller.dispatchCreative(prompt.trim()); }
    catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    setDispatchMsg(r && r.ok ? '디스패치됨 — Claude 가 처리합니다 ✓' : ('실패: ' + (r && r.error || '')));
    setTimeout(() => setDispatchMsg(''), 3000);
  }

  return (
    <div style={panel}>
      <div style={header}>스킬</div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 10px' }}>
        {!remote && (
          <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginBottom: '8px' }}>
            브리지 미연결(local) — 스킬은 /wgf-editor 브리지에서만 동작합니다.
          </div>
        )}

        {/* ── 결정형 트랙(화이트리스트 5종) ── */}
        <div style={trackTitle}>결정형 (에디터 직접 실행)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {DETERMINISTIC.map((e) => (
            <div key={e.tool} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <button style={detBtn} disabled={!remote || running}
                      title={e.desc} onClick={() => runDeterministic(e)}>
                {e.label}
              </button>
              {e.needsInput && (
                <input style={{ ...inp, marginBottom: '2px' }} disabled={!remote || running}
                       value={detInputs[e.tool] || ''} placeholder={e.placeholder || e.needsInput}
                       onInput={(ev) => setDetInputs((s) => ({ ...s, [e.tool]: ev.target.value }))}
                       onKeyDown={(ev) => { if (ev.key === 'Enter') runDeterministic(e); }} />
              )}
            </div>
          ))}
        </div>
        {running && <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '6px' }}>실행 중…</div>}
        {result && <SkillResult result={result} />}

        {/* ── 창작형 트랙 ── */}
        <div style={{ ...trackTitle, marginTop: '14px' }}>창작형 (Claude 디스패치)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {CREATIVE.map((c) => (
            <button key={c.label} style={creBtn} disabled={!remote}
                    title={c.prompt} onClick={() => dispatchCreative(c.prompt)}>
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
          <input style={inp} value={creativeInput} disabled={!remote}
                 placeholder="직접 요청(예: 보스 추가)…"
                 onInput={(e) => setCreativeInput(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') { dispatchCreative(creativeInput); setCreativeInput(''); } }} />
          <button style={creBtn} disabled={!remote || !creativeInput.trim()}
                  onClick={() => { dispatchCreative(creativeInput); setCreativeInput(''); }}>보내기</button>
        </div>
        {dispatchMsg && <div style={{ color: 'var(--accent2)', fontSize: '11px', marginTop: '4px' }}>{dispatchMsg}</div>}
      </div>
    </div>
  );
}

function SkillResult({ result }) {
  const ok = result.ok && result.exit === 0;
  const errors = result.json && result.json.counts ? result.json.counts.error : null;
  const findings = (result.json && Array.isArray(result.json.findings)) ? result.json.findings : [];
  return (
    <div style={{ marginTop: '8px', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600 }}>{result.tool}</span>
        <span style={{ color: ok ? 'var(--ok)' : 'var(--danger)' }}>
          {result.ok ? `exit ${result.exit}` : '실행 거부'}
        </span>
      </div>
      {!result.ok && <div style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '3px' }}>{result.error}</div>}
      {result.ok && errors != null && (
        <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '3px' }}>
          findings: error {errors}{result.json.counts.warn != null ? ` · warn ${result.json.counts.warn}` : ''}
        </div>
      )}
      {findings.slice(0, 8).map((f, i) => (
        <div key={i} style={{ fontSize: '10px', marginTop: '2px',
          color: f.level === 'error' ? 'var(--danger)' : 'var(--text-dim)' }}>
          [{f.level || f.code}] {f.message || f.code}
        </div>
      ))}
    </div>
  );
}

const panel = { display: 'flex', flexDirection: 'column', height: '100%',
  background: 'var(--panel)', borderLeft: '1px solid var(--border)' };
const header = { padding: '8px 10px', fontWeight: 600, fontSize: '12px',
  color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' };
const trackTitle = { fontSize: '11px', fontWeight: 600, color: 'var(--accent)', marginBottom: '5px' };
const detBtn = { background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: '3px', padding: '5px 8px', cursor: 'pointer', textAlign: 'left' };
const creBtn = { background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' };
const inp = { flex: 1, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: '3px', padding: '4px 6px', fontSize: '11px' };
