const DEFAULT_LABELS = ["0", "1", "보류"];
const DRAFT_STORAGE_KEY = "labelingHelperDraft";
const LEGACY_DRAFT_STORAGE_KEY = "drugLabelingHelperDraft";

const state = {
  headers: [],
  rows: [],
  fileName: "",
  sourceColumns: [],
  resultColumn: "",
  targetResultValues: ["__BLANK__"],
  labels: [...DEFAULT_LABELS],
  currentIndex: 0,
  activeUrlIndex: 0,
  reviewedRows: [],
  labelingTargetCount: 0
};

const setupView = document.getElementById("setupView");
const labelingView = document.getElementById("labelingView");
const restoreBanner = document.getElementById("restoreBanner");
const restoreSummary = document.getElementById("restoreSummary");
const restoreDraftButton = document.getElementById("restoreDraftButton");
const discardDraftButton = document.getElementById("discardDraftButton");
const returnToLabelingButton = document.getElementById("returnToLabelingButton");
const setupSteps = document.querySelectorAll(".setup-step");
const stepIndicators = document.querySelectorAll("[data-step-indicator]");
const csvFile = document.getElementById("csvFile");
const fileName = document.getElementById("fileName");
const fileSummary = document.getElementById("fileSummary");
const sourceColumns = document.getElementById("sourceColumns");
const selectAllColumnsButton = document.getElementById("selectAllColumnsButton");
const clearColumnsButton = document.getElementById("clearColumnsButton");
const resultColumn = document.getElementById("resultColumn");
const targetResultValues = document.getElementById("targetResultValues");
const createResultColumn = document.getElementById("createResultColumn");
const newResultColumnName = document.getElementById("newResultColumnName");
const labelOptions = document.getElementById("labelOptions");
const addLabelButton = document.getElementById("addLabelButton");
const toColumnStepButton = document.getElementById("toColumnStepButton");
const backToFileStepButton = document.getElementById("backToFileStepButton");
const toLabelStepButton = document.getElementById("toLabelStepButton");
const backToColumnStepButton = document.getElementById("backToColumnStepButton");
const startButton = document.getElementById("startButton");
const setupMessage = document.getElementById("setupMessage");
const progressText = document.getElementById("progressText");
const rowLabel = document.getElementById("rowLabel");
const completionMessage = document.getElementById("completionMessage");
const rowFields = document.getElementById("rowFields");
const labelButtons = document.getElementById("labelButtons");
const urlPreview = document.getElementById("urlPreview");
const urlTabs = document.getElementById("urlTabs");
const urlColumnName = document.getElementById("urlColumnName");
const urlPreviewText = document.getElementById("urlPreviewText");
const urlPreviewLink = document.getElementById("urlPreviewLink");
const urlPreviewImage = document.getElementById("urlPreviewImage");
const urlPreviewFrame = document.getElementById("urlPreviewFrame");
const downloadButton = document.getElementById("downloadButton");
const backToSetupButton = document.getElementById("backToSetupButton");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((item) => item.some((cell) => cell.trim() !== ""));
}

function escapeCsvValue(value) {
  const text = String(value ?? "");

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function buildCsv() {
  const rows = [
    state.headers,
    ...state.rows.map((row) => state.headers.map((header) => row[header] ?? ""))
  ];

  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
}

function getResultFileName() {
  const baseName = state.fileName.replace(/\.csv$/i, "") || "labeled-data";
  return `${baseName}-labeled.csv`;
}

function setMessage(message) {
  setupMessage.textContent = message;
}

function getDraftPayload() {
  return {
    savedAt: new Date().toISOString(),
    headers: state.headers,
    rows: state.rows,
    fileName: state.fileName,
    sourceColumns: state.sourceColumns,
    resultColumn: state.resultColumn,
    targetResultValues: state.targetResultValues,
    labels: state.labels,
    currentIndex: state.currentIndex,
    activeUrlIndex: state.activeUrlIndex,
    reviewedRows: state.reviewedRows,
    labelingTargetCount: state.labelingTargetCount
  };
}

function saveDraft() {
  if (!state.rows.length) {
    return;
  }

  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(getDraftPayload()));
  } catch {
    setMessage("진행 상황을 자동 저장하지 못했습니다. CSV가 너무 클 수 있습니다.");
  }
}

