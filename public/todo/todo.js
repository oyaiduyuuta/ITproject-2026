class TodoApi {
  constructor(baseUrl = '/api/v1/todos') {
    this.baseUrl = baseUrl;
  }

  // 1. TODO一覧取得 (GET)
  async list() {
    const res = await fetch(this.baseUrl);
    return await res.json();
  }

  // 2. TODO登録 (POST)
  async create(title) {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    return await res.json();
  }

  // 3. 完了状態の変更 (PATCH)
  async update(id, isCompleted) {
    const res = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCompleted }),
    });
    return await res.json();
  }

  // 4. TODO削除 (DELETE)
  async delete(id) {
    const res = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    // 204 No Content の場合は res.json() を呼ばない
    return res.ok;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const api = new TodoApi();
  const todoInput = document.getElementById('todoInput');
  const addBtn = document.getElementById('addBtn');
  const todoList = document.getElementById('todoList');

  // 一覧取得 & 描画
  const loadTodos = async () => {
    try {
      const result = await api.list();
      if (result.status === 'success') {
        renderTodos(result.data);
      }
    } catch (err) {
      console.error('一覧取得エラー:', err);
    }
  };

  const renderTodos = (todos) => {
    todoList.innerHTML = '';
    todos.forEach((todo) => {
      const li = document.createElement('li');

      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = todo.isCompleted;
      checkbox.addEventListener('change', async () => {
        await api.update(todo.id, checkbox.checked);
        loadTodos();
      });

      const span = document.createElement('span');
      span.textContent = ` ${todo.title}`;
      if (todo.isCompleted) span.classList.add('completed');

      label.appendChild(checkbox);
      label.appendChild(span);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '削除';
      deleteBtn.classList.add('delete-btn');
      deleteBtn.addEventListener('click', async () => {
        await api.delete(todo.id);
        loadTodos();
      });

      li.appendChild(label);
      li.appendChild(deleteBtn);
      todoList.appendChild(li);
    });
  };

  // タスク追加
  const handleAdd = async () => {
    const title = todoInput.value.trim();
    if (!title) return;

    try {
      await api.create(title);
      todoInput.value = '';
      loadTodos();
    } catch (err) {
      console.error('登録エラー:', err);
    }
  };

  addBtn.addEventListener('click', handleAdd);
  todoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAdd();
  });

  loadTodos();
});