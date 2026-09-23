'use strict';

// Первый этап: сохраняем идею локально. AI и сервер ещё не подключены.
const form = document.querySelector('#idea-form');
const titleInput = document.querySelector('#task-title');
const descriptionInput = document.querySelector('#task-description');
const statusMessage = document.querySelector('#form-status');
const STORAGE_KEY = 'ai-sana-starter-idea';

try {
  const draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (draft && typeof draft.title === 'string' && typeof draft.description === 'string') {
    titleInput.value = draft.title;
    descriptionInput.value = draft.description;
    statusMessage.textContent = 'Ваш сохранённый черновик восстановлен.';
  }
} catch {
  statusMessage.textContent = 'Локальное сохранение недоступно или черновик повреждён.';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();

  if (!title || description.length < 10) {
    statusMessage.textContent = 'Добавьте название и описание минимум из 10 символов.';
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, description }));
    statusMessage.textContent = 'Идея сохранена в этом браузере. Это первый шаг к вашей задаче.';
  } catch {
    statusMessage.textContent = 'Не удалось сохранить идею. Скопируйте текст, чтобы не потерять его.';
  }
});
