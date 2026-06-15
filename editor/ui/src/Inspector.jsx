/* ============================================================================
 * Inspector — 선택 엔티티의 transform + 컴포넌트를 inspectorFields 로 자동 생성.
 * ----------------------------------------------------------------------------
 * 각 컴포넌트의 inspectorFields(scenekit-components.js)로 입력 위젯을 만든다.
 * 필드 편집 → controller.setTransform / updateComponent (= applyCommand).
 * showWhen 조건 필드, enum(문자열/객체 옵션), asset-ref, json, boolean 지원.
 * AnimatedSprite 의 anims 는 구조화 폼(행 추가/삭제, key·frames·fps·loop) + 고급 raw JSON 폴백.
 * ==========================================================================*/
import { spriteApi } from './sprite/spriteApi.js';
import { useState } from 'preact/hooks';

export function Inspector({ controller, world, selection }) {
  if (!world || selection.length === 0) {
    return (
      <div style={panel}>
        <div style={header}>속성 (Inspector)</div>
        <div style={empty}>엔티티를 선택하세요</div>
      </div>
    );
  }
  // 다중 선택 시 첫 엔티티만 편집(P1 단순화 — 멀티 편집은 후속).
  const ent = world.entities.find((e) => e.id === selection[0]);
  if (!ent) {
    return <div style={panel}><div style={header}>속성 (Inspector)</div><div style={empty}>엔티티 없음</div></div>;
  }

  const multi = selection.length > 1;

  return (
    <div style={panel}>
      <div style={header}>속성 (Inspector)</div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 10px' }}>
        {multi && <div style={{ color: 'var(--accent2)', marginBottom: '6px' }}>
          {selection.length}개 선택 — 첫 엔티티 편집</div>}

        <Field label="이름" >
          <input style={inp} value={ent.name || ''}
                 onInput={(e) => {/* name 편집은 P1 미지원(커맨드 없음) — 표시만 */}}
                 readOnly />
        </Field>
        <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginBottom: '8px' }}>id: {ent.id}</div>

        {/* ── Transform ── */}
        <Section title="Transform" />
        <TransformEditor controller={controller} ent={ent} />

        {/* ── 컴포넌트들 ── */}
        {ent.components.map((comp, idx) => (
          <ComponentEditor key={idx} controller={controller} world={world} ent={ent} comp={comp} index={idx} />
        ))}
      </div>
    </div>
  );
}

function TransformEditor({ controller, ent }) {
  const t = ent.transform;
  const fields = [
    { key: 'x', label: 'x' }, { key: 'y', label: 'y' },
    { key: 'rotation', label: 'rotation(rad)' },
    { key: 'scaleX', label: 'scaleX' }, { key: 'scaleY', label: 'scaleY' },
    { key: 'depth', label: 'depth' }
  ];
  return (
    <div>
      {fields.map((f) => (
        <Field key={f.key} label={f.label}>
          <input type="number" step="any" style={inp}
                 value={numVal(t[f.key])}
                 onChange={(e) => {
                   const v = parseFloat(e.target.value);
                   if (isFinite(v)) controller.setTransform(ent.id, { [f.key]: v });
                 }} />
        </Field>
      ))}
    </div>
  );
}

