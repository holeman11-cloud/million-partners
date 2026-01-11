// =============================
// 입금 체크(저장 버튼 방식)
// - 계약관리와 연동(loadContracts)
// - 보관(archived) 계약 숨김
// - 종료 계약 숨김(메인 리스트에서)
// - 일 이용료(dayFee) 표시(수정 불가)
// - "선택된 계약 입금내역": 계약 기간 전체(시작~종료) 페이지로 표시
// - 내역에서 입금완료 체크 수정 가능 + 저장 버튼으로 저장
// =============================

const PAYMENTS_KEY = "motorbike_payments_v2";

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDate(dateStr) {
  // dateStr: YYYY-MM-DD
  return new Date(dateStr + "T00:00:00");
}

function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadPayments() {
  try {
    const raw = localStorage.getItem(PAYMENTS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function savePayments(allPayments) {
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(allPayments));
}

function ensureContractIds(contracts) {
  let changed = false;
  contracts.forEach(c => {
    if (!c.id) {
      c.id = "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
      changed = true;
    }
  });
  if (changed) saveContracts(contracts);
  return contracts;
}

function getDayPayments(allPayments, dateStr) {
  if (!allPayments[dateStr]) allPayments[dateStr] = {};
  return allPayments[dateStr];
}

function activeContractsOnly(contracts) {
  return contracts.filter(c => !c.archived && c.status !== "종료");
}

function dayFeeOf(contract) {
  return Number(contract.dayFee || 0);
}

// ---- 상태(저장 전 임시 변경) ----
let currentDate = todayStr();
let contractsCache = [];
let paymentsCache = {};

// ✅ 저장 전 임시 변경을 "날짜+계약" 단위로 들고감
// key = `${dateStr}__${contractId}`  value = { paid:boolean }
let staged = {};
let dirty = false;

let selectedContractId = null;

// 내역 페이지
let histPageIndex = 0;
const HIST_PAGE_SIZE = 31; // 한 페이지 31일(대충 한 달)

function stageKey(dateStr, contractId) {
  return `${dateStr}__${contractId}`;
}

function setDirty(v) {
  dirty = v;
  const badge = document.getElementById("dirtyBadge");
  if (badge) badge.style.display = dirty ? "inline-block" : "none";
}

function getPaidState(dateStr, contractId) {
  const key = stageKey(dateStr, contractId);
  if (staged[key] && typeof staged[key].paid === "boolean") {
    return staged[key].paid;
  }
  const day = getDayPayments(paymentsCache, dateStr);
  const saved = day[contractId] || null;
  return saved ? !!saved.paid : false;
}

function updateCounts(dateStr) {
  const list = activeContractsOnly(contractsCache);
  let paidCount = 0, unpaidCount = 0;

  list.forEach(c => {
    const paid = getPaidState(dateStr, c.id);
    if (paid) paidCount++;
    else unpaidCount++;
  });

  const paidEl = document.getElementById("paidCount");
  const unpaidEl = document.getElementById("unpaidCount");
  if (paidEl) paidEl.textContent = paidCount;
  if (unpaidEl) unpaidEl.textContent = unpaidCount;
}

// ---------- 렌더링(PC 테이블) ----------
function renderTable(dateStr) {
  const table = document.getElementById("payTable");
  if (!table) return;

  const list = activeContractsOnly(contractsCache);

  table.innerHTML = `
    <tr>
      <th>입금완료</th>
      <th>일 이용료</th>
      <th>구분</th>
      <th>이름</th>
      <th>연락처</th>
      <th>번호판</th>
      <th>상태</th>
      <th>내역</th>
    </tr>
  `;

  list.forEach(c => {
    const paid = getPaidState(dateStr, c.id);
    const tr = document.createElement("tr");
    if (!paid) tr.classList.add("unpaidRow");

    tr.innerHTML = `
      <td style="text-align:center;">
        <input type="checkbox" data-id="${c.id}" ${paid ? "checked" : ""}>
      </td>
      <td style="text-align:right;">
        ${dayFeeOf(c).toLocaleString()}원
      </td>
      <td>${c.type || ""}</td>
      <td>
        <button type="button" class="linkBtn" data-select-id="${c.id}">${c.name || ""}</button>
      </td>
      <td>${c.phone || ""}</td>
      <td>${c.bike || ""}${c.bikeModel ? ` (${c.bikeModel})` : ""}</td>
      <td>${c.status || ""}</td>
      <td><button type="button" data-hist-id="${c.id}">내역</button></td>
    `;
    table.appendChild(tr);
  });

  table.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
    cb.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-id");
      const key = stageKey(dateStr, id);
      staged[key] = staged[key] || {};
      staged[key].paid = e.target.checked;

      setDirty(true);
      updateCounts(dateStr);
      renderTable(dateStr);
      renderCards(dateStr);

      // 선택된 내역이 있으면 같이 갱신
      if (selectedContractId === id) renderHistory();
    });
  });

  table.querySelectorAll('button[data-select-id]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      selectedContractId = e.target.getAttribute("data-select-id");
      histPageIndex = 0;
      renderHistory();
    });
  });

  table.querySelectorAll('button[data-hist-id]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      selectedContractId = e.target.getAttribute("data-hist-id");
      histPageIndex = 0;
      renderHistory();
      document.getElementById("historyTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// ---------- 렌더링(모바일 카드) ----------
function renderCards(dateStr) {
  const wrap = document.getElementById("payCards");
  if (!wrap) return;

  const list = activeContractsOnly(contractsCache);
  wrap.innerHTML = "";

  list.forEach(c => {
    const paid = getPaidState(dateStr, c.id);
    const card = document.createElement("div");
    card.className = "payCard" + (paid ? "" : " unpaidCard");

    card.innerHTML = `
      <div class="payCardTop">
        <div>
          <div class="payCardTitle">${c.name || ""} <span class="mini">(${c.type || ""})</span></div>
          <div class="mini">${c.bike || ""}${c.bikeModel ? ` (${c.bikeModel})` : ""} · ${c.phone || ""}</div>
          <div class="mini">일 이용료: ${dayFeeOf(c).toLocaleString()}원 · 상태: ${c.status || ""}</div>
        </div>
        <label class="checkLine">
          <input type="checkbox" data-id="${c.id}" ${paid ? "checked" : ""}>
          <span>입금완료</span>
        </label>
      </div>

      <div class="payCardBottom">
        <button type="button" class="smallBtn" data-hist-id="${c.id}">내역</button>
      </div>
    `;

    wrap.appendChild(card);
  });

  wrap.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
    cb.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-id");
      const key = stageKey(dateStr, id);
      staged[key] = staged[key] || {};
      staged[key].paid = e.target.checked;

      setDirty(true);
      updateCounts(dateStr);
      renderTable(dateStr);
      renderCards(dateStr);

      if (selectedContractId === id) renderHistory();
    });
  });

  wrap.querySelectorAll('button[data-hist-id]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      selectedContractId = e.target.getAttribute("data-hist-id");
      histPageIndex = 0;
      renderHistory();
      document.getElementById("historyTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// ---------- 선택된 계약 내역: 계약기간 전체 + 페이지 + 체크 수정 가능 ----------
function contractPeriodDates(contract) {
  if (!contract?.start || !contract?.end) return [];

  const start = parseDate(contract.start);
  const end = parseDate(contract.end);

  // start > end 방지
  if (start.getTime() > end.getTime()) return [];

  const dates = [];
  const cur = new Date(start);

  while (cur.getTime() <= end.getTime()) {
    dates.push(formatDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function renderHistory() {
  const title = document.getElementById("historyTitle");
  const table = document.getElementById("historyTable");
  const prevBtn = document.getElementById("histPrev");
  const nextBtn = document.getElementById("histNext");
  const pageEl = document.getElementById("histPage");

  if (!title || !table) return;

  if (!selectedContractId) {
    title.textContent = "아직 선택된 계약이 없습니다.";
    table.innerHTML = `<tr><th>날짜</th><th>입금완료</th></tr>`;
    if (pageEl) pageEl.textContent = "1 / 1";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const c = contractsCache.find(x => x.id === selectedContractId);
  if (!c) {
    title.textContent = "계약을 찾을 수 없습니다.";
    table.innerHTML = `<tr><th>날짜</th><th>입금완료</th></tr>`;
    return;
  }

  const allDates = contractPeriodDates(c); // 전체 기간 날짜 목록(오름차순)
  // 보기 편하게 최신 날짜가 위로 오게 내림차순
  const datesDesc = [...allDates].reverse();

  const totalPages = Math.max(1, Math.ceil(datesDesc.length / HIST_PAGE_SIZE));
  if (histPageIndex < 0) histPageIndex = 0;
  if (histPageIndex > totalPages - 1) histPageIndex = totalPages - 1;

  const startIdx = histPageIndex * HIST_PAGE_SIZE;
  const pageDates = datesDesc.slice(startIdx, startIdx + HIST_PAGE_SIZE);

  title.innerHTML =
    `<b>${c.name}</b> (${c.type}) · ${c.bike || ""}${c.bikeModel ? ` (${c.bikeModel})` : ""}<br>` +
    `기간: ${c.start} ~ ${c.end} (총 ${allDates.length}일)`;

  table.innerHTML = `
    <tr>
      <th>날짜</th>
      <th>입금완료</th>
      <th>일 이용료</th>
    </tr>
  `;

  pageDates.forEach(dateStr => {
    const paid = getPaidState(dateStr, c.id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td style="text-align:center;">
        <input type="checkbox" data-hist-date="${dateStr}" data-hist-id="${c.id}" ${paid ? "checked" : ""}>
      </td>
      <td style="text-align:right;">${dayFeeOf(c).toLocaleString()}원</td>
    `;
    table.appendChild(tr);
  });

  // 내역 체크 수정 이벤트
  table.querySelectorAll('input[type="checkbox"][data-hist-date]').forEach(cb => {
    cb.addEventListener("change", (e) => {
      const dateStr = e.target.getAttribute("data-hist-date");
      const id = e.target.getAttribute("data-hist-id");

      const key = stageKey(dateStr, id);
      staged[key] = staged[key] || {};
      staged[key].paid = e.target.checked;

      setDirty(true);

      // 메인 날짜가 현재Date인 경우 카운트/표도 갱신해주면 자연스럽다
      updateCounts(currentDate);
      renderTable(currentDate);
      renderCards(currentDate);
    });
  });

  // 페이지 버튼 상태
  if (pageEl) pageEl.textContent = `${histPageIndex + 1} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = (histPageIndex === 0);
  if (nextBtn) nextBtn.disabled = (histPageIndex >= totalPages - 1);

  if (prevBtn) prevBtn.onclick = () => { histPageIndex--; renderHistory(); };
  if (nextBtn) nextBtn.onclick = () => { histPageIndex++; renderHistory(); };
}

// ---------- 저장 시 연체 자동 처리(옵션) ----------
function applyAutoLateIfNeeded(dateStr) {
  const autoLateEl = document.getElementById("autoLate");
  const autoLate = autoLateEl ? autoLateEl.checked : false;
  if (!autoLate) return;

  const list = activeContractsOnly(contractsCache);

  list.forEach(c => {
    const paid = getPaidState(dateStr, c.id);
    if (!paid) c.status = "연체";
    else if (c.status === "연체") c.status = "정상";
  });

  saveContracts(contractsCache);
}

// ---------- 저장 버튼 ----------
window.saveNow = function () {
  // ✅ staged에 들어있는 "모든 날짜"를 저장
  Object.keys(staged).forEach(k => {
    const [dateStr, contractId] = k.split("__");
    const day = getDayPayments(paymentsCache, dateStr);

    const prev = day[contractId] || {};
    day[contractId] = {
      paid: (typeof staged[k].paid === "boolean") ? staged[k].paid : !!prev.paid,
      ts: Date.now()
    };
  });

  savePayments(paymentsCache);

  // 메인 화면의 날짜 기준으로 연체 자동처리(옵션)
  applyAutoLateIfNeeded(currentDate);

  staged = {};
  setDirty(false);

  // 재로딩
  contractsCache = ensureContractIds(loadContracts());
  paymentsCache = loadPayments();

  updateCounts(currentDate);
  renderTable(currentDate);
  renderCards(currentDate);
  renderHistory();

  alert("저장 완료!");
};

// ---------- 페이지 갱신 ----------
function refreshAll(dateStr) {
  currentDate = dateStr;

  contractsCache = ensureContractIds(loadContracts());
  paymentsCache = loadPayments();

  // 날짜 바꾸면 staged는 유지(원하면 유지), 하지만 헷갈리면 비우는 게 안전
  // 여기서는 안전하게 비움
  staged = {};
  setDirty(false);

  updateCounts(dateStr);
  renderTable(dateStr);
  renderCards(dateStr);

  // 선택 내역도 새로 그림
  renderHistory();
}

window.loadPage = function () {
  const dateEl = document.getElementById("payDate");
  const dateStr = (dateEl && dateEl.value) ? dateEl.value : todayStr();
  refreshAll(dateStr);
};

window.onload = function () {
  const dateEl = document.getElementById("payDate");
  if (dateEl) dateEl.value = todayStr();

  selectedContractId = null;
  histPageIndex = 0;

  refreshAll(todayStr());

  if (dateEl) {
    dateEl.addEventListener("change", () => {
      if (dirty) {
        const ok = confirm("저장되지 않은 변경이 있어요. 날짜를 바꾸면 임시 변경이 사라집니다. 계속할까요?");
        if (!ok) {
          dateEl.value = currentDate;
          return;
        }
      }
      refreshAll(dateEl.value);
    });
  }
};
