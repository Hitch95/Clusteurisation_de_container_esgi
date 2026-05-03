const API_URL = '';

let token = localStorage.getItem('token');
let currentUser = null;

// --- DOM Elements ---
const loginSection = document.getElementById('login-section');
const tasksSection = document.getElementById('tasks-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const currentUserSpan = document.getElementById('current-user');
const addTaskBtn = document.getElementById('add-task-btn');
const taskFormContainer = document.getElementById('task-form-container');
const taskForm = document.getElementById('task-form');
const formTitle = document.getElementById('form-title');
const cancelBtn = document.getElementById('cancel-btn');
const taskList = document.getElementById('task-list');
const statusFilter = document.getElementById('status-filter');

// --- API Helpers ---
async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// --- Auth ---
function showLogin() {
  loginSection.classList.remove('hidden');
  tasksSection.classList.add('hidden');
}

function showTasks() {
  loginSection.classList.add('hidden');
  tasksSection.classList.remove('hidden');
  currentUserSpan.textContent = currentUser ? currentUser.username : '';
  loadTasks();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    showTasks();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', () => {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  showLogin();
});

// --- Tasks ---
async function loadTasks() {
  try {
    const filter = statusFilter.value;
    const query = filter ? `?status=${filter}` : '';
    const tasks = await apiRequest(`/tasks${query}`);
    renderTasks(tasks);
  } catch (err) {
    if (err.message.includes('token') || err.message.includes('401')) {
      token = null;
      localStorage.removeItem('token');
      showLogin();
    }
    taskList.innerHTML = `<div class="empty-state">Erreur lors du chargement des tâches</div>`;
  }
}

function renderTasks(tasks) {
  if (tasks.length === 0) {
    taskList.innerHTML = `<div class="empty-state">Aucune tâche trouvée. Créez-en une !</div>`;
    return;
  }
  taskList.innerHTML = tasks
    .map(
      (task) => `
    <div class="task-item status-${task.status}">
      <div class="task-info">
        <h4>${escapeHtml(task.title)}</h4>
        <p>${escapeHtml(task.description || '')}</p>
        <div class="task-meta">
          <span class="status-badge ${task.status}">${statusLabel(task.status)}</span>
          <span>Créée le ${new Date(task.created_at).toLocaleDateString('fr-FR')}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="btn btn-edit" onclick="editTask(${task.id}, '${escapeAttr(task.title)}', '${escapeAttr(task.description || '')}', '${task.status}')">Modifier</button>
        <button class="btn btn-danger" onclick="deleteTask(${task.id})">Supprimer</button>
      </div>
    </div>
  `
    )
    .join('');
}

function statusLabel(status) {
  switch (status) {
    case 'todo': return 'À faire';
    case 'in-progress': return 'En cours';
    case 'done': return 'Terminée';
    default: return status;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// --- Task Form ---
addTaskBtn.addEventListener('click', () => {
  document.getElementById('task-id').value = '';
  taskForm.reset();
  formTitle.textContent = 'Nouvelle tâche';
  taskFormContainer.classList.remove('hidden');
});

cancelBtn.addEventListener('click', () => {
  taskFormContainer.classList.add('hidden');
});

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const title = document.getElementById('task-title').value;
  const description = document.getElementById('task-description').value;
  const status = document.getElementById('task-status').value;

  try {
    if (id) {
      await apiRequest(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, description, status }),
      });
    } else {
      await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title, description, status }),
      });
    }
    taskFormContainer.classList.add('hidden');
    loadTasks();
  } catch (err) {
    alert('Erreur : ' + err.message);
  }
});

// eslint-disable-next-line no-unused-vars
function editTask(id, title, description, status) {
  document.getElementById('task-id').value = id;
  document.getElementById('task-title').value = title;
  document.getElementById('task-description').value = description;
  document.getElementById('task-status').value = status;
  formTitle.textContent = 'Modifier la tâche';
  taskFormContainer.classList.remove('hidden');
}

// eslint-disable-next-line no-unused-vars
async function deleteTask(id) {
  if (!confirm('Supprimer cette tâche ?')) return;
  try {
    await apiRequest(`/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
  } catch (err) {
    alert('Erreur : ' + err.message);
  }
}

statusFilter.addEventListener('change', loadTasks);

// --- Init ---
if (token) {
  showTasks();
} else {
  showLogin();
}
