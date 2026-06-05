const DATA_PATH = "./data.tsv";

let allRows = [];
let filteredRows = [];

let currentSort = {
  key: "",
  direction: "asc",
  type: "text",
};

const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const preferenceFilter = document.getElementById("preferenceFilter");
const resetButton = document.getElementById("resetButton");
const tableBody = document.getElementById("tableBody");
const visibleCount = document.getElementById("visibleCount");
const totalCount = document.getElementById("totalCount");
const tableHeaders = document.querySelectorAll("#logTable th");

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const text = await fetchTsvText();
    allRows = parseTsv(text);

    setupTypeFilter(allRows);
    setupEvents();

    filteredRows = [...allRows];
    renderTable(filteredRows);
    updateCounts(filteredRows.length, allRows.length);
  } catch (error) {
    console.error(error);
    renderError();
  }
}

async function fetchTsvText() {
  const response = await fetch(DATA_PATH, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("data.tsv の読み込みに失敗しました。");
  }

  return await response.text();
}

function parseTsv(text) {
  const rows = parseDelimitedText(text, "\t");

  if (rows.length <= 1) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell).trim() !== ""))
    .map((row) => {
      const obj = {};

      headers.forEach((header, index) => {
        obj[header] = row[index] ? row[index].trim() : "";
      });

      return obj;
    });
}

function parseDelimitedText(text, delimiter) {
  const result = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    const nextChar = normalizedText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      row.push(cell);
      result.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    result.push(row);
  }

  return result;
}

function setupTypeFilter(rows) {
  const types = [...new Set(rows.map((row) => row["Type"]).filter(Boolean))];

  types.sort((a, b) => a.localeCompare(b, "ja"));

  types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    typeFilter.appendChild(option);
  });
}

function setupEvents() {
  searchInput.addEventListener("input", applyFilters);
  typeFilter.addEventListener("change", applyFilters);
  preferenceFilter.addEventListener("change", applyFilters);

  resetButton.addEventListener("click", () => {
    searchInput.value = "";
    typeFilter.value = "";
    preferenceFilter.value = "";

    currentSort = {
      key: "",
      direction: "asc",
      type: "text",
    };

    clearHeaderSortClasses();
    applyFilters();
  });

  tableHeaders.forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      const type = th.dataset.type || "text";

      if (currentSort.key === key) {
        currentSort.direction =
          currentSort.direction === "asc" ? "desc" : "asc";
      } else {
        currentSort.key = key;
        currentSort.direction = "asc";
        currentSort.type = type;
      }

      updateHeaderSortClass(th);
      applyFilters();
    });
  });
}

function applyFilters() {
  const keyword = normalizeText(searchInput.value);
  const selectedType = typeFilter.value;
  const minimumPreference = toNumber(preferenceFilter.value);

  filteredRows = allRows.filter((row) => {
    const matchesKeyword = keyword === "" || rowMatchesKeyword(row, keyword);
    const matchesType = selectedType === "" || row["Type"] === selectedType;
    const preferenceValue = toNumber(row["好み度"]);
    const matchesPreference =
      minimumPreference === 0 || preferenceValue >= minimumPreference;

    return matchesKeyword && matchesType && matchesPreference;
  });

  if (currentSort.key) {
    sortRows(
      filteredRows,
      currentSort.key,
      currentSort.direction,
      currentSort.type
    );
  }

  renderTable(filteredRows);
  updateCounts(filteredRows.length, allRows.length);
}

function rowMatchesKeyword(row, keyword) {
  const values = Object.values(row).join(" ");
  return normalizeText(values).includes(keyword);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value) {
  const number = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sortRows(rows, key, direction, type) {
  rows.sort((a, b) => {
    let valueA = a[key] || "";
    let valueB = b[key] || "";

    if (type === "number") {
      valueA = toNumber(valueA);
      valueB = toNumber(valueB);

      return direction === "asc" ? valueA - valueB : valueB - valueA;
    }

    const compared = String(valueA).localeCompare(String(valueB), "ja", {
      numeric: true,
      sensitivity: "base",
    });

    return direction === "asc" ? compared : -compared;
  });
}

function renderTable(rows) {
  tableBody.innerHTML = "";

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");

    td.colSpan = 7;
    td.className = "empty-cell";
    td.textContent = "該当するデータがありません。";

    tr.appendChild(td);
    tableBody.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = getTypeClass(row["Type"]);

    tr.appendChild(createTitleCell(row["タイトル"]));
    tr.appendChild(createTypeCell(row["Type"]));
    tr.appendChild(createPreferenceCell(row["好み度"]));
    tr.appendChild(createDifficultyCell(row["難易度"]));
    tr.appendChild(createClearTimeCell(row["クリア時間"]));
    tr.appendChild(createTextCell(row["ひとこと"]));
    tr.appendChild(createUrlCell(row["URL"]));

    tableBody.appendChild(tr);
  });
}

function getTypeClass(type) {
  const normalizedType = String(type || "").trim();

  if (normalizedType === "LINE謎") {
    return "type-line";
  }

  if (normalizedType === "Web謎") {
    return "type-web";
  }

  if (normalizedType === "Web謎_スマホ") {
    return "type-web-mobile";
  }

  return "type-other";
}

function createTitleCell(value) {
  const td = document.createElement("td");
  td.className = "title-cell";

  const div = document.createElement("div");
  div.className = "cell-inner";
  div.textContent = value || "";

  td.appendChild(div);
  return td;
}

