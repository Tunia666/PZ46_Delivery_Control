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
  list.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.textContent = "Список доставок пуст.";
    list.appendChild(emptyMsg);
    if (summary) summary.textContent = "Всего доставок: 0";
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "parcel-card";

    const title = document.createElement("h3");
    title.textContent = item.title || item.name || item.trackingNumber || `Доставка #${item.id ?? ""}`;

    const details = document.createElement("p");
    const statusText = item.status ? `Статус: ${item.status}` : "";
    const addressText = item.address || item.destination ? ` | Адрес: ${item.address || item.destination}` : "";
    details.textContent = (statusText + addressText) || JSON.stringify(item);

    card.appendChild(title);
    card.appendChild(details);
    list.appendChild(card);
  });

  if (summary) {
    summary.textContent = `Всего доставок: ${items.length}`;
  }
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

  loadButton.disabled = true;
  cancelButton.disabled = false;
  setStatus("Загрузка данных...", "loading");

  try {
    const mode = scenario ? scenario.value : "ok";
    const response = await fetch(`/api/parcels?mode=${encodeURIComponent(mode)}`, {
      signal: controller.signal,
    });

    if (currentSerial !== serial) return;

    if (!response.ok) {
      let serverMsg = `Ошибка сервера (HTTP ${response.status})`;
      try {
        const errData = await response.json();
        if (errData && errData.message) {
          serverMsg += `: ${errData.message}`;
        }
      } catch {
      }
      throw new Error(serverMsg);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new SyntaxError("Получен повреждённый JSON от сервера.");
    }

    if (currentSerial !== serial) return;

    const parcels = Array.isArray(data) ? data : (data.parcels || data.items || []);
    renderParcels(parcels);
    setStatus("Данные успешно загружены.", "success");

  } catch (error) {
    if (currentSerial !== serial) return;

    if (error.name === "AbortError") {
      if (isTimedOut) {
        setStatus("Превышено время ожидания ответа (тайм-аут 2500 мс).", "error");
      } else {
        setStatus("Запрос отменён пользователем.", "warning");
      }
    } else if (error instanceof SyntaxError) {
      setStatus(`Ошибка формата данных: ${error.message}`, "error");
    } else if (error instanceof TypeError) {
      setStatus("Сетевая ошибка: не удалось связаться с сервером.", "error");
    } else {
      setStatus(error.message || "Произошла неизвестная ошибка.", "error");
    }
  } finally {
    clearTimeout(timeoutId);

    if (currentSerial === serial) {
      activeController = null;
      loadButton.disabled = false;
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
