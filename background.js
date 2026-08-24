// 1. 브라우저 설정 단축키 (chrome.commands)가 눌렸을 때 content script에 복사 명령 전송
chrome.commands.onCommand.addListener((command) => {
  if (command === "copy_last_response") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]?.id) return;
      const tabId = tabs[0].id;
      
      try {
        await chrome.tabs.sendMessage(tabId, { action: "copy_last_response" });
      } catch (e) {
        // 만약 content script가 주입되지 않은 구 탭이면 직접 주입 및 실행
        console.warn("content script 메시지 전송 실패, 직접 주입 시도:", e);
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["turndown.js", "turndown-plugin-gfm.js"]
          });
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: copyHtmlAsMarkdown
          });
        } catch (err) {
          console.error("복사 실행 에러:", err);
        }
      }
    });
  }
});

function copyHtmlAsMarkdown() {
  console.log("--- Gemini Copy: 시작 ---");

  function showStatus(text, isError = false) {
    const div = document.createElement('div');
    div.textContent = text;
    Object.assign(div.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      padding: '16px 24px',
      backgroundColor: isError ? '#ef4444' : '#1e293b',
      color: 'white',
      borderRadius: '12px',
      zIndex: '999999',
      fontSize: '18px',
      fontWeight: '600',
      boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
      border: '1px solid rgba(255,255,255,0.1)',
      pointerEvents: 'none',
      transition: 'opacity 0.2s ease-in-out'
    });
    document.body.appendChild(div);
    setTimeout(() => {
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 200);
    }, 1800);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    return new Promise((resolve, reject) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) resolve();
        else reject(new Error("execCommand copy 실패"));
      } catch (err) {
        document.body.removeChild(textarea);
        reject(err);
      }
    });
  }

  try {
    // 1. Turndown 라이브러리 확인
    if (typeof TurndownService === 'undefined') {
      throw new Error("TurndownService 로드 실패");
    }

    // 2. 최신 Gemini 응답 요소 탐색
    const selectors = [
      '.message-content',
      'message-content',
      '.model-response-text',
      'model-response',
      '.response-container-content',
      'structured-content-renderer',
      '[data-message-author-role="assistant"] .message-content',
      '[data-message-author-role="assistant"]',
      '.conversation-container [data-message-author-role="assistant"]'
    ];
    
    let targetElement = null;
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        // 가장 마지막(최신) 응답 선택
        const lastEl = elements[elements.length - 1];
        // 내부에 더 구체적인 컨텐츠 영역이 있으면 우선 선택
        targetElement = lastEl.querySelector('.message-content, message-content, .model-response-text') || lastEl;
        console.log("선택된 셀렉터:", selector);
        break;
      }
    }

    if (!targetElement) {
      showStatus("복사할 응답 메시지를 찾을 수 없습니다.", true);
      return;
    }

    // 3. 원본 DOM 보호를 위해 복제본 생성 후 전처리 진행
    const clone = targetElement.cloneNode(true);

    // [전처리 A] UI 전용 불필요한 요소 제거 (복사 버튼, 피드백 버튼, 음성 버튼, 툴바 등)
    const uiSelectors = [
      'button:not(.katex button)',
      '[role="button"]',
      '.action-button',
      '.copy-button',
      '.response-footer',
      '.button-container',
      'spark-icon',
      'mat-icon',
      'citation-list',
      'sources-carousel',
      '.source-citation'
    ];
    clone.querySelectorAll(uiSelectors.join(', ')).forEach(el => el.remove());

    // [전처리 B] LaTeX 수식 (KaTeX / MathJax / MathML) 원본 복원
    function extractLatex(node) {
      // 1. KaTeX annotation (가장 정확함)
      const annotation = node.querySelector('annotation[encoding*="tex"], annotation');
      if (annotation && annotation.textContent.trim()) {
        return annotation.textContent.trim();
      }
      // 2. data 속성 확인
      for (const attr of ['data-math', 'data-latex', 'data-tex', 'aria-label', 'alt']) {
        const val = node.getAttribute(attr);
        if (val && val.trim()) return val.trim();
      }
      // 3. MathML semantics 태그
      const mathEl = node.querySelector('math');
      if (mathEl) {
        const ann = mathEl.querySelector('annotation');
        if (ann && ann.textContent.trim()) return ann.textContent.trim();
        const alt = mathEl.getAttribute('alttext') || mathEl.getAttribute('alt');
        if (alt && alt.trim()) return alt.trim();
      }
      // 4. MathJax script
      const mjxScript = node.querySelector('script[type*="math/tex"]');
      if (mjxScript && mjxScript.textContent.trim()) {
        return mjxScript.textContent.trim();
      }
      return null;
    }

    // B-1: 블록 수식 처리 ($$...$$)
    const blockMathElements = clone.querySelectorAll('.katex-display, math-block, [data-math-type="block"], mjx-container[display="true"], .MathJax_Display');
    blockMathElements.forEach(mathEl => {
      const latex = extractLatex(mathEl);
      const replacement = document.createElement('div');
      replacement.className = 'raw-latex-block';
      replacement.setAttribute('data-latex', latex || mathEl.textContent.trim());
      mathEl.parentNode?.replaceChild(replacement, mathEl);
    });

    // B-2: 인라인 수식 처리 ($...$)
    const inlineMathElements = clone.querySelectorAll('.katex, math-inline, [data-math-type="inline"], mjx-container:not([display="true"]), .MathJax');
    inlineMathElements.forEach(mathEl => {
      // 이미 블록 수식 처리된 내부는 제외
      if (mathEl.closest('.raw-latex-block')) return;
      const latex = extractLatex(mathEl);
      const replacement = document.createElement('span');
      replacement.className = 'raw-latex-inline';
      replacement.setAttribute('data-latex', latex || mathEl.textContent.trim());
      mathEl.parentNode?.replaceChild(replacement, mathEl);
    });

    // [전처리 C] SVG 요소 처리
    // UI 아이콘이 아닌 독립 SVG 다이어그램은 마크다운 코드 블록으로 보존
    const svgElements = clone.querySelectorAll('svg');
    svgElements.forEach(svg => {
      // 이미 코드 블록 내부인 경우는 유지
      if (svg.closest('pre, code-block, spark-code-block, code')) return;
      
      const isSmallIcon = (svg.clientWidth > 0 && svg.clientWidth <= 32) || 
                          (svg.getAttribute('width') && parseInt(svg.getAttribute('width')) <= 32) ||
                          svg.classList.contains('icon') || svg.classList.contains('symbol');
      if (isSmallIcon) {
        svg.remove();
      } else {
        const svgHolder = document.createElement('div');
        svgHolder.className = 'raw-svg-diagram';
        svgHolder.setAttribute('data-svg', svg.outerHTML);
        svg.parentNode?.replaceChild(svgHolder, svg);
      }
    });

    // 4. Turndown 설정 및 커스텀 룰 등록
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      blankReplacement: (content, node) => (node.isBlock ? '\n\n' : '')
    });

    // GFM (GitHub Flavored Markdown) 플러그인 적용 (테이블, 취소선, 체크리스트 등)
    if (typeof turndownPluginGfm !== 'undefined') {
      turndownService.use(turndownPluginGfm.gfm);
      console.log("GFM 플러그인 적용 완료");
    }

    // 룰 1: 블록 수식 (Turndown의 이스케이프 방지)
    turndownService.addRule('latexBlock', {
      filter: (node) => node.classList?.contains('raw-latex-block'),
      replacement: (content, node) => {
        const latex = node.getAttribute('data-latex') || content;
        return `\n\n$$\n${latex.trim()}\n$$\n\n`;
      }
    });

    // 룰 2: 인라인 수식 (Turndown의 특수문자 이스케이프 방지)
    turndownService.addRule('latexInline', {
      filter: (node) => node.classList?.contains('raw-latex-inline'),
      replacement: (content, node) => {
        const latex = node.getAttribute('data-latex') || content;
        return ` $${latex.trim()}$ `;
      }
    });

    // 룰 3: 독립 SVG 다이어그램을 ```xml 코드 블록으로 변환
    turndownService.addRule('svgDiagram', {
      filter: (node) => node.classList?.contains('raw-svg-diagram'),
      replacement: (content, node) => {
        const svgCode = node.getAttribute('data-svg') || '';
        return `\n\n\`\`\`xml\n${svgCode.trim()}\n\`\`\`\n\n`;
      }
    });

    // 룰 4: 최신 Gemini 코드 블록 및 다양한 태그 지원
    turndownService.addRule('codeBlock', {
      filter: (node) => {
        return node.nodeName === 'PRE' || 
               node.nodeName === 'CODE-BLOCK' || 
               node.nodeName === 'SPARK-CODE-BLOCK' ||
               node.classList?.contains('code-block') ||
               node.classList?.contains('formatted-code-block-internal-container');
      },
      replacement: (content, node) => {
        // 프로그래밍 언어 감지
        let lang = node.getAttribute('language') || node.getAttribute('data-language') || '';
        if (!lang) {
          const header = node.querySelector('.code-block-header, .code-block-decoration, [class*="header"], [class*="decoration"]');
          if (header) {
            lang = header.querySelector('span')?.textContent?.trim() || header.textContent.trim();
            lang = lang.replace(/^(copy|복사|code|코드)/i, '').trim();
          }
        }
        if (!lang) {
          const codeEl = node.querySelector('code');
          if (codeEl) {
            const match = codeEl.className.match(/(?:lang|language)-(\w+)/);
            if (match) lang = match[1];
          }
        }

        // 코드 내용 추출 (내부 버튼 등 제거)
        const codeEl = node.querySelector('pre, code, [data-test-id="code-content"]') || node;
        const codeButtons = codeEl.querySelectorAll('button, .copy-button, [role="button"]');
        codeButtons.forEach(b => b.remove());

        const code = (codeEl.querySelector('code')?.textContent || codeEl.textContent || '')
          .replace(/^\n+|\n+$/g, '');

        return `\n\n\`\`\`${lang.toLowerCase()}\n${code}\n\`\`\`\n\n`;
      }
    });

    // 5. 마크다운 변환 및 불필요한 연속 공백/줄바꿈 정리
    let markdown = turndownService.turndown(clone.innerHTML);
    markdown = markdown
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '') // 줄 끝 공백 정리
      .trim();

    // 6. 클립보드 복사 실행
    copyToClipboard(markdown)
      .then(() => {
        showStatus("마크다운 복사 완료!");
        console.log("복사 성공 (마크다운 길이:", markdown.length, ")");
      })
      .catch(err => {
        console.error("클립보드 복사 에러:", err);
        showStatus("클립보드 복사 실패", true);
      });

  } catch (err) {
    console.error("복사 처리 에러:", err);
    showStatus("오류: " + err.message, true);
  }
}