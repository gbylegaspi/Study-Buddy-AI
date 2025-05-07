// DOM Elements
const tasksList = document.getElementById('tasks-list');
const addTaskBtn = document.getElementById('add-task-btn');
const newTaskModal = document.getElementById('new-task-modal');
const newTaskForm = document.getElementById('new-task-form');
const closeModalBtns = document.querySelectorAll('.close-modal');
const calendarEl = document.getElementById('calendar');
const loadingOverlay = document.querySelector('.loading-overlay');

// Global variables
let calendar;
let tasks = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Set today's date in task form
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    document.getElementById('task-date').value = formattedDate;
    
    // Load tasks when page loads
    loadTasks();
    
    // Initialize FullCalendar
    initializeCalendar();
    
    // Event listeners
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', showNewTaskModal);
    }
    
    // New task form submission
    if (newTaskForm) {
        newTaskForm.addEventListener('submit', createNewTask);
    }
    
    // Close modal
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
    
    // Hide loading spinner after delay
    setTimeout(() => {
        loadingOverlay.classList.add('hidden');
    }, 1000);
});

// Initialize FullCalendar
function initializeCalendar() {
    if (!calendarEl) return;
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
        },
        height: 'auto',
        eventClick: function(info) {
            showTaskDetails(info.event);
        },
        dateClick: function(info) {
            // Set the clicked date in the new task form and open modal
            document.getElementById('task-date').value = info.dateStr;
            showNewTaskModal();
        }
    });
    
    calendar.render();
}

// Load tasks from Firestore
function loadTasks() {
    if (!db) return;
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).collection('tasks')
            .orderBy('dueDate', 'asc')
            .get()
            .then(querySnapshot => {
                tasks = [];
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                let todayTasks = [];
                let calendarEvents = [];
                
                querySnapshot.forEach(doc => {
                    const task = doc.data();
                    task.id = doc.id;
                    tasks.push(task);
                    
                    // Create calendar event
                    const dueDate = task.dueDate?.toDate();
                    if (dueDate) {
                        // Check if task is due today
                        const taskDate = new Date(dueDate);
                        taskDate.setHours(0, 0, 0, 0);
                        
                        if (taskDate.getTime() === today.getTime()) {
                            todayTasks.push(task);
                        }
                        
                        // Add to calendar
                        calendarEvents.push({
                            id: task.id,
                            title: task.title,
                            start: dueDate,
                            allDay: !task.time, // If time is not specified, make it an all-day event
                            backgroundColor: getTaskColor(task.priority),
                            borderColor: getTaskColor(task.priority),
                            extendedProps: {
                                description: task.description,
                                priority: task.priority,
                                subject: task.subject,
                                completed: task.completed
                            }
                        });
                    }
                });
                
                // Update Today's Tasks section
                updateTodayTasksList(todayTasks);
                
                // Add events to calendar
                if (calendar) {
                    calendar.removeAllEvents();
                    calendarEvents.forEach(event => {
                        calendar.addEvent(event);
                    });
                }
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            })
            .catch(error => {
                console.error('Error loading tasks:', error);
                
                if (tasksList) {
                    tasksList.innerHTML = `
                        <div class="error-state">
                            <i class="fas fa-exclamation-circle"></i>
                            <p>Error loading tasks</p>
                        </div>
                    `;
                }
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            });
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Update Today's Tasks section
function updateTodayTasksList(todayTasks) {
    if (!tasksList) return;
    
    if (todayTasks.length === 0) {
        tasksList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tasks"></i>
                <p>No tasks for today</p>
            </div>
        `;
        return;
    }
    
    tasksList.innerHTML = '';
    
    todayTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        tasksList.appendChild(taskElement);
    });
}

// Create task element
function createTaskElement(task) {
    const taskElement = document.createElement('div');
    taskElement.className = 'task-item';
    if (task.completed) {
        taskElement.classList.add('completed');
    }
    taskElement.dataset.taskId = task.id;
    
    // Format time
    let timeStr = '';
    if (task.time) {
        const timeParts = task.time.split(':');
        const hours = parseInt(timeParts[0]);
        const minutes = timeParts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        timeStr = `${displayHours}:${minutes} ${ampm}`;
    }
    
    taskElement.innerHTML = `
        <div class="task-checkbox">
            <input type="checkbox" id="task-${task.id}" ${task.completed ? 'checked' : ''}>
            <label for="task-${task.id}"></label>
        </div>
        <div class="task-info">
            <h3 class="task-title">${task.title}</h3>
            ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
            <div class="task-meta">
                ${task.subject ? `<span class="task-subject">${task.subject}</span>` : ''}
                ${timeStr ? `<span class="task-time"><i class="fas fa-clock"></i> ${timeStr}</span>` : ''}
                <span class="task-priority ${task.priority || 'medium'}">
                    ${task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium'}
                </span>
            </div>
        </div>
        <div class="task-actions">
            <button class="btn-icon edit-task" title="Edit Task">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon delete-task" title="Delete Task">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // Checkbox event
    const checkbox = taskElement.querySelector(`#task-${task.id}`);
    checkbox.addEventListener('change', function() {
        toggleTaskCompletion(task.id, this.checked);
    });
    
    // Edit button event
    const editBtn = taskElement.querySelector('.edit-task');
    editBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        editTask(task);
    });
    
    // Delete button event
    const deleteBtn = taskElement.querySelector('.delete-task');
    deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteTask(task.id);
    });
    
    return taskElement;
}