function readDraft() {
  try {
    const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY) || localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY);
    return rawDraft ? JSON.parse(rawDraft) : null;
  } catch {
    return null;
  }
}

function discardDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
  localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
  restoreBanner.classList.add("hidden");
}

function showRestoreBannerIfNeeded() {
  const draft = readDraft();

  if (!draft?.rows?.length || !draft?.headers?.length) {
    return;
  }

  const savedDate = draft.savedAt ? new Date(draft.savedAt) : null;
  const savedText = savedDate && !Number.isNaN(savedDate.getTime())
    ? savedDate.toLocaleString("ko-KR")
    : "저장 시간 알 수 없음";

  restoreSummary.textContent = `${draft.fileName || "이름 없는 CSV"} · ${draft.rows.length}개 행 · ${savedText}`;
  restoreBanner.classList.remove("hidden");
}

function restoreDraft() {
  const draft = readDraft();

  if (!draft?.rows?.length || !draft?.headers?.length) {
    setMessage("불러올 이전 작업이 없습니다.");
    discardDraft();
    return;
  }

  state.headers = draft.headers;
  state.rows = draft.rows;
  state.fileName = draft.fileName || "";
  state.sourceColumns = draft.sourceColumns || [];
  state.resultColumn = draft.resultColumn || "";
  state.targetResultValues = draft.targetResultValues?.length ? draft.targetResultValues : ["__BLANK__"];
  state.labels = draft.labels?.length ? draft.labels : [...DEFAULT_LABELS];
  state.currentIndex = Math.min(draft.currentIndex || 0, state.rows.length - 1);
  state.activeUrlIndex = draft.activeUrlIndex || 0;
  state.reviewedRows = draft.reviewedRows || [];
  state.labelingTargetCount = draft.labelingTargetCount || getTargetRowIndexes().length;

  fileName.textContent = state.fileName || "이전 CSV 데이터";
  fileSummary.textContent = `${state.headers.length}개 칼럼, ${state.rows.length}개 데이터 행을 불러왔습니다.`;
  renderColumnOptions();
  renderTargetValueOptions();
  renderLabelInputs();

  if (state.resultColumn && [...resultColumn.options].some((option) => option.value === state.resultColumn)) {
    createResultColumn.checked = false;
    resultColumn.disabled = false;
    newResultColumnName.disabled = true;
    newResultColumnName.classList.add("hidden");
    resultColumn.value = state.resultColumn;
  } else if (state.resultColumn) {
    createResultColumn.checked = true;
    resultColumn.disabled = true;
    newResultColumnName.disabled = false;
    newResultColumnName.classList.remove("hidden");
    newResultColumnName.value = state.resultColumn;
  }

  restoreBanner.classList.add("hidden");

  if (state.sourceColumns.length && state.resultColumn) {
    if (!isPendingTargetRow(state.currentIndex)) {
      const nextUnlabeledIndex = getNextPendingTargetIndex();
      state.currentIndex = nextUnlabeledIndex >= 0 ? nextUnlabeledIndex : state.currentIndex;
    }

    setupView.classList.add("hidden");
    labelingView.classList.remove("hidden");
    updateReturnToLabelingButton();
    renderLabelingView();
    return;
  }

  setupView.classList.remove("hidden");
  labelingView.classList.add("hidden");
  showSetupStep(2);
  updateReturnToLabelingButton();
}

function canReturnToLabeling() {
  return state.rows.length > 0 && state.sourceColumns.length > 0 && Boolean(state.resultColumn);
}

function updateReturnToLabelingButton() {
  returnToLabelingButton.classList.toggle("hidden", !canReturnToLabeling());
}

function returnToLabeling() {
  if (!canReturnToLabeling()) {
    setMessage("돌아갈 라벨링 작업이 없습니다.");
    return;
  }

  setupView.classList.add("hidden");
  labelingView.classList.remove("hidden");
  renderLabelingView();
}

