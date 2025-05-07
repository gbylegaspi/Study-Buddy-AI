

// Handle password reset
const forgotPasswordLink = document.querySelector('.forgot-password');
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        
        if (!email) {
            alert('Please enter your email address first');
            return;
        }
        
        // Show loading
        loadingOverlay.classList.remove('hidden');
        
        auth.sendPasswordResetEmail(email)
            .then(() => {
                // Hide loading
                loadingOverlay.classList.add('hidden');
                
                alert(`Password reset email sent to ${email}`);
            })
            .catch((error) => {
                // Hide loading
                loadingOverlay.classList.add('hidden');
                
                alert(`Password reset failed: ${error.message}`);
            });
    });
}

// Check if user is already logged in
auth.onAuthStateChanged(user => {
    if (user && window.location.href.includes('login.html')) {
        // User is signed in and on login page, redirect to dashboard
        window.location.href = 'dashboard.html';
    }
});

// Check for signup mode on page load
document.addEventListener('DOMContentLoaded', checkForSignupMode);
// DOM Elements
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginMessage = document.getElementById('login-message');
const signupMessage = document.getElementById('signup-message');
const gotoSignup = document.getElementById('goto-signup');
const gotoLogin = document.getElementById('goto-login');
const authTitle = document.getElementById('auth-title');
const togglePasswordButtons = document.querySelectorAll('.toggle-password');
const loadingOverlay = document.querySelector('.loading-overlay');

// Check URL parameters for signup mode
function checkForSignupMode() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('signup') && urlParams.get('signup') === 'true') {
        showSignupForm();
    }
}

// Toggle between login and signup forms
function showLoginForm() {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    loginMessage.classList.remove('hidden');
    signupMessage.classList.add('hidden');
    authTitle.textContent = 'Login to your account';
}

function showSignupForm() {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    loginMessage.classList.add('hidden');
    signupMessage.classList.remove('hidden');
    authTitle.textContent = 'Create your account';
}

// Event Listeners
if (gotoSignup) {
    gotoSignup.addEventListener('click', function(e) {
        e.preventDefault();
        showSignupForm();
    });
}

if (gotoLogin) {
    gotoLogin.addEventListener('click', function(e) {
        e.preventDefault();
        showLoginForm();
    });
}

// Handle form submissions
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        // Show loading
        loadingOverlay.classList.remove('hidden');
        
        // Sign in with Firebase
        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            })
            .catch((error) => {
                // Hide loading
                loadingOverlay.classList.add('hidden');
                
                alert(`Login failed: ${error.message}`);
            });
    });
}

if (signupForm) {
    signupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const terms = document.getElementById('terms').checked;
        
        if (!terms) {
            alert('You must agree to the Terms of Service and Privacy Policy');
            return;
        }
        
        // Show loading
        loadingOverlay.classList.remove('hidden');
        
        // Create user with Firebase
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                
                // Update profile with name
                return user.updateProfile({
                    displayName: name
                }).then(() => {
                    // Create user document in Firestore
                    if (db) {
                        return db.collection('users').doc(user.uid).set({
                            name: name,
                            email: email,
                            createdAt: new Date(),
                            subjects: []
                        });
                    }
                    return Promise.resolve();
                });
            })
            .then(() => {
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            })
            .catch((error) => {
                // Hide loading
                loadingOverlay.classList.add('hidden');
                
                alert(`Sign up failed: ${error.message}`);
            });
    });
}

// Google Sign-In
const googleButtons = document.querySelectorAll('.btn-google');
googleButtons.forEach(button => {
    button.addEventListener('click', function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        
        // Show loading
        loadingOverlay.classList.remove('hidden');
        
        auth.signInWithPopup(provider)
            .then((result) => {
                const user = result.user;
                
                // Check if new user
                const isNewUser = result.additionalUserInfo.isNewUser;
                
                if (isNewUser && db) {
                    // Create user document in Firestore
                    return db.collection('users').doc(user.uid).set({
                        name: user.displayName,
                        email: user.email,
                        createdAt: new Date(),
                        subjects: []
                    });
                }
                
                return Promise.resolve();
            })
            .then(() => {
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            })
            .catch((error) => {
                // Hide loading
                loadingOverlay.classList.add('hidden');
                
                alert(`Google sign-in failed: ${error.message}`);
            });
    });
});

// Toggle password visibility
togglePasswordButtons.forEach(button => {
    button.addEventListener('click', function() {
        const passwordField = this.previousElementSibling;
        const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordField.setAttribute('type', type);
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });
});

// Password strength checker
if (signupForm) {
    const passwordInput = document.getElementById('signup-password');
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    
    passwordInput.addEventListener('input', function() {
        const password = this.value;
        let strength = 0;
        
        if (password.length >= 8) strength += 1;
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        if (/[^A-Za-z0-9]/.test(password)) strength += 1;
        
        const strengthContainer = this.closest('.form-group');
        strengthContainer.classList.remove('weak', 'medium', 'strong');
        
        if (password.length === 0) {
            strengthText.textContent = 'Password strength';
        } else if (strength < 2) {
            strengthContainer.classList.add('weak');
            strengthText.textContent = 'Weak password';
        } else if (strength < 4) {
            strengthContainer.classList.add('medium');
            strengthText.textContent = 'Medium password';
        } else {
            strengthContainer.classList.add('strong');
            strengthText.textContent = 'Strong password';
        }
    });
}