// Show new task modal
function showNewTaskModal() {
    if (newTaskModal) {
        newTaskModal.style.display = 'block';
        
        // Reset form
        if (newTaskForm) {
            newTaskForm.reset();
            
            // Set current date
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0];
            document.getElementById('task-date').value = formattedDate;
            
            // Set default time (1 hour from now)
            const nextHour = new Date(today.getTime() + 60 * 60 * 1000);
            const hours = String(nextHour.getHours()).padStart(2, '0');
            const minutes = String(nextHour.getMinutes()).padStart(2, '0');
            document.getElementById('task-time').value = `${hours}:${minutes}`;
            
            // Set form title
            document.querySelector('#new-task-modal .modal-header h2').textContent = 'Create New Task';
            
            // Change submit button text
            document.querySelector('#new-task-form .btn-primary').textContent = 'Create Task';
        }
    }
}

// Close modals
function closeModals() {
    if (newTaskModal) {
        newTaskModal.style.display = 'none';
    }
}

// Create new task
function createNewTask(e) {
    e.preventDefault();
    
    if (!db) return;
    
    const taskTitle = document.getElementById('task-title').value.trim();
    const taskDescription = document.getElementById('task-description').value.trim();
    const taskDate = document.getElementById('task-date').value;
    const taskTime = document.getElementById('task-time').value;
    const taskPriority = document.getElementById('task-priority').value;
    const taskSubject = document.getElementById('task-subject').value.trim();
    
    if (!taskTitle || !taskDate) {
        alert('Please enter a title and date for the task');
        return;
    }
    
    // Close modal
    closeModals();
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    // Convert date and time to Date object
    const dueDate = new Date(taskDate);
    
    if (taskTime) {
        const [hours, minutes] = taskTime.split(':');
        dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
        // Default to 9 AM if no time specified
        dueDate.setHours(9, 0, 0, 0);
    }
    
    // Get task ID from hidden field (if editing)
    const taskId = document.getElementById('task-id')?.value;
    
    checkAuth().then(user => {
        // Reference to the tasks collection
        const tasksRef = db.collection('users').doc(user.uid).collection('tasks');
        
        // Data object to save
        const taskData = {
            title: taskTitle,
            description: taskDescription,
            dueDate: dueDate,
            time: taskTime,
            priority: taskPriority,
            subject: taskSubject,
            completed: false,
            updatedAt: new Date()
        };
        
        let savePromise;
        
        if (taskId) {
            // Update existing task
            savePromise = tasksRef.doc(taskId).update({
                ...taskData,
                updatedAt: new Date()
            });
        } else {
            // Create new task
            savePromise = tasksRef.add({
                ...taskData,
                createdAt: new Date()
            });
        }
        
        savePromise
            .then(() => {
                // Reload tasks
                loadTasks();
            })
            .catch(error => {
                console.error('Error saving task:', error);
                alert('Failed to save task. Please try again.');
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            });
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Toggle task completion
function toggleTaskCompletion(taskId, completed) {
    if (!db || !taskId) return;
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).collection('tasks')
            .doc(taskId)
            .update({
                completed: completed,
                updatedAt: new Date()
            })
            .then(() => {
                // Update task in UI
                const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
                if (taskElement) {
                    if (completed) {
                        taskElement.classList.add('completed');
                    } else {
                        taskElement.classList.remove('completed');
                    }
                }
                
                // Update task in calendar
                if (calendar) {
                    const event = calendar.getEventById(taskId);
                    if (event) {
                        // Update event color based on completion
                        const priority = event.extendedProps.priority;
                        if (completed) {
                            event.setProp('backgroundColor', '#6c757d'); // Grey for completed
                            event.setProp('borderColor', '#6c757d');
                        } else {
                            event.setProp('backgroundColor', getTaskColor(priority));
                            event.setProp('borderColor', getTaskColor(priority));
                        }
                        
                        // Update extendedProps
                        event.setExtendedProp('completed', completed);
                    }
                }
                
                // Update stats in dashboard
                if (completed) {
                    // Increment tasks completed count in user document
                    db.collection('users').doc(user.uid).update({
                        tasksCompleted: firebase.firestore.FieldValue.increment(1)
                    }).catch(error => {
                        console.error('Error updating stats:', error);
                    });
                }
            })
            .catch(error => {
                console.error('Error updating task:', error);
                alert('Failed to update task. Please try again.');
            });
    }).catch(error => {
        console.error('Authentication check failed:', error);
    });
}

