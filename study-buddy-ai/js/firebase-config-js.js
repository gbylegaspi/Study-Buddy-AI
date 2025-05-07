// Firebase configuration
// Replace these values with your Firebase project config
const firebaseConfig = {
    apiKey: "AIzaSyDxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx",
    authDomain: "study-buddy-ai-d2127.firebaseapp.com",
    projectId: "study-buddy-ai-d2127",
    storageBucket: "study-buddy-ai-d2127.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Auth
const auth = firebase.auth();

// Check authentication state
async function checkAuth() {
    return new Promise((resolve, reject) => {
        auth.onAuthStateChanged(user => {
            if (user) {
                // User is signed in
                resolve(user);
            } else {
                // User is signed out
                reject(new Error('User not authenticated'));
                
                // Redirect to login page if not on login page already
                if (!window.location.href.includes('login.html')) {
                    window.location.href = '../index.html';
                }
            }
        });
    });
}

// Protect routes that require authentication
const path = window.location.pathname;
if (
  !path.endsWith('/login') &&
  !path.endsWith('/login.html') &&
  !path.endsWith('/') && // for index
  !path.endsWith('/index.html')
) {
  checkAuth().catch(error => {
    console.error("Authentication check failed:", error);
  });
}

// Export Firebase instances
window.db = db;
window.auth = auth;
window.checkAuth = checkAuth;
