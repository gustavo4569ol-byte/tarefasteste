/* ============================================================================
   TaskMaster PWA - Script Principal
   Gerenciamento de Listas, Sublistas, Tarefas, Kanbans e Armazenamento Local
   ============================================================================ */

// ============================================================================
// Estrutura de Dados e Storage
// ============================================================================

class TaskManager {
  constructor() {
    this.lists = [];
    this.currentListId = null;
    this.currentSublistId = null;
    this.loadFromStorage();
  }

  // Carregar dados do localStorage
  loadFromStorage() {
    const stored = localStorage.getItem('taskManagerData');
    if (stored) {
      try {
        this.lists = JSON.parse(stored);
      } catch (e) {
        console.error('Erro ao carregar dados:', e);
        this.lists = [];
      }
    }
  }

  // Salvar dados no localStorage
  saveToStorage() {
    localStorage.setItem('taskManagerData', JSON.stringify(this.lists));
  }

  // Criar nova lista
  createList(name) {
    const list = {
      id: Date.now().toString(),
      name: name,
      createdAt: new Date().toISOString(),
      sublists: []
    };
    this.lists.push(list);
    this.saveToStorage();
    return list;
  }

  // Obter lista por ID
  getList(listId) {
    return this.lists.find(l => l.id === listId);
  }

  // Atualizar lista
  updateList(listId, name) {
    const list = this.getList(listId);
    if (list) {
      list.name = name;
      this.saveToStorage();
    }
  }

  // Deletar lista
  deleteList(listId) {
    this.lists = this.lists.filter(l => l.id !== listId);
    this.saveToStorage();
  }

  // Criar sublista
  createSublist(listId, name) {
    const list = this.getList(listId);
    if (list) {
      const sublist = {
        id: Date.now().toString(),
        name: name,
        createdAt: new Date().toISOString(),
        tasks: []
      };
      list.sublists.push(sublist);
      this.saveToStorage();
      return sublist;
    }
  }

  // Obter sublista
  getSublist(listId, sublistId) {
    const list = this.getList(listId);
    if (list) {
      return list.sublists.find(s => s.id === sublistId);
    }
  }

  // Atualizar sublista
  updateSublist(listId, sublistId, name) {
    const sublist = this.getSublist(listId, sublistId);
    if (sublist) {
      sublist.name = name;
      this.saveToStorage();
    }
  }

  // Deletar sublista
  deleteSublist(listId, sublistId) {
    const list = this.getList(listId);
    if (list) {
      list.sublists = list.sublists.filter(s => s.id !== sublistId);
      this.saveToStorage();
    }
  }

  // Criar tarefa
  createTask(listId, sublistId, title) {
    const sublist = this.getSublist(listId, sublistId);
    if (sublist) {
      const task = {
        id: Date.now().toString(),
        title: title,
        completed: false,
        flagged: false,
        priority: 'low',
        dueDate: null,
        note: '',
        status: 'todo', // 'todo', 'in-progress', 'done'
        createdAt: new Date().toISOString()
      };
      sublist.tasks.push(task);
      this.saveToStorage();
      return task;
    }
  }

  // Obter tarefa
  getTask(listId, sublistId, taskId) {
    const sublist = this.getSublist(listId, sublistId);
    if (sublist) {
      return sublist.tasks.find(t => t.id === taskId);
    }
  }

  // Atualizar tarefa
  updateTask(listId, sublistId, taskId, updates) {
    const task = this.getTask(listId, sublistId, taskId);
    if (task) {
      Object.assign(task, updates);
      this.saveToStorage();
    }
  }

  // Deletar tarefa
  deleteTask(listId, sublistId, taskId) {
    const sublist = this.getSublist(listId, sublistId);
    if (sublist) {
      sublist.tasks = sublist.tasks.filter(t => t.id !== taskId);
      this.saveToStorage();
    }
  }

