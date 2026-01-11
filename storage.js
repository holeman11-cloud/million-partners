const STORAGE_KEY = "motorbike_contracts_v1";

function loadContracts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function saveContracts(contracts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
}
