// 오토바이 관리(app.js) - 상태 수정 가능 + localStorage 저장
// motorcycles.html 에서 <script type="module" src="app.js"></script> 로드

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

// 상태 옵션(원하면 추가 가능)
const STATUS_OPTIONS = ["사용가능", "대여중", "정비중"];

let bikes = loadBikes();

// 처음 1번만 샘플 넣기(원하면 삭제 가능)
if (bikes.length === 0) {
  bikes = [
    { plate: "123가4567", model: "PCX", status: "사용가능" },
    { plate: "234나8910", model: "NMAX", status: "대여중" }
  ];
  saveBikes(bikes);
}

function renderBikes() {
  const table = document.getElementById("bikeTable");
  if (!table) return;

  table.innerHTML = `
    <tr>
      <th>번호판</th>
      <th>기종</th>
      <th>상태</th>
      <th>삭제</th>
    </tr>
  `;

  bikes.forEach((b, i) => {
    const tr = document.createElement("tr");

    const optionsHtml = STATUS_OPTIONS.map(s =>
      `<option value="${s}" ${b.status === s ? "selected" : ""}>${s}</option>`
    ).join("");

    tr.innerHTML = `
      <td>${b.plate}</td>
      <td>${b.model}</td>
      <td>
        <select data-index="${i}" class="bikeStatusSelect">
          ${optionsHtml}
        </select>
      </td>
      <td>
        <button type="button" data-del-index="${i}" class="bikeDelBtn">삭제</button>
      </td>
    `;

    table.appendChild(tr);
  });

  // 상태 변경 이벤트
  table.querySelectorAll(".bikeStatusSelect").forEach(sel => {
    sel.addEventListener("change", (e) => {
      const idx = Number(e.target.getAttribute("data-index"));
      const newStatus = e.target.value;

      if (!bikes[idx]) return;
      bikes[idx].status = newStatus;
      saveBikes(bikes);
      // 표는 그대로 두어도 되지만 깔끔하게 다시 그림
      renderBikes();
    });
  });

  // 삭제 이벤트
  table.querySelectorAll(".bikeDelBtn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.target.getAttribute("data-del-index"));
      if (!bikes[idx]) return;

      const ok = confirm(`"${bikes[idx].plate}" 오토바이를 삭제할까요?`);
      if (!ok) return;

      bikes.splice(idx, 1);
      saveBikes(bikes);
      renderBikes();
    });
  });
}

window.addBike = function () {
  const plateEl = document.getElementById("plate");
  const modelEl = document.getElementById("model");
  const statusEl = document.getElementById("status");

  const plate = (plateEl?.value || "").trim();
  const model = (modelEl?.value || "").trim();
  const status = statusEl?.value || "사용가능";

  if (!plate || !model) {
    alert("번호판과 기종을 입력하세요.");
    return;
  }

  if (bikes.some(b => b.plate === plate)) {
    alert("이미 등록된 번호판입니다.");
    return;
  }

  bikes.push({ plate, model, status });
  saveBikes(bikes);

  if (plateEl) plateEl.value = "";
  if (modelEl) modelEl.value = "";

  renderBikes();
};

// 계약관리에서 목록을 읽어갈 때도 같은 키로 접근 가능
window.getBikes = function () {
  return loadBikes();
};

window.onload = function () {
  bikes = loadBikes();
  renderBikes();
};
