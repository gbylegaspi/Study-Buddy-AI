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

// Timer state
let timerState = {
    isRunning: false,
    isPaused: false,
    timeLeft: 0,
    totalTime: 0,
    timerType: 'focus', // 'focus', 'shortBreak', 'longBreak'
    completedSessions: 0,
    totalFocusTime: 0,
    timerInterval: null
};

// Initialize timer
function initTimer() {
    // Set initial values
    timerState.timeLeft = parseInt(focusDurationInput.value) * 60;
    timerState.totalTime = timerState.timeLeft;
    updateDisplay();
    updateProgressCircle();
    
    // Add event listeners
    startButton.addEventListener('click', startTimer);
    pauseButton.addEventListener('click', pauseTimer);
    resetButton.addEventListener('click', resetTimer);
    
    // Add input event listeners for settings
    focusDurationInput.addEventListener('change', updateTimerSettings);
    shortBreakInput.addEventListener('change', updateTimerSettings);
    longBreakInput.addEventListener('change', updateTimerSettings);
    sessionsUntilLongInput.addEventListener('change', updateTimerSettings);
}

// Update timer display
function updateDisplay() {
    const minutes = Math.floor(timerState.timeLeft / 60);
    const seconds = timerState.timeLeft % 60;
    
    minutesDisplay.textContent = minutes.toString().padStart(2, '0');
    secondsDisplay.textContent = seconds.toString().padStart(2, '0');
}

// Update progress circle
function updateProgressCircle() {
    const circumference = 2 * Math.PI * 45; // 2πr where r=45
    const progress = (timerState.timeLeft / timerState.totalTime) * circumference;
    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    progressCircle.style.strokeDashoffset = circumference - progress;
}

// Start timer
function startTimer() {
    if (!timerState.isRunning || timerState.isPaused) {
        timerState.isRunning = true;
        timerState.isPaused = false;
        
        startButton.disabled = true;
        pauseButton.disabled = false;
        timerCircle.classList.add('active');
        
        timerState.timerInterval = setInterval(() => {
            if (timerState.timeLeft > 0) {
                timerState.timeLeft--;
                updateDisplay();
                updateProgressCircle();
            } else {
                handleTimerComplete();
            }
        }, 1000);
    }
}

// Pause timer
function pauseTimer() {
    if (timerState.isRunning && !timerState.isPaused) {
        timerState.isPaused = true;
        clearInterval(timerState.timerInterval);
        
        startButton.disabled = false;
        pauseButton.disabled = true;
        timerCircle.classList.remove('active');
        
        startButton.innerHTML = '<i class="fas fa-play"></i> Resume';
    }
}

// Reset timer
function resetTimer() {
    clearInterval(timerState.timerInterval);
    
    timerState.isRunning = false;
    timerState.isPaused = false;
    timerState.timeLeft = parseInt(focusDurationInput.value) * 60;
    timerState.totalTime = timerState.timeLeft;
    
    startButton.disabled = false;
    pauseButton.disabled = true;
    timerCircle.classList.remove('active');
    
    startButton.innerHTML = '<i class="fas fa-play"></i> Start';
    updateDisplay();
    updateProgressCircle();
}

// Handle timer completion
function handleTimerComplete() {
    clearInterval(timerState.timerInterval);
    
    if (timerState.timerType === 'focus') {
        timerState.completedSessions++;
        timerState.totalFocusTime += parseInt(focusDurationInput.value);
        completedSessionsDisplay.textContent = timerState.completedSessions;
        totalFocusTimeDisplay.textContent = timerState.totalFocusTime;
        
        // Check if it's time for a long break
        if (timerState.completedSessions % parseInt(sessionsUntilLongInput.value) === 0) {
            timerState.timerType = 'longBreak';
            timerState.timeLeft = parseInt(longBreakInput.value) * 60;
        } else {
            timerState.timerType = 'shortBreak';
            timerState.timeLeft = parseInt(shortBreakInput.value) * 60;
        }
    } else {
        timerState.timerType = 'focus';
        timerState.timeLeft = parseInt(focusDurationInput.value) * 60;
    }
    
    timerState.totalTime = timerState.timeLeft;
    timerState.isRunning = false;
    
    startButton.disabled = false;
    pauseButton.disabled = true;
    timerCircle.classList.remove('active');
    
    startButton.innerHTML = '<i class="fas fa-play"></i> Start';
    updateDisplay();
    updateProgressCircle();
    
    // Play notification sound
    playNotificationSound();
}

// Update timer settings
function updateTimerSettings() {
    if (!timerState.isRunning) {
        if (timerState.timerType === 'focus') {
            timerState.timeLeft = parseInt(focusDurationInput.value) * 60;
            timerState.totalTime = timerState.timeLeft;
        }
        updateDisplay();
        updateProgressCircle();
    }
}

// Play notification sound
function playNotificationSound() {
    const audio = new Audio('../assets/notification.mp3');
    audio.play().catch(error => {
        console.log('Audio playback failed:', error);
    });
}

// Initialize timer when DOM is loaded
document.addEventListener('DOMContentLoaded', initTimer); 