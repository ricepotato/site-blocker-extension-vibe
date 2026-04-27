const domainInput = document.getElementById("domain-input");
const addBtn = document.getElementById("add-btn");
const clearBtn = document.getElementById("clear-btn");
const domainList = document.getElementById("domain-list");
const domainCount = document.getElementById("domain-count");
const closeTabOption = document.getElementById("close-tab-option");
const blockingEnabled = document.getElementById("blocking-enabled");
const mainHeader = document.getElementById("main-header");
const blockingStatusText = document.getElementById("blocking-status-text");

// 도메인 유효성 검사
function isValidDomain(domain) {
  const pattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return pattern.test(domain.trim());
}

// 도메인 정규화 (앞의 http/https 등 제거)
function normalizeDomain(input) {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//i, "");
  domain = domain.split("/")[0];
  domain = domain.split(":")[0];
  return domain;
}

// 구버전 string[] 데이터를 {domain, enabled}[] 로 마이그레이션
function migrate(domains) {
  return domains.map((item) =>
    typeof item === "string" ? { domain: item, enabled: true } : item
  );
}

// 저장소에서 도메인 불러오기
function loadDomains(callback) {
  chrome.storage.sync.get({ blockedDomains: [] }, (result) => {
    callback(migrate(result.blockedDomains));
  });
}

// 저장소에 도메인 저장
function saveDomains(domains, callback) {
  chrome.storage.sync.set({ blockedDomains: domains }, callback);
}

// 목록 UI 렌더링
function renderList(domains) {
  domainList.innerHTML = "";
  domainCount.textContent = `차단 목록 (${domains.length}개)`;

  if (domains.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-message";
    li.textContent = "차단된 도메인이 없습니다.";
    domainList.appendChild(li);
    return;
  }

  domains.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "domain-item" + (item.enabled ? "" : " item-disabled");

    // 활성/비활성 체크박스
    const checkLabel = document.createElement("label");
    checkLabel.className = "item-check-label";
    checkLabel.title = item.enabled ? "차단 활성" : "차단 비활성";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.enabled;
    checkbox.addEventListener("change", () => toggleDomain(index, checkbox.checked));

    const checkmark = document.createElement("span");
    checkmark.className = "item-checkmark";

    checkLabel.appendChild(checkbox);
    checkLabel.appendChild(checkmark);

    // 도메인 텍스트
    const span = document.createElement("span");
    span.className = "domain-text";
    span.textContent = item.domain;
    span.title = item.domain;

    // 삭제 버튼
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "×";
    removeBtn.title = "삭제";
    removeBtn.addEventListener("click", () => removeDomain(index));

    li.appendChild(checkLabel);
    li.appendChild(span);
    li.appendChild(removeBtn);
    domainList.appendChild(li);
  });
}

// 도메인 추가
function addDomain() {
  const raw = domainInput.value.trim();
  if (!raw) return;

  const domain = normalizeDomain(raw);

  if (!isValidDomain(domain)) {
    showToast("올바른 도메인 형식이 아닙니다. (예: example.com)");
    return;
  }

  loadDomains((domains) => {
    if (domains.some((d) => d.domain === domain)) {
      showToast("이미 차단 목록에 있는 도메인입니다.");
      return;
    }

    const updated = [{ domain, enabled: true }, ...domains];
    saveDomains(updated, () => {
      renderList(updated);
      domainInput.value = "";
      domainInput.focus();
      showToast(`${domain} 차단 추가됨`);
    });
  });
}

// 도메인 활성/비활성 토글
function toggleDomain(index, enabled) {
  loadDomains((domains) => {
    const updated = domains.map((item, i) =>
      i === index ? { ...item, enabled } : item
    );
    saveDomains(updated, () => {
      renderList(updated);
      showToast(`${updated[index].domain} 차단 ${enabled ? "활성화" : "비활성화"}됨`);
    });
  });
}

// 도메인 삭제
function removeDomain(index) {
  loadDomains((domains) => {
    const removed = domains[index].domain;
    const updated = domains.filter((_, i) => i !== index);
    saveDomains(updated, () => {
      renderList(updated);
      showToast(`${removed} 삭제됨`);
    });
  });
}

// 전체 삭제
function clearAll() {
  loadDomains((domains) => {
    if (domains.length === 0) return;
    if (!confirm(`차단 목록의 도메인 ${domains.length}개를 모두 삭제할까요?`)) return;

    saveDomains([], () => {
      renderList([]);
      showToast("차단 목록이 비워졌습니다.");
    });
  });
}

// 토스트 알림 표시
let toastTimer = null;
function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

// 헤더 및 토글 텍스트 상태 반영
function applyBlockingState(enabled) {
  blockingEnabled.checked = enabled;
  blockingStatusText.textContent = enabled ? "ON" : "OFF";
  mainHeader.classList.toggle("disabled", !enabled);
}

// 옵션 불러오기
function loadOptions() {
  chrome.storage.sync.get({ closeTabOnBlock: false, blockingEnabled: true }, (result) => {
    closeTabOption.checked = result.closeTabOnBlock;
    applyBlockingState(result.blockingEnabled);
  });
}

// 옵션 저장
function saveOption() {
  chrome.storage.sync.set({ closeTabOnBlock: closeTabOption.checked });
}

// 차단 활성/비활성 저장 및 UI 반영
function saveBlockingEnabled() {
  const enabled = blockingEnabled.checked;
  chrome.storage.sync.set({ blockingEnabled: enabled });
  applyBlockingState(enabled);
  showToast(enabled ? "차단 활성화됨" : "차단 일시 중단됨");
}

// 이벤트 등록
addBtn.addEventListener("click", addDomain);
clearBtn.addEventListener("click", clearAll);
closeTabOption.addEventListener("change", saveOption);
blockingEnabled.addEventListener("change", saveBlockingEnabled);

domainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDomain();
});

// 초기 로드
loadDomains(renderList);
loadOptions();
domainInput.focus();
