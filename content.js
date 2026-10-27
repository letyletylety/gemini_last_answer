/**
 * Gemini Content Script - Sound Notification & Copy Logic
 * Includes defensive checks for chrome.storage to prevent crashes
 */

let isGenerating = false;

// Defensive storage access
function getSettings(callback) {
  const defaultSettings = {
    enableSound: true,
    soundType: 'triangle',
    volume: 0.15,
    frequency: 720
  };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(defaultSettings, (items) => {
      if (chrome.runtime.lastError) {
        callback(defaultSettings);
      } else {
        callback(items);
      }
    });
  } else {
    // If context is lost or storage unavailable, use defaults
    callback(defaultSettings);
  }
}

async function playNotification() {
  getSettings(async (settings) => {
    if (!settings.enableSound) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = settings.soundType;
      oscillator.frequency.setValueAtTime(parseFloat(settings.frequency), audioCtx.currentTime);

      const vol = parseFloat(settings.volume);
      const now = audioCtx.currentTime;

      // Beep 1
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(vol, now + 0.02);
      gainNode.gain.linearRampToValueAtTime(vol, now + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.15);

      // Beep 2 (Reverb)
      const secondStart = now + 0.2;
      gainNode.gain.setValueAtTime(0, secondStart);
      gainNode.gain.linearRampToValueAtTime(vol, secondStart + 0.02);
      gainNode.gain.linearRampToValueAtTime(vol, secondStart + 0.3);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, secondStart + 1.5);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(secondStart + 1.6);
    } catch (e) {
      console.warn("Sound play failed (Interaction required?):", e);
    }
  });
}