function showSetupStep(step) {
  setupSteps.forEach((element) => {
    element.classList.toggle("hidden", element.dataset.step !== String(step));
  });

  stepIndicators.forEach((indicator) => {
    indicator.classList.toggle("is-active", indicator.dataset.stepIndicator === String(step));
  });

  setMessage("");
  updateReturnToLabelingButton();
}

function renderColumnOptions() {
  sourceColumns.replaceChildren();
  resultColumn.replaceChildren();
  resultColumn.add(new Option("결과 기록 칼럼을 선택하세요", ""));

  state.headers.forEach((header) => {
    const chip = document.createElement("button");

    chip.type = "button";
    chip.className = "column-chip";
    chip.dataset.value = header;
    chip.textContent = header;
    chip.classList.toggle("is-selected", state.sourceColumns.includes(header));
    chip.addEventListener("click", () => {
      chip.classList.toggle("is-selected");
      chip.setAttribute("aria-pressed", String(chip.classList.contains("is-selected")));
    });
    chip.setAttribute("aria-pressed", String(state.sourceColumns.includes(header)));
    sourceColumns.appendChild(chip);

    resultColumn.add(new Option(header, header));
  });

  if (state.resultColumn && [...resultColumn.options].some((option) => option.value === state.resultColumn)) {
    resultColumn.value = state.resultColumn;
  } else {
    resultColumn.value = "";
  }

  renderTargetValueOptions();
}

function getResultValueLabel(value) {
  return value === "__BLANK__" ? "빈칸" : value;
}

function getRowResultValue(row) {
  const value = String(row[state.resultColumn] ?? "").trim();
  return value || "__BLANK__";
}

function getResultValueOptions() {
  if (createResultColumn.checked && state.resultColumn) {
    return ["__BLANK__"];
  }

  if (!state.resultColumn || !state.headers.includes(state.resultColumn)) {
    return [];
  }

  const values = new Set(["__BLANK__"]);

  state.rows.forEach((row) => {
    const value = String(row[state.resultColumn] ?? "").trim();

    if (value) {
      values.add(value);
    }
  });

  return [...values];
}

function renderTargetValueOptions() {
  targetResultValues.replaceChildren();

  getResultValueOptions().forEach((value) => {
    const chip = document.createElement("button");
    const isSelected = state.targetResultValues.includes(value);

    chip.type = "button";
    chip.className = "column-chip";
    chip.dataset.value = value;
    chip.textContent = getResultValueLabel(value);
    chip.classList.toggle("is-selected", isSelected);
    chip.setAttribute("aria-pressed", String(isSelected));
    chip.addEventListener("click", () => {
      targetResultValues.querySelectorAll(".column-chip").forEach((item) => {
        item.classList.remove("is-selected");
        item.setAttribute("aria-pressed", "false");
      });
      chip.classList.add("is-selected");
      chip.setAttribute("aria-pressed", "true");
    });
    targetResultValues.appendChild(chip);
  });
}

function syncTargetValuesFromCurrentColumn() {
  state.resultColumn = getResultColumn();
  state.targetResultValues = ["__BLANK__"];
  renderTargetValueOptions();
}

function renderLabelInputs() {
  labelOptions.replaceChildren();

  state.labels.forEach((label) => {
    const row = document.createElement("div");
    const input = document.createElement("input");
    const deleteButton = document.createElement("button");

    row.className = "label-option-row";
    input.type = "text";
    input.value = label;
    input.placeholder = "라벨 값";

    deleteButton.type = "button";
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", () => {
      row.remove();
    });

    row.append(input, deleteButton);
    labelOptions.appendChild(row);
  });
}

function getLabelValues() {
  return [...labelOptions.querySelectorAll("input")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function getSelectedSourceColumns() {
  return [...sourceColumns.querySelectorAll(".column-chip.is-selected")].map((chip) => chip.dataset.value);
}

function getResultColumn() {
  if (createResultColumn.checked) {
    return newResultColumnName.value.trim();
  }

  return resultColumn.value;
}

function getSelectedTargetResultValues() {
  return [...targetResultValues.querySelectorAll(".column-chip.is-selected")].map((chip) => chip.dataset.value);
}

function normalizeUrl(value) {
  const trimmedValue = value.trim();

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  if (/^www\./i.test(trimmedValue)) {
    return `https://${trimmedValue}`;
  }

  return "";
}

function isImageUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(parsedUrl.pathname);
  } catch {
    return false;
  }
}

