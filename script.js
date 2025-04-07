const taskList = document.getElementById("taskList");
const taskInput = document.getElementById("taskInput");
const dueDate = document.getElementById("dueDate");
const dueTime = document.getElementById("dueTime");
const categorySelect = document.getElementById("categorySelect");
const prioritySelect = document.getElementById("prioritySelect");
const taskIconInput = document.getElementById("taskIconInput");
const searchInput = document.getElementById("searchInput");
const successMsg = document.getElementById("successMessage");
const errorMsg = document.getElementById("errorMessage");
const progressText = document.getElementById("progress-text");
const progressCircle = document.getElementById("progress-circle");
const toggleDarkModeBtn = document.getElementById("toggleDarkMode");
const notificationContainer = document.getElementById("notification-container");
const controls = document.getElementById("controls");

const notificationSound = new Audio('https://freesound.org/data/previews/80/80921_1022651-lq.mp3');
notificationSound.preload = "auto";

let tasks = [];
try {
  const stored = localStorage.getItem("tasks");
  tasks = stored ? JSON.parse(stored) : [];
} catch (e) {
  console.error("Error parsing tasks:", e);
  tasks = [];
}

const debouncedSave = debounce(() => localStorage.setItem("tasks", JSON.stringify(tasks)), 500);

function updateProgress() {
  const completed = tasks.filter(t => t.completed).length;
  const total = tasks.length;
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  progressText.textContent = `${percentage}%`;
  const circumference = 2 * Math.PI * 36;
  progressCircle.style.strokeDasharray = circumference;
  progressCircle.style.strokeDashoffset = circumference * (1 - percentage / 100);
}

function formatDateTime(dateStr, timeStr) {
  return dateStr && timeStr ? new Intl.DateTimeFormat("default", { dateStyle: "medium", timeStyle: "short" }).format(new Date(`${dateStr}T${timeStr}`)) : "";
}

