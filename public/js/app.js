const list = document.querySelector("#parcel-list");
const status = document.querySelector("#status");
const summary = document.querySelector("#summary");
const scenario = document.querySelector("#scenario");
const loadButton = document.querySelector("#load-button");
const cancelButton = document.querySelector("#cancel-button");
let activeController = null;
let serial = 0;

function setStatus(message, kind = "info") {
  status.textContent = message;
  status.dataset.kind = kind;
}

function renderParcels(items) {
  list.replaceChildren();
  summary.textContent = `Найдено доставок: ${items.length}`;

  if (items.length === 0) {
    const emptyEl = document.createElement("div");
    emptyEl.className = "empty";
    emptyEl.textContent = "Список доставок пуст.";
    list.appendChild(emptyEl);
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "parcel-card";

    const titleEl = document.createElement("h3");
    const code = item.code || item.id || "Без номера";
    const title = item.title || item.recipient || item.destination || "Доставка";
    titleEl.textContent = `${code} — ${title}`;

    const detailsEl = document.createElement("p");
    const parts = [];
    if (item.status) parts.push(`Статус: ${item.status}`);
    if (item.address || item.city) parts.push(`Адрес: ${item.address || item.city}`);
    if (item.eta || item.date) parts.push(`Срок: ${item.eta || item.date}`);
    detailsEl.textContent = parts.length > 0 ? parts.join(" • ") : "Детали доставки уточняются";

    card.append(titleEl, detailsEl);
    fragment.appendChild(card);
  });

  list.appendChild(fragment);
}

async function loadParcels() {
  if (activeController) {
    activeController.abort("superseded");
  }

  const currentSerial = ++serial;
  const controller = new AbortController();
  activeController = controller;

  let isTimedOut = false;
  const timeoutId = setTimeout(() => {
    isTimedOut = true;
    controller.abort("timeout");
  }, 2500);

  cancelButton.disabled = false;
  setStatus("Загрузка данных о доставках...", "info");

  const mode = scenario.value || "ok";

  try {
    const response = await fetch(`/api/parcels?mode=${encodeURIComponent(mode)}`, {
      signal: controller.signal,
    });

    if (currentSerial !== serial) return;

    if (!response.ok) {
      let serverMsg = "";
      try {
        const errData = await response.json();
        if (errData && errData.error) serverMsg = ` (${errData.error})`;
      } catch (_) {}

      if (response.status === 503) {
        throw new Error(`HTTP 503: Сервис временно недоступен${serverMsg}`);
      }
      throw new Error(`Ошибка HTTP ${response.status}${serverMsg}`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (_) {
      throw new Error("Ошибка разбора данных: сервер вернул повреждённый JSON.");
    }

    if (currentSerial !== serial) return;

    const items = Array.isArray(payload?.data?.items)
      ? payload.data.items
      : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
      ? payload
      : null;

    if (!items) {
      throw new Error("Ошибка структуры: в ответе отсутствует массив доставок.");
    }

    renderParcels(items);

    if (items.length === 0) {
      setStatus("Запрос выполнен: доставок нет (пустой массив).", "info");
    } else {
      setStatus(`Успешно загружено доставок: ${items.length}`, "success");
    }
  } catch (error) {
    if (currentSerial !== serial) return;

    if (error.name === "AbortError" || controller.signal.aborted) {
      if (isTimedOut || controller.signal.reason === "timeout") {
        setStatus("Тайм-аут: сервер не ответил за 2500 мс.", "error");
      } else {
        setStatus("Запрос отменён пользователем.", "info");
      }
    } else if (error instanceof TypeError) {
      setStatus("Сетевая ошибка: не удалось связаться с сервером.", "error");
    } else {
      setStatus(error.message || "Произошла неизвестная ошибка.", "error");
    }
  } finally {
    clearTimeout(timeoutId);
    if (currentSerial === serial) {
      activeController = null;
      cancelButton.disabled = true;
    }
  }
}

loadButton.addEventListener("click", loadParcels);

cancelButton.addEventListener("click", () => {
  if (activeController) {
    activeController.abort("manual");
  }
});