function getPreviewUrls(row) {
  const urls = [];

  state.sourceColumns.forEach((column) => {
    const url = normalizeUrl(row[column] || "");

    if (url) {
      urls.push({ column, url });
    }
  });

  return urls;
}

function setActiveUrl(index) {
  state.activeUrlIndex = index;
  renderLabelingView();
}

function applyLabel(value) {
  const row = state.rows[state.currentIndex];
  row[state.resultColumn] = value;
  if (!state.reviewedRows.includes(state.currentIndex)) {
    state.reviewedRows.push(state.currentIndex);
  }
  moveToNextUnlabeledRow();
  saveDraft();
  renderLabelingView();
}

function isTargetRow(row) {
  const selectedValues = state.targetResultValues.length ? state.targetResultValues : ["__BLANK__"];
  return selectedValues.includes(getRowResultValue(row));
}

function isPendingTargetRow(index) {
  return isTargetRow(state.rows[index]) && !state.reviewedRows.includes(index);
}

function getTargetRowIndexes() {
  return state.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isTargetRow(row))
    .map(({ index }) => index);
}

function getNextPendingTargetIndex() {
  const nextIndex = state.rows.findIndex((row, index) => index > state.currentIndex && isPendingTargetRow(index));

  if (nextIndex >= 0) {
    return nextIndex;
  }

  return state.rows.findIndex((row, index) => isPendingTargetRow(index));
}

function moveToNextUnlabeledRow() {
  const nextIndex = getNextPendingTargetIndex();

  if (nextIndex >= 0) {
    state.currentIndex = nextIndex;
  }
}

function renderLabelingView() {
  const remainingTargetCount = state.rows.filter((row, index) => isPendingTargetRow(index)).length;
  const completedCount = Math.max(0, state.labelingTargetCount - remainingTargetCount);

  progressText.textContent = `${completedCount} / ${state.labelingTargetCount} 완료`;
  completionMessage.classList.toggle("hidden", remainingTargetCount > 0);
  rowFields.classList.toggle("hidden", remainingTargetCount === 0);
  labelButtons.classList.toggle("hidden", remainingTargetCount === 0);

  if (remainingTargetCount === 0) {
    rowLabel.textContent = "완료";
    urlTabs.replaceChildren();
    urlColumnName.textContent = "";
    urlPreviewText.textContent = "";
    urlPreviewLink.removeAttribute("href");
    urlPreviewImage.removeAttribute("src");
    urlPreviewImage.classList.add("hidden");
    urlPreviewFrame.removeAttribute("src");
    urlPreview.classList.add("hidden");
    labelingView.classList.remove("has-url-preview");
    return;
  }

  const row = state.rows[state.currentIndex];
  const previewUrls = getPreviewUrls(row);
  const activeUrl = previewUrls[state.activeUrlIndex] || previewUrls[0];

  rowLabel.textContent = `${state.currentIndex + 2}행`;
  completionMessage.classList.add("hidden");
  rowFields.replaceChildren();
  labelButtons.replaceChildren();
  urlTabs.replaceChildren();
  urlPreview.classList.toggle("hidden", !activeUrl);
  labelingView.classList.toggle("has-url-preview", Boolean(activeUrl));

  if (activeUrl) {
    const isImage = isImageUrl(activeUrl.url);

    state.activeUrlIndex = previewUrls.indexOf(activeUrl);
    urlColumnName.textContent = activeUrl.column;
    urlPreviewText.textContent = activeUrl.url;
    urlPreviewLink.href = activeUrl.url;
    urlPreviewFrame.classList.toggle("hidden", isImage);
    urlPreviewImage.classList.toggle("hidden", !isImage);

    if (isImage) {
      urlPreviewFrame.removeAttribute("src");
      urlPreviewImage.src = activeUrl.url;
    } else {
      urlPreviewImage.removeAttribute("src");
      urlPreviewFrame.src = activeUrl.url;
    }

    previewUrls.forEach((item, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "url-tab";
      tab.textContent = item.column;
      tab.classList.toggle("is-active", index === state.activeUrlIndex);
      tab.addEventListener("click", () => setActiveUrl(index));
      urlTabs.appendChild(tab);
    });
  } else {
    state.activeUrlIndex = 0;
    urlColumnName.textContent = "";
    urlPreviewText.textContent = "";
    urlPreviewLink.removeAttribute("href");
    urlPreviewImage.removeAttribute("src");
    urlPreviewImage.classList.add("hidden");
    urlPreviewFrame.removeAttribute("src");
    urlPreviewFrame.classList.remove("hidden");
  }

  state.sourceColumns.forEach((column) => {
    const cellValue = row[column] || "";

    if (!cellValue.trim()) {
      return;
    }

    const field = document.createElement("section");
    field.className = "field";

    const title = document.createElement("strong");
    title.textContent = column;

    const value = document.createElement("p");
    value.textContent = cellValue;

    field.append(title, value);
    rowFields.appendChild(field);
  });

  state.labels.forEach((label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => applyLabel(label));
    labelButtons.appendChild(button);
  });
}

