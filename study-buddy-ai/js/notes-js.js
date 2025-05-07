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

// Debug function
function debug(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
        console.log(`[${timestamp}] ${message}:`, data);
    } else {
        console.log(`[${timestamp}] ${message}`);
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
        'new-note': newNoteBtn,
        'editor': document.getElementById('editor'),
        'note-color': colorPicker
    };

    const missingElements = Object.entries(requiredElements)
        .filter(([_, element]) => !element)
        .map(([id]) => id);

    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements);
        return false;
    }

    return true;
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    debug('Initializing notes page...');
    
    // Check if all required elements exist
    if (!checkRequiredElements()) {
        debug('Initialization failed: Missing required elements');
        return;
    }
    
    // Initialize Quill editor
    try {
        quill = new Quill('#editor', {
            theme: 'snow',
            placeholder: 'Start writing...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'header': 1 }, { 'header': 2 }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['clean']
                ]
            }
        });
        debug('Quill editor initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Quill editor:', error);
        return;
    }
    
    // Add change listener for auto-save
    quill.on('text-change', function() {
        if (isDeleting) return;
        isDirty = true;
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
        }
        autoSaveTimeout = setTimeout(autoSaveNote, 2000);
    });
    
    // Add color picker change listener
    if (colorPicker) {
        colorPicker.addEventListener('change', function() {
            if (currentNoteId) {
                isDirty = true;
                saveNote();
            }
        });
    }
    
    // Load notes
    loadNotes();
    
    // Event listeners
    if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', saveNote);
    }
    
    if (deleteNoteBtn) {
        deleteNoteBtn.addEventListener('click', deleteNote);
    }
    
    if (noteSearch) {
        noteSearch.addEventListener('input', filterNotes);
    }
    
    if (newNoteBtn) {
        newNoteBtn.addEventListener('click', createNewNote);
    }
    
    // Add beforeunload event listener
    window.addEventListener('beforeunload', function(e) {
        if (isDirty && !isDeleting) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    
    // Hide loading spinner after delay
    setTimeout(() => {
        if (notesLoadingOverlay) {
            notesLoadingOverlay.classList.add('hidden');
        }
    }, 500);
});

// Load notes from Firestore
function loadNotes() {
    if (!db) {
        debug('Database not initialized');
        return;
    }
    
    debug('Loading notes...');
    
    // Show loading
    if (notesLoadingOverlay) {
        notesLoadingOverlay.classList.remove('hidden');
    }
    
    checkAuth().then(user => {
        debug('User authenticated, loading notes for:', user.uid);
        
        db.collection('users').doc(user.uid).collection('notes')
            .orderBy('updatedAt', 'desc')
            .get()
            .then(querySnapshot => {
                if (notesList) {
                    notesList.innerHTML = ''; // Clear previous content
                    notes = [];
                    
                    if (querySnapshot.empty) {
                        debug('No notes found');
                        notesList.innerHTML = `
                            <div class="empty-state animate__animated animate__fadeIn">
                                <i class="fas fa-sticky-note"></i>
                                <p>No notes found</p>
                                <button class="btn btn-primary" onclick="createNewNote()">
                                    <i class="fas fa-plus"></i> Create Note
                                </button>
                            </div>
                        `;
                    } else {
                        debug('Found notes:', querySnapshot.size);
                        querySnapshot.forEach(doc => {
                            const note = doc.data();
                            note.id = doc.id;
                            notes.push(note);
                            
                            const noteElement = createNoteElement(note);
                            notesList.appendChild(noteElement);
                        });
                        
                        // Select first note
                        if (notes.length > 0) {
                            selectNote(notes[0]);
                        }
                    }
                }
                
                // Hide loading
                if (notesLoadingOverlay) {
                    notesLoadingOverlay.classList.add('hidden');
                }
            })
            .catch(error => {
                debug('Error loading notes:', error);
                
                if (notesList) {
                    notesList.innerHTML = `
                        <div class="error-state animate__animated animate__fadeIn">
                            <i class="fas fa-exclamation-circle"></i>
                            <p>Error loading notes</p>
                            <button class="btn btn-primary" onclick="loadNotes()">
                                <i class="fas fa-sync"></i> Retry
                            </button>
                        </div>
                    `;
                }
                
                // Hide loading
                if (notesLoadingOverlay) {
                    notesLoadingOverlay.classList.add('hidden');
                }
            });
    }).catch(error => {
        debug('Authentication check failed:', error);
        if (notesLoadingOverlay) {
            notesLoadingOverlay.classList.add('hidden');
        }
    });
}