function observeGemini() {
  const observer = new MutationObserver(() => {
    // Check if extension context is still valid
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
      observer.disconnect();
      return;
    }

    const stopButton = document.querySelector('button[aria-label*="Stop"], button[aria-label*="중지"], .stop-generating-button');

    if (stopButton && !isGenerating) {
      isGenerating = true;
    } else if (!stopButton && isGenerating) {
      isGenerating = false;
      setTimeout(playNotification, 300);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ==========================================
// Robust Response Finder & Copy Logic
// ==========================================

function findLastResponseElement() {
  const candidateSelectors = [
    'message-content',
    '.message-content',
    '.model-response-text',
    'model-response',
    '.response-container-content',
    '[data-test-id="model-response-text"]',
    'structured-content-renderer',
    '[data-message-author-role="assistant"]',
    '.conversation-container [data-message-author-role="assistant"]',
    '.response-container',
    'div[class*="model-response"]',
    'div[class*="response-content"]'
  ];

  for (const selector of candidateSelectors) {
    const nodes = Array.from(document.querySelectorAll(selector));
    const validNodes = nodes.filter(el => {
      const text = el.textContent?.trim() || '';
      return text.length > 0 && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
    });

    if (validNodes.length > 0) {
      const lastNode = validNodes[validNodes.length - 1];
      const inner = lastNode.querySelector('message-content, .message-content, .model-response-text, .markdown');
      const selected = (inner && inner.textContent.trim().length > 0) ? inner : lastNode;
      console.log("[Gemini Copy] 발견된 응답 셀렉터:", selector);
      return selected;
    }
  }

  // Fallback: search for any visible markdown containers
  const markdownBlocks = Array.from(document.querySelectorAll('.markdown, [class*="markdown"]')).filter(el => {
    return el.textContent.trim().length > 0 && (el.offsetWidth > 0 || el.offsetHeight > 0);
  });
  if (markdownBlocks.length > 0) {
    console.log("[Gemini Copy] Markdown fallback 셀렉터 발견");
    return markdownBlocks[markdownBlocks.length - 1];
  }

  return null;
}

function copyHtmlAsMarkdown() {
  console.log("[Gemini Copy] 복사 프로세스 시작...");

  function showStatus(text, isError = false) {
    const existing = document.getElementById('gemini-copy-toast');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'gemini-copy-toast';
    div.textContent = text;
    Object.assign(div.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      padding: '16px 28px',
      backgroundColor: isError ? '#dc2626' : '#0f172a',
      color: '#ffffff',
      borderRadius: '12px',
      zIndex: '2147483647',
      fontSize: '18px',
      fontWeight: '700',
      boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
      border: '1px solid rgba(255,255,255,0.2)',
      pointerEvents: 'none',
      transition: 'opacity 0.25s ease',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });
    document.body.appendChild(div);
    setTimeout(() => {
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 250);
    }, 1800);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch((err) => {
        console.warn("[Gemini Copy] navigator.clipboard 실패, execCommand로 전환:", err);
        return fallbackCopy(text);
      });
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
    const Turndown = typeof TurndownService !== 'undefined' ? TurndownService : window.TurndownService;
    if (typeof Turndown === 'undefined') {
      throw new Error("Turndown 라이브러리가 로드되지 않았습니다.");
    }

    const targetElement = findLastResponseElement();
    if (!targetElement) {
      showStatus("복사할 최신 응답을 찾을 수 없습니다.", true);
      console.warn("[Gemini Copy] DOM에서 응답 요소를 찾지 못했습니다.");
      return;
    }

    const clone = targetElement.cloneNode(true);

    // UI 요소 제거
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

    // [전처리 B] LaTeX 수식 (KaTeX / MathJax / MathML) 원본 추출 및 DOM 직접 치환
    function getCleanLatex(node) {
      if (!node) return '';
      // 1. annotation 태그 (KaTeX / MathML 표준 TeX 원본)
      const ann = node.querySelector('annotation');
      if (ann && ann.textContent && ann.textContent.trim()) {
        return ann.textContent.trim();
      }
      // 2. MathJax script 태그
      const script = node.querySelector('script[type*="math/tex"]');
      if (script && script.textContent && script.textContent.trim()) {
        return script.textContent.trim();
      }
      // 3. data 및 aria 속성 탐색 (노드 및 하위 모든 요소)
      const candidates = [node, ...Array.from(node.querySelectorAll('*'))];
      for (const el of candidates) {
        for (const attr of ['data-math', 'data-latex', 'data-tex', 'data-raw-math', 'data-math-expression', 'data-expr', 'aria-label', 'alt']) {
          const val = el.getAttribute?.(attr);
          if (val && val.trim()) return val.trim();
        }
      }
      // 4. MathML alttext
      const mathml = node.querySelector('math') || (node.tagName === 'MATH' ? node : null);
      if (mathml) {
        const alt = mathml.getAttribute('alttext') || mathml.getAttribute('alt');
        if (alt && alt.trim()) return alt.trim();
      }
      // 5. katex-html 텍스트만 추출 (중복 방지)
      const katexHtml = node.querySelector('.katex-html');
      if (katexHtml) {
        return katexHtml.textContent.trim();
      }
      return node.textContent.trim();
    }

    // 최상위 수식 노드부터 탐색하여 TextNode로 직접 치환 (Turndown의 이스케이프 및 DOM 변형 완전 방지)
    const allMathNodes = Array.from(clone.querySelectorAll('.katex-display, .katex, math-block, math-inline, [data-math-type], mjx-container, .MathJax, .MathJax_Display, math'));
    const processedMathNodes = new Set();

    allMathNodes.forEach(node => {
      if (processedMathNodes.has(node)) return;
      for (const p of processedMathNodes) {
        if (p.contains(node)) return;
      }

      const latex = getCleanLatex(node);
      if (!latex) return;

      // 블록 수식 여부 판별 (디스플레이 클래스, 속성, 단독 p태그, multiline LaTeX 등)
      const isDisplay = node.classList.contains('katex-display') ||
        node.tagName === 'MATH-BLOCK' ||
        node.getAttribute('data-math-type') === 'block' ||
        node.getAttribute('display') === 'true' ||
        node.classList.contains('MathJax_Display') ||
        (node.parentElement && node.parentElement.childNodes.length === 1 && (node.parentElement.tagName === 'P' || node.parentElement.tagName === 'DIV')) ||
        latex.includes('\\begin{') ||
        latex.includes('\\\\');

      const replacementText = isDisplay
        ? `\n\n$$\n${latex.trim()}\n$$\n\n`
        : ` $${latex.trim()}$ `;

      const textNode = document.createTextNode(replacementText);
      if (node.parentNode) {
        node.parentNode.replaceChild(textNode, node);
        processedMathNodes.add(node);
      }
    });

    // [전처리 C] SVG 요소 처리
    const svgElements = Array.from(clone.querySelectorAll('svg'));
    svgElements.forEach(svg => {
      if (svg.closest('pre, code-block, spark-code-block, code')) return;

      const isSmallIcon = (svg.clientWidth > 0 && svg.clientWidth <= 32) ||
        (svg.getAttribute('width') && parseInt(svg.getAttribute('width')) <= 32) ||
        svg.classList.contains('icon') || svg.classList.contains('symbol') ||
        svg.closest('button, [role="button"], .button-container');
      if (isSmallIcon) {
        svg.remove();
      } else {
        const svgCode = `\n\n\`\`\`xml\n${svg.outerHTML.trim()}\n\`\`\`\n\n`;
        const textNode = document.createTextNode(svgCode);
        svg.parentNode?.replaceChild(textNode, svg);
      }
    });

    // Turndown 설정
    const turndownService = new Turndown({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      blankReplacement: (content, node) => (node.isBlock ? '\n\n' : '')
    });

    // 중요: 수식의 백슬래시(\), 밑줄(_), 별표(*) 등이 마크다운 이스케이프로 파괴되지 않도록 escape 함수 비활성화
    turndownService.escape = function (str) {
      return str;
    };

    const gfmPlugin = typeof turndownPluginGfm !== 'undefined' ? turndownPluginGfm.gfm : window.turndownPluginGfm?.gfm;
    if (gfmPlugin) {
      turndownService.use(gfmPlugin);
    }

    turndownService.addRule('codeBlock', {
      filter: (node) => {
        return node.nodeName === 'PRE' ||
          node.nodeName === 'CODE-BLOCK' ||
          node.nodeName === 'SPARK-CODE-BLOCK' ||
          node.classList?.contains('code-block') ||
          node.classList?.contains('formatted-code-block-internal-container');
      },
      replacement: (content, node) => {
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

        const codeEl = node.querySelector('pre, code, [data-test-id="code-content"]') || node;
        const codeButtons = codeEl.querySelectorAll('button, .copy-button, [role="button"]');
        codeButtons.forEach(b => b.remove());

        const code = (codeEl.querySelector('code')?.textContent || codeEl.textContent || '')
          .replace(/^\n+|\n+$/g, '');

        return `\n\n\`\`\`${lang.toLowerCase()}\n${code}\n\`\`\`\n\n`;
      }
    });

    // DOM 노드(clone)를 직접 Turndown에 전달하여 HTML 인코딩 파괴 방지
    let markdown = turndownService.turndown(clone);

    // 수식 구분자 및 연속 줄바꿈 정제
    markdown = markdown
      .replace(/\\\[([\s\S]*?)\\\]/g, '\n\n$$$$\n$1\n$$$$\n\n') // \[ ... \] -> $$ ... $$
      .replace(/\\\(([\s\S]*?)\\\)/g, (match, p1) => ` $${p1}$ `) // \( ... \) -> $ ... $
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .trim();

    copyToClipboard(markdown)
      .then(() => {
        showStatus("마크다운 복사 완료!");
        console.log("[Gemini Copy] 복사 완료! (길이:", markdown.length, ")");
      })
      .catch(err => {
        console.error("[Gemini Copy] 클립보드 복사 에러:", err);
        showStatus("클립보드 복사 실패", true);
      });

  } catch (err) {
    console.error("[Gemini Copy] 에러 발생:", err);
    showStatus("오류: " + err.message, true);
  }
}

// Shortcut handler for Copy Last Response
let lastCopyTriggerTime = 0;

function handleKeyDown(e) {
  const isCKey = e.code === 'KeyC' || e.key === 'c' || e.key === 'C' || e.key === 'ㅊ' || e.keyCode === 67;
  const isModifier = e.metaKey || e.ctrlKey;

  if (isModifier && e.shiftKey && isCKey) {
    console.log("[Gemini Copy] 단축키 감지됨 (Cmd/Ctrl + Shift + C)");

    const activeEl = document.activeElement;
    const isTextInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    const selectedText = window.getSelection()?.toString() || '';

    if (isTextInput && selectedText.length > 0) {
      console.log("[Gemini Copy] 입력창 내 텍스트 드래그 중이므로 건너뜁니다.");
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    if (now - lastCopyTriggerTime < 500) return;
    lastCopyTriggerTime = now;

    copyHtmlAsMarkdown();
  }
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keydown', handleKeyDown, true);
}

// Listen for background commands
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "copy_last_response") {
      copyHtmlAsMarkdown();
    }
  });
}

// Start only if context is valid
if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  console.log("Gemini Copy & Notify script active.");
  observeGemini();
  setupKeyboardShortcuts();
}