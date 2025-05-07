// DOM Elements
const profileForm = document.getElementById('profile-form');
const displayNameInput = document.getElementById('display-name');
const emailInput = document.getElementById('email');
const studyGoalInput = document.getElementById('study-goal');
const themeButtons = document.querySelectorAll('.theme-btn');
const emailNotificationsCheckbox = document.getElementById('email-notifications');
const reminderNotificationsCheckbox = document.getElementById('reminder-notifications');
const changePasswordBtn = document.getElementById('change-password');
const deleteAccountBtn = document.getElementById('delete-account');
const loadingOverlay = document.querySelector('.loading-overlay');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Load user profile data
    loadUserProfile();
    
    // Event listeners
    if (profileForm) {
        profileForm.addEventListener('submit', saveProfileChanges);
    }
    
    // Theme selection
    themeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            setTheme(this.dataset.theme);
        });
    });
    
    // Notification preferences
    if (emailNotificationsCheckbox) {
        emailNotificationsCheckbox.addEventListener('change', saveNotificationPreferences);
    }
    
    if (reminderNotificationsCheckbox) {
        reminderNotificationsCheckbox.addEventListener('change', saveNotificationPreferences);
    }
    
    // Account management
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', showChangePasswordPrompt);
    }
    
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', showDeleteAccountConfirmation);
    }
    
    // Hide loading spinner after delay
    setTimeout(() => {
        loadingOverlay.classList.add('hidden');
    }, 500);
});

// Load user profile data from Firestore
function loadUserProfile() {
    if (!db) return;
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    checkAuth().then(user => {
        // Set email (always available from auth)
        if (emailInput) {
            emailInput.value = user.email || '';
        }
        
        // Set display name (may come from auth or Firestore)
        if (displayNameInput) {
            displayNameInput.value = user.displayName || '';
        }
        
        // Get additional profile data from Firestore
        db.collection('users').doc(user.uid)
            .get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    
                    // Study goal
                    if (studyGoalInput && userData.studyGoal) {
                        studyGoalInput.value = userData.studyGoal;
                    }
                    
                    // Theme preference
                    if (userData.theme) {
                        setTheme(userData.theme, false); // Don't save again
                    }
                    
                    // Notification preferences
                    if (emailNotificationsCheckbox && userData.notifications) {
                        emailNotificationsCheckbox.checked = userData.notifications.email !== false;
                    }
                    
                    if (reminderNotificationsCheckbox && userData.notifications) {
                        reminderNotificationsCheckbox.checked = userData.notifications.reminders !== false;
                    }
                }
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            })
            .catch(error => {
                console.error('Error loading profile:', error);
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            });
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Save profile changes
function saveProfileChanges(e) {
    e.preventDefault();
    
    if (!db) return;
    
    // Get values
    const displayName = displayNameInput.value.trim();
    const studyGoal = parseInt(studyGoalInput.value) || 2;
    
    // Validate
    if (!displayName) {
        alert('Please enter a display name');
        return;
    }
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    checkAuth().then(user => {
        // Update display name in auth profile
        user.updateProfile({
            displayName: displayName
        }).then(() => {
            // Update user data in Firestore
            return db.collection('users').doc(user.uid).update({
                name: displayName,
                studyGoal: studyGoal,
                updatedAt: new Date()
            });
        }).then(() => {
            // Update UI
            if (userName) {
                userName.textContent = displayName;
            }
            
            if (userInitial) {
                userInitial.textContent = displayName.charAt(0).toUpperCase();
            }
            
            if (headerName) {
                headerName.textContent = displayName.split(' ')[0];
            }
            
            // Show success message
            alert('Profile updated successfully');
            
            // Hide loading
            loadingOverlay.classList.add('hidden');
        }).catch(error => {
            console.error('Error updating profile:', error);
            alert('Failed to update profile. Please try again.');
            
            // Hide loading
            loadingOverlay.classList.add('hidden');
        });
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Set theme
function setTheme(theme, save = true) {
    // Update UI
    themeButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === theme) {
            btn.classList.add('active');
        }
    });
    
    // Apply theme to body
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
    
    // Save preference to Firestore
    if (save) {
        checkAuth().then(user => {
            db.collection('users').doc(user.uid).update({
                theme: theme
            }).catch(error => {
                console.error('Error saving theme preference:', error);
            });
        }).catch(error => {
            console.error('Authentication check failed:', error);
        });
    }
    
    // Save to localStorage for persistence
    localStorage.setItem('theme', theme);
}

// Save notification preferences
function saveNotificationPreferences() {
    if (!db) return;
    
    const emailNotifs = emailNotificationsCheckbox.checked;
    const reminderNotifs = reminderNotificationsCheckbox.checked;
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).update({
            'notifications.email': emailNotifs,
            'notifications.reminders': reminderNotifs
        }).catch(error => {
            console.error('Error saving notification preferences:', error);
            alert('Failed to save notification preferences. Please try again.');
        });
    }).catch(error => {
        console.error('Authentication check failed:', error);
    });
}

// Show change password prompt
function showChangePasswordPrompt() {
    const email = auth.currentUser.email;
    
    if (confirm(`A password reset email will be sent to ${email}. Continue?`)) {
        // Show loading
        loadingOverlay.classList.remove('hidden');
        
        // Send password reset email
        auth.sendPasswordResetEmail(email)
            .then(() => {
                alert(`Password reset email sent to ${email}. Please check your inbox.`);
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            })
            .catch(error => {
                console.error('Error sending password reset email:', error);
                alert(`Failed to send password reset email: ${error.message}`);
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            });
    }
}