function startLabeling() {
  state.sourceColumns = getSelectedSourceColumns();
  state.resultColumn = getResultColumn();
  state.targetResultValues = getSelectedTargetResultValues();
  state.labels = getLabelValues();
  state.reviewedRows = [];

  if (!state.rows.length) {
    setMessage("CSV 파일을 먼저 불러와주세요.");
    return;
  }

  if (!state.sourceColumns.length) {
    setMessage("확인할 칼럼을 하나 이상 선택해주세요.");
    return;
  }

  if (!state.resultColumn) {
    setMessage("결과 기록 칼럼을 선택해주세요.");
    return;
  }

  if (!state.targetResultValues.length) {
    setMessage("다시 라벨링할 결과값을 하나 이상 선택해주세요.");
    return;
  }

  if (!state.labels.length) {
    setMessage("라벨 값을 하나 이상 입력해주세요.");
    return;
  }

  if (!state.headers.includes(state.resultColumn)) {
    state.headers.push(state.resultColumn);
    state.rows.forEach((row) => {
      row[state.resultColumn] = "";
    });
  }

  const targetRowIndexes = getTargetRowIndexes();
  state.labelingTargetCount = targetRowIndexes.length;

  if (!state.labelingTargetCount) {
    setMessage("선택한 결과값에 해당하는 행이 없습니다.");
    return;
  }

  const firstUnlabeledIndex = targetRowIndexes[0];
  state.currentIndex = firstUnlabeledIndex >= 0 ? firstUnlabeledIndex : 0;
  setupView.classList.add("hidden");
  labelingView.classList.remove("hidden");
  updateReturnToLabelingButton();
  saveDraft();
  renderLabelingView();
}

function goToColumnStep() {
  if (!state.rows.length) {
    setMessage("CSV 파일을 먼저 불러와주세요.");
    return;
  }

  showSetupStep(2);
}

function goToLabelStep() {
  const selectedColumns = getSelectedSourceColumns();
  const selectedResultColumn = getResultColumn();
  const selectedTargetValues = getSelectedTargetResultValues();

  if (!selectedColumns.length) {
    setMessage("확인할 칼럼을 하나 이상 선택해주세요.");
    return;
  }

  if (!selectedResultColumn) {
    setMessage("결과 기록 칼럼을 선택해주세요.");
    return;
  }

  if (!selectedTargetValues.length) {
    setMessage("다시 라벨링할 결과값을 하나 이상 선택해주세요.");
    return;
  }

  state.sourceColumns = selectedColumns;
  state.resultColumn = selectedResultColumn;
  state.targetResultValues = selectedTargetValues;
  state.reviewedRows = [];
  state.labelingTargetCount = getTargetRowIndexes().length;
  saveDraft();
  showSetupStep(3);
}

