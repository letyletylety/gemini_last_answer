/**
 * Gemini Copy - GFM Table Test Suite (Node.js & CLI)
 * 
 * 실행 방법:
 * 1. npx jsdom 사용 (권장):
 *    npx -y jsdom node test_table.js
 * 
 * 2. 또는 브라우저에서 바로 확인:
 *    open test_runner.html
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// DOM 환경 초기화 (JSDOM 또는 글로벌 DOM)
function initDomEnvironment() {
  if (typeof global.window !== 'undefined' && global.DOMParser) {
    return;
  }

  try {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.DOMParser = dom.window.DOMParser;
    global.Node = dom.window.Node;
    global.HTMLElement = dom.window.HTMLElement;
    global.performance = dom.window.performance || { now: () => Date.now() };
  } catch (e) {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  jsdom 패키지가 설치되어 있지 않습니다.');
    console.log('다음 중 하나의 방법으로 테스트를 실행할 수 있습니다:\n');
    console.log('1. 브라우저로 실행 (추천, 무설치):');
    console.log('   open test_runner.html\n');
    console.log('2. npx로 즉시 실행:');
    console.log('   npx -p jsdom node test_table.js\n');
    process.exit(1);
  }
}

initDomEnvironment();

// Turndown 및 GFM 플러그인 로드
const turndownCode = fs.readFileSync(path.join(__dirname, 'turndown.js'), 'utf8');
const gfmCode = fs.readFileSync(path.join(__dirname, 'turndown-plugin-gfm.js'), 'utf8');

const evalInContext = new Function('window', 'document', 'DOMParser', `
  ${turndownCode}
  ${gfmCode}
  return { TurndownService: TurndownService, turndownPluginGfm: turndownPluginGfm };
`);

const { TurndownService, turndownPluginGfm } = evalInContext(global.window, global.document, global.DOMParser);

function createTurndownService() {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    blankReplacement: (content, node) => (node.isBlock ? '\n\n' : '')
  });
  service.escape = (str) => str;
  if (turndownPluginGfm && turndownPluginGfm.gfm) {
    service.use(turndownPluginGfm.gfm);
  }
  return service;
}

// 마크다운 테이블 구조 유효성 검사 헬퍼
function validateMarkdownTable(markdown, expectedRowCount, expectedColCount) {
  const lines = markdown.trim().split('\n').filter(l => l.trim().length > 0);
  
  assert(lines.length >= 2, `테이블 행 수가 부족합니다. (실제 행 수: ${lines.length})`);

  // 헤더 구분선 검증
  const separatorLine = lines[1].trim();
  assert(/^\|(\s*:?-+:?\s*\|)+$/.test(separatorLine), `2번째 라인이 GFM 구분선(| --- |)이 아닙니다: "${separatorLine}"`);

  // 모든 행이 단일 라인이고 파이프로 시작/끝나는지 검증
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    assert(line.startsWith('|'), `${i + 1}번째 줄이 '|'로 시작하지 않습니다: ${line}`);
    assert(line.endsWith('|'), `${i + 1}번째 줄이 '|'로 끝나지 않습니다: ${line}`);

    const unescapedPipes = (line.match(/(?<!\\)\|/g) || []).length;
    const colCount = unescapedPipes - 1;

    if (expectedColCount !== undefined) {
      assert.strictEqual(colCount, expectedColCount, `${i + 1}번째 줄 컬럼 수가 예상치(${expectedColCount})와 다릅니다: 실제 ${colCount}`);
    }
  }

  if (expectedRowCount !== undefined) {
    assert.strictEqual(lines.length, expectedRowCount, `총 행 수가 예상치(${expectedRowCount})와 다릅니다: 실제 ${lines.length}`);
  }

  return true;
}

// 테스트 스위트
const tests = [
  {
    name: 'TC-1: 셀 내 복수 문단(<p>)이 <br>로 연결되어 단일 라인을 유지하는가',
    run: (service) => {
      const html = `<table>
        <thead><tr><th>권역</th><th>수량</th></tr></thead>
        <tbody>
          <tr>
            <td><p><strong>영미권 (40%)</strong></p><p>12편</p></td>
            <td>12</td>
          </tr>
        </tbody>
      </table>`;
      const md = service.turndown(html);
      validateMarkdownTable(md, 3, 2);
      assert(md.includes('**영미권 (40%)**<br>12편'), '<p> 태그가 <br>로 올바르게 치환되지 않았습니다.');
    }
  },
  {
    name: 'TC-2: 셀 내 글머리 기호 목록(<ul><li>)이 테이블 행을 파괴하지 않는가',
    run: (service) => {
      const html = `<table>
        <thead><tr><th>작가</th><th>대표작</th></tr></thead>
        <tbody>
          <tr>
            <td>에드거 앨런 포</td>
            <td>
              <ul>
                <li>갈가마귀</li>
                <li>애너벨 리</li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>`;
      const md = service.turndown(html);
      validateMarkdownTable(md, 3, 2);
      assert(md.includes('갈가마귀<br>애너벨 리') || md.includes('갈가마귀<br>- 애너벨 리') || md.includes('갈가마귀<br>• 애너벨 리') || md.includes('<br>'), '리스트 아이템이 <br>로 변환되지 않았습니다.');
    }
  },
  {
    name: 'TC-3: 셀 내부 파이프(|) 문자가 \\| 로 이스케이프되는가',
    run: (service) => {
      const html = `<table>
        <thead><tr><th>구분</th><th>항목 | 설명</th></tr></thead>
        <tbody>
          <tr><td>A | B</td><td>값 1 | 값 2</td></tr>
        </tbody>
      </table>`;
      const md = service.turndown(html);
      validateMarkdownTable(md, 3, 2);
      assert(md.includes('A \\| B'), 'A | B 파이프가 이스케이프되지 않았습니다.');
      assert(md.includes('값 1 \\| 값 2'), '값 1 | 값 2 파이프가 이스케이프되지 않았습니다.');
    }
  },
  {
    name: 'TC-4: 빈 행(Spacer empty tr)이 마크다운에서 자동으로 제거되는가',
    run: (service) => {
      const html = `<table>
        <thead><tr><th>항목</th><th>값</th></tr></thead>
        <tbody>
          <tr><td></td><td></td></tr>
          <tr><td>데이터 1</td><td>100</td></tr>
          <tr><td>   </td><td>   </td></tr>
        </tbody>
      </table>`;
      const md = service.turndown(html);
      validateMarkdownTable(md, 3, 2); // 헤더(1) + 구분선(1) + 데이터1(1) = 3행
    }
  },
  {
    name: 'TC-5: 사용자 실제 케이스 (유화 30선 및 명시 30선 표)',
    run: (service) => {
      const html = `<table>
        <thead>
          <tr>
            <th>권역 (비중)</th>
            <th>대표 작가 및 작품</th>
            <th>매칭할 기존 유화 에셋</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><p><strong>영미권 (40%)</strong></p><p>12편</p></td>
            <td>
              <p>• <strong>에드거 앨런 포</strong> · 『갈가마귀』</p>
              <p>• <strong>에밀리 디킨슨</strong> · 『고독과 밤의 시선』</p>
            </td>
            <td>
              <p><code>bg_poe_telltale_heart</code></p>
              <p><code>bg_gilman_yellow_wallpaper</code></p>
            </td>
          </tr>
        </tbody>
      </table>`;
      const md = service.turndown(html);
      validateMarkdownTable(md, 3, 3);
      assert(md.includes('bg_poe_telltale_heart`<br>`bg_gilman_yellow_wallpaper'), '코드 에셋 간 <br> 연결이 올바르지 않습니다.');
    }
  },
  {
    name: 'TC-6: thead 없는 일반 table Fallback 변환',
    run: (service) => {
      const html = `<table>
        <tbody>
          <tr><td>헤더 1</td><td>헤더 2</td></tr>
          <tr><td>값 1</td><td>값 2</td></tr>
        </tbody>
      </table>`;
      const md = service.turndown(html);
      validateMarkdownTable(md, 3, 2);
      assert(!md.includes('<table'), '테이블이 마크다운으로 변환되지 못하고 HTML로 남았습니다.');
    }
  }
];

// 테스트 실행 함수
function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Gemini Copy - GFM Table 변환 테스트 스위트');
  console.log('======================================================\n');

  const service = createTurndownService();
  let passed = 0;
  let failed = 0;
  const startTotal = Date.now();

  tests.forEach((t, idx) => {
    const tStart = Date.now();
    try {
      t.run(service);
      const elapsed = Date.now() - tStart;
      console.log(`\x1b[32m[PASS]\x1b[0m ${t.name} (${elapsed}ms)`);
      passed++;
    } catch (err) {
      const elapsed = Date.now() - tStart;
      console.error(`\x1b[31m[FAIL]\x1b[0m ${t.name} (${elapsed}ms)`);
      console.error(`       \x1b[31m→ Error: ${err.message}\x1b[0m`);
      failed++;
    }
  });

  const totalElapsed = Date.now() - startTotal;
  console.log('\n------------------------------------------------------');
  console.log(`결과: 총 ${tests.length}개 중 \x1b[32m${passed}개 성공\x1b[0m, \x1b[31m${failed}개 실패\x1b[0m (${totalElapsed}ms)`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