// Show delete account confirmation
function showDeleteAccountConfirmation() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        return;
    }
    
    // Second confirmation
    if (!confirm('All your data will be permanently deleted. Are you absolutely sure?')) {
        return;
    }
    
    // Ask for password for security
    const password = prompt('Please enter your password to confirm account deletion:');
    
    if (!password) {
        return; // User canceled
    }
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    // Reauthenticate user
    const user = auth.currentUser;
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
    
    user.reauthenticateWithCredential(credential)
        .then(() => {
            // Delete user data from Firestore first
            return deleteUserData(user.uid);
        })
        .then(() => {
            // Then delete the user account
            return user.delete();
        })
        .then(() => {
            alert('Your account has been deleted. You will be redirected to the login page.');
            
            // Redirect to login page
            window.location.href = '/login.html';
        })
        .catch(error => {
            console.error('Error deleting account:', error);
            
            if (error.code === 'auth/wrong-password') {
                alert('Incorrect password. Account deletion canceled.');
            } else {
                alert(`Failed to delete account: ${error.message}`);
            }
            
            // Hide loading
            loadingOverlay.classList.add('hidden');
        });
}

// Delete user data from Firestore
function deleteUserData(userId) {
    if (!db || !userId) return Promise.reject('No database or user ID');
    
    // Get references to all collections
    const collectionsToDelete = [
        'tasks',
        'notes',
        'flashcard_decks',
        'pomodoro_sessions'
    ];
    
    const promises = [];
    
    // Delete each collection
    collectionsToDelete.forEach(collectionName => {
        const deleteCollectionPromise = db.collection('users').doc(userId).collection(collectionName)
            .get()
            .then(querySnapshot => {
                const batch = db.batch();
                
                querySnapshot.forEach(doc => {
                    // For flashcard_decks, need to delete cards subcollection first
                    if (collectionName === 'flashcard_decks') {
                        // This is handled separately below
                    }
                    
                    batch.delete(doc.ref);
                });
                
                return batch.commit();
            });
        
        promises.push(deleteCollectionPromise);
    });
    
    // Special handling for flashcard decks to delete cards subcollection
    const deleteFlashcardCardsPromise = db.collection('users').doc(userId).collection('flashcard_decks')
        .get()
        .then(querySnapshot => {
            const cardDeletionPromises = [];
            
            querySnapshot.forEach(deckDoc => {
                const deleteCardsPromise = deckDoc.ref.collection('cards')
                    .get()
                    .then(cardsSnapshot => {
                        const batch = db.batch();
                        
                        cardsSnapshot.forEach(cardDoc => {
                            batch.delete(cardDoc.ref);
                        });
                        
                        return batch.commit();
                    });
                
                cardDeletionPromises.push(deleteCardsPromise);
            });
            
            return Promise.all(cardDeletionPromises);
        });
    
    promises.push(deleteFlashcardCardsPromise);
    
    // Finally, delete the user document itself
    const deleteUserDocPromise = db.collection('users').doc(userId)
        .delete();
    
    promises.push(deleteUserDocPromise);
    
    return Promise.all(promises);
}

// Apply saved theme on page load
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme, false); // Don't save again
    }
    
    // Add custom styles
    const style = document.createElement('style');
    style.textContent = `
        .profile-container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .profile-section {
            background-color: white;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            padding: 30px;
            margin-bottom: 30px;
        }
        
        .profile-section h2 {
            margin-bottom: 20px;
            font-size: 1.3rem;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 10px;
        }
        
        .profile-form {
            display: grid;
            gap: 20px;
        }
        
        .preferences-form {
            display: grid;
            gap: 20px;
        }
        
        .theme-options {
            display: flex;
            gap: 15px;
        }
        
        .theme-btn {
            background-color: #f5f7fb;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            padding: 10px 15px;
            cursor: pointer;
            display: flex;
            align-items: center;
            transition: all 0.3s ease;
        }
        
        .theme-btn i {
            margin-right: 8px;
        }
        
        .theme-btn.light {
            background-color: white;
        }
        
        .theme-btn.dark {
            background-color: #343a40;
            color: white;
        }
        
        .theme-btn.active {
            border-color: var(--primary-color);
            box-shadow: 0 0 0 2px rgba(76, 132, 255, 0.2);
        }
        
        .checkbox-group {
            display: grid;
            gap: 10px;
        }
        
        .checkbox-label {
            display: flex;
            align-items: center;
            cursor: pointer;
        }
        
        .checkbox-label input {
            margin-right: 10px;
        }
        
        .account-actions {
            display: flex;
            gap: 15px;
        }
        
        /* Theme classes */
        body.theme-light {
            --body-bg: #f5f7fb;
            --text-color: #333;
        }
        
        body.theme-dark {
            --body-bg: #343a40;
            --text-color: #f8f9fa;
            --border-color: #495057;
        }
        
        body.theme-dark .profile-section,
        body.theme-dark .theme-btn.light {
            background-color: #495057;
            color: #f8f9fa;
        }
        
        body.theme-dark .theme-btn.dark {
            background-color: #212529;
        }
        
        body.theme-dark input[type="text"],
        body.theme-dark input[type="email"],
        body.theme-dark input[type="number"] {
            background-color: #495057;
            color: #f8f9fa;
            border-color: #6c757d;
        }
        
        body.theme-dark input[type="text"]:focus,
        body.theme-dark input[type="email"]:focus,
        body.theme-dark input[type="number"]:focus {
            box-shadow: 0 0 0 2px rgba(76, 132, 255, 0.3);
        }
    `;
    document.head.appendChild(style);
});