async function handleCsvFile(file) {
  const text = await file.text();
  const parsedRows = parseCsv(text);

  if (parsedRows.length < 2) {
    setMessage("헤더와 데이터 행이 있는 CSV 파일을 선택해주세요.");
    return;
  }

  state.fileName = file.name;
  const headerColumns = parsedRows[0]
    .map((header, index) => ({ name: header.trim(), index }))
    .filter((header) => header.name);

  if (!headerColumns.length) {
    setMessage("이름이 있는 헤더 칼럼을 찾지 못했습니다.");
    return;
  }

  state.headers = headerColumns.map((header) => header.name);
  state.rows = parsedRows.slice(1).map((row) => {
    const item = {};
    headerColumns.forEach((header) => {
      item[header.name] = row[header.index] ?? "";
    });
    return item;
  });

  fileName.textContent = file.name;
  fileSummary.textContent = `${state.headers.length}개 칼럼, ${state.rows.length}개 데이터 행을 불러왔습니다.`;
  setMessage("");
  renderColumnOptions();
  updateReturnToLabelingButton();
  saveDraft();
}

csvFile.addEventListener("change", async (event) => {
  const [file] = event.target.files;

  if (file) {
    await handleCsvFile(file);
  }
});

createResultColumn.addEventListener("change", () => {
  const shouldCreateColumn = createResultColumn.checked;

  resultColumn.disabled = shouldCreateColumn;
  newResultColumnName.disabled = !shouldCreateColumn;
  newResultColumnName.classList.toggle("hidden", !shouldCreateColumn);

  if (shouldCreateColumn) {
    newResultColumnName.focus();
  }

  syncTargetValuesFromCurrentColumn();
});

resultColumn.addEventListener("change", syncTargetValuesFromCurrentColumn);
newResultColumnName.addEventListener("input", () => {
  if (createResultColumn.checked) {
    syncTargetValuesFromCurrentColumn();
  }
});

addLabelButton.addEventListener("click", () => {
  const row = document.createElement("div");
  const input = document.createElement("input");
  const deleteButton = document.createElement("button");

  row.className = "label-option-row";
  input.type = "text";
  input.placeholder = "라벨 값";

  deleteButton.type = "button";
  deleteButton.textContent = "삭제";
  deleteButton.addEventListener("click", () => {
    row.remove();
  });

  row.append(input, deleteButton);
  labelOptions.appendChild(row);
  input.focus();
});

toColumnStepButton.addEventListener("click", goToColumnStep);
backToFileStepButton.addEventListener("click", () => showSetupStep(1));
toLabelStepButton.addEventListener("click", goToLabelStep);
backToColumnStepButton.addEventListener("click", () => showSetupStep(2));

selectAllColumnsButton.addEventListener("click", () => {
  sourceColumns.querySelectorAll(".column-chip").forEach((chip) => {
    chip.classList.add("is-selected");
    chip.setAttribute("aria-pressed", "true");
  });
});

clearColumnsButton.addEventListener("click", () => {
  sourceColumns.querySelectorAll(".column-chip").forEach((chip) => {
    chip.classList.remove("is-selected");
    chip.setAttribute("aria-pressed", "false");
  });
});

startButton.addEventListener("click", startLabeling);

async function downloadResultCsv() {
  const blob = new Blob([buildCsv()], { type: "text/csv;charset=utf-8" });
  const fileName = getResultFileName();

  if ("showSaveFilePicker" in window) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "CSV 파일",
            accept: { "text/csv": [".csv"] }
          }
        ]
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      saveDraft();
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  saveDraft();
}

downloadButton.addEventListener("click", downloadResultCsv);

backToSetupButton.addEventListener("click", () => {
  labelingView.classList.add("hidden");
  setupView.classList.remove("hidden");
  renderColumnOptions();
  renderTargetValueOptions();
  renderLabelInputs();
  showSetupStep(1);
  updateReturnToLabelingButton();
  saveDraft();
});

returnToLabelingButton.addEventListener("click", returnToLabeling);
restoreDraftButton.addEventListener("click", restoreDraft);
discardDraftButton.addEventListener("click", discardDraft);
window.addEventListener("beforeunload", saveDraft);

newResultColumnName.disabled = true;
renderLabelInputs();
showRestoreBannerIfNeeded();
updateReturnToLabelingButton();
