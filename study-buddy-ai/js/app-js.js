// DOM Elements
const userInitial = document.getElementById('user-initial');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const headerName = document.getElementById('header-name');
const currentDate = document.getElementById('current-date');
const upcomingTasks = document.getElementById('upcoming-tasks');
const progressChart = null;
const loadingOverlay = document.querySelector('.loading-overlay');
const logoutBtn = document.getElementById('logout-btn');
const toggleSidebarBtn = document.querySelector('.toggle-sidebar');
const sidebar = document.querySelector('.sidebar');
const studyStreak = null;
const focusSessions = null;
const tasksCompleted = null;

// Only initialize dashboard functionality if we're on the dashboard page
function initializeDashboard() {
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
    if (toggleSidebarBtn && sidebar) {
        toggleSidebarBtn.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    // Handle logout
    if (logoutBtn && loadingOverlay) {
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
        if (typeof checkAuth !== 'function') {
            console.error('checkAuth function not found');
            return;
        }

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
                if (loadingOverlay) {
                    loadingOverlay.classList.add('hidden');
                }
            })
            .catch(error => {
                console.error('Error loading user data:', error);
                if (loadingOverlay) {
                    loadingOverlay.classList.add('hidden');
                }
            });
    }

    // Only initialize if we're on the dashboard page
    if (window.location.pathname.includes('dashboard')) {
        loadUserData();
    }
}

// Initialize dashboard if we're on the dashboard page
initializeDashboard();

// Load user data
window.loadUserData = async function() {
    try {
        const user = await checkAuth();
        if (!user) {
            console.error('No authenticated user found');
            return;
        }

        // Load user document
        const userDocRef = window.firestore.doc(db, 'users', user.uid);
        const userDoc = await window.firestore.getDoc(userDocRef);
        
        if (!userDoc.exists()) {
            console.log('Creating new user document');
            // Create new user document with default values
            const userData = {
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                createdAt: new Date(),
                tasksCompleted: 0,
                focusSessions: 0,
                streak: 0,
                lastActive: new Date()
            };
            
            await window.firestore.setDoc(userDocRef, userData);
            return userData;
        }
        
        // Update last active timestamp
        await window.firestore.updateDoc(userDocRef, {
            lastActive: new Date()
        });
        
        return userDoc.data();
    } catch (error) {
        console.error('Error loading user data:', error);
        throw error;
    }
};

// Load study data from Firestore
function loadStudyData(userId) {
    if (!db || !window.firestore) {
        console.error('Database not initialized');
        return Promise.resolve();
    }
    
    console.log('Loading study data for user:', userId);
    
    // Get user document
    const userDocRef = window.firestore.doc(db, 'users', userId);
    return window.firestore.getDoc(userDocRef)
        .then(doc => {
            if (doc.exists()) {
                const userData = doc.data();
                console.log('User data found:', userData);
                
                // Load upcoming tasks
                return loadUpcomingTasks(userId).then(() => userData);
            } else {
                console.log('No user data found, creating new user document');
                // Create user document if it doesn't exist
                const userData = {
                    tasksCompleted: 0,
                    focusSessions: 0,
                    streak: 0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                return window.firestore.setDoc(userDocRef, userData)
                    .then(() => {
                        console.log('Created new user document');
                        return loadUpcomingTasks(userId).then(() => userData);
                    });
            }
        })
        .then(userData => {
            // Update stats
            updateStats(userData);
        })
        .catch(error => {
            console.error('Error in loadStudyData:', error);
        });
}

// Load upcoming tasks
function loadUpcomingTasks(userId) {
    if (!db || !window.firestore || !upcomingTasks) {
        console.error('Database or upcoming tasks element not found');
        return Promise.resolve();
    }
    
    console.log('Loading tasks for user:', userId);
    
    // Get tasks collection - simplified query to avoid index requirement
    const tasksRef = window.firestore.collection(db, 'users', userId, 'tasks');
    const q = window.firestore.query(tasksRef, window.firestore.where('completed', '==', false));
    
    return window.firestore.getDocs(q)
        .then(querySnapshot => {
            console.log('Tasks query result:', querySnapshot.size, 'tasks found');
            
            if (querySnapshot.empty) {
                console.log('No tasks found, showing empty state');
                // No tasks found, show empty state
                upcomingTasks.innerHTML = `
                    <div class="empty-state animate__animated animate__fadeIn">
                        <i class="fas fa-tasks"></i>
                        <p>No upcoming tasks</p>
                        <a href="pages/planner.html" class="btn btn-primary">Add Tasks</a>
                    </div>
                `;
                return;
            }
            
            // Clear current content
            upcomingTasks.innerHTML = '';
            
            // Convert to array and sort by due date
            const tasks = [];
            querySnapshot.forEach(doc => {
                tasks.push({ id: doc.id, ...doc.data() });
            });
            
            // Sort tasks by due date
            tasks.sort((a, b) => {
                const dateA = a.dueDate?.toDate() || new Date(0);
                const dateB = b.dueDate?.toDate() || new Date(0);
                return dateA - dateB;
            });
            
            // Take only the first 5 tasks
            const recentTasks = tasks.slice(0, 5);
            
            // Add tasks to the list
            recentTasks.forEach((task, index) => {
                console.log('Processing task:', task);
                
                const dueDate = task.dueDate?.toDate() || new Date();
                const formattedDate = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                const taskElement = document.createElement('div');
                taskElement.className = 'task-item animate__animated animate__fadeIn';
                taskElement.style.animationDelay = `${index * 0.1}s`;
                
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
                            ${task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium'}
                        </span>
                    </div>
                `;
                
                upcomingTasks.appendChild(taskElement);
            });
        })
        .catch(error => {
            console.error('Error loading tasks:', error);
            upcomingTasks.innerHTML = `
                <div class="error-state animate__animated animate__fadeIn">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error loading tasks</p>
                </div>
            `;
        });
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    // Load user data
    loadUserData().catch(error => {
        console.error('Failed to load user data:', error);
    });
    
    // Set active nav item
    setActiveNavItem();
});

// Set active nav item
function setActiveNavItem() {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.sidebar-nav li');
    
    console.log('Current path:', currentPath);
    
    navItems.forEach(item => {
        const link = item.querySelector('a');
        const linkPath = link.getAttribute('href');
        console.log('Checking link:', linkPath);
        
        // Check if the current path ends with the link path
        if (currentPath.endsWith(linkPath)) {
            item.classList.add('active');
            console.log('Set active:', linkPath);
        } else {
            item.classList.remove('active');
        }
    });
}

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