// Create note element
function createNoteElement(note) {
    const noteElement = document.createElement('div');
    noteElement.className = 'note-item animate__animated animate__fadeIn';
    noteElement.dataset.noteId = note.id;
    
    // Format date
    const date = note.updatedAt?.toDate();
    const formattedDate = date ? formatDate(date) : 'Unknown date';
    
    // Get content preview (strip HTML tags)
    const contentPreview = note.content ? 
        note.content.replace(/<[^>]*>/g, '').substring(0, 50) : 
        'No content';
    
    // Set note color
    const noteColor = note.color || '#ffffff';
    noteElement.style.backgroundColor = noteColor;
    
    noteElement.innerHTML = `
        <div class="note-info">
            <h3>${note.title || 'Untitled Note'}</h3>
            <p class="note-preview">${contentPreview}${contentPreview.length >= 50 ? '...' : ''}</p>
            <p class="note-date">${formattedDate}</p>
        </div>
    `;
    
    // Add click event to select note
    noteElement.addEventListener('click', function() {
        selectNote(note);
    });
    
    return noteElement;
}

// Select a note
function selectNote(note) {
    debug('Selecting note:', note.id);
    
    // Set current note ID
    currentNoteId = note.id;
    
    // Update UI
    noteTitle.value = note.title || '';
    quill.root.innerHTML = note.content || '';
    if (colorPicker) {
        colorPicker.value = note.color || '#ffffff';
    }
    
    // Highlight selected note
    const noteItems = document.querySelectorAll('.note-item');
    noteItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.noteId === note.id) {
            item.classList.add('active');
        }
    });
    
    // Enable delete button
    deleteNoteBtn.disabled = false;
    
    // Reset dirty state
    isDirty = false;
}

// Auto-save note
function autoSaveNote() {
    if (!isDirty || !currentNoteId || isDeleting) return;
    
    debug('Auto-saving note...');
    saveNote(true);
}

// Save note
function saveNote(isAutoSave = false) {
    if (!db) {
        debug('Database not initialized');
        return;
    }
    
    if (!currentNoteId) {
        debug('Creating new note...');
        createNewNote();
        return;
    }
    
    debug('Saving note:', currentNoteId);
    
    // Show loading
    if (!isAutoSave) {
        if (notesLoadingOverlay) {
            notesLoadingOverlay.classList.remove('hidden');
        }
    }
    
    checkAuth().then(user => {
        const noteData = {
            title: noteTitle.value || 'Untitled Note',
            content: quill.root.innerHTML,
            color: colorPicker ? colorPicker.value : '#ffffff',
            updatedAt: firebase.firestore.Timestamp.fromDate(new Date())
        };
        
        db.collection('users').doc(user.uid).collection('notes').doc(currentNoteId)
            .update(noteData)
            .then(() => {
                debug('Note saved successfully');
                
                // Update note in list
                updateNoteInList(noteData);
                
                // Reset dirty state
                isDirty = false;
                
                // Hide loading
                if (!isAutoSave) {
                    if (notesLoadingOverlay) {
                        notesLoadingOverlay.classList.add('hidden');
                    }
                }
            })
            .catch(error => {
                debug('Error saving note:', error);
                
                // Show error message
                if (!isAutoSave) {
                    alert('Error saving note. Please try again.');
                }
                
                // Hide loading
                if (!isAutoSave) {
                    if (notesLoadingOverlay) {
                        notesLoadingOverlay.classList.add('hidden');
                    }
                }
            });
    }).catch(error => {
        debug('Authentication check failed:', error);
        if (!isAutoSave) {
            if (notesLoadingOverlay) {
                notesLoadingOverlay.classList.add('hidden');
            }
        }
    });
}

