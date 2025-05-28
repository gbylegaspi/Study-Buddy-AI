// DOM Elements
const notesList = document.getElementById('notes-list');
const noteTitle = document.getElementById('note-title');
const saveNoteBtn = document.getElementById('save-note');
const deleteNoteBtn = document.getElementById('delete-note');
const noteSearch = document.getElementById('note-search');
const newNoteBtn = document.getElementById('new-note');
const notesLoadingOverlay = document.querySelector('.loading-overlay');
const colorPicker = document.getElementById('note-color');

// Quill editor
let quill;

// Global variables
let currentNoteId = null;
let notes = [];
let autoSaveTimeout = null;
let isDirty = false;
let isDeleting = false;
let isInitialized = false;

// Debug function
function debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
        const timestamp = new Date().toISOString();
        if (data) {
            console.log(`[${timestamp}] ${message}:`, data);
        } else {
            console.log(`[${timestamp}] ${message}`);
        }
    }
}

// Check if required elements exist
function checkRequiredElements() {
    const requiredElements = {
        'notes-list': notesList,
        'note-title': noteTitle,
        'save-note': saveNoteBtn,
        'delete-note': deleteNoteBtn,
        'note-search': noteSearch,
        'editor': document.getElementById('editor'),
        'note-color': colorPicker
    };

    const missingElements = Object.entries(requiredElements)
        .filter(([_, element]) => !element)
        .map(([id]) => id);

    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements);
        showError(`Missing required elements: ${missingElements.join(', ')}`);
        return false;
    }

    return true;
}

// Initialize Quill editor
function initializeQuill() {
    try {
        quill = new Quill('#editor', {
            theme: 'snow',
            placeholder: 'Start writing your notes...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'header': 1 }, { 'header': 2 }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['link'],
                    ['clean']
                ]
            }
        });
        debug('Quill editor initialized successfully');
        
        // Add change listener for auto-save
        quill.on('text-change', function(delta, oldDelta, source) {
            if (source === 'user' && !isDeleting) {
                isDirty = true;
                scheduleAutoSave();
            }
        });
        
        return true;
    } catch (error) {
        console.error('Failed to initialize Quill editor:', error);
        showError('Failed to initialize editor. Please refresh the page.');
        return false;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    debug('Initializing notes page...');
    
    // Check if all required elements exist
    if (!checkRequiredElements()) {
        debug('Initialization failed: Missing required elements');
        return;
    }
    
    // Initialize Quill editor
    if (!initializeQuill()) {
        return;
    }
    
    // Add title change listener
    if (noteTitle) {
        noteTitle.addEventListener('input', function() {
            if (!isDeleting) {
                isDirty = true;
                scheduleAutoSave();
            }
        });
    }
    
    // Add color picker change listener
    if (colorPicker) {
        colorPicker.addEventListener('change', function() {
            if (currentNoteId && !isDeleting) {
                isDirty = true;
                scheduleAutoSave();
            }
        });
    }
    
    try {
        // Load notes
        await loadNotes();
        
        // Event listeners
        if (saveNoteBtn) {
            saveNoteBtn.addEventListener('click', function() {
                saveNote(false); // Manual save
            });
        }
        
        if (deleteNoteBtn) {
            deleteNoteBtn.addEventListener('click', deleteNote);
        }
        
        if (noteSearch) {
            noteSearch.addEventListener('input', filterNotes);
        }
        
        // Create new note button (if it exists in the header)
        if (newNoteBtn) {
            newNoteBtn.addEventListener('click', createNewNote);
        }
        
        // Add floating new note button if it doesn't exist
        addFloatingNewNoteButton();
        
        // Add beforeunload event listener to prevent data loss
        window.addEventListener('beforeunload', function(e) {
            if (isDirty && !isDeleting) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
        isInitialized = true;
        debug('Notes page initialization complete');
    } catch (error) {
        console.error('Failed to initialize notes page:', error);
        showError('Failed to initialize notes page. Please refresh.');
    } finally {
        // Hide loading spinner after delay
        setTimeout(() => {
            if (notesLoadingOverlay) {
                notesLoadingOverlay.classList.add('hidden');
            }
        }, 500);
    }
});

// Schedule auto-save
function scheduleAutoSave() {
    if (!isInitialized) return;
    
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }
    autoSaveTimeout = setTimeout(() => {
        saveNote(true); // Auto-save
    }, 2000);
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(e) {
    if (!isInitialized) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return; // Don't interfere with input fields
    }
    
    // Ctrl/Cmd + S for save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveNote(false);
    }
    
    // Ctrl/Cmd + N for new note
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNewNote();
    }
}

