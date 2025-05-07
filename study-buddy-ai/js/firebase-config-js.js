// Firebase configuration
// Replace these values with your Firebase project config
const firebaseConfig = {
    apiKey: "AIzaSyDwYeYqxzuuA07COZgB2ORb-g5a5583ZBs",
    authDomain: "study-buddy-ai-d2127.firebaseapp.com",
    projectId: "study-buddy-ai-d2127",
    storageBucket: "study-buddy-ai-d2127.appspot.com",
    messagingSenderId: "562459365865",
    appId: "1:562459365865:web:1f710be4af9f4be1747b78",
    measurementId: "G-NYRZC0DQFM"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore && firebase.firestore();
const analytics = firebase.analytics && firebase.analytics();

// Function to check if user is authenticated
function checkAuth() {
    return new Promise((resolve, reject) => {
        auth.onAuthStateChanged(user => {
            if (user) {
                // User is signed in
                resolve(user);
            } else {
                // User is signed out
                reject("User not authenticated");
                
                // Redirect to login page if not on login page already
                if (!window.location.href.includes('login.html')) {
                    window.location.href = 'login.html';
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