function ComponentEditor({ controller, world, ent, comp, index }) {
  const def = controller.getComponentDef(comp.type);
  const fields = (def && def.inspectorFields) ? def.inspectorFields : [];

  function patch(key, value) {
    controller.updateComponent(ent.id, index, { [key]: value });
  }

  function visible(field) {
    if (!field.showWhen) return true;
    return comp[field.showWhen.field] === field.showWhen.value;
  }

  return (
    <div style={{ marginTop: '10px', border: '1px solid var(--border)', borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 8px', background: 'var(--panel2)', borderRadius: '4px 4px 0 0' }}>
        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{comp.type}</span>
        <button style={delBtn} title="컴포넌트 제거"
                onClick={() => controller.removeComponent(ent.id, index)}>✕</button>
      </div>
      <div style={{ padding: '6px 8px' }}>
        {fields.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>편집 가능한 필드 없음</div>}
        {fields.filter(visible).map((field) => {
          // AnimatedSprite 의 anims 는 전용 구조화 폼(키·프레임·fps·loop) 렌더.
          if ((comp.type === 'AnimatedSprite') && field.key === 'anims') {
            return <AnimsEditor key={field.key} field={field} value={comp.anims}
                                onChange={(v) => patch('anims', v)} />;
          }
          return (
            <FieldWidget key={field.key} field={field} value={comp[field.key]} world={world}
                         onChange={(v) => patch(field.key, v)} />
          );
        })}
      </div>
    </div>
  );
}

// inspectorField → 입력 위젯. type: number/string/boolean/enum/asset-ref/json.
function FieldWidget({ field, value, onChange, world }) {
  const label = field.label || field.key;

  if (field.type === 'boolean') {
    return (
      <Field label={label}>
        <input type="checkbox" checked={!!value}
               onChange={(e) => onChange(e.target.checked)} />
      </Field>
    );
  }

  if (field.type === 'enum') {
    const options = normEnumOptions(field.options || field.values || []);
    return (
      <Field label={label}>
        <select style={inp} value={value == null ? '' : String(value)}
                onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
    );
  }

  if (field.type === 'number') {
    return (
      <Field label={label}>
        <input type="number" step="any" style={inp}
               value={numVal(value)}
               placeholder={field.placeholder || ''}
               onChange={(e) => {
                 const v = parseFloat(e.target.value);
                 if (isFinite(v)) onChange(v);
               }} />
      </Field>
    );
  }

  if (field.type === 'json') {
    return (
      <Field label={label} stacked>
        <textarea style={{ ...inp, minHeight: '48px', fontFamily: 'monospace', fontSize: '11px' }}
                  value={jsonVal(value)}
                  placeholder={field.placeholder || ''}
                  onBlur={(e) => {
                    const txt = e.target.value.trim();
                    if (!txt) { onChange(undefined); return; }
                    try { onChange(JSON.parse(txt)); }
                    catch (err) { /* 잘못된 JSON 은 무시(커밋 안 함) */ }
                  }} />
      </Field>
    );
  }

  // asset-ref: 텍스트 입력 + (가능하면) 작은 썸네일 미리보기.
  if (field.type === 'asset-ref') {
    const thumbUrl = assetThumbUrl(world, value);
    return (
      <Field label={label}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {thumbUrl && (
            <img src={thumbUrl} alt="" width="20" height="20"
                 style={{ flexShrink: 0, imageRendering: 'pixelated', borderRadius: '2px',
                          background: 'var(--bg)', border: '1px solid var(--border)', objectFit: 'contain' }} />
          )}
          <input type="text" style={inp}
                 value={value == null ? '' : String(value)}
                 placeholder={field.placeholder || '(자산 id)'}
                 onChange={(e) => onChange(e.target.value)} />
        </div>
      </Field>
    );
  }

  // string (기본 텍스트 입력)
  return (
    <Field label={label}>
      <input type="text" style={inp}
             value={value == null ? '' : String(value)}
             placeholder={field.placeholder || ''}
             onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

// 스프라이트 id 로 world.assets.sprites 에서 def 를 찾아 썸네일 절대 URL 산출(없으면 null).
function assetThumbUrl(world, spriteId) {
  if (!world || !spriteId) return null;
  const sprites = (world.assets && Array.isArray(world.assets.sprites)) ? world.assets.sprites : null;
  if (!sprites) return null;
  let def = null;
  for (let i = 0; i < sprites.length; i++) {
    if (sprites[i] && sprites[i].id === spriteId) { def = sprites[i]; break; }
  }
  if (!def || !def.url) return null;
  try { return spriteApi.assetUrl(def.url); } catch (e) { return null; }
}

// ── AnimatedSprite anims 구조화 편집기 ─────────────────────────────────────────
// value = [{key, frames:[int], fps, loop}]. 행 추가/삭제 + 각 필드 편집 → onChange(전체 배열).
// frames 는 쉼표구분 정수 입력 ↔ 배열. 고급(raw JSON) 폴백을 <details> 로 제공.
function AnimsEditor({ field, value, onChange }) {
  const anims = Array.isArray(value) ? value : [];

  function commit(next) { onChange(next); }
  function updateRow(idx, patch) {
    const next = anims.map((a, i) => (i === idx ? Object.assign({}, a, patch) : a));
    commit(next);
  }
  function addRow() {
    commit(anims.concat([{ key: '', frames: [], fps: 8, loop: true }]));
  }
  function removeRow(idx) {
    commit(anims.filter((_, i) => i !== idx));
  }

  return (
    <Field label={field.label || 'anims'} stacked>
      <div>
        {anims.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginBottom: '4px' }}>애니메이션 없음</div>
        )}
        {anims.map((a, idx) => (
          <AnimRow key={idx} anim={a || {}}
                   onChange={(patch) => updateRow(idx, patch)}
                   onRemove={() => removeRow(idx)} />
        ))}
        <button style={addBtn} onClick={addRow}>+ 애니 추가</button>

        {/* 고급: raw JSON 직접 편집 폴백(파싱 실패 시 무시). */}
        <details style={{ marginTop: '6px' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: '11px' }}>고급(raw JSON)</summary>
          <textarea style={{ ...inp, minHeight: '48px', fontFamily: 'monospace', fontSize: '11px', marginTop: '4px' }}
                    value={jsonVal(anims)}
                    placeholder={field.placeholder || ''}
                    onBlur={(e) => {
                      const txt = e.target.value.trim();
                      if (!txt) { onChange([]); return; }
                      try {
                        const parsed = JSON.parse(txt);
                        if (Array.isArray(parsed)) onChange(parsed);
                      } catch (err) { /* 잘못된 JSON 은 무시(커밋 안 함) */ }
                    }} />
        </details>
      </div>
    </Field>
  );
}

// 단일 애니 행: key(text)·frames(쉼표 정수)·fps(number)·loop(checkbox)·삭제.
// frames 입력은 자유 타이핑을 위해 로컬 텍스트 버퍼를 유지하고, 변경마다 파싱해 정수 배열로 커밋.
function AnimRow({ anim, onChange, onRemove }) {
  const [framesText, setFramesText] = useState(framesToText(anim.frames));

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '3px', padding: '5px 6px', marginBottom: '5px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
        <input type="text" style={{ ...inp, flex: 1 }} placeholder="키 (예: walk)"
               value={anim.key == null ? '' : String(anim.key)}
               onChange={(e) => onChange({ key: e.target.value })} />
        <button style={delBtn} title="애니 삭제" onClick={onRemove}>✕</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
        <label style={rowLbl}>프레임</label>
        <input type="text" style={{ ...inp, flex: 1 }} placeholder="0, 1, 2, 3"
               value={framesText}
               onInput={(e) => {
                 const txt = e.target.value;
                 setFramesText(txt);
                 onChange({ frames: parseFrames(txt) });
               }}
               onBlur={() => setFramesText(framesToText(parseFrames(framesText)))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={rowLbl}>fps</label>
        <input type="number" step="any" style={{ ...inp, width: '64px' }}
               value={numVal(anim.fps)}
               onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v)) onChange({ fps: v }); }} />
        <label style={{ ...rowLbl, width: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={anim.loop !== false}
                 onChange={(e) => onChange({ loop: e.target.checked })} />
          loop
        </label>
      </div>
    </div>
  );
}

