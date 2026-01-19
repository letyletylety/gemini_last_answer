chrome.commands.onCommand.addListener((command) => {
  if (command === "copy_last_response") {
    console.log("1. 단축키 신호 받음");
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) return;
      const tabId = tabs[0].id;

      try {
        // 1. 필요한 파일들을 확실히 먼저 주입
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["turndown.js", "turndown-plugin-gfm.js"]
        });
        console.log("2. 라이브러리 파일 주입 완료");

        // 2. 메인 로직 실행
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: copyHtmlAsMarkdown
        });
        console.log("3. 복사 함수 실행 명령 전달 완료");
      } catch (err) {
        console.error("주입 에러:", err);
      }
    });
  }
});

function copyHtmlAsMarkdown() {
  // 웹페이지 콘솔에 바로 출력 (F12 누르면 보임)
  console.log("--- 복사 스크립트 실행 시작 ---");

  function showStatus(text, isError = false) {
    const div = document.createElement('div');
    div.textContent = text;
    Object.assign(div.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      padding: '20px',
      backgroundColor: isError ? '#ff4444' : '#333',
      color: 'white',
      borderRadius: '10px',
      zIndex: '999999',
      fontSize: '20px',
      fontWeight: 'bold'
    });
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2000);
  }

  try {
    // 1. 라이브러리 로드 확인
    if (typeof TurndownService === 'undefined') {
      throw new Error("TurndownService 로드 실패");
    }

    // 2. 메시지 찾기 (더 넓은 범위의 셀렉터)
    // Gemini는 .message-content를 주로 쓰지만, 구조가 바뀌었을 수 있음
    const selectors = [
      '.message-content',
      '.model-response-text',
      'message-content',
      '.conversation-container [data-message-author-role="assistant"]'
    ];
    
    let targetElement = null;
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        targetElement = elements[elements.length - 1];
        console.log("찾은 셀렉터:", selector);
        break;
      }
    }

    if (!targetElement) {
      showStatus("메시지를 찾을 수 없습니다.", true);
      return;
    }

    // 3. 변환 설정
    const turndownService = new TurndownService({
      blankReplacement: (content, node) => (node.isBlock ? '\n' : '')
    });

    // GFM 플러그인 확인 및 적용
    if (typeof turndownPluginGfm !== 'undefined') {
      turndownService.use(turndownPluginGfm.gfm);
      console.log("GFM 플러그인 적용됨");
    }

    // 코드 블록 최적화
    turndownService.addRule('codeBlock', {
      filter: 'pre',
      replacement: function (content, node) {
        const code = node.querySelector('code')?.textContent || node.textContent;
        let lang = '';
        const deco = node.closest('.formatted-code-block-internal-container')?.previousElementSibling;
        if (deco?.classList.contains('code-block-decoration')) {
          lang = deco.textContent.trim().toLowerCase();
        }
        return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
      }
    });

    // 4. 변환 및 복사
    let markdown = turndownService.turndown(targetElement.innerHTML);
    markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

    // navigator.clipboard가 안 될 경우 대비하여 예외 처리
    if (!navigator.clipboard) {
      throw new Error("클립보드 API를 사용할 수 없습니다.");
    }

    navigator.clipboard.writeText(markdown)
      .then(() => {
        showStatus("복사 성공!");
        console.log("복사 완료!");
      })
      .catch(err => {
        console.error("클립보드 복사 에러:", err);
        showStatus("클립보드 접근 거부됨", true);
      });

  } catch (err) {
    console.error("에러 발생:", err.message);
    showStatus("에러: " + err.message, true);
  }
}