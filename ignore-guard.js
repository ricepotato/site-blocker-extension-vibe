// '차단 시 탭 열지 않기'(ignore 모드) 용 isolated 월드 스크립트.
// 차단 도메인으로 향하는 링크 클릭 / 폼 제출을 페이지 단계에서 취소하고,
// MAIN 월드의 ignore-guard-main.js가 보내는 window.open 확인 요청에 응답한다.
// 차단 목록은 isolated 월드에만 두어 페이지가 목록을 읽을 수 없게 한다.
(() => {
  const CHECK_OPEN_EVENT = "__siteBlacklistCheckOpen";
  const DEFAULTS = { blockedDomains: [], blockingEnabled: true, ignoreOnBlock: false };
  let settings = { ...DEFAULTS };

  chrome.storage.sync.get(DEFAULTS, (result) => {
    settings = result;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    for (const key of Object.keys(DEFAULTS)) {
      if (changes[key]) {
        settings[key] = changes[key].newValue ?? DEFAULTS[key];
      }
    }
  });

  function isActive() {
    return settings.blockingEnabled && settings.ignoreOnBlock;
  }

  // background.js의 isDomainBlocked와 동일한 규칙 (서브도메인 포함, 활성 항목만)
  function isBlockedUrl(url) {
    let target;
    try {
      target = new URL(url, location.href);
    } catch {
      return false;
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") return false;

    const hostname = target.hostname.toLowerCase();
    return settings.blockedDomains.some((item) => {
      const entry = typeof item === "string" ? { domain: item, enabled: true } : item;
      if (!entry.enabled) return false;
      const blocked = entry.domain.toLowerCase().trim();
      return hostname === blocked || hostname.endsWith("." + blocked);
    });
  }

  function cancel(event, url) {
    event.preventDefault();
    event.stopImmediatePropagation();
    console.log("[site-blacklist] 차단 도메인 열기 무시:", url);
  }

  // 링크 클릭 (일반 클릭, ctrl/shift 클릭, 휠 클릭)
  function onLinkClick(event) {
    if (!isActive()) return;
    const link = event.composedPath().find(
      (el) => (el instanceof HTMLAnchorElement || el instanceof HTMLAreaElement) && el.href
    );
    if (link && isBlockedUrl(link.href)) {
      cancel(event, link.href);
    }
  }

  window.addEventListener("click", onLinkClick, true);
  window.addEventListener("auxclick", onLinkClick, true);

  // 폼 제출
  window.addEventListener(
    "submit",
    (event) => {
      if (!isActive()) return;
      const form = event.target;
      const action = event.submitter?.formAction || form.action;
      if (action && isBlockedUrl(action)) {
        cancel(event, action);
      }
    },
    true
  );

  // MAIN 월드 window.open 확인 요청: 차단 대상이면 이벤트를 취소해서 알린다
  document.addEventListener(CHECK_OPEN_EVENT, (event) => {
    if (isActive() && isBlockedUrl(event.detail)) {
      event.preventDefault();
    }
  });
})();
