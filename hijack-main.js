// 하이재킹 방지 대상 도메인에만 background.js가 동적으로 주입하는 스크립트.
// 페이지의 MAIN 월드에서 실행되므로 window.open을 직접 재정의할 수 있다.
(() => {
  if (window.__hijackGuardInstalled) return;
  window.__hijackGuardInstalled = true;

  const originalOpen = window.open;

  window.open = function (url, ...rest) {
    try {
      if (url) {
        const target = new URL(url, location.href);
        if (target.hostname !== location.hostname) {
          console.log("[site-blacklist] window.open 하이재킹 차단:", target.href);
          window.postMessage({ __hijackGuardBlocked: true, url: target.href }, "*");
          return null;
        }
      }
    } catch {
      // URL 파싱 실패 시 원래 동작 유지
    }
    return originalOpen.call(window, url, ...rest);
  };
})();
