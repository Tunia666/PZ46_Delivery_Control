const list = document.querySelector('#parcel-list');
const status = document.querySelector('#status');
const summary = document.querySelector('#summary');
const modeSelect = document.querySelector('#mode') || document.querySelector('#scenario');
const loadButton = document.querySelector('#load-button');
const cancelButton = document.querySelector('#cancel-button');
let activeController = null;
let serial = 0;
function setStatus(message, kind = 'info') {
  status.textContent = message;
  status.dataset.kind = kind;
}
function renderParcels(items) {
  list.replaceChildren();
  if (!Array.isArray(items) || items.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-state';
    emptyMessage.textContent = 'Список доставок пуст.';
    list.append(emptyMessage);
    summary.textContent = 'Доставок: 0';
    return;
  }
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'parcel-card';
    const title = document.createElement('h3');
    title.textContent = item.id || item.trackingNumber || item.title || 'Без номера';
    const statusText = item.status ?? item.state ?? item.stage ?? 'не указан';
    const recipientText = item.recipient ?? item.destination ?? item.city ?? '';
    const details = document.createElement('p');
    details.textContent = recipientText
      ? `Статус: ${statusText} • ${recipientText}`
      : `Статус: ${statusText}`;

    card.append(title, details);
    fragment.append(card);
  });
  list.append(fragment);
  summary.textContent = `Доставок: ${items.length}`;
}
async function loadParcels() {
  if (activeController) {
    activeController.abort('new-request');
  }
  const controller = new AbortController();
  activeController = controller;
  const currentSerial = ++serial;
  let isTimeout = false;
  const timeoutId = setTimeout(() => {
    isTimeout = true;
    controller.abort('timeout');
  }, 2500);
  cancelButton.disabled = false;
  setStatus('Загрузка списка доставок...', 'loading');
  try {
    const selectedMode = modeSelect?.value || 'ok';
    const response = await fetch(`/api/parcels?mode=${encodeURIComponent(selectedMode)}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 503) {
        throw new Error('HTTP_503');
      }
      throw new Error(`HTTP_${response.status}`);
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('INVALID_JSON');
    }
    const items = Array.isArray(data) ? data : data?.items;
    if (!Array.isArray(items)) {
      throw new Error('INVALID_JSON');
    }
    if (currentSerial !== serial) return;
    renderParcels(items);
    setStatus('Данные успешно загружены.', 'success');
  } catch (error) {
    if (currentSerial !== serial) return;
    if (error.name === 'AbortError' || controller.signal.aborted) {
      if (isTimeout) {
        setStatus('Превышено время ожидания ответа (2500 мс).', 'error');
      } else {
        setStatus('Запрос отменён пользователем.', 'warning');
      }
    } else if (error.message === 'HTTP_503') {
      setStatus('Сервис временно недоступен (ошибка 503). Попробуйте позже.', 'error');
    } else if (error.message.startsWith('HTTP_')) {
      setStatus(`Ошибка сервера: ${error.message.replace('HTTP_', '')}.`, 'error');
    } else if (error.message === 'INVALID_JSON') {
      setStatus('Ошибка формата данных: сервер вернул некорректный JSON.', 'error');
    } else {
      setStatus('Сетевая ошибка: проверьте подключение к интернету.', 'error');
    }
  } finally {
    clearTimeout(timeoutId);
    if (currentSerial === serial) {
      activeController = null;
      cancelButton.disabled = true;
    }
  }
}
loadButton.addEventListener('click', loadParcels);
cancelButton.addEventListener('click', () => {
  if (activeController) {
    activeController.abort('manual');
  }
});
