// ✅ 임시 계약 데이터(contracts.js와 동일 구조)
let contracts = loadContracts();

function renderSettlement() {
  // 이번달 수입(심플 버전): 정상 + 연체 모두 "청구금액"으로 합산
  const total = contracts.reduce((sum, c) => sum + Number(c.fee || 0), 0);
  document.getElementById("monthIncome").textContent = total.toLocaleString() + "원";

  // 연체 목록
  const late = contracts.filter(c => c.status === "연체");
  document.getElementById("lateCount").textContent = late.length + "건";

  const table = document.getElementById("lateTable");
  table.innerHTML = `
    <tr>
      <th>구분</th>
      <th>이름</th>
      <th>번호판</th>
      <th>월 이용료</th>
      <th>상태</th>
    </tr>
  `;

  late.forEach(c => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${c.type}</td>
      <td>${c.name}</td>
      <td>${c.bike}</td>
      <td>${Number(c.fee).toLocaleString()}원</td>
      <td>${c.status}</td>
    `;
    table.appendChild(row);
  });
}

window.onload = function () {
  renderSettlement();
};
