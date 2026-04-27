// 저장소에서 설정을 가져오는 헬퍼 함수
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      { blockedDomains: [], closeTabOnBlock: false, blockingEnabled: true },
      (result) => { resolve(result); }
    );
  });
}

// URL에서 도메인을 추출하는 함수
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    return null;
  }
}

// 구버전 string[] 데이터를 {domain, enabled}[] 로 마이그레이션
function migrate(domains) {
  return domains.map((item) =>
    typeof item === "string" ? { domain: item, enabled: true } : item
  );
}

// 도메인이 활성화된 차단 목록에 있는지 확인 (서브도메인 포함)
function isDomainBlocked(hostname, blockedDomains) {
  return migrate(blockedDomains).some((item) => {
    if (!item.enabled) return false;
    const blockedLower = item.domain.toLowerCase().trim();
    return hostname === blockedLower || hostname.endsWith("." + blockedLower);
  });
}

// 차단 동작 실행: 옵션에 따라 탭 즉시 닫기 또는 차단 페이지로 이동
async function blockTab(tabId, hostname) {
  const { closeTabOnBlock } = await getSettings();
  if (closeTabOnBlock) {
    chrome.tabs.remove(tabId);
  } else {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL("blocked.html") + "?domain=" + encodeURIComponent(hostname),
    });
  }
}

// 탭이 차단 대상인지 확인 후 처리
async function checkAndBlockTab(tabId, url) {
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
    return;
  }

  const hostname = extractDomain(url);
  if (!hostname) return;

  const { blockedDomains, blockingEnabled } = await getSettings();
  if (!blockingEnabled) return;

  if (isDomainBlocked(hostname, blockedDomains)) {
    blockTab(tabId, hostname);
  }
}

// 탭 업데이트 이벤트 감지

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && tab.url) {
    checkAndBlockTab(tabId, tab.url);
  }
});

// 웹 내비게이션 이벤트 감지 (더 빠른 차단)
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // 메인 프레임만 처리

  const hostname = extractDomain(details.url);
  if (!hostname) return;

  const { blockedDomains, blockingEnabled } = await getSettings();
  if (!blockingEnabled) return;

  if (isDomainBlocked(hostname, blockedDomains)) {
    blockTab(details.tabId, hostname);
  }
});