// Edit task
function editTask(task) {
    if (!newTaskModal || !newTaskForm) return;
    
    // Populate form with task data
    document.getElementById('task-title').value = task.title || '';
    document.getElementById('task-description').value = task.description || '';
    
    // Format date for input field
    const dueDate = task.dueDate?.toDate();
    if (dueDate) {
        const year = dueDate.getFullYear();
        const month = String(dueDate.getMonth() + 1).padStart(2, '0');
        const day = String(dueDate.getDate()).padStart(2, '0');
        document.getElementById('task-date').value = `${year}-${month}-${day}`;
    }
    
    document.getElementById('task-time').value = task.time || '';
    document.getElementById('task-priority').value = task.priority || 'medium';
    document.getElementById('task-subject').value = task.subject || '';
    
    // Add hidden field for task ID
    let taskIdField = document.getElementById('task-id');
    if (!taskIdField) {
        taskIdField = document.createElement('input');
        taskIdField.type = 'hidden';
        taskIdField.id = 'task-id';
        newTaskForm.appendChild(taskIdField);
    }
    taskIdField.value = task.id;
    
    // Change modal title and button text
    document.querySelector('#new-task-modal .modal-header h2').textContent = 'Edit Task';
    document.querySelector('#new-task-form .btn-primary').textContent = 'Save Changes';
    
    // Show modal
    newTaskModal.style.display = 'block';
}

