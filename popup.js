const domainInput = document.getElementById("domain-input");
const addBtn = document.getElementById("add-btn");
const clearBtn = document.getElementById("clear-btn");
const domainList = document.getElementById("domain-list");
const domainCount = document.getElementById("domain-count");
const closeTabOption = document.getElementById("close-tab-option");

// 도메인 유효성 검사
function isValidDomain(domain) {
  const pattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return pattern.test(domain.trim());
}

// 도메인 정규화 (앞의 http/https, www 등 제거)
function normalizeDomain(input) {
  let domain = input.trim().toLowerCase();
  // http:// 또는 https:// 제거
  domain = domain.replace(/^https?:\/\//i, "");
  // 경로 제거 (슬래시 이후)
  domain = domain.split("/")[0];
  // 포트 제거
  domain = domain.split(":")[0];
  return domain;
}

// 저장소에서 도메인 불러오기
function loadDomains(callback) {
  chrome.storage.sync.get({ blockedDomains: [] }, (result) => {
    callback(result.blockedDomains);
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

  domains.forEach((domain, index) => {
    const li = document.createElement("li");
    li.className = "domain-item";

    const span = document.createElement("span");
    span.className = "domain-text";
    span.textContent = domain;
    span.title = domain;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "×";
    removeBtn.title = "삭제";
    removeBtn.addEventListener("click", () => removeDomain(index));

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
    if (domains.includes(domain)) {
      showToast("이미 차단 목록에 있는 도메인입니다.");
      return;
    }

    const updated = [domain, ...domains];
    saveDomains(updated, () => {
      renderList(updated);
      domainInput.value = "";
      domainInput.focus();
      showToast(`${domain} 차단 추가됨`);
    });
  });
}

// 도메인 삭제
function removeDomain(index) {
  loadDomains((domains) => {
    const removed = domains[index];
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

// 옵션 불러오기
function loadOptions() {
  chrome.storage.sync.get({ closeTabOnBlock: false }, (result) => {
    closeTabOption.checked = result.closeTabOnBlock;
  });
}

// 옵션 저장
function saveOption() {
  chrome.storage.sync.set({ closeTabOnBlock: closeTabOption.checked });
}

// 이벤트 등록
addBtn.addEventListener("click", addDomain);
clearBtn.addEventListener("click", clearAll);
closeTabOption.addEventListener("change", saveOption);

domainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDomain();
});

// 초기 로드
loadDomains(renderList);
loadOptions();
domainInput.focus();
