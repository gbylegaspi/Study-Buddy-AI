// DOM Elements
const minutesDisplay = document.getElementById('minutes');
const secondsDisplay = document.getElementById('seconds');
const startButton = document.getElementById('start-timer');
const pauseButton = document.getElementById('pause-timer');
const resetButton = document.getElementById('reset-timer');
const focusDurationInput = document.getElementById('focus-duration');
const shortBreakInput = document.getElementById('short-break');
const longBreakInput = document.getElementById('long-break');
const sessionsUntilLongInput = document.getElementById('sessions-until-long');
const completedSessionsDisplay = document.getElementById('completed-sessions');
const totalFocusTimeDisplay = document.getElementById('total-focus-time');
const progressCircle = document.querySelector('.timer-progress');
const timerCircle = document.querySelector('.timer-circle');
const loadingOverlay = document.querySelector('.loading-overlay');

// Timer state
let timerState = {
    isRunning: false,
    isPaused: false,
    timeLeft: 0,
    totalTime: 0,
    timerType: 'focus', // 'focus', 'shortBreak', 'longBreak'
    completedSessions: 0,
    totalFocusTime: 0,
    timerInterval: null,
    lastUpdate: null // Track last update time for accuracy
};

// Validate timer settings
function validateTimerSettings() {
    const focusDuration = parseInt(focusDurationInput?.value || 25);
    const shortBreak = parseInt(shortBreakInput?.value || 5);
    const longBreak = parseInt(longBreakInput?.value || 15);
    const sessionsUntilLong = parseInt(sessionsUntilLongInput?.value || 4);

    if (isNaN(focusDuration) || focusDuration < 1 || focusDuration > 60) {
        throw new Error('Focus duration must be between 1 and 60 minutes');
    }
    if (isNaN(shortBreak) || shortBreak < 1 || shortBreak > 30) {
        throw new Error('Short break must be between 1 and 30 minutes');
    }
    if (isNaN(longBreak) || longBreak < 1 || longBreak > 60) {
        throw new Error('Long break must be between 1 and 60 minutes');
    }
    if (isNaN(sessionsUntilLong) || sessionsUntilLong < 1 || sessionsUntilLong > 10) {
        throw new Error('Sessions until long break must be between 1 and 10');
    }

    return { focusDuration, shortBreak, longBreak, sessionsUntilLong };
}

// Save timer state to localStorage
function saveTimerState() {
    const stateToSave = {
        isRunning: timerState.isRunning,
        isPaused: timerState.isPaused,
        timeLeft: timerState.timeLeft,
        totalTime: timerState.totalTime,
        timerType: timerState.timerType,
        lastUpdate: Date.now()
    };
    localStorage.setItem('timerState', JSON.stringify(stateToSave));
}

// Load timer state from localStorage
function loadTimerState() {
    try {
        const savedState = localStorage.getItem('timerState');
        if (savedState) {
            const state = JSON.parse(savedState);
            const timeElapsed = Math.floor((Date.now() - state.lastUpdate) / 1000);
            
            // Only restore if less than 1 hour has passed
            if (timeElapsed < 3600) {
                timerState.isRunning = state.isRunning;
                timerState.isPaused = state.isPaused;
                timerState.timeLeft = Math.max(0, state.timeLeft - timeElapsed);
                timerState.totalTime = state.totalTime;
                timerState.timerType = state.timerType;
                
                // Update UI
                updateDisplay();
                updateProgressCircle();
                updateTimerTypeLabel();
                
                // Restart timer if it was running
                if (timerState.isRunning && !timerState.isPaused) {
                    startTimer();
                }
            }
        }
    } catch (error) {
        console.error('Error loading timer state:', error);
    }
}

