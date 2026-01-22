/**
 * Gemini 응답 완료 감지 및 알림음 재생
 */

let isGenerating = false;

// 별도의 파일 없이 코드로 소리를 생성하는 함수 (Web Audio API)
function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine'; // 부드러운 사인파
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // 주파수 (A5 음)
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05); // 서서히 커짐
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5); // 서서히 사라짐

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
    
    console.log("Gemini: 응답 완료 알림음 재생됨");
  } catch (e) {
    console.error("알림음 재생 실패:", e);
  }
}

// Gemini 화면 변화를 감시하여 응답 상태 확인
function startObserving() {
  const observer = new MutationObserver(() => {
    // '중지' 또는 'Stop' 버튼이 있으면 답변 생성 중임
    // 구글이 UI를 바꿔도 대응할 수 있도록 여러 속성 확인
    const stopButton = document.querySelector('button[aria-label*="Stop"], button[aria-label*="중지"], .stop-generating-button');
    
    if (stopButton && !isGenerating) {
      // 생성이 시작되는 시점
      isGenerating = true;
    } else if (!stopButton && isGenerating) {
      // 생성이 끝나는 시점 (버튼이 사라짐)
      isGenerating = false;
      playBeep();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// 초기 로드 시 실행
console.log("Gemini Copy & Notify: 알림 기능 활성화됨");
startObserving();