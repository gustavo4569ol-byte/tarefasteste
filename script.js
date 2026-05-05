/* ============================================================================
   TaskMaster PWA - Script Principal
   Gerenciamento de Listas, Sublistas, Tarefas, Kanbans, Calendário e Armazenamento Local
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
        dueTime: null, // Novo campo de horário
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
      // Sincronizar status se completed mudar
      if (updates.hasOwnProperty('completed')) {
        updates.status = updates.completed ? 'done' : (task.status === 'done' ? 'todo' : task.status);
      }
      // Sincronizar completed se status mudar
      if (updates.hasOwnProperty('status')) {
        updates.completed = (updates.status === 'done');
      }
      
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

  // Reordenar tarefa dentro da mesma faixa de prioridade
  reorderTask(listId, sublistId, taskId, newIndex) {
    const sublist = this.getSublist(listId, sublistId);
    if (!sublist) return;

    const taskIndex = sublist.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = sublist.tasks[taskIndex];
    const sortedTasks = this.sortTasks(sublist.tasks);
    const taskPositionInSorted = sortedTasks.findIndex(t => t.id === taskId);

    // Encontrar os limites da faixa de prioridade
    const getPriorityGroup = (t) => {
      if (t.flagged) return 'flagged';
      return t.priority;
    };

    const taskGroup = getPriorityGroup(task);
    let groupStart = 0;
    let groupEnd = sortedTasks.length;

    for (let i = 0; i < sortedTasks.length; i++) {
      if (getPriorityGroup(sortedTasks[i]) === taskGroup) {
        if (groupStart === 0 && i > 0) groupStart = i;
        groupEnd = i + 1;
      } else if (groupStart > 0) {
        break;
      }
    }

    // Limitar o novo índice aos limites do grupo
    const constrainedIndex = Math.max(groupStart, Math.min(newIndex, groupEnd - 1));

    // Remover a tarefa da posição atual
    sublist.tasks.splice(taskIndex, 1);

    // Encontrar a posição correta na lista original
    const newSortedTasks = this.sortTasks(sublist.tasks);
    const targetTaskInSorted = newSortedTasks[constrainedIndex];

    if (targetTaskInSorted) {
      const targetIndexInOriginal = sublist.tasks.findIndex(t => t.id === targetTaskInSorted.id);
      sublist.tasks.splice(targetIndexInOriginal, 0, task);
    } else {
      sublist.tasks.push(task);
    }

    this.saveToStorage();
  }

  // Obter todas as tarefas ordenadas por prioridade e flag (Apenas ativas)
  getAllActiveTasksSorted() {
    const allTasks = [];
    this.lists.forEach(list => {
      list.sublists.forEach(sublist => {
        sublist.tasks.forEach(task => {
          if (task.status !== 'done' && !task.completed) {
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

    return this.sortTasks(allTasks);
  }

  // Obter todas as tarefas concluídas
  getAllCompletedTasks() {
    const completedTasks = [];
    this.lists.forEach(list => {
      list.sublists.forEach(sublist => {
        sublist.tasks.forEach(task => {
          if (task.status === 'done' || task.completed) {
            completedTasks.push({
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
    return completedTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // Obter tarefas por sublista ordenadas (Apenas ativas)
  getSublistTasksSorted(listId, sublistId) {
    const sublist = this.getSublist(listId, sublistId);
    if (!sublist) return [];

    const tasks = sublist.tasks.filter(t => t.status !== 'done' && !t.completed);
    return this.sortTasks(tasks);
  }

  // Utilitário de ordenação
  sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
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

    return this.sortTasks(allTasks);
  }

  // Obter tarefas de um dia específico para o calendário
  getTasksByDate(dateStr) {
    const allTasks = [];
    this.lists.forEach(list => {
      list.sublists.forEach(sublist => {
        sublist.tasks.forEach(task => {
          if (task.dueDate === dateStr && task.status !== 'done' && !task.completed) {
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
    return allTasks;
  }
}

// ============================================================================
// Drag and Drop System - VERSÃO SIMPLIFICADA
// ============================================================================

function setupSimpleDragAndDrop() {
  let draggedElement = null;
  let draggedTaskData = null;
  
  document.addEventListener('dragstart', function(e) {
    const taskItem = e.target.closest('.task-item, .kanban-card, .calendar-task-item, .calendar-week-task-item');
    if (!taskItem) return;
    
    draggedElement = taskItem;
    draggedTaskData = {
      taskId: taskItem.dataset.taskId,
      listId: taskItem.dataset.listId,
      sublistId: taskItem.dataset.sublistId
    };
    
    taskItem.style.opacity = '0.5';
    taskItem.style.backgroundColor = '#f0f0f0';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', taskItem.innerHTML);
  }, true);
  
  document.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const taskItem = e.target.closest('.task-item, .kanban-card, .calendar-task-item, .calendar-week-task-item');
    if (!taskItem || taskItem === draggedElement) return;
    
    const rect = taskItem.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    
    taskItem.style.borderTop = e.clientY < midpoint ? '3px solid #FF6B35' : 'none';
    taskItem.style.borderBottom = e.clientY >= midpoint ? '3px solid #FF6B35' : 'none';
  }, true);
  
  document.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const targetItem = e.target.closest('.task-item, .kanban-card, .calendar-task-item, .calendar-week-task-item');
    if (!targetItem || !draggedElement || targetItem === draggedElement) return;
    
    if (draggedTaskData.listId === targetItem.dataset.listId && 
        draggedTaskData.sublistId === targetItem.dataset.sublistId) {
      
      const parent = draggedElement.parentNode;
      const targetParent = targetItem.parentNode;
      
      if (parent === targetParent) {
        const rect = targetItem.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        if (e.clientY < midpoint) {
          targetItem.parentNode.insertBefore(draggedElement, targetItem);
        } else {
          targetItem.parentNode.insertBefore(draggedElement, targetItem.nextSibling);
        }
        
        const sublist = taskManager.getSublist(draggedTaskData.listId, draggedTaskData.sublistId);
        if (sublist) {
          const sortedTasks = taskManager.sortTasks(sublist.tasks);
          const targetIndex = sortedTasks.findIndex(t => t.id === targetItem.dataset.taskId);
          
          if (targetIndex !== -1) {
            taskManager.reorderTask(draggedTaskData.listId, draggedTaskData.sublistId, draggedTaskData.taskId, targetIndex);
          }
        }
      }
    }
    
    document.querySelectorAll('.task-item, .kanban-card, .calendar-task-item, .calendar-week-task-item').forEach(item => {
      item.style.borderTop = 'none';
      item.style.borderBottom = 'none';
    });
  }, true);
  
  document.addEventListener('dragend', function(e) {
    if (draggedElement) {
      draggedElement.style.opacity = '1';
      draggedElement.style.backgroundColor = '';
    }
    
    document.querySelectorAll('.task-item, .kanban-card, .calendar-task-item, .calendar-week-task-item').forEach(item => {
      item.style.borderTop = 'none';
      item.style.borderBottom = 'none';
    });
    
    draggedElement = null;
    draggedTaskData = null;
  }, true);
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
  addBtn.onclick = showCreateListModal;
  container.appendChild(addBtn);
}

function showCreateListModal() {
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
        <div class="empty-state-title">Nenhuma tarefa ativa</div>
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
  addBtn.onclick = () => {
    taskManager.currentListId = list.id;
    taskManager.currentSublistId = sublist.id;
    showCreateTaskModal(list.id, sublist.id);
  };
  container.appendChild(addBtn);
}

function createTaskElement(task, listId, sublistId) {
  const taskEl = document.createElement('div');
  taskEl.className = `task-item ${task.completed ? 'completed' : ''}`;
  taskEl.draggable = true;
  taskEl.dataset.taskId = task.id;
  taskEl.dataset.listId = listId;
  taskEl.dataset.sublistId = sublistId;
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
    metaHtml += `<span class="task-date">📅 ${formatDate(task.dueDate)}`;
    if (task.dueTime) {
      metaHtml += ` ${task.dueTime}`;
    }
    metaHtml += `</span>`;
  }
  if (task.note) {
    metaHtml += `<span class="task-note-icon" onclick="event.stopPropagation(); showTaskNote('${task.id}', '${listId}', '${sublistId}')">📝</span>`;
  }

  taskEl.innerHTML = `
    <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="event.stopPropagation(); toggleTaskComplete('${listId}', '${sublistId}', '${task.id}')">
      ${task.completed ? '✓' : ''}
    </div>
    <div class="task-content" onclick="editTask('${listId}', '${sublistId}', '${task.id}')">
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
  taskManager.currentListId = listId;
  taskManager.currentSublistId = sublistId;
  document.getElementById('task-modal-title').textContent = 'Criar Tarefa';
  document.getElementById('task-input-title').value = '';
  document.getElementById('task-input-priority').value = 'low';
  document.getElementById('task-input-date').value = '';
  document.getElementById('task-input-time').value = '';
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
  const dueTime = document.getElementById('task-input-time').value;
  const note = document.getElementById('task-input-note').value;
  const flagged = document.getElementById('task-input-flagged').checked;
  const status = document.getElementById('task-input-status').value;
  const taskId = document.getElementById('task-input-id').value;

  if (!title) {
    alert('Digite um título para a tarefa');
    return;
  }

  const updates = {
    title: title,
    priority: priority,
    dueDate: dueDate,
    dueTime: dueTime,
    note: note,
    flagged: flagged,
    status: status
  };

  if (taskId) {
    taskManager.updateTask(taskManager.currentListId, taskManager.currentSublistId, taskId, updates);
  } else {
    taskManager.createTask(taskManager.currentListId, taskManager.currentSublistId, title);
    const sublist = taskManager.getSublist(taskManager.currentListId, taskManager.currentSublistId);
    const newTask = sublist.tasks[sublist.tasks.length - 1];
    taskManager.updateTask(taskManager.currentListId, taskManager.currentSublistId, newTask.id, updates);
  }

  closeTaskModal();
  refreshCurrentScreen();
}

function refreshCurrentScreen() {
  if (currentScreen === 'overview') renderOverviewScreen();
  else if (currentScreen === 'kanban1') renderKanban1Screen();
  else if (currentScreen === 'kanban2') renderKanban2Screen();
  else if (currentScreen === 'notebook') renderNotebookScreen();
  else if (currentScreen === 'completed') renderCompletedScreen();
  else if (currentScreen === 'calendar') renderCalendarScreen();
  else if (currentScreen === 'sublist-tasks') renderSublistTasksScreen();
}

function editTask(listId, sublistId, taskId) {
  taskManager.currentListId = listId;
  taskManager.currentSublistId = sublistId;
  const task = taskManager.getTask(listId, sublistId, taskId);
  document.getElementById('task-modal-title').textContent = 'Editar Tarefa';
  document.getElementById('task-input-title').value = task.title;
  document.getElementById('task-input-priority').value = task.priority;
  document.getElementById('task-input-date').value = task.dueDate || '';
  document.getElementById('task-input-time').value = task.dueTime || '';
  document.getElementById('task-input-note').value = task.note;
  document.getElementById('task-input-flagged').checked = task.flagged;
  document.getElementById('task-input-status').value = task.status;
  document.getElementById('task-input-id').value = taskId;
  document.getElementById('task-modal-overlay').classList.add('active');
}

function deleteTask(listId, sublistId, taskId) {
  if (confirm('Tem certeza que deseja deletar esta tarefa?')) {
    taskManager.deleteTask(listId, sublistId, taskId);
    refreshCurrentScreen();
  }
}

function toggleTaskComplete(listId, sublistId, taskId) {
  const task = taskManager.getTask(listId, sublistId, taskId);
  taskManager.updateTask(listId, sublistId, taskId, { completed: !task.completed });
  refreshCurrentScreen();
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

    // Verificar se a lista não tem sublistas
    if (list.sublists.length === 0) {
      const notificationDiv = document.createElement('div');
      notificationDiv.style.marginTop = 'var(--spacing-md)';
      notificationDiv.innerHTML = `
        <div style="background-color: var(--color-gray-light); border-left: 4px solid var(--color-warning); border-radius: var(--radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-md);">
          <div style="font-weight: 500; margin-bottom: var(--spacing-sm); color: var(--color-black);">⚠️ Nenhuma sublista criada</div>
          <div style="font-size: var(--font-size-caption); color: var(--color-gray-dark); margin-bottom: var(--spacing-md);">Para adicionar tarefas aqui, volte pro menu <strong>Config</strong> (⚙️) e adicione na lista uma sublista clicando em <strong>Gerenciar Sublistas</strong></div>
        </div>
      `;
      listDiv.appendChild(notificationDiv);
    }

    list.sublists.forEach(sublist => {
      const sublistDiv = document.createElement('div');
      sublistDiv.style.marginTop = 'var(--spacing-md)';
      sublistDiv.innerHTML = `
        <div style="font-weight: 500; margin-bottom: var(--spacing-sm); color: var(--color-gray-dark);">
          ${escapeHtml(sublist.name)}
        </div>
      `;

      const tasks = taskManager.getSublistTasksSorted(list.id, sublist.id);
      if (tasks.length === 0) {
        sublistDiv.innerHTML += '<div class="text-muted" style="font-size: var(--font-size-caption);">Sem tarefas ativas</div>';
      } else {
        tasks.forEach(task => {
          const taskDiv = document.createElement('div');
          taskDiv.className = 'task-item';
          taskDiv.style.marginBottom = 'var(--spacing-sm)';
          taskDiv.style.cursor = 'pointer';
          
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
            <div class="task-content" onclick="editTask('${list.id}', '${sublist.id}', '${task.id}')">
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
      addBtn.onclick = () => showCreateTaskModal(list.id, sublist.id);
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

  if (taskManager.lists.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-title">Sem sublistas</div>
        <div class="empty-state-text">Crie sublistas para visualizar no Kanban</div>
      </div>
    `;
    return;
  }

  const kanbanContainer = document.createElement('div');
  kanbanContainer.className = 'kanban-container';

  taskManager.lists.forEach(list => {
    list.sublists.forEach(sublist => {
      const column = document.createElement('div');
      column.className = 'kanban-column';

      const header = document.createElement('div');
      header.className = 'kanban-column-header';
      header.innerHTML = `
        ${escapeHtml(sublist.name)}
        <span class="kanban-column-count">(${sublist.tasks.filter(t => !t.completed).length})</span>
      `;
      column.appendChild(header);

      const tasks = taskManager.getSublistTasksSorted(list.id, sublist.id);
      tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.dataset.taskId = task.id;
        card.dataset.listId = list.id;
        card.dataset.sublistId = sublist.id;
        card.innerHTML = `
          <div style="font-weight: 500; margin-bottom: 4px;">${escapeHtml(task.title)}</div>
          <div style="font-size: var(--font-size-caption); color: var(--color-gray-dark); margin-bottom: 8px;">
            ${escapeHtml(list.name)}
          </div>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${task.flagged ? '<span class="badge badge-flagged">🚩 Sinalizada</span>' : ''}
            ${task.priority !== 'low' ? `<span class="badge task-priority ${task.priority}">${task.priority === 'high' ? 'Alta' : 'Média'}</span>` : ''}
          </div>
        `;
        card.onclick = () => editTask(list.id, sublist.id, task.id);
        column.appendChild(card);
      });

      kanbanContainer.appendChild(column);
    });
  });

  container.appendChild(kanbanContainer);
}

// ============================================================================
// Tela 4: Kanban 2 (Por Status)
// ============================================================================

function renderKanban2Screen() {
  const container = document.getElementById('kanban2-content');
  container.innerHTML = '';

  const statuses = ['todo', 'in-progress', 'done'];
  const statusLabels = { 'todo': 'A Fazer', 'in-progress': 'Em Andamento', 'done': 'Concluída' };

  const kanbanContainer = document.createElement('div');
  kanbanContainer.className = 'kanban-container';

  statuses.forEach(status => {
    const column = document.createElement('div');
    column.className = 'kanban-column';

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
      card.draggable = true;
      card.dataset.taskId = task.id;
      card.dataset.listId = task.listId;
      card.dataset.sublistId = task.sublistId;
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

    kanbanContainer.appendChild(column);
  });

  container.appendChild(kanbanContainer);
}

// ============================================================================
// Tela 5: Caderno (Todas as Tarefas Ativas)
// ============================================================================

function renderNotebookScreen() {
  const container = document.getElementById('notebook-content');
  container.innerHTML = '';

  const allTasks = taskManager.getAllActiveTasksSorted();

  if (allTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📔</div>
        <div class="empty-state-title">Nenhuma tarefa ativa</div>
        <div class="empty-state-text">Crie tarefas para visualizá-las aqui</div>
      </div>
    `;
    return;
  }

  allTasks.forEach(task => {
    const taskEl = createTaskElement(task, task.listId, task.sublistId);
    // Adicionar nome da lista/sublista na meta
    const meta = taskEl.querySelector('.task-meta');
    const info = document.createElement('span');
    info.className = 'text-small';
    info.textContent = `${task.listName} • ${task.sublistName}`;
    meta.appendChild(info);
    
    container.appendChild(taskEl);
  });
}

// ============================================================================
// Tela 6: Concluídas
// ============================================================================

function renderCompletedScreen() {
  const container = document.getElementById('completed-content');
  container.innerHTML = '';

  const completedTasks = taskManager.getAllCompletedTasks();

  if (completedTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-title">Nenhuma tarefa concluída</div>
        <div class="empty-state-text">As tarefas que você concluir aparecerão aqui</div>
      </div>
    `;
    return;
  }

  completedTasks.forEach(task => {
    const taskEl = document.createElement('div');
    taskEl.className = 'task-item completed';
    
    taskEl.innerHTML = `
      <div class="task-checkbox checked" onclick="toggleTaskComplete('${task.listId}', '${task.sublistId}', '${task.id}')">
        ✓
      </div>
      <div class="task-content">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          <span class="text-small">${task.listName} • ${task.sublistName}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="btn-icon" onclick="deleteTask('${task.listId}', '${task.sublistId}', '${task.id}')">🗑️</button>
      </div>
    `;
    container.appendChild(taskEl);
  });
}

// ============================================================================
// Tela 7: Calendário (Nova)
// ============================================================================

function renderCalendarScreen() {
  const container = document.getElementById('calendar-content');
  
  // Renderizar as três visualizações
  renderCalendarToday();
  renderCalendarWeek();
  renderCalendarMonth();
}

function renderCalendarToday() {
  const today = new Date().toLocaleDateString('en-CA');
  const container = document.getElementById('calendar-today');
  container.innerHTML = '';

  const tasks = taskManager.getTasksByDate(today);
  
  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="min-height: 200px;">
        <div class="empty-state-icon">📅</div>
        <div class="empty-state-title">Sem tarefas hoje</div>
        <div class="empty-state-text">Você está em dia!</div>
      </div>
    `;
    return;
  }

  // Separar tarefas com e sem horário
  const noTimeTask = tasks.filter(t => !t.dueTime);
  const withTimeTasks = tasks.filter(t => t.dueTime).sort((a, b) => a.dueTime.localeCompare(b.dueTime));

  // Renderizar tarefas sem horário
  if (noTimeTask.length > 0) {
    const noTimeSection = document.createElement('div');
    noTimeSection.className = 'calendar-no-time-section';
    noTimeSection.innerHTML = '<div class="calendar-no-time-title">Sem horário definido</div>';
    
    noTimeTask.forEach(task => {
      const taskEl = createCalendarTaskElement(task);
      noTimeSection.appendChild(taskEl);
    });
    
    container.appendChild(noTimeSection);
  }

  // Renderizar tarefas com horário
  const timeline = document.createElement('div');
  timeline.className = 'calendar-timeline';

  withTimeTasks.forEach(task => {
    const slot = document.createElement('div');
    slot.className = 'calendar-time-slot';
    
    const timeLabel = document.createElement('div');
    timeLabel.className = 'calendar-time-label';
    timeLabel.textContent = task.dueTime;
    
    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'calendar-time-tasks';
    
    const taskEl = createCalendarTaskElement(task);
    tasksContainer.appendChild(taskEl);
    
    slot.appendChild(timeLabel);
    slot.appendChild(tasksContainer);
    timeline.appendChild(slot);
  });

  container.appendChild(timeline);
}

function renderCalendarWeek() {
  const container = document.getElementById('calendar-week');
  container.innerHTML = '';

  const today = new Date();
  const weekContainer = document.createElement('div');
  weekContainer.className = 'calendar-week-container';

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toLocaleDateString('en-CA');
    const isToday = dateStr === new Date().toLocaleDateString('en-CA');
    
    const dayEl = document.createElement('div');
    dayEl.className = `calendar-week-day ${isToday ? 'today' : ''}`;
    
    const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' });
    const dayNum = date.getDate();
    
    dayEl.innerHTML = `
      <div class="calendar-week-day-header">
        <div>${dayName} ${dayNum}</div>
        <div class="calendar-week-day-date">${date.toLocaleDateString('pt-BR')}</div>
      </div>
    `;
    
    const tasks = taskManager.getTasksByDate(dateStr);
    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'calendar-week-day-tasks';
    
    if (tasks.length === 0) {
      tasksContainer.innerHTML = '<div style="font-size: var(--font-size-caption); opacity: 0.7;">Sem tarefas</div>';
    } else {
      tasks.forEach(task => {
        const priorityLabels = { high: 'Alta', medium: 'Média', low: 'Baixa' };
        const taskEl = document.createElement('div');
        taskEl.className = 'calendar-week-task-item';
        taskEl.draggable = true;
        taskEl.dataset.taskId = task.id;
        taskEl.dataset.listId = task.listId;
        taskEl.dataset.sublistId = task.sublistId;
        taskEl.innerHTML = `
          <div class="calendar-week-task-time">${task.dueTime || 'Sem horário'}</div>
          <div class="calendar-week-task-title" style="font-weight: bold; margin-bottom: 4px;">${escapeHtml(task.title)}</div>
          <div style="font-size: 9px; opacity: 0.9;">${task.listName} • ${task.sublistName}</div>
          <div style="display: flex; gap: 4px; margin-top: 4px;">
            <span class="task-priority ${task.priority}" style="font-size: 8px; padding: 1px 4px;">${priorityLabels[task.priority]}</span>
            ${task.flagged ? '<span style="font-size: 8px;">🚩</span>' : ''}
          </div>
        `;
        taskEl.onclick = () => editTask(task.listId, task.sublistId, task.id);
        tasksContainer.appendChild(taskEl);
      });
    }
    
    dayEl.appendChild(tasksContainer);
    weekContainer.appendChild(dayEl);
  }

  container.appendChild(weekContainer);
}

function renderCalendarMonth() {
  const container = document.getElementById('calendar-month');
  container.innerHTML = '';

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Primeiro dia do mês
  const firstDay = new Date(year, month, 1);
  // Último dia do mês
  const lastDay = new Date(year, month + 1, 0);
  // Dia da semana do primeiro dia (0 = domingo)
  const startDayOfWeek = firstDay.getDay();

  const monthContainer = document.createElement('div');
  monthContainer.className = 'calendar-month-container';

  // Adicionar dias do mês anterior
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-month-day other-month';
    dayEl.innerHTML = `<div class="calendar-month-day-number">${dayNum}</div>`;
    monthContainer.appendChild(dayEl);
  }

  // Adicionar dias do mês atual
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const dateStr = date.toLocaleDateString('en-CA');
    const isToday = dateStr === new Date().toLocaleDateString('en-CA');

    const dayEl = document.createElement('div');
    dayEl.className = `calendar-month-day ${isToday ? 'today' : ''}`;

    dayEl.innerHTML = `<div class="calendar-month-day-number">${day}</div>`;

    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'calendar-month-day-tasks';

    const tasks = taskManager.getTasksByDate(dateStr);
    const maxTasks = 2;
    
    tasks.slice(0, maxTasks).forEach(task => {
      const taskEl = document.createElement('div');
      taskEl.className = `calendar-month-task ${task.completed ? 'completed' : ''}`;
      taskEl.textContent = task.title;
      taskEl.onclick = (e) => {
        e.stopPropagation();
        editTask(task.listId, task.sublistId, task.id);
      };
      tasksContainer.appendChild(taskEl);
    });

    if (tasks.length > maxTasks) {
      const moreEl = document.createElement('div');
      moreEl.className = 'calendar-month-more';
      moreEl.textContent = `+${tasks.length - maxTasks} mais`;
      tasksContainer.appendChild(moreEl);
    }

    dayEl.appendChild(tasksContainer);
    monthContainer.appendChild(dayEl);
  }

  // Adicionar dias do próximo mês
  const totalCells = monthContainer.children.length;
  const remainingCells = 42 - totalCells; // 6 linhas x 7 dias
  for (let i = 1; i <= remainingCells; i++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-month-day other-month';
    dayEl.innerHTML = `<div class="calendar-month-day-number">${i}</div>`;
    monthContainer.appendChild(dayEl);
  }

  container.appendChild(monthContainer);
}

function createCalendarTaskElement(task) {
  const taskEl = document.createElement('div');
  taskEl.className = `calendar-task-item ${task.completed ? 'completed' : ''}`;
  taskEl.draggable = true;
  taskEl.dataset.taskId = task.id;
  taskEl.dataset.listId = task.listId;
  taskEl.dataset.sublistId = task.sublistId;
  
  const priorityLabels = { high: 'Alta', medium: 'Média', low: 'Baixa' };
  
  taskEl.innerHTML = `
    <div class="calendar-task-title">${escapeHtml(task.title)}</div>
    <div class="calendar-task-meta">
      ${task.listName} • ${task.sublistName}
      <div style="display: flex; gap: 4px; margin-top: 4px;">
        <span class="task-priority ${task.priority}">${priorityLabels[task.priority]}</span>
        ${task.flagged ? '<span class="task-flagged">🚩</span>' : ''}
      </div>
    </div>
  `;
  taskEl.onclick = () => editTask(task.listId, task.sublistId, task.id);
  return taskEl;
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
      if (screen === 'settings') renderSettingsScreen();
      else if (screen === 'overview') renderOverviewScreen();
      else if (screen === 'kanban1') renderKanban1Screen();
      else if (screen === 'kanban2') renderKanban2Screen();
      else if (screen === 'notebook') renderNotebookScreen();
      else if (screen === 'completed') renderCompletedScreen();
      else if (screen === 'calendar') renderCalendarScreen();
      showScreen(screen);
    });
  });

  // Configurar event listeners das abas do calendário
  document.querySelectorAll('.calendar-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remover active de todos os botões e views
      document.querySelectorAll('.calendar-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.calendar-view').forEach(v => v.classList.remove('active'));
      
      // Adicionar active ao botão clicado e sua view correspondente
      btn.classList.add('active');
      const tabName = btn.dataset.tab;
      const viewId = `calendar-${tabName}`;
      document.getElementById(viewId).classList.add('active');
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
  document.getElementById('back-btn-sublist').addEventListener('click', goBack);

  // Inicializar drag and drop - VERSÃO SIMPLIFICADA
  setupSimpleDragAndDrop();
  console.log('✅ Drag-and-drop inicializado!');

  // Mostrar tela inicial
  showScreen('overview');
  renderOverviewScreen();
});
