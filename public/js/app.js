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
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Доставки не найдены.";
    list.appendChild(empty);
    summary.textContent = "Всего доставок: 0";
    return;
  }
  items.forEach((parcel) => {
    const card = document.createElement("article");
    card.className = "parcel-card";
    const id = document.createElement("h3");
    id.textContent = "Номер: " + parcel.id;
    const recipient = document.createElement("p");
    recipient.textContent = "Получатель: " + parcel.recipient;
    const destination = document.createElement("p");
    destination.textContent = "Город: " + parcel.destination;
    const state = document.createElement("p");
    state.textContent = "Статус: " + parcel.state;
    card.append(id, recipient, destination, state);
    list.appendChild(card);
  });
  summary.textContent = "Всего доставок: " + items.length;
}
async function loadParcels() {
  if (activeController) {
    activeController.abort();
  }
  const requestId = ++serial;
  const controller = new AbortController();
  activeController = controller;
  let timedOut = false;
  let manuallyCancelled = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 2500);
  cancelButton.disabled = false;
  loadButton.disabled = false;
  setStatus("Загрузка доставок...", "info");
  try {
    const mode = scenario.value;
    const url = "/api/parcels?mode=" + encodeURIComponent(mode);
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error("HTTP_ERROR_" + response.status);
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.items)) {
      throw new Error("INVALID_DATA");
    }
    if (requestId !== serial) return;
    renderParcels(data.items);
    if (data.items.length === 0) {
      setStatus("Запрос выполнен. Доставок пока нет.", "info");
    } else {
      setStatus("Доставки успешно загружены!", "success");
    }
  } catch (error) {
    if (requestId !== serial) return;
    if (timedOut) {
      setStatus("Ошибка: время ожидания истекло (2500 мс).", "error");
    } else if (manuallyCancelled) {
      setStatus("Запрос отменён пользователем.", "info");
    } else if (error.message.startsWith("HTTP_ERROR_")) {
      const code = error.message.replace("HTTP_ERROR_", "");
      setStatus("Ошибка сервера: HTTP " + code, "error");
    } else if (error instanceof SyntaxError) {
      setStatus("Ошибка: сервер вернул некорректный JSON.", "error");
    } else if (error.name === "AbortError") {
      setStatus("Запрос отменён.", "info");
    } else if (error.message === "Failed to fetch" ||
               error instanceof TypeError) {
      setStatus("Ошибка сети: не удалось связаться с сервером.", "error");
    } else {
      setStatus("Произошла ошибка: " + error.message, "error");
    }
  } finally {
    clearTimeout(timer);
    if (requestId === serial) {
      cancelButton.disabled = true;
      activeController = null;
    }
  }
}
loadButton.addEventListener("click", loadParcels);
cancelButton.addEventListener("click", () => {
  if (activeController) {
    manuallyCancelled = false;
  }
});