// Create new note
function createNewNote() {
    debug('Creating new note...');
    
    // Reset editor
    noteTitle.value = '';
    quill.root.innerHTML = '';
    if (colorPicker) {
        colorPicker.value = '#ffffff';
    }
    
    // Create note in Firestore
    checkAuth().then(user => {
        const noteData = {
            title: '',
            content: '',
            color: colorPicker ? colorPicker.value : '#ffffff',
            createdAt: firebase.firestore.Timestamp.fromDate(new Date()),
            updatedAt: firebase.firestore.Timestamp.fromDate(new Date())
        };
        
        db.collection('users').doc(user.uid).collection('notes')
            .add(noteData)
            .then(docRef => {
                debug('New note created:', docRef.id);
                
                // Add note to list
                noteData.id = docRef.id;
                notes.unshift(noteData);
                
                const noteElement = createNoteElement(noteData);
                notesList.insertBefore(noteElement, notesList.firstChild);
                
                // Select new note
                selectNote(noteData);
                
                // Reset dirty state
                isDirty = false;
            })
            .catch(error => {
                debug('Error creating note:', error);
                alert('Error creating note. Please try again.');
            });
    }).catch(error => {
        debug('Authentication check failed:', error);
    });
}

// Delete note
function deleteNote() {
    if (!currentNoteId) return;
    
    if (!confirm('Are you sure you want to delete this note?')) {
        return;
    }
    
    debug('Deleting note:', currentNoteId);
    
    // Set deleting flag
    isDeleting = true;
    
    // Clear any pending auto-save
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = null;
    }
    
    // Show loading
    if (notesLoadingOverlay) {
        notesLoadingOverlay.classList.remove('hidden');
    }
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).collection('notes').doc(currentNoteId)
            .delete()
            .then(() => {
                debug('Note deleted successfully');
                
                // Remove note from list
                const noteElement = document.querySelector(`.note-item[data-note-id="${currentNoteId}"]`);
                if (noteElement) {
                    noteElement.remove();
                }
                
                // Remove from notes array
                notes = notes.filter(note => note.id !== currentNoteId);
                
                // Reset editor
                noteTitle.value = '';
                quill.root.innerHTML = '';
                currentNoteId = null;
                
                // Disable delete button
                deleteNoteBtn.disabled = true;
                
                // Select first note if available
                if (notes.length > 0) {
                    selectNote(notes[0]);
                } else {
                    // Show empty state
                    notesList.innerHTML = `
                        <div class="empty-state animate__animated animate__fadeIn">
                            <i class="fas fa-sticky-note"></i>
                            <p>No notes found</p>
                            <button class="btn btn-primary" onclick="createNewNote()">
                                <i class="fas fa-plus"></i> Create Note
                            </button>
                        </div>
                    `;
                }
                
                // Hide loading
                if (notesLoadingOverlay) {
                    notesLoadingOverlay.classList.add('hidden');
                }
                
                // Reset deleting flag after a short delay
                setTimeout(() => {
                    isDeleting = false;
                }, 1000);
            })
            .catch(error => {
                debug('Error deleting note:', error);
                alert('Error deleting note. Please try again.');
                if (notesLoadingOverlay) {
                    notesLoadingOverlay.classList.add('hidden');
                }
                isDeleting = false;
            });
    }).catch(error => {
        debug('Authentication check failed:', error);
        if (notesLoadingOverlay) {
            notesLoadingOverlay.classList.add('hidden');
        }
        isDeleting = false;
    });
}

// Filter notes by search
function filterNotes() {
    const searchTerm = noteSearch.value.toLowerCase();
    
    if (!searchTerm) {
        // Show all notes if search is empty
        updateNotesListUI(notes);
        return;
    }
    
    const filteredNotes = notes.filter(note => {
        const title = (note.title || '').toLowerCase();
        const content = (note.content || '').toLowerCase();
        return title.includes(searchTerm) || content.includes(searchTerm);
    });
    
    updateNotesListUI(filteredNotes);
}

