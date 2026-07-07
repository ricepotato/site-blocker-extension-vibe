// MAIN 월드에 주입된 hijack-main.js가 window.open 차단을 감지하면
// window.postMessage로 알려온다. 이 스크립트(isolated 월드)는 그 메시지를
// 받아 background 서비스워커로 전달해 뱃지 카운트를 갱신한다.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data && event.data.__hijackGuardBlocked) {
    chrome.runtime.sendMessage({ type: "hijack-blocked", url: event.data.url });
  }
});
