#!/usr/bin/env node
/**
 * web-game-builder — UserPromptSubmit 의도 감지 훅 (크로스플랫폼, Node.js)
 *
 * 동작:
 *  - stdin 으로 들어온 훅 JSON 에서 .prompt 를 읽는다.
 *  - 한/영 "게임 제작" 의도를 정규식으로 감지한다.
 *  - 매치되면 hookSpecificOutput.additionalContext 를 출력한다.
 *    이 문자열은 Claude Code 가 <system-reminder> 로 감싸 다음 모델 요청에 주입한다(= 넛지).
 *  - 매치 안 되면 아무것도 출력하지 않고 exit 0 (no-op).
 *
 * 중요: decision:block 을 쓰지 않는다 — 그건 프롬프트 자체를 지워버린다.
 *       우리는 "스킬을 켜라"고 살짝 밀어주는(nudge) 것이 목적이다.
 */
'use strict';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let prompt = '';
  try {
    prompt = (JSON.parse(input).prompt) || '';
  } catch (_e) {
    prompt = input; // JSON 파싱 실패 시 원문 전체로 폴백
  }

  // 한국어: 게임 + (만들/제작/개발/짜/구현/코딩) 양방향
  // 영어: (make/build/create/code/develop/implement) ... (game/platformer/...)
  // 고유 장르/클론 이름은 단독 키워드로도 감지
  const gamePattern = new RegExp(
    [
      '(게임)[\\s\\S]*(만들|제작|개발|짜줘|짜|구현|코딩|클론)',
      '(만들|제작|개발|코딩|구현)[\\s\\S]*(게임)',
      '\\b(make|build|create|code|develop|implement|clone)\\b[\\s\\S]*\\b(game|platformer|shooter|rpg|puzzle|arcade|runner|2d ?game|html5 ?game|canvas ?game|phaser)\\b',
      '(슈퍼마리오|마리오|플랫포머|벽돌깨기|테트리스|스네이크|뱀게임|플래피|점프게임|러너게임|아케이드게임)',
      '\\b(tetris|breakout|flappy|snake|pong|asteroids|space ?invaders|platformer)\\b'
    ].join('|'),
    'i'
  );

  // 스프라이트/스프라이트시트/에셋을 고르거나·적용·교체하려는 의도 (sprite-picker 넛지)
  const assetPattern = new RegExp(
    [
      '스프라이트\\s*시트|스프라이트시트|스프라이트|타일셋|아이콘\\s*세트',
      '(에셋|애셋)[\\s\\S]*(골라|고르|선택|적용|바꿔|교체|찾아|추가|넣어|쓰)',
      '(골라|고르|선택|적용|바꿔|교체)[\\s\\S]*(에셋|애셋|스프라이트|캐릭터\\s*이미지|아이콘|타일)',
      '(캐릭터|배경|적|몬스터)[\\s\\S]*(이미지|스프라이트|아트)[\\s\\S]*(골라|고르|선택|적용|바꿔|교체|넣어)',
      'kenney|opengameart|game-?icons|svgrepo',
      '\\b(sprite ?sheet|spritesheet|sprite|tileset|tilesheet)\\b',
      '\\b(asset|sprites?|tiles?|icons?|character art)\\b[\\s\\S]*\\b(pick|choose|select|apply|swap|browse|use)\\b',
      '\\b(pick|choose|select|apply|swap|browse)\\b[\\s\\S]*\\b(asset|sprites?|tileset|icon|character)\\b'
    ].join('|'),
    'i'
  );

  const parts = [];
  if (gamePattern.test(prompt)) {
    parts.push([
      '사용자가 브라우저/웹 게임 제작을 요청하고 있습니다.',
      '응답 전에 web-game-builder 스킬을 호출하고 그 워크플로(Phaser 4 + 모바일 웹뷰 하니스 + CC0/절차적 에셋)를 따르세요.',
      '단순 바닐라 JS 로 투박하게 만들지 말고, 반드시 스킬의 reference 템플릿을 사용해 스프라이트 애니메이션·HUD·터치 컨트롤·오디오 언락까지 포함된 완성도 높은 결과물을 만드세요.',
      '(The user is requesting a browser/web game — invoke the web-game-builder skill and follow its workflow.)'
    ].join(' '));
  }
  if (assetPattern.test(prompt)) {
    parts.push([
      '사용자가 게임 스프라이트/스프라이트시트/에셋을 고르거나 적용·교체하려 합니다.',
      '응답 전에 sprite-picker 스킬을 호출해 먼저 "실제 에셋 소싱 vs 절차 생성"을 묻고,',
      '캐싱된 CC0 카탈로그·로컬 파일·이전 사용분을 브라우저 갤러리 피커로 시각 선택하게 하세요(절차 생성은 sprite-forge/vector-graphics 위임).',
      '(The user wants to choose/apply game sprite assets — invoke the sprite-picker skill.)'
    ].join(' '));
  }

  if (parts.length) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: parts.join(' ')
      },
      suppressOutput: true
    }));
  }
  process.exit(0);
});
