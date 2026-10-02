// '차단 시 탭 열지 않기'(ignore 모드) 용 MAIN 월드 스크립트.
// window.open을 재정의해, 열기 전에 isolated 월드의 ignore-guard.js에게
// 동기 이벤트로 차단 여부를 묻는다. (이벤트가 취소되면 차단 대상)
(() => {
  if (window.__siteBlacklistIgnoreGuardInstalled) return;
  window.__siteBlacklistIgnoreGuardInstalled = true;

  const CHECK_OPEN_EVENT = "__siteBlacklistCheckOpen";
  const originalOpen = window.open;

  window.open = function (url, ...rest) {
    if (url) {
      const allowed = document.dispatchEvent(
        new CustomEvent(CHECK_OPEN_EVENT, { detail: String(url), cancelable: true })
      );
      if (!allowed) {
        console.log("[site-blacklist] 차단 도메인 window.open 무시:", String(url));
        return null;
      }
    }
    return originalOpen.call(window, url, ...rest);
  };
})();
