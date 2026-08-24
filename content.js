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

    // LaTeX 수식 복원 함수
    function extractLatex(node) {
      const annotation = node.querySelector('annotation[encoding*="tex"], annotation');
      if (annotation && annotation.textContent.trim()) {
        return annotation.textContent.trim();
      }
      for (const attr of ['data-math', 'data-latex', 'data-tex', 'aria-label', 'alt']) {
        const val = node.getAttribute(attr);
        if (val && val.trim()) return val.trim();
      }
      const mathEl = node.querySelector('math');
      if (mathEl) {
        const ann = mathEl.querySelector('annotation');
        if (ann && ann.textContent.trim()) return ann.textContent.trim();
        const alt = mathEl.getAttribute('alttext') || mathEl.getAttribute('alt');
        if (alt && alt.trim()) return alt.trim();
      }
      const mjxScript = node.querySelector('script[type*="math/tex"]');
      if (mjxScript && mjxScript.textContent.trim()) {
        return mjxScript.textContent.trim();
      }
      return null;
    }

    // 블록 수식 ($$...$$)
    const blockMathElements = clone.querySelectorAll('.katex-display, math-block, [data-math-type="block"], mjx-container[display="true"], .MathJax_Display');
    blockMathElements.forEach(mathEl => {
      const latex = extractLatex(mathEl);
      const replacement = document.createElement('div');
      replacement.className = 'raw-latex-block';
      replacement.setAttribute('data-latex', latex || mathEl.textContent.trim());
      mathEl.parentNode?.replaceChild(replacement, mathEl);
    });

    // 인라인 수식 ($...$)
    const inlineMathElements = clone.querySelectorAll('.katex, math-inline, [data-math-type="inline"], mjx-container:not([display="true"]), .MathJax');
    inlineMathElements.forEach(mathEl => {
      if (mathEl.closest('.raw-latex-block')) return;
      const latex = extractLatex(mathEl);
      const replacement = document.createElement('span');
      replacement.className = 'raw-latex-inline';
      replacement.setAttribute('data-latex', latex || mathEl.textContent.trim());
      mathEl.parentNode?.replaceChild(replacement, mathEl);
    });

    // SVG 요소 처리
    const svgElements = clone.querySelectorAll('svg');
    svgElements.forEach(svg => {
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

    // Turndown 설정
    const turndownService = new Turndown({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      blankReplacement: (content, node) => (node.isBlock ? '\n\n' : '')
    });

    const gfmPlugin = typeof turndownPluginGfm !== 'undefined' ? turndownPluginGfm.gfm : window.turndownPluginGfm?.gfm;
    if (gfmPlugin) {
      turndownService.use(gfmPlugin);
    }

    turndownService.addRule('latexBlock', {
      filter: (node) => node.classList?.contains('raw-latex-block'),
      replacement: (content, node) => {
        const latex = node.getAttribute('data-latex') || content;
        return `\n\n$$\n${latex.trim()}\n$$\n\n`;
      }
    });

    turndownService.addRule('latexInline', {
      filter: (node) => node.classList?.contains('raw-latex-inline'),
      replacement: (content, node) => {
        const latex = node.getAttribute('data-latex') || content;
        return ` $${latex.trim()}$ `;
      }
    });

    turndownService.addRule('svgDiagram', {
      filter: (node) => node.classList?.contains('raw-svg-diagram'),
      replacement: (content, node) => {
        const svgCode = node.getAttribute('data-svg') || '';
        return `\n\n\`\`\`xml\n${svgCode.trim()}\n\`\`\`\n\n`;
      }
    });

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

    let markdown = turndownService.turndown(clone.innerHTML);
    markdown = markdown
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