// Add floating new note button
function addFloatingNewNoteButton() {
    if (!isInitialized) return;
    
    if (!newNoteBtn && notesList) {
        const headerActions = document.querySelector('.content-header');
        if (headerActions) {
            const button = document.createElement('button');
            button.id = 'new-note';
            button.className = 'btn btn-primary';
            button.innerHTML = '<i class="fas fa-plus"></i> New Note';
            button.addEventListener('click', createNewNote);
            headerActions.appendChild(button);
        }
    }
}

// Load notes from Firestore
async function loadNotes() {
    if (!db) {
        debug('Database not initialized');
        showError('Database not available. Please refresh the page.');
        return;
    }
    
    debug('Loading notes...');
    
    // Show loading
    if (notesLoadingOverlay) {
        notesLoadingOverlay.classList.remove('hidden');
    }
    
    try {
        const user = await checkAuth();
        const notesRef = db.collection('users').doc(user.uid).collection('notes');
        
        const snapshot = await notesRef.orderBy('updatedAt', 'desc').get();
        
        notes = [];
        notesList.innerHTML = '';
        
        if (snapshot.empty) {
            showEmptyState();
            return;
        }
        
        snapshot.forEach(doc => {
            const note = { id: doc.id, ...doc.data() };
            notes.push(note);
            createNoteElement(note);
        });
        
        // Select first note if none selected
        if (!currentNoteId && notes.length > 0) {
            selectNote(notes[0]);
        }
    } catch (error) {
        console.error('Error loading notes:', error);
        showError('Failed to load notes. Please refresh the page.');
    } finally {
        if (notesLoadingOverlay) {
            notesLoadingOverlay.classList.add('hidden');
        }
    }
}