// Update timer type label
function updateTimerTypeLabel() {
    const label = document.getElementById('timer-type-label');
    if (label) {
        label.textContent = getTimerTypeLabel();
        // Update label color based on timer type
        label.style.background = timerState.timerType === 'focus' 
            ? 'rgba(76, 132, 255, 0.1)' 
            : timerState.timerType === 'shortBreak'
                ? 'rgba(33, 150, 243, 0.1)'
                : 'rgba(255, 152, 0, 0.1)';
    }
}

// Initialize timer
function initTimer() {
    console.log('Initializing timer...');
    
    try {
        // Validate settings
        validateTimerSettings();
        
        // Check if required elements exist
        if (!minutesDisplay || !secondsDisplay || !startButton) {
            throw new Error('Required timer elements not found');
        }
        
        // Load saved stats from Firestore
        loadTimerStats();
        
        // Load saved timer state
        loadTimerState();
        
        // Set initial values if no saved state
        if (!timerState.timeLeft) {
            timerState.timeLeft = parseInt(focusDurationInput.value) * 60;
            timerState.totalTime = timerState.timeLeft;
            updateDisplay();
            updateProgressCircle();
        }
        
        // Add event listeners
        if (startButton) {
            startButton.addEventListener('click', startTimer);
        }
        
        if (pauseButton) {
            pauseButton.addEventListener('click', pauseTimer);
        }
        
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                if (timerState.isRunning && !confirm('Are you sure you want to reset the timer?')) {
                    return;
                }
                resetTimer();
            });
        }
        
        // Add input event listeners for settings with debounce
        const debouncedUpdateSettings = debounce(updateTimerSettings, 500);
        if (focusDurationInput) {
            focusDurationInput.addEventListener('change', debouncedUpdateSettings);
        }
        
        if (shortBreakInput) {
            shortBreakInput.addEventListener('change', debouncedUpdateSettings);
        }
        
        if (longBreakInput) {
            longBreakInput.addEventListener('change', debouncedUpdateSettings);
        }
        
        if (sessionsUntilLongInput) {
            sessionsUntilLongInput.addEventListener('change', debouncedUpdateSettings);
        }
        
        console.log('Timer initialized successfully');
    } catch (error) {
        console.error('Error initializing timer:', error);
        showError('Failed to initialize timer: ' + error.message);
    }
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Load timer stats from Firestore
function loadTimerStats() {
    if (!db) {
        console.log('Database not available');
        return;
    }
    
    checkAuth().then(user => {
        // Load user's timer stats
        db.collection('users').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    timerState.completedSessions = userData.completedSessions || 0;
                    timerState.totalFocusTime = userData.totalFocusTime || 0;
                    
                    if (completedSessionsDisplay) {
                        completedSessionsDisplay.textContent = timerState.completedSessions;
                    }
                    
                    if (totalFocusTimeDisplay) {
                        totalFocusTimeDisplay.textContent = formatFocusTime(timerState.totalFocusTime);
                    }
                }
            })
            .catch(error => {
                console.error('Error loading timer stats:', error);
            });
    }).catch(error => {
        console.log('User not authenticated');
    });
}

// Save timer stats to Firestore
function saveTimerStats() {
    if (!db) return;
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).update({
            completedSessions: timerState.completedSessions,
            totalFocusTime: timerState.totalFocusTime,
            focusSessions: timerState.completedSessions // For dashboard compatibility
        }).catch(error => {
            console.error('Error saving timer stats:', error);
        });
    }).catch(error => {
        console.log('User not authenticated');
    });
}