// "0, 1, 2" → [0,1,2] (정수만, 음수/비정수/빈 항목 제거).
function parseFrames(txt) {
  if (!txt) return [];
  return String(txt).split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n >= 0);
}
// [0,1,2] → "0, 1, 2".
function framesToText(frames) {
  return Array.isArray(frames) ? frames.filter((n) => Number.isInteger(n)).join(', ') : '';
}

// ── 소품 ──────────────────────────────────────────────────────────────────────
function Field({ label, children, stacked }) {
  return (
    <div style={{ display: 'flex', flexDirection: stacked ? 'column' : 'row',
                  alignItems: stacked ? 'stretch' : 'center', marginBottom: '5px', gap: '6px' }}>
      <label style={{ color: 'var(--text-dim)', fontSize: '11px', width: stacked ? 'auto' : '92px', flexShrink: 0 }}>{label}</label>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
function Section({ title }) {
  return <div style={{ marginTop: '8px', marginBottom: '4px', fontWeight: 600,
    color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px' }}>{title}</div>;
}

function normEnumOptions(opts) {
  return opts.map((o) => (typeof o === 'object' && o !== null)
    ? { value: String(o.value), label: o.label || String(o.value) }
    : { value: String(o), label: String(o) });
}
function numVal(v) { return (typeof v === 'number' && isFinite(v)) ? v : (v == null ? '' : v); }
function jsonVal(v) { if (v == null) return ''; try { return JSON.stringify(v); } catch (e) { return ''; } }

const panel = { display: 'flex', flexDirection: 'column', height: '100%',
  background: 'var(--panel)', borderLeft: '1px solid var(--border)' };
const header = { padding: '8px 10px', fontWeight: 600, fontSize: '12px',
  color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' };
const empty = { padding: '12px 10px', color: 'var(--text-dim)' };
const inp = { width: '100%', background: 'var(--bg)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: '3px', padding: '3px 6px' };
const delBtn = { background: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer', fontSize: '12px' };
const addBtn = { background: 'var(--panel2)', color: 'var(--accent)', border: '1px solid var(--border)',
  borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px' };
const rowLbl = { color: 'var(--text-dim)', fontSize: '11px', width: '44px', flexShrink: 0 };