// Delete task
function deleteTask(taskId) {
    if (!db || !taskId) return;
    
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).collection('tasks')
            .doc(taskId)
            .delete()
            .then(() => {
                // Remove task from calendar
                if (calendar) {
                    const event = calendar.getEventById(taskId);
                    if (event) {
                        event.remove();
                    }
                }
                
                // Reload tasks to update Today's Tasks section
                loadTasks();
            })
            .catch(error => {
                console.error('Error deleting task:', error);
                alert('Failed to delete task. Please try again.');
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            });
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Show task details
function showTaskDetails(event) {
    const task = {
        id: event.id,
        title: event.title,
        description: event.extendedProps.description,
        priority: event.extendedProps.priority,
        subject: event.extendedProps.subject,
        completed: event.extendedProps.completed,
        dueDate: { toDate: () => event.start },
        time: event.start ? `${String(event.start.getHours()).padStart(2, '0')}:${String(event.start.getMinutes()).padStart(2, '0')}` : null
    };
    
    editTask(task);
}

// Get color based on task priority
function getTaskColor(priority) {
    switch (priority) {
        case 'high':
            return '#dc3545'; // Red
        case 'medium':
            return '#ffc107'; // Yellow
        case 'low':
            return '#28a745'; // Green
        default:
            return '#6c757d'; // Grey
    }
}

// Add custom styles
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        .task-item {
            display: flex;
            align-items: flex-start;
            padding: 15px;
            border-bottom: 1px solid var(--border-color);
            transition: background-color 0.2s ease;
        }
        
        .task-item:hover {
            background-color: rgba(0, 0, 0, 0.01);
        }
        
        .task-checkbox {
            margin-right: 15px;
            margin-top: 3px;
        }
        
        .task-checkbox input[type="checkbox"] {
            display: none;
        }
        
        .task-checkbox label {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid var(--primary-color);
            border-radius: 50%;
            position: relative;
            cursor: pointer;
        }
        
        .task-checkbox input[type="checkbox"]:checked + label:after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 12px;
            height: 12px;
            background-color: var(--primary-color);
            border-radius: 50%;
        }
        
        .task-info {
            flex: 1;
        }
        
        .task-title {
            font-size: 1.1rem;
            margin-bottom: 5px;
        }
        
        .task-description {
            font-size: 0.9rem;
            color: var(--secondary-color);
            margin-bottom: 10px;
        }
        
        .task-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            font-size: 0.85rem;
        }
        
        .task-subject {
            background-color: rgba(76, 132, 255, 0.1);
            color: var(--primary-color);
            padding: 2px 8px;
            border-radius: 4px;
        }
        
        .task-time {
            color: var(--secondary-color);
        }
        
        .task-priority {
            padding: 2px 8px;
            border-radius: 4px;
        }
        
        .task-priority.high {
            background-color: #ffecec;
            color: var(--danger-color);
        }
        
        .task-priority.medium {
            background-color: #fff8e5;
            color: #d9980d;
        }
        
        .task-priority.low {
            background-color: #e5f9e5;
            color: var(--success-color);
        }
        
        .task-actions {
            display: none;
            margin-left: 10px;
        }
        
        .task-item:hover .task-actions {
            display: flex;
            gap: 5px;
        }
        
        .task-item.completed .task-title {
            text-decoration: line-through;
            color: var(--secondary-color);
        }
        
        .calendar-overview .card-content {
            padding: 0;
        }
        
        #calendar {
            height: 100%;
        }
        
        .fc-event {
            cursor: pointer;
        }
        
        /* Modal styles */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            overflow: auto;
        }
        
        .modal-content {
            background-color: white;
            margin: 10% auto;
            padding: 0;
            width: 90%;
            max-width: 600px;
            border-radius: var(--border-radius);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            animation: modalFadeIn 0.3s;
        }
        
        @keyframes modalFadeIn {
            from { opacity: 0; transform: translateY(-50px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .modal-header {
            padding: 15px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .modal-header h2 {
            margin: 0;
            font-size: 1.3rem;
        }
        
        .close-modal {
            background: none;
            border: none;
            font-size: 1.5rem;
            line-height: 1;
            cursor: pointer;
            color: var(--secondary-color);
        }
        
        .modal-body {
            padding: 20px;
        }
        
        .form-row {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .form-row .form-group {
            flex: 1;
        }
        
        .form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
        }
    `;
    document.head.appendChild(style);
});