function createTypeCell(value) {
  const td = document.createElement("td");

  if (!value) {
    td.textContent = "";
    return td;
  }

  const span = document.createElement("span");
  span.className = `type-badge ${getTypeClass(value)}`;
  span.textContent = value;

  td.appendChild(span);
  return td;
}

function createPreferenceCell(value) {
  const td = document.createElement("td");
  const rating = clampNumber(toNumber(value), 0, 10);

  if (!rating) {
    td.textContent = "";
    return td;
  }

  const gradient = getThermoGradient(rating);

  const wrapper = document.createElement("div");
  wrapper.className = "preference-cell";

  const number = document.createElement("span");
  number.className = "preference-number";
  number.textContent = rating;
  number.style.color = gradient.textColor;

  const stars = document.createElement("div");
  stars.className = "star-rating";
  stars.setAttribute("aria-label", `好み度 ${rating}`);

  for (let i = 1; i <= 10; i++) {
    const star = document.createElement("span");

    if (i <= rating) {
      star.className = "star-on";
      star.textContent = "★";
      star.style.color = gradient.textColor;
    } else {
      star.className = "star-off";
      star.textContent = "☆";
    }

    stars.appendChild(star);
  }

  wrapper.appendChild(number);
  wrapper.appendChild(stars);
  td.appendChild(wrapper);

  return td;
}

function createDifficultyCell(value) {
  const td = document.createElement("td");
  const difficulty = clampNumber(toNumber(value), 0, 10);

  if (!difficulty) {
    td.textContent = "";
    return td;
  }

  const percent = difficulty * 10;
  const gradient = getThermoGradient(difficulty);

  const wrapper = document.createElement("div");
  wrapper.className = "difficulty-cell";

  const number = document.createElement("span");
  number.className = "difficulty-number";
  number.textContent = difficulty;
  number.style.color = gradient.textColor;

  const bar = document.createElement("div");
  bar.className = "difficulty-bar";

  const fill = document.createElement("div");
  fill.className = "difficulty-fill";
  fill.style.width = `${percent}%`;
  fill.style.backgroundImage = gradient.background;

  bar.appendChild(fill);
  wrapper.appendChild(number);
  wrapper.appendChild(bar);
  td.appendChild(wrapper);

  return td;
}

function getThermoGradient(value) {
  const gradients = {
    1: {
      background: "linear-gradient(90deg, #355cff 0%, #6aa8ff 100%)",
      textColor: "#355cff",
    },
    2: {
      background: "linear-gradient(90deg, #2c7bff 0%, #59c2ff 100%)",
      textColor: "#2c7bff",
    },
    3: {
      background: "linear-gradient(90deg, #00a2ff 0%, #34dcff 100%)",
      textColor: "#0c97d6",
    },
    4: {
      background: "linear-gradient(90deg, #00c5d8 0%, #49e8bf 100%)",
      textColor: "#00a39f",
    },
    5: {
      background: "linear-gradient(90deg, #33c96b 0%, #95d84a 100%)",
      textColor: "#34a853",
    },
    6: {
      background: "linear-gradient(90deg, #9ed93f 0%, #e5df39 100%)",
      textColor: "#7da100",
    },
    7: {
      background: "linear-gradient(90deg, #efd63a 0%, #f8b63a 100%)",
      textColor: "#c28a00",
    },
    8: {
      background: "linear-gradient(90deg, #f79d2e 0%, #f86f2e 100%)",
      textColor: "#dc6d00",
    },
    9: {
      background: "linear-gradient(90deg, #f55f2e 0%, #e9342e 100%)",
      textColor: "#d43a1c",
    },
    10: {
      background: "linear-gradient(90deg, #df1f26 0%, #a80021 100%)",
      textColor: "#b00020",
    },
  };

  return gradients[value] || gradients[1];
}

function createClearTimeCell(value) {
  const td = document.createElement("td");
  const minutes = toNumber(value);

  if (!minutes) {
    td.textContent = "";
    return td;
  }

  td.textContent = `${minutes}分`;
  return td;
}

function createTextCell(value) {
  const td = document.createElement("td");

  const div = document.createElement("div");
  div.className = "cell-inner";
  div.textContent = value || "";

  td.appendChild(div);
  return td;
}

function createUrlCell(value) {
  const td = document.createElement("td");

  if (!value) {
    td.textContent = "";
    return td;
  }

  const link = document.createElement("a");
  link.className = "url-link";
  link.href = value;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "開く";

  td.appendChild(link);
  return td;
}

function updateCounts(visible, total) {
  visibleCount.textContent = visible;
  totalCount.textContent = total;
}

function clearHeaderSortClasses() {
  tableHeaders.forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
  });
}

function updateHeaderSortClass(activeHeader) {
  clearHeaderSortClasses();

  if (currentSort.direction === "asc") {
    activeHeader.classList.add("sort-asc");
  } else {
    activeHeader.classList.add("sort-desc");
  }
}

function renderError() {
  tableBody.innerHTML = "";

  const tr = document.createElement("tr");
  const td = document.createElement("td");

  td.colSpan = 7;
  td.className = "empty-cell";
  td.innerHTML =
    "data.tsv を読み込めませんでした。<br>GitHub Pages上で開くか、ローカルではLive Serverなどを使って確認してください。";

  tr.appendChild(td);
  tableBody.appendChild(tr);

  updateCounts(0, 0);
}