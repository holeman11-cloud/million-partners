/************************************************
 * contracts.js (오토바이 관리 연동 + 상태 자동 변경)
 * - 번호판 선택 → 기종 자동 입력
 * - 계약 추가 시: 오토바이 상태 => 대여중
 * - 계약 종료 시: 오토바이 상태 => 사용가능 (다른 계약이 사용 중이면 유지)
 ************************************************/

// ====== 오토바이 저장소 ======
const BIKES_KEY = "motorbike_bikes_v1";

function loadBikes() {
  try {
    const raw = localStorage.getItem(BIKES_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveBikes(bikes) {
  localStorage.setItem(BIKES_KEY, JSON.stringify(bikes));
}

function setBikeStatus(plate, status) {
  const bikes = loadBikes();
  const idx = bikes.findIndex(b => b.plate === plate);
  if (idx === -1) return; // 없는 번호판이면 무시
  bikes[idx].status = status;
  saveBikes(bikes);
}

// ====== 계약 저장소 ======
let contracts = loadContracts();
let editIndex = null;

// ====== “이 번호판이 다른 진행중 계약에서 사용중인가?” ======
function isBikeInUse(plate, excludeIndex = null) {
  return contracts.some((c, idx) => {
    if (excludeIndex !== null && idx === excludeIndex) return false;
    if (c.archived) return false; // 보관이면 제외(있을 수도 있어서 안전)
    if ((c.status || "") === "종료") return false; // 종료면 사용중 아님
    return (c.bike === plate);
  });
}

// ====== 번호판 드롭다운 ======
function populateBikeSelect(selectedPlate = "") {
  const select = document.getElementById("cBikePlate");
  if (!select) return;

  const bikes = loadBikes();
  select.innerHTML = `<option value="">번호판 선택</option>`;

  bikes.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.plate;

    const labelStatus = b.status ? ` · ${b.status}` : "";
    opt.textContent = `${b.plate} (${b.model})${labelStatus}`;

    // 사용가능이 아니면 기본적으로 선택 못 하게(단, 수정 모드에서 본인 선택은 허용)
    const notAvailable = (b.status && b.status !== "사용가능");
    if (notAvailable && b.plate !== selectedPlate) {
      opt.disabled = true;
    }

    if (b.plate === selectedPlate) opt.selected = true;
    select.appendChild(opt);
  });
}

function syncBikeModel() {
  const plateEl = document.getElementById("cBikePlate");
  const modelEl = document.getElementById("cBikeModel");
  if (!plateEl || !modelEl) return;

  const plate = plateEl.value;
  const bikes = loadBikes();
  const bike = bikes.find(b => b.plate === plate);
  modelEl.value = bike ? bike.model : "";
}

// ====== 요금 자동 표시(일→주/월) ======
function updateWeekMonthFromDayFee() {
  const dayEl = document.getElementById("cDayFee");
  const weekEl = document.getElementById("cWeekFee");
  const monthEl = document.getElementById("cMonthFee");
  if (!dayEl || !weekEl || !monthEl) return;

  const day = Number(dayEl.value || 0);
  const week = day * 7;
  const month = day * 30;

  weekEl.value = week ? `${week.toLocaleString()}원` : "";
  monthEl.value = month ? `${month.toLocaleString()}원` : "";
}

// ====== 종료일 자동 계산 ======
function updateEndDate() {
  const start = document.getElementById("cStart").value;
  const days = Number(document.getElementById("cDays").value || 0);
  const endEl = document.getElementById("cEnd");
  if (!start || !days || !endEl) return;

  const d = new Date(start + "T00:00:00");
  d.setDate(d.getDate() + days - 1);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  endEl.value = `${yyyy}-${mm}-${dd}`;
}

// ====== 폼 읽기 ======
function readForm() {
  const type = document.getElementById("cType").value;
  const name = document.getElementById("cName").value.trim();
  const phone = document.getElementById("cPhone").value.trim();

  const plate = document.getElementById("cBikePlate").value;
  const bikeModel = document.getElementById("cBikeModel").value;

  const dayFee = Number(document.getElementById("cDayFee").value || 0);
  const weekFee = dayFee * 7;
  const monthFee = dayFee * 30;

  const start = document.getElementById("cStart").value;
  const days = Number(document.getElementById("cDays").value || 0);
  const end = document.getElementById("cEnd").value;
  const status = document.getElementById("cStatus").value;

  return { type, name, phone, plate, bikeModel, dayFee, weekFee, monthFee, start, days, end, status };
}

function validateForm(d) {
  if (!d.name || !d.phone) return false;
  if (!d.plate) return false;
  if (!d.dayFee || d.dayFee <= 0) return false;
  if (!d.start || !d.days || d.days < 1 || !d.end) return false;
  return true;
}

function clearForm() {
  document.getElementById("cName").value = "";
  document.getElementById("cPhone").value = "";
  document.getElementById("cBikePlate").value = "";
  document.getElementById("cBikeModel").value = "";
  document.getElementById("cDayFee").value = "";
  document.getElementById("cWeekFee").value = "";
  document.getElementById("cMonthFee").value = "";
  document.getElementById("cStart").value = "";
  document.getElementById("cDays").value = "";
  document.getElementById("cEnd").value = "";
  document.getElementById("cStatus").value = "정상";

  updateWeekMonthFromDayFee();
  syncBikeModel();
}

// ====== 수정 모드 버튼 토글(있으면 사용) ======
function setEditMode(on) {
  const addBtn = document.getElementById("addBtn");
  const updateBtn = document.getElementById("updateBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  if (!addBtn || !updateBtn || !cancelBtn) return;

  addBtn.style.display = on ? "none" : "inline-block";
  updateBtn.style.display = on ? "inline-block" : "none";
  cancelBtn.style.display = on ? "inline-block" : "none";
}

// ====== 표 렌더 ======
function renderContracts() {
  const table = document.getElementById("contractTable");
  if (!table) return;

  table.innerHTML = `
    <tr>
      <th>구분</th>
      <th>이름</th>
      <th>연락처</th>
      <th>오토바이</th>
      <th>이용료(일/주/월)</th>
      <th>기간</th>
      <th>상태</th>
      <th>수정</th>
    </tr>
  `;

  contracts
    .filter(c => !c.archived) // 보관 기능 쓰는 경우 대비
    .forEach((c, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.type || ""}</td>
        <td>${c.name || ""}</td>
        <td>${c.phone || ""}</td>
        <td>${c.bike || ""}${c.bikeModel ? ` (${c.bikeModel})` : ""}</td>
        <td>
          일 ${Number(c.dayFee || 0).toLocaleString()} /
          주 ${Number(c.weekFee || 0).toLocaleString()} /
          월 ${Number(c.monthFee || 0).toLocaleString()}
        </td>
        <td>${c.start || ""} ~ ${c.end || ""}</td>
        <td>${c.status || ""}</td>
        <td><button type="button" onclick="startEdit(${idx})">수정</button></td>
      `;
      table.appendChild(tr);
    });
}

// ====== 오토바이 상태 자동 반영 규칙 ======
function desiredBikeStatusByContractStatus(contractStatus) {
  // 종료면 사용가능, 그 외는 대여중
  return (contractStatus === "종료") ? "사용가능" : "대여중";
}

// ====== 계약 추가 ======
window.addContract = function () {
  const d = readForm();
  if (!validateForm(d)) {
    alert("모든 항목을 입력하세요. (번호판/기간/1일이용료 필수)");
    return;
  }

  // 새 계약은 기본적으로 오토바이 상태 변경
  const newBikeStatus = desiredBikeStatusByContractStatus(d.status);
  setBikeStatus(d.plate, newBikeStatus);

  contracts.push({
    id: "c_" + Date.now(),
    type: d.type,
    name: d.name,
    phone: d.phone,
    bike: d.plate,
    bikeModel: d.bikeModel,

    dayFee: d.dayFee,
    weekFee: d.weekFee,
    monthFee: d.monthFee,
    fee: d.monthFee, // 입금/정산 기본 금액

    start: d.start,
    days: d.days,
    end: d.end,
    status: d.status,

    archived: false
  });

  saveContracts(contracts);

  // 드롭다운 갱신(대여중으로 바뀐 것 반영)
  populateBikeSelect();
  clearForm();
  renderContracts();
};

// ====== 수정 시작 ======
window.startEdit = function (index) {
  const c = contracts[index];
  if (!c) return;

  editIndex = index;

  document.getElementById("cType").value = c.type || "렌트";
  document.getElementById("cName").value = c.name || "";
  document.getElementById("cPhone").value = c.phone || "";

  populateBikeSelect(c.bike); // 본인 바이크는 선택 가능하게
  document.getElementById("cBikeModel").value = c.bikeModel || "";

  document.getElementById("cDayFee").value = Number(c.dayFee || 0);
  updateWeekMonthFromDayFee();

  document.getElementById("cStart").value = c.start || "";
  document.getElementById("cDays").value = Number(c.days || 0);
  document.getElementById("cEnd").value = c.end || "";
  document.getElementById("cStatus").value = c.status || "정상";

  setEditMode(true);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ====== 수정 저장 ======
window.updateContract = function () {
  if (editIndex === null) return;

  const old = contracts[editIndex];
  const d = readForm();
  if (!validateForm(d)) {
    alert("모든 항목을 입력하세요. (번호판/기간/1일이용료 필수)");
    return;
  }

  const oldPlate = old.bike;
  const newPlate = d.plate;

  // 1) 계약 데이터 업데이트
  contracts[editIndex] = {
    ...old,
    type: d.type,
    name: d.name,
    phone: d.phone,
    bike: newPlate,
    bikeModel: d.bikeModel,

    dayFee: d.dayFee,
    weekFee: d.weekFee,
    monthFee: d.monthFee,
    fee: d.monthFee,

    start: d.start,
    days: d.days,
    end: d.end,
    status: d.status
  };

  saveContracts(contracts);

  // 2) 오토바이 상태 처리
  // (A) 번호판이 바뀐 경우: 기존 번호판을 사용가능으로 풀지 여부 판단
  if (oldPlate && newPlate && oldPlate !== newPlate) {
    // 기존 번호판을 다른 진행중 계약이 쓰고 있으면 유지(대여중), 아니면 사용가능으로
    if (!isBikeInUse(oldPlate, editIndex)) {
      setBikeStatus(oldPlate, "사용가능");
    }
    // 새 번호판은 현재 계약 상태에 맞게
    setBikeStatus(newPlate, desiredBikeStatusByContractStatus(d.status));
  } else {
    // (B) 번호판 동일: 상태만 변경했을 수 있음
    // 종료로 바꾸면 사용가능(단, 다른 계약이 쓰면 대여중 유지)
    if (d.status === "종료") {
      if (!isBikeInUse(newPlate, editIndex)) {
        setBikeStatus(newPlate, "사용가능");
      }
    } else {
      // 정상/연체면 대여중
      setBikeStatus(newPlate, "대여중");
    }
  }

  // 완료 처리
  editIndex = null;
  setEditMode(false);

  populateBikeSelect(); // 상태 반영으로 옵션 갱신
  clearForm();
  renderContracts();

  alert("수정 저장 완료!");
};

// ====== 수정 취소 ======
window.cancelEdit = function () {
  editIndex = null;
  setEditMode(false);
  populateBikeSelect();
  clearForm();
};

// ====== 초기 로드 ======
window.onload = function () {
  // 번호판 목록 채우기 + 자동기종
  populateBikeSelect();
  syncBikeModel();

  // 표 렌더
  renderContracts();

  // 이벤트
  document.getElementById("cBikePlate")?.addEventListener("change", syncBikeModel);
  document.getElementById("cDayFee")?.addEventListener("input", updateWeekMonthFromDayFee);
  document.getElementById("cDays")?.addEventListener("input", updateEndDate);
  document.getElementById("cStart")?.addEventListener("change", updateEndDate);

  setEditMode(false);
};