function getOverdueStatus(dueDate, dueTime, completed) {
  const taskTime = new Date(`${dueDate}T${dueTime}`);
  const now = new Date();
  if (taskTime < now && !completed) {
    const diffMs = now - taskTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    return diffDays > 0 ? `Overdue by ${diffDays} day${diffDays > 1 ? 's' : ''}` :
           diffHours > 0 ? `Overdue by ${diffHours} hour${diffHours > 1 ? 's' : ''}` :
           `Overdue by ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  }
  return "";
}

function displayTasks(taskArray) {
  const fragment = document.createDocumentFragment();
  const sorted = taskArray.sort((a, b) => new Date(`${a.dueDate}T${a.dueTime}`) - new Date(`${b.dueDate}T${b.dueTime}`));
  sorted.forEach(task => {
    const li = document.createElement("li");
    li.setAttribute("role", "listitem");
    li.classList.add(`priority-${task.priority}`, `category-${task.category.toLowerCase()}`);
    if (task.completed) li.classList.add("completed");
    if (new Date(`${task.dueDate}T${task.dueTime}`) < new Date() && !task.completed) li.classList.add("overdue");

    li.innerHTML = `
      ${task.icon ? `<img class="task-icon" src="${task.icon}" alt="Task icon" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2740%27 height=%2740%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23ccc%27 stroke-width=%272%27%3E%3Ccircle cx=%2712%27 cy=%2712%27 r=%2710%27/%3E%3C/svg%3E'">` : ''}
      <span class="task-text"><input class="edit-text" data-id="${task.id}" value="${sanitizeInput(task.text)}" disabled aria-label="Task text"></span>
      <input class="edit-date" data-id="${task.id}" type="date" value="${task.dueDate}" disabled aria-label="Due date">
      <input class="edit-time" data-id="${task.id}" type="time" value="${task.dueTime}" disabled aria-label="Due time">
      <span class="category">${task.category}</span>
      <span class="due-date">${formatDateTime(task.dueDate, task.dueTime)}</span>
      <span class="overdue-status" style="display: ${getOverdueStatus(task.dueDate, task.dueTime, task.completed) ? 'inline' : 'none'}">${getOverdueStatus(task.dueDate, task.dueTime, task.completed)}</span>
      <div>
        <button data-action="edit" data-id="${task.id}" aria-label="Edit task" ${task.completed ? 'disabled' : ''}>Edit</button>
        <button data-action="delete" data-id="${task.id}" aria-label="Delete task">Delete</button>
        <button data-action="toggle" data-id="${task.id}" aria-label="${task.completed ? 'Undo completion' : 'Mark complete'}">${task.completed ? 'Undo' : 'Done'}</button>
      </div>
    `;
    fragment.appendChild(li);
  });
  taskList.innerHTML = "";
  taskList.appendChild(fragment);
  updateProgress();
}

function toggleEdit(id, button) {
  const textInput = document.querySelector(`.edit-text[data-id="${id}"]`);
  const dateInput = document.querySelector(`.edit-date[data-id="${id}"]`);
  const timeInput = document.querySelector(`.edit-time[data-id="${id}"]`);
  const isEditing = !textInput.disabled;
  if (isEditing) {
    const newDate = dateInput.value;
    const newTime = timeInput.value;
    const selectedTime = new Date(`${newDate}T${newTime}`);
    if (selectedTime <= new Date()) {
      showError("Cannot set task to past time!");
      return;
    }
    const task = tasks.find(t => t.id === id);
    task.text = textInput.value;
    task.dueDate = newDate;
    task.dueTime = newTime;
    task.notified = false; // Reset notification status
    textInput.disabled = true;
    dateInput.disabled = true;
    timeInput.disabled = true;
    button.textContent = "Edit"; // Explicitly set back to "Edit"
    debouncedSave();
    displayTasks(tasks);
    scheduleNotification(task); // Reschedule notification for edited task
    showSuccess("Task updated!");
  } else {
    textInput.disabled = false;
    dateInput.disabled = false;
    timeInput.disabled = false;
    button.textContent = "Save";
  }
}

function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  tasks = tasks.filter(t => t.id !== id);
  debouncedSave();
  displayTasks(tasks);
  showNotification(`Task "${task.text}" deleted`, true, () => {
    tasks.push(task);
    debouncedSave();
    displayTasks(tasks);
  });
}

function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  task.completed = !task.completed;
  debouncedSave();
  displayTasks(tasks);
}

function showNotification(message, withUndo = false, undoCallback) {
  if (!notificationContainer) return;
  if (notificationContainer.timeoutId) clearTimeout(notificationContainer.timeoutId);
  notificationContainer.innerHTML = `${message}${withUndo ? ' <button class="close-btn">Undo</button>' : ' <button class="close-btn">✖</button>'}`;
  notificationContainer.classList.remove("hidden");
  notificationContainer.classList.add("show");
  const closeBtn = notificationContainer.querySelector(".close-btn");
  closeBtn.onclick = () => {
    if (withUndo && undoCallback) undoCallback();
    hideNotification();
  };
  notificationContainer.timeoutId = setTimeout(hideNotification, 5000);
  if (!withUndo) {
    notificationSound.play().catch(e => console.error("Audio playback failed:", e));
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("To-Do List", { body: message });
    } else if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification("To-Do List", { body: message });
        }
      });
    }
  }
  function hideNotification() {
    notificationContainer.classList.remove("show");
    setTimeout(() => notificationContainer.classList.add("hidden"), 300);
  }
}

window.addTask = async function () {
  const inputs = [taskInput, dueDate, dueTime, prioritySelect, categorySelect];
  inputs.forEach(el => el?.classList.remove("input-error"));
  const text = taskInput?.value.trim();
  const dateVal = dueDate?.value;
  const timeVal = dueTime?.value;
  const priorityVal = prioritySelect?.value;
  const categoryVal = categorySelect?.value;
  if (!text || !dateVal || !timeVal || !priorityVal || !categoryVal) {
    inputs.forEach(el => { if (!el.value) el.classList.add("input-error"); });
    showError("Please fill all fields!");
    return;
  }
  const selectedTime = new Date(`${dateVal}T${timeVal}`);
  if (selectedTime <= new Date()) {
    showError("Cannot set task to past time!");
    return;
  }
  let iconBase64 = "";
  if (taskIconInput?.files[0]) {
    try {
      iconBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(taskIconInput.files[0]);
      });
    } catch (e) {
      console.error("Error converting icon:", e);
    }
  }
  const newTask = { id: Date.now().toString(), text, dueDate: dateVal, dueTime: timeVal, priority: priorityVal, category: categoryVal, icon: iconBase64, completed: false, notified: false };
  tasks.push(newTask);
  debouncedSave();
  displayTasks(tasks);
  scheduleNotification(newTask);
  inputs.forEach(el => el.value = "");
  prioritySelect.selectedIndex = 0;
  categorySelect.selectedIndex = 0;
  showSuccess("Task added!");
};

window.filterTasks = function(status) {
  displayTasks(status === "completed" ? tasks.filter(t => t.completed) : status === "pending" ? tasks.filter(t => !t.completed) : tasks);
};

window.sortTasks = function(criteria) {
  if (criteria === "dueDate") {
    tasks.sort((a, b) => new Date(`${a.dueDate}T${a.dueTime}`) - new Date(`${b.dueDate}T${b.dueTime}`));
  } else if (criteria === "priority") {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    tasks.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  }
  debouncedSave();
  displayTasks(tasks);
};

window.exportTasks = function() {
  try {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", "tasks.json");
    document.body.appendChild(a);
    a.click();
    a.remove();
    showSuccess("Tasks exported!");
  } catch (e) {
    showError("Export failed!");
  }
};

window.importTasks = function() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        tasks = JSON.parse(event.target.result);
        debouncedSave();
        displayTasks(tasks);
        tasks.forEach(task => scheduleNotification(task));
        showSuccess("Tasks imported!");
      } catch (e) {
        showError("Invalid JSON!");
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

function scheduleNotification(task) {
  if (task.completed || task.notified) return;
  const taskTime = new Date(`${task.dueDate}T${task.dueTime}`).getTime();
  const now = Date.now();
  const delay = taskTime - now;
  console.log(`Scheduling notification for "${task.text}" in ${delay}ms`);
  if (delay <= 0) {
    showNotification(`⏰ "${task.text}" due now!`);
    task.notified = true;
    debouncedSave();
    displayTasks(tasks);
    return;
  }
  setTimeout(() => {
    if (!task.completed && !task.notified) {
      showNotification(`⏰ "${task.text}" due now!`);
      task.notified = true;
      debouncedSave();
      displayTasks(tasks);
      console.log(`Notification triggered for "${task.text}"`);
    }
  }, delay);
}

function sanitizeInput(input) {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

function showSuccess(message) {
  successMsg.textContent = message;
  successMsg.classList.remove("hidden");
  setTimeout(() => successMsg.classList.add("hidden"), 2000);
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove("hidden");
  setTimeout(() => errorMsg.classList.add("hidden"), 2000);
}

function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const isDarkMode = localStorage.getItem("darkMode") === "true";
  if (isDarkMode) {
    document.body.classList.add("dark-mode");
    toggleDarkModeBtn.textContent = "Light";
  }
  progressCircle.style.transition = "stroke-dashoffset 0.5s ease";
  controls.classList.remove("hidden");
  displayTasks(tasks);
  
  taskList.addEventListener('click', (e) => {
    const id = e.target.dataset.id;
    if (e.target.matches('[data-action="toggle"]')) toggleComplete(id);
    if (e.target.matches('[data-action="delete"]')) deleteTask(id);
    if (e.target.matches('[data-action="edit"]')) toggleEdit(id, e.target);
  });

  searchInput.addEventListener("input", debounce(() => {
    const value = searchInput.value.toLowerCase();
    displayTasks(tasks.filter(t => t.text.toLowerCase().includes(value)));
  }, 300));

  toggleDarkModeBtn.addEventListener("click", () => {
    const isDarkModeNow = !document.body.classList.contains("dark-mode");
    document.body.classList.toggle("dark-mode", isDarkModeNow);
    toggleDarkModeBtn.textContent = isDarkModeNow ? "Light" : "Dark";
    localStorage.setItem("darkMode", isDarkModeNow);
  });

  tasks.forEach(task => scheduleNotification(task));
  console.log("Initial notifications scheduled for tasks:", tasks);
});