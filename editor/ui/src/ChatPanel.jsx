/* ============================================================================
 * ChatPanel — 에디터 ↔ Claude 챗 패널 (P3 역채널)
 * ----------------------------------------------------------------------------
 * 사용자 입력 → controller.sendChat → POST /api/chat(브리지) → MCP editor_next_message
 * 가 디큐 → Claude 가 씬 편집 후 editor_reply → SSE chat 델타 → 여기 표시.
 *
 * remote(브리지) 에서만 활성. local(P1) 에선 비활성 안내.
 * ========================================================================== */
import { useState, useEffect, useRef } from 'preact/hooks';

export function ChatPanel({ controller }) {
  const [log, setLog] = useState(controller.getChatLog ? controller.getChatLog().slice() : []);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!controller.onChatChange) return;
    const off = controller.onChatChange((chatLog) => { setLog(chatLog.slice()); });
    return off;
  }, []);

  // 새 메시지 시 맨 아래로 스크롤.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [log]);

  async function submit(e) {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try { await controller.sendChat(text); } catch (err) { /* 실패는 system 메시지로 표시됨 */ }
    setSending(false);
  }

  const remote = controller.isRemote;

  return (
    <div style={wrap}>
      <div style={head}>Claude 챗</div>
      <div ref={scrollRef} style={logBox}>
        {log.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: '11px', padding: '8px' }}>
            {remote
              ? '에디터에서 Claude 에게 명령하세요. 예) "적 3마리 추가"'
              : '브리지 미연결(local 모드) — 챗은 /wgf-editor 브리지에서만 동작합니다.'}
          </div>
        )}
        {log.map((m, i) => <Bubble key={i} msg={m} />)}
      </div>
      <form style={inputRow} onSubmit={submit}>
        <input style={inp} value={input} disabled={!remote || sending}
               placeholder={remote ? 'Claude 에게 보낼 명령…' : '브리지 미연결'}
               onInput={(e) => setInput(e.target.value)} />
        <button type="submit" style={sendBtn} disabled={!remote || sending || !input.trim()}>전송</button>
      </form>
    </div>
  );
}

function Bubble({ msg }) {
  const role = msg.role || 'assistant';
  const isUser = role === 'user';
  const isSystem = role === 'system';
  const bg = isSystem ? 'transparent' : (isUser ? 'var(--accent)' : 'var(--panel2)');
  const color = isUser ? '#08121a' : (isSystem ? 'var(--text-dim)' : 'var(--text)');
  const align = isUser ? 'flex-end' : 'flex-start';
  return (
    <div style={{ display: 'flex', justifyContent: align, marginBottom: '6px' }}>
      <div style={{
        maxWidth: '85%', background: bg, color, borderRadius: '8px',
        padding: isSystem ? '2px 4px' : '6px 9px', fontSize: isSystem ? '10px' : '12px',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        border: isSystem ? 'none' : '1px solid var(--border)', fontStyle: isSystem ? 'italic' : 'normal'
      }}>{msg.text}</div>
    </div>
  );
}

const wrap = { display: 'flex', flexDirection: 'column', height: '100%',
  background: 'var(--panel)', borderLeft: '1px solid var(--border)' };
const head = { padding: '8px 10px', fontWeight: 600, fontSize: '12px',
  borderBottom: '1px solid var(--border)', color: 'var(--text)' };
const logBox = { flex: 1, overflowY: 'auto', padding: '8px', minHeight: 0 };
const inputRow = { display: 'flex', gap: '4px', padding: '8px', borderTop: '1px solid var(--border)' };
const inp = { flex: 1, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: '4px', padding: '6px 8px', fontSize: '12px' };
const sendBtn = { background: 'var(--accent)', color: '#08121a', border: 'none', borderRadius: '4px',
  padding: '6px 12px', cursor: 'pointer', fontWeight: 600 };
