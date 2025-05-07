// DOM Elements
const notesList = document.getElementById('notes-list');
const noteTitle = document.getElementById('note-title');
const saveNoteBtn = document.getElementById('save-note');
const deleteNoteBtn = document.getElementById('delete-note');
const noteSearch = document.getElementById('note-search');
const newNoteBtn = document.getElementById('new-note');
const folderItems = document.querySelectorAll('.notes-folders li');
const loadingOverlay = document.querySelector('.loading-overlay');

// Quill editor
let quill;

// Global variables
let currentNoteId = null;
let currentFolder = 'all';
let notes = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Quill editor
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
    
    // Folder selection
    folderItems.forEach(folder => {
        folder.addEventListener('click', function() {
            // Update active folder
            folderItems.forEach(f => f.classList.remove('active'));
            this.classList.add('active');
            
            // Get folder name from span text
            const folderName = this.querySelector('span').textContent.toLowerCase();
            currentFolder = folderName;
            
            // Filter notes by folder
            filterNotesByFolder(folderName);
        });
    });
    
    // Hide loading spinner after delay
    setTimeout(() => {
        loadingOverlay.classList.add('hidden');
    }, 500);
});

// Load notes from Firestore
function loadNotes() {
    if (!db) return;
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).collection('notes')
            .orderBy('updatedAt', 'desc')
            .get()
            .then(querySnapshot => {
                if (notesList) {
                    notesList.innerHTML = ''; // Clear previous content
                    notes = [];
                    
                    if (querySnapshot.empty) {
                        notesList.innerHTML = `
                            <div class="empty-state">
                                <p>No notes found</p>
                            </div>
                        `;
                    } else {
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
                loadingOverlay.classList.add('hidden');
            })
            .catch(error => {
                console.error('Error loading notes:', error);
                
                if (notesList) {
                    notesList.innerHTML = `
                        <div class="error-state">
                            <p>Error loading notes</p>
                        </div>
                    `;
                }
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            });
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Create note element
function createNoteElement(note) {
    const noteElement = document.createElement('div');
    noteElement.className = 'note-item';
    noteElement.dataset.noteId = note.id;
    
    // Format date
    const date = note.updatedAt?.toDate();
    const formattedDate = date ? formatDate(date) : 'Unknown date';
    
    // Get content preview (strip HTML tags)
    const contentPreview = note.content ? 
        note.content.replace(/<[^>]*>/g, '').substring(0, 50) : 
        'No content';
    
    noteElement.innerHTML = `
        <div class="note-info">
            <h3>${note.title || 'Untitled Note'}</h3>
            <p class="note-preview">${contentPreview}${contentPreview.length >= 50 ? '...' : ''}</p>
            <p class="note-date">${formattedDate}</p>
        </div>
        <div class="note-tags">
            ${note.folder ? `<span class="tag">${note.folder}</span>` : ''}
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
    // Set current note ID
    currentNoteId = note.id;
    
    // Update UI
    noteTitle.value = note.title || '';
    quill.root.innerHTML = note.content || '';
    
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
}

// Save note
function saveNote() {
    if (!db) return;
    
    const title = noteTitle.value.trim() || 'Untitled Note';
    const content = quill.root.innerHTML;
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    checkAuth().then(user => {
        if (currentNoteId) {
            // Update existing note
            db.collection('users').doc(user.uid).collection('notes')
                .doc(currentNoteId)
                .update({
                    title: title,
                    content: content,
                    updatedAt: new Date()
                })
                .then(() => {
                    updateNoteInList();
                    // Hide loading
                    loadingOverlay.classList.add('hidden');
                })
                .catch(error => {
                    console.error('Error updating note:', error);
                    alert('Failed to save note. Please try again.');
                    
                    // Hide loading
                    loadingOverlay.classList.add('hidden');
                });
        } else {
            // Create new note
            db.collection('users').doc(user.uid).collection('notes')
                .add({
                    title: title,
                    content: content,
                    folder: currentFolder === 'all' ? 'study notes' : currentFolder,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
                .then(docRef => {
                    // Set current note ID
                    currentNoteId = docRef.id;
                    
                    // Add note to list
                    const newNote = {
                        id: docRef.id,
                        title: title,
                        content: content,
                        folder: currentFolder === 'all' ? 'study notes' : currentFolder,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    
                    notes.unshift(newNote);
                    
                    // Add to UI
                    const noteElement = createNoteElement(newNote);
                    if (notesList.firstChild) {
                        notesList.insertBefore(noteElement, notesList.firstChild);
                    } else {
                        notesList.appendChild(noteElement);
                    }
                    
                    // Select the new note
                    selectNote(newNote);
                    
                    // Hide loading
                    loadingOverlay.classList.add('hidden');
                })
                .catch(error => {
                    console.error('Error creating note:', error);
                    alert('Failed to create note. Please try again.');
                    
                    // Hide loading
                    loadingOverlay.classList.add('hidden');
                });
        }
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Delete note
function deleteNote() {
    if (!currentNoteId) return;
    
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).collection('notes')
            .doc(currentNoteId)
            .delete()
            .then(() => {
                // Remove note from array
                notes = notes.filter(note => note.id !== currentNoteId);
                
                // Remove note from UI
                const noteElement = document.querySelector(`.note-item[data-note-id="${currentNoteId}"]`);
                if (noteElement) {
                    noteElement.remove();
                }
                
                // Clear editor
                noteTitle.value = '';
                quill.root.innerHTML = '';
                
                // Reset current note ID
                currentNoteId = null;
                
                // Disable delete button
                deleteNoteBtn.disabled = true;
                
                // Select first note if available
                if (notes.length > 0) {
                    selectNote(notes[0]);
                } else {
                    // Show empty state
                    notesList.innerHTML = `
                        <div class="empty-state">
                            <p>No notes found</p>
                        </div>
                    `;
                }
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            })
            .catch(error => {
                console.error('Error deleting note:', error);
                alert('Failed to delete note. Please try again.');
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            });
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Create new note
function createNewNote() {
    // Clear editor
    noteTitle.value = '';
    quill.root.innerHTML = '';
    
    // Reset current note ID
    currentNoteId = null;
    
    // Deselect all notes
    const noteItems = document.querySelectorAll('.note-item');
    noteItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Focus on title
    noteTitle.focus();
}

// Filter notes by search term
function filterNotes() {
    const searchTerm = noteSearch.value.toLowerCase().trim();
    
    if (!searchTerm) {
        // Show all notes
        filterNotesByFolder(currentFolder);
        return;
    }
    
    // Filter notes by title and content
    const filteredNotes = notes.filter(note => {
        // Match by title
        if (note.title && note.title.toLowerCase().includes(searchTerm)) {
            return true;
        }
        
        // Match by content (strip HTML)
        if (note.content) {
            const contentText = note.content.replace(/<[^>]*>/g, '').toLowerCase();
            if (contentText.includes(searchTerm)) {
                return true;
            }
        }
        
        return false;
    });
    
    // Update UI
    updateNotesListUI(filteredNotes);
}

// Filter notes by folder
function filterNotesByFolder(folderName) {
    if (folderName === 'all notes') {
        // Show all notes
        updateNotesListUI(notes);
    } else {
        // Filter by folder
        const filteredNotes = notes.filter(note => {
            return note.folder && note.folder.toLowerCase() === folderName.toLowerCase();
        });
        
        // Update UI
        updateNotesListUI(filteredNotes);
    }
}

// Update notes list UI
function updateNotesListUI(notesToShow) {
    if (!notesList) return;
    
    notesList.innerHTML = ''; // Clear previous content
    
    if (notesToShow.length === 0) {
        notesList.innerHTML = `
            <div class="empty-state">
                <p>No notes found</p>
            </div>
        `;
    } else {
        notesToShow.forEach(note => {
            const noteElement = createNoteElement(note);
            notesList.appendChild(noteElement);
            
            // Highlight current note if it's in the filtered list
            if (note.id === currentNoteId) {
                noteElement.classList.add('active');
            }
        });
    }
}

// Update note in list after saving
function updateNoteInList() {
    if (!currentNoteId) return;
    
    // Find the note in the array
    const noteIndex = notes.findIndex(note => note.id === currentNoteId);
    
    if (noteIndex !== -1) {
        // Update the note
        notes[noteIndex].title = noteTitle.value.trim() || 'Untitled Note';
        notes[noteIndex].content = quill.root.innerHTML;
        notes[noteIndex].updatedAt = new Date();
        
        // Update the UI
        const noteElement = document.querySelector(`.note-item[data-note-id="${currentNoteId}"]`);
        
        if (noteElement) {
            // Format date
            const formattedDate = formatDate(new Date());
            
            // Get content preview
            const contentPreview = quill.getText().substring(0, 50);
            
            // Update note element
            noteElement.querySelector('h3').textContent = notes[noteIndex].title || 'Untitled Note';
            noteElement.querySelector('.note-preview').textContent = contentPreview + (contentPreview.length >= 50 ? '...' : '');
            noteElement.querySelector('.note-date').textContent = formattedDate;
        }
    }
}

// Format date
function formatDate(date) {
    if (!date) return 'Unknown date';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // If today
    if (diff < 24 * 60 * 60 * 1000 && 
        now.getDate() === date.getDate() && 
        now.getMonth() === date.getMonth() && 
        now.getFullYear() === date.getFullYear()) {
        return 'Today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.getDate() === date.getDate() && 
        yesterday.getMonth() === date.getMonth() && 
        yesterday.getFullYear() === date.getFullYear()) {
        return 'Yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Otherwise show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
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