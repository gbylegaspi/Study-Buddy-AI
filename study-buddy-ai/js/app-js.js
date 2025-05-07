// DOM Elements
const userInitial = document.getElementById('user-initial');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const headerName = document.getElementById('header-name');
const currentDate = document.getElementById('current-date');
const upcomingTasks = document.getElementById('upcoming-tasks');
const tasksCompleted = document.getElementById('tasks-completed');
const focusSessions = document.getElementById('focus-sessions');
const studyStreak = document.getElementById('study-streak');
const progressChart = document.getElementById('progress-chart');
const loadingOverlay = document.querySelector('.loading-overlay');
const logoutBtn = document.getElementById('logout-btn');
const toggleSidebarBtn = document.querySelector('.toggle-sidebar');
const sidebar = document.querySelector('.sidebar');

// Format date for display
function formatDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    return today.toLocaleDateString('en-US', options);
}

// Set current date
if (currentDate) {
    currentDate.textContent = formatDate();
}

// Toggle sidebar on mobile
if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', function() {
        sidebar.classList.toggle('active');
    });
}

// Handle logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
        // Show loading
        loadingOverlay.classList.remove('hidden');
        
        auth.signOut()
            .then(() => {
                // Redirect to login page
                window.location.href = 'login.html';
            })
            .catch((error) => {
                console.error('Logout error:', error);
                loadingOverlay.classList.add('hidden');
            });
    });
}

// Load user data
function loadUserData() {
    checkAuth()
        .then(user => {
            // Update user info
            if (userName) {
                userName.textContent = user.displayName || 'Study Buddy User';
            }
            
            if (userEmail) {
                userEmail.textContent = user.email;
            }
            
            if (headerName) {
                headerName.textContent = user.displayName?.split(' ')[0] || 'Student';
            }
            
            if (userInitial) {
                userInitial.textContent = (user.displayName || 'S')[0].toUpperCase();
            }
            
            // Load user's study data from Firestore
            return loadStudyData(user.uid);
        })
        .then(() => {
            // Hide loading overlay
            loadingOverlay.classList.add('hidden');
        })
        .catch(error => {
            console.error('Error loading user data:', error);
            loadingOverlay.classList.add('hidden');
        });
}

// Load study data from Firestore
function loadStudyData(userId) {
    if (!db) return Promise.resolve();
    
    // Get user document
    return db.collection('users').doc(userId).get()
        .then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                
                // Load upcoming tasks
                return loadUpcomingTasks(userId).then(() => userData);
            } else {
                console.log('No user data found!');
                return {};
            }
        })
        .then(userData => {
            // Update stats
            updateStats(userData);
        });
}

// Load upcoming tasks
function loadUpcomingTasks(userId) {
    if (!db || !upcomingTasks) return Promise.resolve();
    
    // Get tasks collection
    return db.collection('users').doc(userId).collection('tasks')
        .where('completed', '==', false)
        .orderBy('dueDate', 'asc')
        .limit(5)
        .get()
        .then(querySnapshot => {
            if (querySnapshot.empty) {
                // No tasks found, show empty state
                upcomingTasks.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-tasks"></i>
                        <p>No upcoming tasks</p>
                        <a href="pages/planner.html" class="btn btn-primary">Add Tasks</a>
                    </div>
                `;
                return;
            }
            
            // Clear current content
            upcomingTasks.innerHTML = '';
            
            // Add tasks to the list
            querySnapshot.forEach(doc => {
                const task = doc.data();
                const dueDate = task.dueDate?.toDate() || new Date();
                const formattedDate = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                const taskElement = document.createElement('div');
                taskElement.className = 'task-item';
                taskElement.innerHTML = `
                    <div class="task-info">
                        <h3 class="task-title">${task.title}</h3>
                        <p class="task-subject">${task.subject || 'General'}</p>
                    </div>
                    <div class="task-meta">
                        <span class="task-date">
                            <i class="fas fa-calendar-alt"></i> ${formattedDate}
                        </span>
                        <span class="task-priority ${task.priority || 'medium'}">
                            ${task.priority || 'Medium'}
                        </span>
                    </div>
                `;
                
                upcomingTasks.appendChild(taskElement);
            });
        })
        .catch(error => {
            console.error('Error loading tasks:', error);
            upcomingTasks.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error loading tasks</p>
                </div>
            `;
        });
}

// Update stats display
function updateStats(userData) {
    if (tasksCompleted) {
        tasksCompleted.textContent = userData.tasksCompleted || 0;
    }
    
    if (focusSessions) {
        focusSessions.textContent = userData.focusSessions || 0;
    }
    
    if (studyStreak) {
        studyStreak.textContent = userData.streak || 0;
    }
    
    // In a real app, we would implement chart rendering here
    // using a library like Chart.js
    if (progressChart) {
        // For now, just show placeholder
        progressChart.innerHTML = `
            <div class="chart-placeholder">
                <i class="fas fa-chart-pie"></i>
                <p>Progress data will appear here</p>
            </div>
        `;
    }
}

// Add custom styles to task items
document.addEventListener('DOMContentLoaded', function() {
    // Add this CSS to the page
    const style = document.createElement('style');
    style.textContent = `
        .task-item {
            padding: 15px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .task-item:last-child {
            border-bottom: none;
        }
        
        .task-title {
            font-size: 1.1rem;
            margin-bottom: 5px;
        }
        
        .task-subject {
            font-size: 0.9rem;
            color: var(--secondary-color);
        }
        
        .task-meta {
            text-align: right;
            font-size: 0.9rem;
        }
        
        .task-date {
            display: block;
            margin-bottom: 5px;
        }
        
        .task-priority {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.8rem;
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
    `;
    document.head.appendChild(style);
});

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Load user data when the page is ready
    loadUserData();
    
    // Hide loading overlay with slight delay to prevent flash
    setTimeout(() => {
        loadingOverlay.classList.add('hidden');
    }, 1000);
});

// Mobile sidebar toggle
const toggleSidebar = document.querySelector('.toggle-sidebar');
const sidebarElement = document.querySelector('.sidebar');

if (toggleSidebar && sidebarElement) {
    toggleSidebar.addEventListener('click', () => {
        sidebarElement.classList.toggle('active');
    });
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && 
        sidebarElement && 
        sidebarElement.classList.contains('active') && 
        !sidebarElement.contains(e.target) && 
        !toggleSidebar.contains(e.target)) {
        sidebarElement.classList.remove('active');
    }
});

// Set active navigation item based on current page
function setActiveNavItem() {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.sidebar-nav li');
    
    navItems.forEach(item => {
        const link = item.querySelector('a');
        if (link && link.getAttribute('href') === currentPath.split('/').pop()) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Call on page load
document.addEventListener('DOMContentLoaded', setActiveNavItem);