// Update notes list UI
function updateNotesListUI(notesToShow) {
    if (!notesList) return;
    
    notesList.innerHTML = '';
    
    if (notesToShow.length === 0) {
        notesList.innerHTML = `
            <div class="empty-state animate__animated animate__fadeIn">
                <i class="fas fa-search"></i>
                <p>No notes found</p>
            </div>
        `;
        return;
    }
    
    notesToShow.forEach(note => {
        const noteElement = createNoteElement(note);
        notesList.appendChild(noteElement);
    });
}

// Update note in list
function updateNoteInList(noteData) {
    const noteIndex = notes.findIndex(note => note.id === currentNoteId);
    if (noteIndex !== -1) {
        notes[noteIndex] = { ...notes[noteIndex], ...noteData };
        
        const noteElement = document.querySelector(`.note-item[data-note-id="${currentNoteId}"]`);
        if (noteElement) {
            const newNoteElement = createNoteElement(notes[noteIndex]);
            noteElement.replaceWith(newNoteElement);
        }
    }
}

// Format date
function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    
    // If less than 24 hours ago
    if (diff < 24 * 60 * 60 * 1000) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    
    // If less than 7 days ago
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    
    // Otherwise show full date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Add custom styles
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        .notes-container {
            display: flex;
            height: calc(100vh - 120px);
        }
        
        .notes-sidebar {
            width: 300px;
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .notes-search {
            padding: 15px;
            position: relative;
            border-bottom: 1px solid var(--border-color);
        }
        
        .notes-search input {
            width: 100%;
            padding: 10px 15px 10px 35px;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            font-size: 0.9rem;
        }
        
        .notes-search i {
            position: absolute;
            left: 25px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--secondary-color);
        }
        
        .notes-folders {
            padding: 15px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .notes-folders h3 {
            font-size: 1rem;
            margin-bottom: 10px;
        }
        
        .notes-folders ul {
            list-style: none;
        }
        
        .notes-folders li {
            padding: 8px 10px;
            border-radius: var(--border-radius);
            cursor: pointer;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
        }
        
        .notes-folders li:hover {
            background-color: rgba(76, 132, 255, 0.05);
        }
        
        .notes-folders li.active {
            background-color: rgba(76, 132, 255, 0.1);
            color: var(--primary-color);
        }
        
        .notes-folders li i {
            margin-right: 10px;
            font-size: 0.9rem;
        }
        
        .notes-list {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
        }
        
        .note-item {
            padding: 15px;
            border-bottom: 1px solid var(--border-color);
            cursor: pointer;
            transition: background-color 0.2s ease;
        }
        
        .note-item:hover {
            background-color: rgba(76, 132, 255, 0.05);
        }
        
        .note-item.active {
            background-color: rgba(76, 132, 255, 0.1);
            border-left: 3px solid var(--primary-color);
        }
        
        .note-info h3 {
            font-size: 1rem;
            margin-bottom: 5px;
            font-weight: 600;
        }
        
        .note-preview {
            font-size: 0.85rem;
            color: var(--secondary-color);
            margin-bottom: 8px;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
        
        .note-date {
            font-size: 0.8rem;
            color: var(--secondary-color);
        }
        
        .note-tags {
            display: flex;
            gap: 5px;
            margin-top: 5px;
        }
        
        .tag {
            font-size: 0.7rem;
            padding: 2px 6px;
            background-color: rgba(76, 132, 255, 0.1);
            color: var(--primary-color);
            border-radius: 4px;
        }
        
        .notes-editor {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .editor-header {
            padding: 15px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        #note-title {
            flex: 1;
            border: none;
            font-size: 1.2rem;
            font-weight: 600;
            padding: 5px 0;
            outline: none;
        }
        
        .editor-actions {
            display: flex;
            gap: 10px;
        }
        
        #editor {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        }
        
        .ql-editor {
            min-height: 100%;
            font-size: 1rem;
            line-height: 1.6;
        }
    `;
    document.head.appendChild(style);
});