const domainInput = document.getElementById("domain-input");
const addBtn = document.getElementById("add-btn");
const clearBtn = document.getElementById("clear-btn");
const domainList = document.getElementById("domain-list");
const domainCount = document.getElementById("domain-count");
const closeTabOption = document.getElementById("close-tab-option");
const addCurrentBtn = document.getElementById("add-current-btn");
const blockingEnabled = document.getElementById("blocking-enabled");
const mainHeader = document.getElementById("main-header");
const blockingStatusText = document.getElementById("blocking-status-text");

const hijackInput = document.getElementById("hijack-input");
const hijackAddBtn = document.getElementById("hijack-add-btn");
const hijackClearBtn = document.getElementById("hijack-clear-btn");
const hijackList = document.getElementById("hijack-list");
const hijackCount = document.getElementById("hijack-count");
const hijackAddCurrentBtn = document.getElementById("hijack-add-current-btn");

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

// 도메인 목록(차단 목록 / 하이재킹 방지 목록) 공통 관리 로직
function createDomainListController(config) {
  const {
    storageKey,
    listEl,
    countEl,
    countLabel,
    inputEl,
    addBtn,
    addCurrentBtn,
    clearBtn,
    emptyText,
    alreadyText,
    addedText,
    removedText,
  } = config;

  function load(callback) {
    chrome.storage.sync.get({ [storageKey]: [] }, (result) => {
      callback(migrate(result[storageKey]));
    });
  }

  function save(domains, callback) {
    chrome.storage.sync.set({ [storageKey]: domains }, callback);
  }

  function render(domains) {
    listEl.innerHTML = "";
    countEl.textContent = `${countLabel} (${domains.length}개)`;

    if (domains.length === 0) {
      const li = document.createElement("li");
      li.className = "empty-message";
      li.textContent = emptyText;
      listEl.appendChild(li);
      return;
    }

    domains.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "domain-item" + (item.enabled ? "" : " item-disabled");

      const checkLabel = document.createElement("label");
      checkLabel.className = "item-check-label";
      checkLabel.title = item.enabled ? "활성" : "비활성";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.enabled;
      checkbox.addEventListener("change", () => toggle(index, checkbox.checked));

      const checkmark = document.createElement("span");
      checkmark.className = "item-checkmark";

      checkLabel.appendChild(checkbox);
      checkLabel.appendChild(checkmark);

      const span = document.createElement("span");
      span.className = "domain-text";
      span.textContent = item.domain;
      span.title = item.domain;

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "×";
      removeBtn.title = "삭제";
      removeBtn.addEventListener("click", () => remove(index));

      li.appendChild(checkLabel);
      li.appendChild(span);
      li.appendChild(removeBtn);
      listEl.appendChild(li);
    });
  }

  function addFromInput() {
    const raw = inputEl.value.trim();
    if (!raw) return;

    const domain = normalizeDomain(raw);
    if (!isValidDomain(domain)) {
      showToast("올바른 도메인 형식이 아닙니다. (예: example.com)");
      return;
    }

    load((domains) => {
      if (domains.some((d) => d.domain === domain)) {
        showToast(alreadyText);
        return;
      }

      const updated = [{ domain, enabled: true }, ...domains];
      save(updated, () => {
        render(updated);
        inputEl.value = "";
        inputEl.focus();
        showToast(`${domain} ${addedText}`);
      });
    });
  }

  function toggle(index, enabled) {
    load((domains) => {
      const updated = domains.map((item, i) => (i === index ? { ...item, enabled } : item));
      save(updated, () => {
        render(updated);
        showToast(`${updated[index].domain} ${enabled ? "활성화" : "비활성화"}됨`);
      });
    });
  }

  function remove(index) {
    load((domains) => {
      const removed = domains[index].domain;
      const updated = domains.filter((_, i) => i !== index);
      save(updated, () => {
        render(updated);
        showToast(`${removed} ${removedText}`);
      });
    });
  }

  function clearAll() {
    load((domains) => {
      if (domains.length === 0) return;
      if (!confirm(`목록의 도메인 ${domains.length}개를 모두 삭제할까요?`)) return;

      save([], () => {
        render([]);
        showToast("목록이 비워졌습니다.");
      });
    });
  }

  function addCurrentSite() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        showToast("현재 탭 URL을 가져올 수 없습니다.");
        return;
      }

      const url = tab.url;
      if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) {
        showToast("브라우저 내부 페이지는 추가할 수 없습니다.");
        return;
      }

      const domain = normalizeDomain(url);
      if (!isValidDomain(domain)) {
        showToast("유효한 도메인을 가진 페이지가 아닙니다.");
        return;
      }

      load((domains) => {
        if (domains.some((d) => d.domain === domain)) {
          showToast(alreadyText);
          return;
        }

        const updated = [{ domain, enabled: true }, ...domains];
        save(updated, () => {
          render(updated);
          showToast(`${domain} ${addedText}`);
        });
      });
    });
  }

  function initAddCurrentBtn() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.url) return;

      const url = tab.url;
      if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) {
        addCurrentBtn.disabled = true;
        addCurrentBtn.textContent = "+ 현재 사이트 추가 불가";
        return;
      }

      const domain = normalizeDomain(url);
      if (domain) {
        addCurrentBtn.textContent = `+ 현재 사이트 추가 (${domain})`;
      }
    });
  }

  addBtn.addEventListener("click", addFromInput);
  clearBtn.addEventListener("click", clearAll);
  addCurrentBtn.addEventListener("click", addCurrentSite);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addFromInput();
  });

  return { load, render, initAddCurrentBtn };
}

const blockListController = createDomainListController({
  storageKey: "blockedDomains",
  listEl: domainList,
  countEl: domainCount,
  countLabel: "차단 목록",
  inputEl: domainInput,
  addBtn,
  addCurrentBtn,
  clearBtn,
  emptyText: "차단된 도메인이 없습니다.",
  alreadyText: "이미 차단 목록에 있는 도메인입니다.",
  addedText: "차단 추가됨",
  removedText: "삭제됨",
});

const hijackListController = createDomainListController({
  storageKey: "hijackProtectedDomains",
  listEl: hijackList,
  countEl: hijackCount,
  countLabel: "하이재킹 방지 목록",
  inputEl: hijackInput,
  addBtn: hijackAddBtn,
  addCurrentBtn: hijackAddCurrentBtn,
  clearBtn: hijackClearBtn,
  emptyText: "등록된 도메인이 없습니다.",
  alreadyText: "이미 하이재킹 방지 목록에 있는 도메인입니다.",
  addedText: "하이재킹 방지 추가됨",
  removedText: "삭제됨",
});

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
closeTabOption.addEventListener("change", saveOption);
blockingEnabled.addEventListener("change", saveBlockingEnabled);

// 초기 로드
blockListController.load(blockListController.render);
hijackListController.load(hijackListController.render);
loadOptions();
blockListController.initAddCurrentBtn();
hijackListController.initAddCurrentBtn();
domainInput.focus();