  // Obter todas as tarefas ordenadas por prioridade e flag
  getAllTasksSorted() {
    const allTasks = [];
    this.lists.forEach(list => {
      list.sublists.forEach(sublist => {
        sublist.tasks.forEach(task => {
          allTasks.push({
            ...task,
            listId: list.id,
            listName: list.name,
            sublistId: sublist.id,
            sublistName: sublist.name
          });
        });
      });
    });

    // Ordenar: flagged primeiro, depois por prioridade, depois por data
    return allTasks.sort((a, b) => {
      if (a.flagged !== b.flagged) return b.flagged - a.flagged;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }

  // Obter tarefas por sublista ordenadas
  getSublistTasksSorted(listId, sublistId) {
    const sublist = this.getSublist(listId, sublistId);
    if (!sublist) return [];

    const tasks = [...sublist.tasks];
    return tasks.sort((a, b) => {
      if (a.flagged !== b.flagged) return b.flagged - a.flagged;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }

  // Obter tarefas por status (para Kanban 2)
  getTasksByStatus(status) {
    const allTasks = [];
    this.lists.forEach(list => {
      list.sublists.forEach(sublist => {
        sublist.tasks.forEach(task => {
          if (task.status === status) {
            allTasks.push({
              ...task,
              listId: list.id,
              listName: list.name,
              sublistId: sublist.id,
              sublistName: sublist.name
            });
          }
        });
      });
    });

    return allTasks.sort((a, b) => {
      if (a.flagged !== b.flagged) return b.flagged - a.flagged;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}

// ============================================================================
// Inicialização Global
// ============================================================================

const taskManager = new TaskManager();
let currentScreen = 'overview';

// ============================================================================
// Funções de Navegação
// ============================================================================

function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(`${screenName}-screen`);
  if (screen) {
    screen.classList.add('active');
    currentScreen = screenName;
    updateNavigation();
  }
}

function updateNavigation() {
  document.querySelectorAll('.nav-button').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector(`[data-screen="${currentScreen}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
}

// ============================================================================
// Tela 1: Configurações (Listas)
// ============================================================================

function renderSettingsScreen() {
  const container = document.getElementById('settings-content');
  container.innerHTML = '';

  if (taskManager.lists.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">Nenhuma lista criada</div>
        <div class="empty-state-text">Clique no botão abaixo para criar sua primeira lista</div>
      </div>
    `;
  } else {
    taskManager.lists.forEach(list => {
      const sublistCount = list.sublists.length;
      const taskCount = list.sublists.reduce((sum, s) => sum + s.tasks.length, 0);
      const listEl = document.createElement('div');
      listEl.className = 'card';
      listEl.innerHTML = `
        <div class="card-header">
          <div class="card-title">${escapeHtml(list.name)}</div>
          <div class="list-item-actions">
            <button class="btn-icon" onclick="editList('${list.id}')">✏️</button>
            <button class="btn-icon" onclick="deleteList('${list.id}')">🗑️</button>
          </div>
        </div>
        <div class="card-subtitle">${sublistCount} sublista(s) • ${taskCount} tarefa(s)</div>
        <button class="btn-primary mt-md" onclick="openListDetail('${list.id}')">
          Gerenciar Sublistas
        </button>
      `;
      container.appendChild(listEl);
    });
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.style.width = '100%';
  addBtn.style.marginTop = 'var(--spacing-lg)';
  addBtn.textContent = '+ Criar Nova Lista';
  addBtn.onclick = () => showCreateListModal();
  container.appendChild(addBtn);
}

function showCreateListModal() {
  const modal = document.getElementById('list-modal');
  document.getElementById('list-modal-title').textContent = 'Criar Nova Lista';
  document.getElementById('list-input').value = '';
  document.getElementById('list-input').dataset.listId = '';
  document.getElementById('list-modal-overlay').classList.add('active');
}

function saveList() {
  const input = document.getElementById('list-input');
  const name = input.value.trim();
  const listId = input.dataset.listId;

  if (!name) {
    alert('Digite um nome para a lista');
    return;
  }

  if (listId) {
    taskManager.updateList(listId, name);
  } else {
    taskManager.createList(name);
  }

  closeListModal();
  renderSettingsScreen();
}

function editList(listId) {
  const list = taskManager.getList(listId);
  const modal = document.getElementById('list-modal');
  document.getElementById('list-modal-title').textContent = 'Editar Lista';
  document.getElementById('list-input').value = list.name;
  document.getElementById('list-input').dataset.listId = listId;
  document.getElementById('list-modal-overlay').classList.add('active');
}

function deleteList(listId) {
  if (confirm('Tem certeza que deseja deletar esta lista?')) {
    taskManager.deleteList(listId);
    renderSettingsScreen();
  }
}

function closeListModal() {
  document.getElementById('list-modal-overlay').classList.remove('active');
}

function openListDetail(listId) {
  taskManager.currentListId = listId;
  renderListDetailScreen();
  showScreen('list-detail');
}

function renderListDetailScreen() {
  const list = taskManager.getList(taskManager.currentListId);
  if (!list) return;

  document.getElementById('list-detail-title').textContent = list.name;
  const container = document.getElementById('list-detail-content');
  container.innerHTML = '';

  if (list.sublists.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📑</div>
        <div class="empty-state-title">Nenhuma sublista</div>
        <div class="empty-state-text">Crie sua primeira sublista para organizar tarefas</div>
      </div>
    `;
  } else {
    list.sublists.forEach(sublist => {
      const taskCount = sublist.tasks.length;
      const sublistEl = document.createElement('div');
      sublistEl.className = 'card';
      sublistEl.innerHTML = `
        <div class="card-header">
          <div class="card-title">${escapeHtml(sublist.name)}</div>
          <div class="list-item-actions">
            <button class="btn-icon" onclick="editSublist('${taskManager.currentListId}', '${sublist.id}')">✏️</button>
            <button class="btn-icon" onclick="deleteSublist('${taskManager.currentListId}', '${sublist.id}')">🗑️</button>
          </div>
        </div>
        <div class="card-subtitle">${taskCount} tarefa(s)</div>
        <button class="btn-primary mt-md" onclick="openSublistTasks('${taskManager.currentListId}', '${sublist.id}')">
          Ver Tarefas
        </button>
      `;
      container.appendChild(sublistEl);
    });
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.style.width = '100%';
  addBtn.style.marginTop = 'var(--spacing-lg)';
  addBtn.textContent = '+ Criar Sublista';
  addBtn.onclick = () => showCreateSublistModal(taskManager.currentListId);
  container.appendChild(addBtn);
}

function showCreateSublistModal(listId) {
  const modal = document.getElementById('sublist-modal');
  document.getElementById('sublist-modal-title').textContent = 'Criar Sublista';
  document.getElementById('sublist-input').value = '';
  document.getElementById('sublist-input').dataset.sublistId = '';
  document.getElementById('sublist-modal-overlay').classList.add('active');
}

function saveSublist() {
  const input = document.getElementById('sublist-input');
  const name = input.value.trim();
  const sublistId = input.dataset.sublistId;

  if (!name) {
    alert('Digite um nome para a sublista');
    return;
  }

  if (sublistId) {
    taskManager.updateSublist(taskManager.currentListId, sublistId, name);
  } else {
    taskManager.createSublist(taskManager.currentListId, name);
  }

  closeSublistModal();
  renderListDetailScreen();
}

function editSublist(listId, sublistId) {
  const sublist = taskManager.getSublist(listId, sublistId);
  document.getElementById('sublist-modal-title').textContent = 'Editar Sublista';
  document.getElementById('sublist-input').value = sublist.name;
  document.getElementById('sublist-input').dataset.sublistId = sublistId;
  document.getElementById('sublist-modal-overlay').classList.add('active');
}

function deleteSublist(listId, sublistId) {
  if (confirm('Tem certeza que deseja deletar esta sublista?')) {
    taskManager.deleteSublist(listId, sublistId);
    renderListDetailScreen();
  }
}

function closeSublistModal() {
  document.getElementById('sublist-modal-overlay').classList.remove('active');
}

function openSublistTasks(listId, sublistId) {
  taskManager.currentListId = listId;
  taskManager.currentSublistId = sublistId;
  renderSublistTasksScreen();
  showScreen('sublist-tasks');
}

function renderSublistTasksScreen() {
  const list = taskManager.getList(taskManager.currentListId);
  const sublist = taskManager.getSublist(taskManager.currentListId, taskManager.currentSublistId);
  if (!list || !sublist) return;

  document.getElementById('sublist-tasks-title').textContent = sublist.name;
  const container = document.getElementById('sublist-tasks-content');
  container.innerHTML = '';

  const tasks = taskManager.getSublistTasksSorted(taskManager.currentListId, taskManager.currentSublistId);

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✓</div>
        <div class="empty-state-title">Nenhuma tarefa</div>
        <div class="empty-state-text">Clique no botão abaixo para adicionar sua primeira tarefa</div>
      </div>
    `;
  } else {
    tasks.forEach(task => {
      const taskEl = createTaskElement(task, taskManager.currentListId, taskManager.currentSublistId);
      container.appendChild(taskEl);
    });
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.style.width = '100%';
  addBtn.style.marginTop = 'var(--spacing-lg)';
  addBtn.textContent = '+ Adicionar Tarefa';
  addBtn.onclick = () => showCreateTaskModal(taskManager.currentListId, taskManager.currentSublistId);
  container.appendChild(addBtn);
}

function createTaskElement(task, listId, sublistId) {
  const taskEl = document.createElement('div');
  taskEl.className = `task-item ${task.completed ? 'completed' : ''}`;
  if (task.priority === 'high') {
    taskEl.style.borderLeftColor = 'var(--color-priority-high)';
  } else if (task.priority === 'medium') {
    taskEl.style.borderLeftColor = 'var(--color-priority-medium)';
  } else {
    taskEl.style.borderLeftColor = 'var(--color-priority-low)';
  }

  let metaHtml = '';
  if (task.flagged) {
    metaHtml += '<span class="task-flagged">🚩 Sinalizada</span>';
  }
  if (task.priority !== 'low') {
    const priorityLabel = task.priority === 'high' ? 'Alta' : 'Média';
    metaHtml += `<span class="task-priority ${task.priority}">${priorityLabel}</span>`;
  }
  if (task.dueDate) {
    metaHtml += `<span class="task-date">📅 ${formatDate(task.dueDate)}</span>`;
  }
  if (task.note) {
    metaHtml += `<span class="task-note-icon" onclick="showTaskNote('${task.id}', '${listId}', '${sublistId}')">📝</span>`;
  }

  taskEl.innerHTML = `
    <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTaskComplete('${listId}', '${sublistId}', '${task.id}')">
      ${task.completed ? '✓' : ''}
    </div>
    <div class="task-content">
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-meta">${metaHtml}</div>
    </div>
    <div class="task-actions">
      <button class="btn-icon" onclick="editTask('${listId}', '${sublistId}', '${task.id}')">✏️</button>
      <button class="btn-icon" onclick="deleteTask('${listId}', '${sublistId}', '${task.id}')">🗑️</button>
    </div>
  `;
  return taskEl;
}

function showCreateTaskModal(listId, sublistId) {
  document.getElementById('task-modal-title').textContent = 'Criar Tarefa';
  document.getElementById('task-input-title').value = '';
  document.getElementById('task-input-priority').value = 'low';
  document.getElementById('task-input-date').value = '';
  document.getElementById('task-input-note').value = '';
  document.getElementById('task-input-flagged').checked = false;
  document.getElementById('task-input-status').value = 'todo';
  document.getElementById('task-input-id').value = '';
  document.getElementById('task-modal-overlay').classList.add('active');
}

function saveTask() {
  const title = document.getElementById('task-input-title').value.trim();
  const priority = document.getElementById('task-input-priority').value;
  const dueDate = document.getElementById('task-input-date').value;
  const note = document.getElementById('task-input-note').value;
  const flagged = document.getElementById('task-input-flagged').checked;
  const status = document.getElementById('task-input-status').value;
  const taskId = document.getElementById('task-input-id').value;

  if (!title) {
    alert('Digite um título para a tarefa');
    return;
  }

  if (taskId) {
    taskManager.updateTask(taskManager.currentListId, taskManager.currentSublistId, taskId, {
      title, priority, dueDate, note, flagged, status
    });
  } else {
    taskManager.createTask(taskManager.currentListId, taskManager.currentSublistId, title);
    const sublist = taskManager.getSublist(taskManager.currentListId, taskManager.currentSublistId);
    const newTaskId = sublist.tasks[sublist.tasks.length - 1].id;
    taskManager.updateTask(taskManager.currentListId, taskManager.currentSublistId, newTaskId, { priority, dueDate, note, flagged, status });
  }

  closeTaskModal();
  
  // Renderizar a tela correta baseado na tela atual
  if (currentScreen === 'overview') {
    renderOverviewScreen();
  } else if (currentScreen === 'sublist-tasks') {
    renderSublistTasksScreen();
  }
}

function editTask(listId, sublistId, taskId) {
  const task = taskManager.getTask(listId, sublistId, taskId);
  document.getElementById('task-modal-title').textContent = 'Editar Tarefa';
  document.getElementById('task-input-title').value = task.title;
  document.getElementById('task-input-priority').value = task.priority;
  document.getElementById('task-input-date').value = task.dueDate || '';
  document.getElementById('task-input-note').value = task.note;
  document.getElementById('task-input-flagged').checked = task.flagged;
  document.getElementById('task-input-status').value = task.status;
  document.getElementById('task-input-id').value = taskId;
  document.getElementById('task-modal-overlay').classList.add('active');
}

function deleteTask(listId, sublistId, taskId) {
  if (confirm('Tem certeza que deseja deletar esta tarefa?')) {
    taskManager.deleteTask(listId, sublistId, taskId);
    renderSublistTasksScreen();
  }
}

function toggleTaskComplete(listId, sublistId, taskId) {
  const task = taskManager.getTask(listId, sublistId, taskId);
  const newCompleted = !task.completed;
  const newStatus = newCompleted ? 'done' : 'todo';
  taskManager.updateTask(listId, sublistId, taskId, { completed: newCompleted, status: newStatus });
  
  // Renderizar a tela correta baseado na tela atual
  if (currentScreen === 'overview') {
    renderOverviewScreen();
  } else if (currentScreen === 'sublist-tasks') {
    renderSublistTasksScreen();
  } else if (currentScreen === 'notebook') {
    renderNotebookScreen();
  } else if (currentScreen === 'completed') {
    renderCompletedScreen();
  }
}

function closeTaskModal() {
  document.getElementById('task-modal-overlay').classList.remove('active');
}

function showTaskNote(taskId, listId, sublistId) {
  const task = taskManager.getTask(listId, sublistId, taskId);
  alert(`Nota:\n\n${task.note || 'Sem nota'}`);
}

// ============================================================================
// Tela 2: Visão Geral (Foguete)
// ============================================================================

function renderOverviewScreen() {
  const container = document.getElementById('overview-content');
  container.innerHTML = '';

  if (taskManager.lists.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🚀</div>
        <div class="empty-state-title">Comece agora</div>
        <div class="empty-state-text">Crie sua primeira lista para começar a gerenciar tarefas</div>
      </div>
    `;
    return;
  }

  taskManager.lists.forEach(list => {
    const listDiv = document.createElement('div');
    listDiv.className = 'card';
    listDiv.innerHTML = `<div class="card-title">${escapeHtml(list.name)}</div>`;

    list.sublists.forEach(sublist => {
      const sublistDiv = document.createElement('div');
      sublistDiv.style.marginTop = 'var(--spacing-md)';
      sublistDiv.innerHTML = `
        <div style="font-weight: 500; margin-bottom: var(--spacing-sm); color: var(--color-gray-dark);">
          ${escapeHtml(sublist.name)}
        </div>
      `;

      // Filtrar apenas tarefas que não estão concluídas
      const tasks = taskManager.getSublistTasksSorted(list.id, sublist.id).filter(t => t.status !== 'done');
      if (tasks.length === 0) {
        sublistDiv.innerHTML += '<div class="text-muted" style="font-size: var(--font-size-caption);">Sem tarefas</div>';
      } else {
        tasks.forEach(task => {
          const taskDiv = document.createElement('div');
          taskDiv.className = 'task-item';
          taskDiv.style.marginBottom = 'var(--spacing-sm)';
          taskDiv.style.cursor = 'pointer';
          taskDiv.onclick = () => editTask(list.id, sublist.id, task.id);

          let metaHtml = '';
          if (task.flagged) {
            metaHtml += '<span class="task-flagged">🚩</span>';
          }
          if (task.priority !== 'low') {
            const priorityLabel = task.priority === 'high' ? '🔴' : '🟡';
            metaHtml += `<span>${priorityLabel}</span>`;
          }
          if (task.note) {
            metaHtml += `<span class="task-note-icon" onclick="event.stopPropagation(); showTaskNote('${task.id}', '${list.id}', '${sublist.id}')">📝</span>`;
          }

          taskDiv.innerHTML = `
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="event.stopPropagation(); toggleTaskComplete('${list.id}', '${sublist.id}', '${task.id}')">
              ${task.completed ? '✓' : ''}
            </div>
            <div class="task-content">
              <div class="task-title">${escapeHtml(task.title)}</div>
              <div class="task-meta">${metaHtml}</div>
            </div>
          `;
          sublistDiv.appendChild(taskDiv);
        });
      }

      const addBtn = document.createElement('button');
      addBtn.className = 'btn-primary btn-small';
      addBtn.style.marginTop = 'var(--spacing-sm)';
      addBtn.textContent = '+ Adicionar';
      addBtn.onclick = () => {
        taskManager.currentListId = list.id;
        taskManager.currentSublistId = sublist.id;
        showCreateTaskModal(list.id, sublist.id);
      };
      sublistDiv.appendChild(addBtn);

      listDiv.appendChild(sublistDiv);
    });

    container.appendChild(listDiv);
  });
}

// ============================================================================
// Tela 3: Kanban 1 (Por Sublista)
// ============================================================================

function renderKanban1Screen() {
  const container = document.getElementById('kanban1-content');
  container.innerHTML = '';
  container.style.display = 'grid';
  container.style.gridTemplateColumns = '1fr 1fr';
  container.style.gap = 'var(--spacing-md)';
  container.style.padding = 'var(--spacing-md)';

  if (taskManager.lists.length === 0) {
    container.style.gridColumn = '1 / -1';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-title">Sem sublistas</div>
        <div class="empty-state-text">Crie sublistas para visualizar no Kanban</div>
      </div>
    `;
    return;
  }

  taskManager.lists.forEach(list => {
    list.sublists.forEach(sublist => {
      const column = document.createElement('div');
      column.className = 'kanban-column';
      column.style.minHeight = '500px';
      column.style.overflowY = 'auto';

      const header = document.createElement('div');
      header.className = 'kanban-column-header';
      header.innerHTML = `
        ${escapeHtml(sublist.name)}
        <span class="kanban-column-count">(${sublist.tasks.length})</span>
      `;
      column.appendChild(header);

      const tasks = taskManager.getSublistTasksSorted(list.id, sublist.id);
      tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.innerHTML = `
          <div style="font-weight: 500; margin-bottom: 4px;">${escapeHtml(task.title)}</div>
          <div style="font-size: var(--font-size-caption); color: var(--color-gray-dark); margin-bottom: 8px;">
            ${escapeHtml(list.name)}
          </div>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${task.flagged ? '<span class="badge badge-flagged">🚩 Sinalizada</span>' : ''}
            ${task.priority !== 'low' ? `<span class="badge task-priority ${task.priority}">${task.priority === 'high' ? 'Alta' : 'Média'}</span>` : ''}
            ${task.completed ? '<span class="badge badge-completed">✓ Concluída</span>' : ''}
          </div>
        `;
        card.onclick = () => editTask(list.id, sublist.id, task.id);
        column.appendChild(card);
      });

      container.appendChild(column);
    });
  });
}

// ============================================================================
// Tela 4: Kanban 2 (Por Status)
// ============================================================================

function renderKanban2Screen() {
  const container = document.getElementById('kanban2-content');
  container.innerHTML = '';
  container.style.display = 'grid';
  container.style.gridTemplateColumns = '1fr 1fr';
  container.style.gap = 'var(--spacing-md)';
  container.style.padding = 'var(--spacing-md)';

  const statuses = ['todo', 'in-progress', 'done'];
  const statusLabels = { 'todo': 'A Fazer', 'in-progress': 'Em Andamento', 'done': 'Concluída' };

  statuses.forEach(status => {
    const column = document.createElement('div');
    column.className = 'kanban-column';
    column.style.minHeight = '500px';
    column.style.overflowY = 'auto';

    const header = document.createElement('div');
    header.className = 'kanban-column-header';
    const tasks = taskManager.getTasksByStatus(status);
    header.innerHTML = `
      ${statusLabels[status]}
      <span class="kanban-column-count">(${tasks.length})</span>
    `;
    column.appendChild(header);

    tasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'kanban-card';
      card.innerHTML = `
        <div style="font-weight: 500; margin-bottom: 4px;">${escapeHtml(task.title)}</div>
        <div style="font-size: var(--font-size-caption); color: var(--color-gray-dark); margin-bottom: 8px;">
          ${escapeHtml(task.listName)} • ${escapeHtml(task.sublistName)}
        </div>
        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
          ${task.flagged ? '<span class="badge badge-flagged">🚩 Sinalizada</span>' : ''}
          ${task.priority !== 'low' ? `<span class="badge task-priority ${task.priority}">${task.priority === 'high' ? 'Alta' : 'Média'}</span>` : ''}
        </div>
      `;
      card.onclick = () => editTask(task.listId, task.sublistId, task.id);
      column.appendChild(card);
    });

    container.appendChild(column);
  });
}

// ============================================================================
// Tela 5: Caderno (Todas as Tarefas)
// ============================================================================

function renderNotebookScreen() {
  const container = document.getElementById('notebook-content');
  container.innerHTML = '';

  const allTasks = taskManager.getAllTasksSorted().filter(t => t.status !== 'done');

  if (allTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📔</div>
        <div class="empty-state-title">Nenhuma tarefa</div>
        <div class="empty-state-text">Crie tarefas para visualizá-las aqui</div>
      </div>
    `;
    return;
  }

  allTasks.forEach(task => {
    const taskEl = document.createElement('div');
    taskEl.className = `task-item ${task.completed ? 'completed' : ''}`;
    if (task.priority === 'high') {
      taskEl.style.borderLeftColor = 'var(--color-priority-high)';
    } else if (task.priority === 'medium') {
      taskEl.style.borderLeftColor = 'var(--color-priority-medium)';
    } else {
      taskEl.style.borderLeftColor = 'var(--color-priority-low)';
    }

    let metaHtml = '';
    if (task.flagged) {
      metaHtml += '<span class="task-flagged">🚩 Sinalizada</span>';
    }
    if (task.priority !== 'low') {
      const priorityLabel = task.priority === 'high' ? 'Alta' : 'Média';
      metaHtml += `<span class="task-priority ${task.priority}">${priorityLabel}</span>`;
    }
    if (task.dueDate) {
      metaHtml += `<span class="task-date">📅 ${formatDate(task.dueDate)}</span>`;
    }
    metaHtml += `<span class="text-small">${escapeHtml(task.listName)} • ${escapeHtml(task.sublistName)}</span>`;
    if (task.note) {
      metaHtml += `<span class="task-note-icon" onclick="showTaskNote('${task.id}', '${task.listId}', '${task.sublistId}')">📝</span>`;
    }

    taskEl.innerHTML = `
      <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTaskComplete('${task.listId}', '${task.sublistId}', '${task.id}')">
        ${task.completed ? '✓' : ''}
      </div>
      <div class="task-content">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">${metaHtml}</div>
      </div>
      <div class="task-actions">
        <button class="btn-icon" onclick="editTask('${task.listId}', '${task.sublistId}', '${task.id}')">✏️</button>
        <button class="btn-icon" onclick="deleteTask('${task.listId}', '${task.sublistId}', '${task.id}')">🗑️</button>
      </div>
    `;
    container.appendChild(taskEl);
  });
}

// ============================================================================
// Tela 6: Concluídas (Tarefas Concluídas)
// ============================================================================

function renderCompletedScreen() {
  const container = document.getElementById('completed-content');
  container.innerHTML = '';

  const completedTasks = taskManager.getAllTasksSorted().filter(t => t.status === 'done');

  if (completedTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-title">Nenhuma tarefa concluída</div>
        <div class="empty-state-text">Complete tarefas para vê-las aqui</div>
      </div>
    `;
    return;
  }

  completedTasks.forEach(task => {
    const taskEl = document.createElement('div');
    taskEl.className = 'task-item completed';
    taskEl.style.borderLeftColor = 'var(--color-success)';

    let metaHtml = '';
    if (task.flagged) {
      metaHtml += '<span class="task-flagged">🚩 Sinalizada</span>';
    }
    if (task.priority !== 'low') {
      const priorityLabel = task.priority === 'high' ? 'Alta' : 'Média';
      metaHtml += `<span class="task-priority ${task.priority}">${priorityLabel}</span>`;
    }
    if (task.dueDate) {
      metaHtml += `<span class="task-date">📅 ${formatDate(task.dueDate)}</span>`;
    }
    metaHtml += `<span class="text-small">${escapeHtml(task.listName)} • ${escapeHtml(task.sublistName)}</span>`;
    if (task.note) {
      metaHtml += `<span class="task-note-icon" onclick="showTaskNote('${task.id}', '${task.listId}', '${task.sublistId}')">📝</span>`;
    }

    taskEl.innerHTML = `
      <div class="task-checkbox checked" onclick="toggleTaskComplete('${task.listId}', '${task.sublistId}', '${task.id}')">
        ✓
      </div>
      <div class="task-content">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">${metaHtml}</div>
      </div>
      <div class="task-actions">
        <button class="btn-icon" onclick="deleteTask('${task.listId}', '${task.sublistId}', '${task.id}')">🗑️</button>
      </div>
    `;
    container.appendChild(taskEl);
  });
}

// ============================================================================
// Utilitários
// ============================================================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function goBack() {
  if (currentScreen === 'list-detail') {
    showScreen('settings');
    renderSettingsScreen();
  } else if (currentScreen === 'sublist-tasks') {
    showScreen('list-detail');
    renderListDetailScreen();
  }
}

// ============================================================================
// Inicialização
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Configurar event listeners dos botões de navegação
  document.querySelectorAll('.nav-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      if (screen === 'settings') {
        renderSettingsScreen();
      } else if (screen === 'overview') {
        renderOverviewScreen();
      } else if (screen === 'kanban1') {
        renderKanban1Screen();
      } else if (screen === 'kanban2') {
        renderKanban2Screen();
      } else if (screen === 'notebook') {
        renderNotebookScreen();
      } else if (screen === 'completed') {
        renderCompletedScreen();
      }
      showScreen(screen);
    });
  });

  // Configurar event listeners dos modais
  document.getElementById('list-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeListModal();
  });
  document.getElementById('sublist-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSublistModal();
  });
  document.getElementById('task-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeTaskModal();
  });

  // Botões de salvar
  document.getElementById('list-save-btn').addEventListener('click', saveList);
  document.getElementById('sublist-save-btn').addEventListener('click', saveSublist);
  document.getElementById('task-save-btn').addEventListener('click', saveTask);

  // Botões de fechar
  document.getElementById('list-close-btn').addEventListener('click', closeListModal);
  document.getElementById('list-close-btn-footer').addEventListener('click', closeListModal);
  document.getElementById('sublist-close-btn').addEventListener('click', closeSublistModal);
  document.getElementById('sublist-close-btn-footer').addEventListener('click', closeSublistModal);
  document.getElementById('task-close-btn').addEventListener('click', closeTaskModal);
  document.getElementById('task-close-btn-footer').addEventListener('click', closeTaskModal);

  // Botões de voltar
  document.getElementById('back-btn').addEventListener('click', goBack);
  const backBtnSublist = document.getElementById('back-btn-sublist');
  if (backBtnSublist) {
    backBtnSublist.addEventListener('click', goBack);
  }

  // Mostrar tela inicial
  showScreen('overview');
  renderOverviewScreen();
});


