// 하이재킹 방지 대상 도메인에만 background.js가 동적으로 주입하는 스크립트.
// 페이지의 MAIN 월드에서 실행되므로 window.open 등을 직접 재정의할 수 있다.
(() => {
  if (window.__hijackGuardInstalled) return;
  window.__hijackGuardInstalled = true;

  // 다른 도메인으로 가는 http(s) URL이면 절대 URL을, 아니면 null을 반환
  function getCrossDomainUrl(url) {
    try {
      const target = new URL(url, location.href);
      if (target.protocol !== "http:" && target.protocol !== "https:") return null;
      return target.hostname !== location.hostname ? target.href : null;
    } catch {
      return null; // URL 파싱 실패 시 원래 동작 유지
    }
  }

  function reportBlocked(kind, url) {
    console.log(`[site-blacklist] ${kind} 하이재킹 차단:`, url);
    window.postMessage({ __hijackGuardBlocked: true, url }, "*");
  }

  // 클릭 시 이동하게 될 링크(<a>/<area>)의 다른 도메인 URL. 링크 안쪽 요소를 클릭해도 링크가 열리므로 조상까지 확인
  function getCrossDomainLinkUrl(el) {
    if (!(el instanceof Element)) return null;
    const link = el.closest("a[href], area[href]");
    return link ? getCrossDomainUrl(link.href) : null;
  }

  // window.open
  const originalOpen = window.open;
  window.open = function (url, ...rest) {
    const blockedUrl = url ? getCrossDomainUrl(url) : null;
    if (blockedUrl) {
      reportBlocked("window.open", blockedUrl);
      return null;
    }
    return originalOpen.call(window, url, ...rest);
  };

  // element.click(): 항상 스크립트가 호출하므로(사용자 클릭은 이 메서드를 거치지 않음)
  // 다른 도메인 링크에 대한 호출은 모두 차단. 문서에 붙지 않은 <a>의 click()도 여기서 잡힌다.
  const originalClick = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function () {
    const blockedUrl = getCrossDomainLinkUrl(this);
    if (blockedUrl) {
      reportBlocked("click()", blockedUrl);
      return;
    }
    return originalClick.call(this);
  };

  // element.dispatchEvent(new MouseEvent("click")): 스크립트가 만든 이벤트이므로 같은 기준으로 차단
  const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (event) {
    if (event && event.type === "click") {
      const blockedUrl = getCrossDomainLinkUrl(this);
      if (blockedUrl) {
        reportBlocked("dispatchEvent(click)", blockedUrl);
        return false; // 이벤트가 취소된 것처럼 반환
      }
    }
    return originalDispatchEvent.call(this, event);
  };
})();
