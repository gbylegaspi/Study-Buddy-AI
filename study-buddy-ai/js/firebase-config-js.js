// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDwYeYqxzuuA07COZgB2ORb-g5a5583ZBs",
    authDomain: "study-buddy-ai-d2127.firebaseapp.com",
    projectId: "study-buddy-ai-d2127",
    messagingSenderId: "562459365865",
    appId: "1:562459365865:web:1f710be4af9f4be1747b78",
    measurementId: "G-NYRZC0DQFM"
};

// Initialize Firebase with error handling
try {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    console.log('Firebase initialized successfully');

    // Initialize services
    const auth = firebase.auth();
    const db = firebase.firestore();
    const analytics = firebase.analytics();
    console.log('Firebase services initialized successfully');

    // Check authentication state
    async function checkAuth() {
        return new Promise((resolve, reject) => {
            auth.onAuthStateChanged(user => {
                if (user) {
                    // User is signed in
                    console.log('User is signed in:', user.email);
                    resolve(user);
                } else {
                    // User is signed out
                    console.log('User is signed out');
                    reject(new Error('User not authenticated'));
                    
                    // Only redirect if we're on a protected page
                    const path = window.location.pathname;
                    if (
                        !path.endsWith('/login') &&
                        !path.endsWith('/login.html') &&
                        !path.endsWith('/') &&
                        !path.endsWith('/index.html')
                    ) {
                        window.location.href = 'login.html';
                    }
                }
            }, error => {
                console.error('Auth state change error:', error);
                reject(error);
            });
        });
    }

    // Export Firebase instances
    window.db = db;
    window.auth = auth;
    window.analytics = analytics;
    window.checkAuth = checkAuth;

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

} catch (error) {
    console.error('Firebase initialization error:', error);
    alert('Failed to initialize Firebase. Please check the console for details.');
}
