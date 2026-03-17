// ─── MODEL: Task ─────────────────────────────────────────────────────────────
    class Task {
        constructor(description) {
            this.id = Date.now() + Math.random().toString(36).slice(2);
            this.description = description;
            this.completed = false;
            this.createdAt = new Date().toISOString();
        }
    }

    // ─── MODEL: TaskManager ───────────────────────────────────────────────────────
    class TaskManager {
        constructor() {
            this.tasks = this.#load();
        }

        #load() {
            try {
                return JSON.parse(localStorage.getItem('pro-tasks') || '[]');
            } catch {
                return [];
            }
        }

        #save() {
            localStorage.setItem('pro-tasks', JSON.stringify(this.tasks));
        }

        add(description) {
            const task = new Task(description.trim());
            this.tasks.push(task);
            this.#save();
            return task;
        }

        remove(id) {
            this.tasks = this.tasks.filter(t => t.id !== id);
            this.#save();
        }

        toggle(id) {
            const task = this.tasks.find(t => t.id === id);
            if (task) {
                task.completed = !task.completed;
                this.#save();
            }
        }

        edit(id, newDesc) {
            const task = this.tasks.find(t => t.id === id);
            if (task && newDesc.trim()) {
                task.description = newDesc.trim();
                this.#save();
            }
        }

        getFiltered(filter, sort) {
            let list = [...this.tasks];

            // Filter
            if (filter === 'completed') list = list.filter(t => t.completed);
            if (filter === 'incomplete') list = list.filter(t => !t.completed);

            // Sort
            if (sort === 'alpha') {
                list.sort((a, b) => a.description.localeCompare(b.description));
            } else {
                list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }

            return list;
        }
    }

    // ─── VIEW: TaskView ───────────────────────────────────────────────────────────
    class TaskView {
        constructor() {
            this.listEl = document.getElementById('task-list');
            this.inputEl = document.getElementById('task-input');
            this.addBtn = document.getElementById('add-btn');
            this.statTotal = document.getElementById('stat-total');
            this.statDone = document.getElementById('stat-done');
            this.statPend = document.getElementById('stat-pending');
            this.filterBtns = document.querySelectorAll('[data-filter]');
            this.sortBtns = document.querySelectorAll('[data-sort]');
        }

        render(tasks) {
            this.listEl.innerHTML = '';
            if (!tasks.length) {
                this.listEl.innerHTML = `
                    <div class="empty-state">
                        <div class="icon">📝</div>
                        <p>No tasks here. Create one to get started!</p>
                    </div>`;
                return;
            }
            tasks.forEach(task => this.listEl.appendChild(this.#createItem(task)));
        }

        #createItem(task) {
            const item = document.createElement('div');
            item.className = 'task-item' + (task.completed ? ' completed' : '');
            item.dataset.id = task.id;

            // Toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'toggle-btn';
            toggleBtn.title = 'Mark complete';
            toggleBtn.innerHTML = task.completed
                ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#10b981" stroke="#10b981" stroke-width="1.5"/><path d="M7 12.5L10 15.5L17.5 8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
                : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" stroke="#cbd5e1" stroke-width="1.5"/></svg>`;
            toggleBtn.dataset.action = 'toggle';

            // Content
            const content = document.createElement('div');
            content.className = 'task-content';

            const textEl = document.createElement('div');
            textEl.className = 'task-text';
            textEl.textContent = task.description;

            const timeEl = document.createElement('div');
            timeEl.className = 'task-time';
            timeEl.innerHTML = `<i class="fas fa-clock"></i> ${new Date(task.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}`;

            content.appendChild(textEl);
            content.appendChild(timeEl);

            // Actions
            const actions = document.createElement('div');
            actions.className = 'task-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'icon-btn';
            editBtn.title = 'Edit';
            editBtn.innerHTML = '<i class="fas fa-pen-to-square"></i>';
            editBtn.dataset.action = 'edit';

            const delBtn = document.createElement('button');
            delBtn.className = 'icon-btn delete';
            delBtn.title = 'Delete';
            delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            delBtn.dataset.action = 'delete';

            actions.appendChild(editBtn);
            actions.appendChild(delBtn);

            item.appendChild(toggleBtn);
            item.appendChild(content);
            item.appendChild(actions);
            return item;
        }

        showEditInput(item, task) {
            const content = item.querySelector('.task-content');
            const textEl = item.querySelector('.task-text');
            textEl.style.display = 'none';

            const input = document.createElement('input');
            input.className = 'edit-input';
            input.value = task.description;
            content.insertBefore(input, textEl);
            input.focus();
            input.select();
            return input;
        }

        updateStats(all) {
            const done = all.filter(t => t.completed).length;
            this.statTotal.textContent = all.length;
            this.statDone.textContent = done;
            this.statPend.textContent = all.length - done;
        }

        setActiveFilter(filter) {
            this.filterBtns.forEach(b =>
                b.classList.toggle('active', b.dataset.filter === filter)
            );
        }

        setActiveSort(sort) {
            this.sortBtns.forEach(b =>
                b.classList.toggle('active', b.dataset.sort === sort)
            );
        }

        animateRemove(item, cb) {
            item.classList.add('removing');
            item.addEventListener('transitionend', cb, { once: true });
        }
    }

    // ─── CONTROLLER ───────────────────────────────────────────────────────────────
    class Controller {
        constructor(model, view) {
            this.model = model;
            this.view = view;
            this.filter = 'all';
            this.sort = 'time';

            // Add task
            this.view.addBtn.addEventListener('click', () => this.#addTask());
            this.view.inputEl.addEventListener('keydown', e => {
                if (e.key === 'Enter') this.#addTask();
            });

            // Filter
            this.view.filterBtns.forEach(btn => btn.addEventListener('click', () => {
                this.filter = btn.dataset.filter;
                this.view.setActiveFilter(this.filter);
                this.#refresh();
            }));

            // Sort
            this.view.sortBtns.forEach(btn => btn.addEventListener('click', () => {
                this.sort = btn.dataset.sort;
                this.view.setActiveSort(this.sort);
                this.#refresh();
            }));

            // Task list actions
            this.view.listEl.addEventListener('click', e => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                const item = btn.closest('.task-item');
                const id = item?.dataset.id;
                if (!id) return;

                const action = btn.dataset.action;
                if (action === 'toggle') this.#toggle(id);
                if (action === 'delete') this.#delete(item, id);
                if (action === 'edit') this.#startEdit(item, id);
            });

            this.#refresh();
        }

        #addTask() {
            const val = this.view.inputEl.value.trim();
            if (!val) return;
            this.model.add(val);
            this.view.inputEl.value = '';
            this.#refresh();
        }

        #toggle(id) {
            this.model.toggle(id);
            this.#refresh();
        }

        #delete(item, id) {
            this.view.animateRemove(item, () => {
                this.model.remove(id);
                this.#refresh();
            });
        }

        #startEdit(item, id) {
            const task = this.model.tasks.find(t => t.id === id);
            if (!task) return;
            const input = this.view.showEditInput(item, task);

            const commit = () => {
                this.model.edit(id, input.value);
                this.#refresh();
            };

            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') this.#refresh();
            });
            input.addEventListener('blur', commit);
        }

        #refresh() {
            const filtered = this.model.getFiltered(this.filter, this.sort);
            this.view.render(filtered);
            this.view.updateStats(this.model.tasks);
        }
    }

    // Boot
    const app = new Controller(new TaskManager(), new TaskView());