// Save note to Firestore
async function saveNote(isAutoSave = false) {
    if (!isInitialized || !currentNoteId) return;
    
    try {
        const user = await checkAuth();
        const noteRef = db.collection('users').doc(user.uid).collection('notes').doc(currentNoteId);
        
        const title = noteTitle.value.trim();
        const content = quill.root.innerHTML;
        const color = colorPicker.value;
        
        if (!title) {
            showError('Note title cannot be empty');
            return;
        }
        
        await noteRef.update({
            title: title,
            content: content,
            color: color,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        isDirty = false;
        
        if (!isAutoSave) {
            showToast('Note saved successfully');
        }
        
        // Update note in list
        const noteData = {
            id: currentNoteId,
            title: title,
            content: content,
            color: color,
            updatedAt: new Date()
        };
        updateNoteInList(noteData);
        
    } catch (error) {
        console.error('Error saving note:', error);
        showError('Failed to save note. Please try again.');
    }
}

// Create new note
async function createNewNote() {
    if (!isInitialized) return;
    
    try {
        const user = await checkAuth();
        const notesRef = db.collection('users').doc(user.uid).collection('notes');
        
        const newNote = {
            title: 'Untitled Note',
            content: '',
            color: '#ffffff',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await notesRef.add(newNote);
        
        // Add to local array
        const note = { id: docRef.id, ...newNote };
        notes.unshift(note);
        
        // Create element
        createNoteElement(note);
        
        // Select new note
        selectNote(note);
        
        // Focus title
        noteTitle.focus();
        noteTitle.select();
        
        showToast('New note created');
        
    } catch (error) {
        console.error('Error creating note:', error);
        showError('Failed to create new note. Please try again.');
    }
}

// Delete note
async function deleteNote() {
    if (!isInitialized || !currentNoteId) return;
    
    if (!confirm('Are you sure you want to delete this note?')) {
        return;
    }
    
    isDeleting = true;
    
    try {
        const user = await checkAuth();
        const noteRef = db.collection('users').doc(user.uid).collection('notes').doc(currentNoteId);
        
        await noteRef.delete();
        
        // Remove from local array
        notes = notes.filter(note => note.id !== currentNoteId);
        
        // Remove element
        const noteElement = document.querySelector(`[data-note-id="${currentNoteId}"]`);
        if (noteElement) {
            noteElement.remove();
        }
        
        // Clear editor
        currentNoteId = null;
        noteTitle.value = '';
        quill.setContents([]);
        colorPicker.value = '#ffffff';
        
        // Disable buttons
        saveNoteBtn.disabled = true;
        deleteNoteBtn.disabled = true;
        noteTitle.disabled = true;
        colorPicker.disabled = true;
        
        // Show empty state if no notes left
        if (notes.length === 0) {
            showEmptyState();
        } else {
            // Select first note
            selectNote(notes[0]);
        }
        
        showToast('Note deleted successfully');
        
    } catch (error) {
        console.error('Error deleting note:', error);
        showError('Failed to delete note. Please try again.');
    } finally {
        isDeleting = false;
    }
}

// Filter notes
function filterNotes() {
    if (!isInitialized) return;
    
    const searchTerm = noteSearch.value.toLowerCase().trim();
    
    notes.forEach(note => {
        const noteElement = document.querySelector(`[data-note-id="${note.id}"]`);
        if (noteElement) {
            const title = note.title.toLowerCase();
            const content = getTextPreview(note.content).toLowerCase();
            
            if (title.includes(searchTerm) || content.includes(searchTerm)) {
                noteElement.style.display = '';
            } else {
                noteElement.style.display = 'none';
            }
        }
    });
}

// Update note in list
function updateNoteInList(noteData) {
    if (!isInitialized) return;
    
    const noteElement = document.querySelector(`[data-note-id="${noteData.id}"]`);
    if (noteElement) {
        const titleElement = noteElement.querySelector('.note-title');
        const previewElement = noteElement.querySelector('.note-preview');
        const dateElement = noteElement.querySelector('.note-date');
        
        if (titleElement) titleElement.textContent = noteData.title;
        if (previewElement) previewElement.textContent = getTextPreview(noteData.content);
        if (dateElement) dateElement.textContent = formatDate(noteData.updatedAt);
        
        noteElement.style.backgroundColor = noteData.color;
    }
}

// Format date
function formatDate(date) {
    if (!date) return '';
    
    const now = new Date();
    const noteDate = date instanceof Date ? date : new Date(date);
    
    if (isNaN(noteDate.getTime())) {
        return '';
    }
    
    const diff = now - noteDate;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 7) {
        return noteDate.toLocaleDateString();
    } else if (days > 0) {
        return `${days} day${days === 1 ? '' : 's'} ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    } else {
        return 'Just now';
    }
}

// Show empty state
function showEmptyState() {
    if (!isInitialized) return;
    
    notesList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-sticky-note"></i>
            <p>No notes yet. Create your first note!</p>
        </div>
    `;
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Show toast message
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Create note element
function createNoteElement(note) {
    if (!isInitialized) return;
    
    const noteElement = document.createElement('div');
    noteElement.className = 'note-item';
    noteElement.dataset.noteId = note.id;
    noteElement.style.backgroundColor = note.color;
    
    noteElement.innerHTML = `
        <h3 class="note-title">${escapeHtml(note.title)}</h3>
        <p class="note-preview">${getTextPreview(note.content)}</p>
        <span class="note-date">${formatDate(note.updatedAt)}</span>
    `;
    
    noteElement.addEventListener('click', () => selectNote(note));
    
    notesList.insertBefore(noteElement, notesList.firstChild);
}

// Get text preview from HTML content
function getTextPreview(htmlContent, maxLength = 100) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Escape HTML special characters
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Select note
function selectNote(note) {
    if (!isInitialized) return;
    
    // Update current note
    currentNoteId = note.id;
    
    // Update UI
    noteTitle.value = note.title;
    quill.root.innerHTML = note.content;
    colorPicker.value = note.color;
    
    // Enable buttons
    saveNoteBtn.disabled = false;
    deleteNoteBtn.disabled = false;
    noteTitle.disabled = false;
    colorPicker.disabled = false;
    
    // Update selected state
    document.querySelectorAll('.note-item').forEach(element => {
        element.classList.remove('active');
    });
    
    const noteElement = document.querySelector(`[data-note-id="${note.id}"]`);
    if (noteElement) {
        noteElement.classList.add('active');
    }
    
    // Focus editor
    quill.focus();
}