// Update timer display
function updateDisplay() {
    if (!minutesDisplay || !secondsDisplay) return;
    
    const minutes = Math.floor(timerState.timeLeft / 60);
    const seconds = timerState.timeLeft % 60;
    
    minutesDisplay.textContent = minutes.toString().padStart(2, '0');
    secondsDisplay.textContent = seconds.toString().padStart(2, '0');
    
    // Update page title with timer
    document.title = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} - ${getTimerTypeLabel()} - Study Buddy AI`;
}

// Get timer type label
function getTimerTypeLabel() {
    switch (timerState.timerType) {
        case 'focus':
            return 'Focus Session';
        case 'shortBreak':
            return 'Short Break';
        case 'longBreak':
            return 'Long Break';
        default:
            return 'Pomodoro Timer';
    }
}

// Update progress circle
function updateProgressCircle() {
    if (!progressCircle) return;
    
    const circumference = 2 * Math.PI * 45; // 2πr where r=45
    const progress = (timerState.timeLeft / timerState.totalTime) * circumference;
    
    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    progressCircle.style.strokeDashoffset = circumference - progress;
    
    // Update circle color based on timer type
    let color = '#4CAF50'; // Green for focus
    if (timerState.timerType === 'shortBreak') {
        color = '#2196F3'; // Blue for short break
    } else if (timerState.timerType === 'longBreak') {
        color = '#FF9800'; // Orange for long break
    }
    
    progressCircle.style.stroke = color;
}

// Start timer
function startTimer() {
    if (!timerState.isRunning || timerState.isPaused) {
        try {
            validateTimerSettings();
            timerState.isRunning = true;
            timerState.isPaused = false;
            timerState.lastUpdate = Date.now();
            
            if (startButton) {
                startButton.disabled = true;
                startButton.innerHTML = '<i class="fas fa-play"></i> Running...';
            }
            
            if (pauseButton) {
                pauseButton.disabled = false;
            }
            
            if (timerCircle) {
                timerCircle.classList.add('active');
            }
            
            // Save state
            saveTimerState();
            
            timerState.timerInterval = setInterval(() => {
                if (timerState.timeLeft > 0) {
                    timerState.timeLeft--;
                    updateDisplay();
                    updateProgressCircle();
                    saveTimerState();
                } else {
                    handleTimerComplete();
                }
            }, 1000);
            
            console.log(`Started ${timerState.timerType} timer for ${Math.floor(timerState.timeLeft / 60)} minutes`);
        } catch (error) {
            showError(error.message);
        }
    }
}

// Pause timer
function pauseTimer() {
    if (timerState.isRunning && !timerState.isPaused) {
        timerState.isPaused = true;
        clearInterval(timerState.timerInterval);
        
        if (startButton) {
            startButton.disabled = false;
            startButton.innerHTML = '<i class="fas fa-play"></i> Resume';
        }
        
        if (pauseButton) {
            pauseButton.disabled = true;
        }
        
        if (timerCircle) {
            timerCircle.classList.remove('active');
        }
        
        console.log('Timer paused');
    }
}

// Reset timer
function resetTimer() {
    clearInterval(timerState.timerInterval);
    
    timerState.isRunning = false;
    timerState.isPaused = false;
    
    // Reset to focus session
    timerState.timerType = 'focus';
    timerState.timeLeft = parseInt(focusDurationInput?.value || 25) * 60;
    timerState.totalTime = timerState.timeLeft;
    
    if (startButton) {
        startButton.disabled = false;
        startButton.innerHTML = '<i class="fas fa-play"></i> Start';
    }
    
    if (pauseButton) {
        pauseButton.disabled = true;
    }
    
    if (timerCircle) {
        timerCircle.classList.remove('active');
    }
    
    updateDisplay();
    updateProgressCircle();
    
    // Reset page title
    document.title = 'Pomodoro Timer - Study Buddy AI';
    
    console.log('Timer reset');
}

// Handle timer completion
function handleTimerComplete() {
    clearInterval(timerState.timerInterval);
    
    console.log(`${timerState.timerType} session completed`);
    
    if (timerState.timerType === 'focus') {
        // Completed a focus session
        timerState.completedSessions++;
        timerState.totalFocusTime += parseInt(focusDurationInput?.value || 25);
        
        if (completedSessionsDisplay) {
            completedSessionsDisplay.textContent = timerState.completedSessions;
        }
        
        if (totalFocusTimeDisplay) {
            totalFocusTimeDisplay.textContent = formatFocusTime(timerState.totalFocusTime);
        }
        
        // Save stats to Firestore
        saveTimerStats();
        
        // Determine next break type
        const sessionsUntilLong = parseInt(sessionsUntilLongInput?.value || 4);
        if (timerState.completedSessions % sessionsUntilLong === 0) {
            timerState.timerType = 'longBreak';
            timerState.timeLeft = parseInt(longBreakInput?.value || 15) * 60;
            showNotification('Focus session complete!', 'Time for a long break.');
        } else {
            timerState.timerType = 'shortBreak';
            timerState.timeLeft = parseInt(shortBreakInput?.value || 5) * 60;
            showNotification('Focus session complete!', 'Time for a short break.');
        }
    } else {
        // Completed a break
        timerState.timerType = 'focus';
        timerState.timeLeft = parseInt(focusDurationInput?.value || 25) * 60;
        showNotification('Break complete!', 'Ready for another focus session?');
    }
    
    timerState.totalTime = timerState.timeLeft;
    timerState.isRunning = false;
    timerState.isPaused = false;
    
    if (startButton) {
        startButton.disabled = false;
        startButton.innerHTML = '<i class="fas fa-play"></i> Start';
    }
    
    if (pauseButton) {
        pauseButton.disabled = true;
    }
    
    if (timerCircle) {
        timerCircle.classList.remove('active');
    }
    
    updateDisplay();
    updateProgressCircle();
    
    // Play notification sound
    playNotificationSound();
}

// Show notification
function showNotification(title, message) {
    // Try to use browser notifications if permission granted
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: '../assets/favicon.ico'
        });
    } else if (Notification.permission !== 'denied') {
        // Request permission
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, {
                    body: message,
                    icon: '../assets/favicon.ico'
                });
            }
        });
    }
    
    // Always show alert as fallback
    alert(`${title}\n${message}`);
}

// Update timer settings
function updateTimerSettings() {
    if (!timerState.isRunning) {
        try {
            validateTimerSettings();
            if (timerState.timerType === 'focus') {
                timerState.timeLeft = parseInt(focusDurationInput?.value || 25) * 60;
                timerState.totalTime = timerState.timeLeft;
            }
            updateDisplay();
            updateProgressCircle();
        } catch (error) {
            showError(error.message);
        }
    }
}

// Format focus time for display
function formatFocusTime(minutes) {
    if (minutes < 60) {
        return `${minutes}m`;
    } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
}

// Play notification sound
function playNotificationSound() {
    try {
        // Create a simple beep sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.log('Audio notification failed:', error);
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT') return; // Don't trigger if typing in inputs
    
    switch (e.key) {
        case ' ': // Spacebar
            e.preventDefault();
            if (timerState.isRunning && !timerState.isPaused) {
                pauseTimer();
            } else {
                startTimer();
            }
            break;
        case 'r':
        case 'R':
            if (e.ctrlKey || e.metaKey) return; // Don't interfere with browser refresh
            resetTimer();
            break;
    }
});

// Initialize timer when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Timer page loaded');
    
    // Hide loading overlay
    setTimeout(() => {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
    }, 500);
    
    // Initialize timer
    initTimer();
    
    // Request notification permission on page load
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// Handle page visibility change (pause timer when tab is not visible)
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden' && timerState.isRunning && !timerState.isPaused) {
        // Save state when leaving page
        saveTimerState();
    } else if (document.visibilityState === 'visible') {
        // Update display and check if we need to adjust time
        const timeElapsed = Math.floor((Date.now() - timerState.lastUpdate) / 1000);
        if (timerState.isRunning && !timerState.isPaused) {
            timerState.timeLeft = Math.max(0, timerState.timeLeft - timeElapsed);
            if (timerState.timeLeft === 0) {
                handleTimerComplete();
            }
        }
        updateDisplay();
        updateProgressCircle();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (timerState.timerInterval) {
        clearInterval(timerState.timerInterval);
    }
});