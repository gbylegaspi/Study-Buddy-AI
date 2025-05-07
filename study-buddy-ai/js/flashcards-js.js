// DOM Elements
const decksList = document.getElementById('decks-list');
const cardsGrid = document.getElementById('cards-grid');
const currentDeckName = document.getElementById('current-deck-name');
const startReviewBtn = document.getElementById('start-review');
const editDeckBtn = document.getElementById('edit-deck');
const newDeckBtn = document.getElementById('new-deck');
const newCardBtn = document.getElementById('new-card');
const newCardModal = document.getElementById('new-card-modal');
const newCardForm = document.getElementById('new-card-form');
const closeModalBtns = document.querySelectorAll('.close-modal');
const reviewMode = document.getElementById('review-mode');
const reviewCard = document.getElementById('review-card');
const reviewFront = document.getElementById('review-front');
const reviewBack = document.getElementById('review-back');
const flipCardBtn = document.getElementById('flip-card');
const markHardBtn = document.getElementById('mark-hard');
const markGoodBtn = document.getElementById('mark-good');
const markEasyBtn = document.getElementById('mark-easy');
const reviewProgress = document.getElementById('review-progress');
const reviewCount = document.getElementById('review-count');
const deckSearch = document.getElementById('deck-search');
const loadingOverlay = document.querySelector('.loading-overlay');

// Global variables
let currentDeckId = null;
let currentCards = [];
let reviewCards = [];
let currentReviewIndex = 0;
let isCardFlipped = false;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Load decks when page loads
    loadDecks();
    
    // Hide loading spinner after delay to prevent flash
    setTimeout(() => {
        loadingOverlay.classList.add('hidden');
    }, 500);
    
    // Event listeners
    newDeckBtn.addEventListener('click', showNewDeckPrompt);
    newCardBtn.addEventListener('click', showNewCardModal);
    deckSearch.addEventListener('input', filterDecks);
    
    // New card form submission
    if (newCardForm) {
        newCardForm.addEventListener('submit', createNewCard);
    }
    
    // Close modal
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
    
    // Review mode buttons
    if (startReviewBtn) {
        startReviewBtn.addEventListener('click', startReview);
    }
    
    if (flipCardBtn) {
        flipCardBtn.addEventListener('click', flipCard);
    }
    
    if (markHardBtn) {
        markHardBtn.addEventListener('click', () => markCard('hard'));
    }
    
    if (markGoodBtn) {
        markGoodBtn.addEventListener('click', () => markCard('good'));
    }
    
    if (markEasyBtn) {
        markEasyBtn.addEventListener('click', () => markCard('easy'));
    }
    
    if (editDeckBtn) {
        editDeckBtn.addEventListener('click', editDeck);
    }
});

// Load decks from Firestore
function loadDecks() {
    if (!db) return;
    
    checkAuth().then(user => {
        // Show loading
        loadingOverlay.classList.remove('hidden');
        
        db.collection('users').doc(user.uid).collection('flashcard_decks')
            .orderBy('createdAt', 'desc')
            .get()
            .then(querySnapshot => {
                if (decksList) {
                    decksList.innerHTML = ''; // Clear previous content
                    
                    if (querySnapshot.empty) {
                        decksList.innerHTML = `
                            <div class="empty-state">
                                <p>No decks found</p>
                                <button id="create-first-deck" class="btn btn-primary">Create First Deck</button>
                            </div>
                        `;
                        
                        document.getElementById('create-first-deck').addEventListener('click', showNewDeckPrompt);
                    } else {
                        querySnapshot.forEach(doc => {
                            const deck = doc.data();
                            const deckElement = createDeckElement(doc.id, deck);
                            decksList.appendChild(deckElement);
                        });
                    }
                }
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            })
            .catch(error => {
                console.error('Error loading decks:', error);
                
                if (decksList) {
                    decksList.innerHTML = `
                        <div class="error-state">
                            <p>Error loading decks</p>
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

// Create deck element
function createDeckElement(deckId, deck) {
    const deckElement = document.createElement('div');
    deckElement.className = 'deck-item';
    deckElement.dataset.deckId = deckId;
    
    deckElement.innerHTML = `
        <div class="deck-info">
            <h3>${deck.name}</h3>
            <p>${deck.cards?.length || 0} cards</p>
        </div>
        <div class="deck-actions">
            <button class="btn-icon delete-deck" title="Delete Deck">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // Add click event to load cards
    deckElement.addEventListener('click', function(e) {
        // Don't load cards if delete button was clicked
        if (e.target.closest('.delete-deck')) {
            e.stopPropagation();
            deleteDeck(deckId);
            return;
        }
        
        loadDeckCards(deckId, deck.name);
    });
    
    return deckElement;
}

// Load cards for a deck
function loadDeckCards(deckId, deckName) {
    if (!db) return;
    
    // Set current deck
    currentDeckId = deckId;
    
    // Update UI
    if (currentDeckName) {
        currentDeckName.textContent = deckName;
    }
    
    if (startReviewBtn) {
        startReviewBtn.disabled = false;
    }
    
    if (editDeckBtn) {
        editDeckBtn.disabled = false;
    }
    
    // Highlight selected deck
    const deckItems = document.querySelectorAll('.deck-item');
    deckItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.deckId === deckId) {
            item.classList.add('active');
        }
    });
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).collection('flashcard_decks')
            .doc(deckId).collection('cards')
            .orderBy('createdAt', 'desc')
            .get()
            .then(querySnapshot => {
                if (cardsGrid) {
                    cardsGrid.innerHTML = ''; // Clear previous content
                    
                    if (querySnapshot.empty) {
                        cardsGrid.innerHTML = `
                            <div class="empty-state">
                                <p>No cards in this deck</p>
                                <button class="btn btn-primary add-first-card">Add First Card</button>
                            </div>
                        `;
                        
                        cardsGrid.querySelector('.add-first-card').addEventListener('click', showNewCardModal);
                    } else {
                        currentCards = [];
                        querySnapshot.forEach(doc => {
                            const card = doc.data();
                            card.id = doc.id;
                            currentCards.push(card);
                            
                            const cardElement = createCardElement(card);
                            cardsGrid.appendChild(cardElement);
                        });
                    }
                }
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            })
            .catch(error => {
                console.error('Error loading cards:', error);
                
                if (cardsGrid) {
                    cardsGrid.innerHTML = `
                        <div class="error-state">
                            <p>Error loading cards</p>
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

// Create card element
function createCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'card-item';
    cardElement.dataset.cardId = card.id;
    
    cardElement.innerHTML = `
        <div class="card-front">
            <p>${card.front}</p>
        </div>
        <div class="card-actions">
            <button class="btn-icon edit-card" title="Edit Card">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon delete-card" title="Delete Card">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // Add click event to flip card
    cardElement.addEventListener('click', function(e) {
        // Don't flip if action button was clicked
        if (e.target.closest('.card-actions')) {
            e.stopPropagation();
            return;
        }
        
        // Add if not already preview
        if (!cardElement.classList.contains('preview')) {
            // Remove preview from other cards
            document.querySelectorAll('.card-item.preview').forEach(item => {
                item.classList.remove('preview');
                item.querySelector('.card-back')?.remove();
            });
            
            // Add preview to this card
            cardElement.classList.add('preview');
            
            // Add back side
            const backElement = document.createElement('div');
            backElement.className = 'card-back';
            backElement.innerHTML = `<p>${card.back}</p>`;
            
            cardElement.appendChild(backElement);
        } else {
            // Remove preview
            cardElement.classList.remove('preview');
            cardElement.querySelector('.card-back').remove();
        }
    });
    
    // Add event listener for edit button
    cardElement.querySelector('.edit-card').addEventListener('click', function(e) {
        e.stopPropagation();
        editCard(card);
    });
    
    // Add event listener for delete button
    cardElement.querySelector('.delete-card').addEventListener('click', function(e) {
        e.stopPropagation();
        deleteCard(card.id);
    });
    
    return cardElement;
}

// Show new deck prompt
function showNewDeckPrompt() {
    const deckName = prompt('Enter deck name:');
    
    if (deckName && deckName.trim()) {
        createNewDeck(deckName.trim());
    }
}

// Create new deck
function createNewDeck(deckName) {
    if (!db) return;
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).collection('flashcard_decks')
            .add({
                name: deckName,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .then(docRef => {
                // Reload decks
                loadDecks();
                
                // Select the new deck
                setTimeout(() => {
                    loadDeckCards(docRef.id, deckName);
                }, 500);
            })
            .catch(error => {
                console.error('Error creating deck:', error);
                alert('Failed to create deck. Please try again.');
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            });
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Show new card modal
function showNewCardModal() {
    if (!currentDeckId) {
        alert('Please select a deck first');
        return;
    }
    
    if (newCardModal) {
        newCardModal.style.display = 'block';
        
        // Reset form
        if (newCardForm) {
            newCardForm.reset();
        }
    }
}

// Close modals
function closeModals() {
    if (newCardModal) {
        newCardModal.style.display = 'none';
    }
}

// Create new card
function createNewCard(e) {
    e.preventDefault();
    
    if (!db || !currentDeckId) return;
    
    const front = document.getElementById('card-front').value.trim();
    const back = document.getElementById('card-back').value.trim();
    const tags = document.getElementById('card-tags').value.trim()
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag);
    
    if (!front || !back) {
        alert('Please fill in both front and back of the card');
        return;
    }
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    // Close modal
    closeModals();
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).collection('flashcard_decks')
            .doc(currentDeckId).collection('cards')
            .add({
                front: front,
                back: back,
                tags: tags,
                createdAt: new Date(),
                updatedAt: new Date(),
                reviewCount: 0,
                nextReview: new Date(),
                difficulty: 'medium'
            })
            .then(() => {
                // Reload cards
                loadDeckCards(currentDeckId, currentDeckName.textContent);
            })
            .catch(error => {
                console.error('Error creating card:', error);
                alert('Failed to create card. Please try again.');
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            });
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Edit card
function editCard(card) {
    const newFront = prompt('Edit front of card:', card.front);
    
    if (newFront === null) return; // User canceled
    
    const newBack = prompt('Edit back of card:', card.back);
    
    if (newBack === null) return; // User canceled
    
    if (!newFront.trim() || !newBack.trim()) {
        alert('Both front and back must have content');
        return;
    }
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).collection('flashcard_decks')
            .doc(currentDeckId).collection('cards')
            .doc(card.id)
            .update({
                front: newFront.trim(),
                back: newBack.trim(),
                updatedAt: new Date()
            })
            .then(() => {
                // Reload cards
                loadDeckCards(currentDeckId, currentDeckName.textContent);
            })
            .catch(error => {
                console.error('Error updating card:', error);
                alert('Failed to update card. Please try again.');
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            });
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Delete card
function deleteCard(cardId) {
    if (!confirm('Are you sure you want to delete this card?')) return;
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).collection('flashcard_decks')
            .doc(currentDeckId).collection('cards')
            .doc(cardId)
            .delete()
            .then(() => {
                // Reload cards
                loadDeckCards(currentDeckId, currentDeckName.textContent);
            })
            .catch(error => {
                console.error('Error deleting card:', error);
                alert('Failed to delete card. Please try again.');
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            });
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Delete deck
function deleteDeck(deckId) {
    if (!confirm('Are you sure you want to delete this deck and all its cards?')) return;
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    checkAuth().then(user => {
        // First get all cards to delete (subcollections aren't deleted automatically)
        db.collection('users').doc(user.uid).collection('flashcard_decks')
            .doc(deckId).collection('cards')
            .get()
            .then(querySnapshot => {
                // Create batch for efficient deletes
                const batch = db.batch();
                
                // Add each card to batch delete
                querySnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                
                // Add deck to batch delete
                const deckRef = db.collection('users').doc(user.uid).collection('flashcard_decks').doc(deckId);
                batch.delete(deckRef);
                
                // Commit the batch
                return batch.commit();
            })
            .then(() => {
                // Reload decks
                loadDecks();
                
                // Clear cards view
                if (cardsGrid) {
                    cardsGrid.innerHTML = '';
                }
                
                if (currentDeckName) {
                    currentDeckName.textContent = 'Select a Deck';
                }
                
                // Disable buttons
                if (startReviewBtn) {
                    startReviewBtn.disabled = true;
                }
                
                if (editDeckBtn) {
                    editDeckBtn.disabled = true;
                }
                
                // Reset current deck
                currentDeckId = null;
            })
            .catch(error => {
                console.error('Error deleting deck:', error);
                alert('Failed to delete deck. Please try again.');
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            });
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Edit deck
function editDeck() {
    if (!currentDeckId) return;
    
    const newName = prompt('Enter new deck name:', currentDeckName.textContent);
    
    if (!newName || !newName.trim()) return;
    
    // Show loading
    loadingOverlay.classList.remove('hidden');
    
    checkAuth().then(user => {
        db.collection('users').doc(user.uid).collection('flashcard_decks')
            .doc(currentDeckId)
            .update({
                name: newName.trim(),
                updatedAt: new Date()
            })
            .then(() => {
                // Update deck name in UI
                if (currentDeckName) {
                    currentDeckName.textContent = newName.trim();
                }
                
                // Update deck in list
                const deckElement = document.querySelector(`.deck-item[data-deck-id="${currentDeckId}"]`);
                if (deckElement) {
                    deckElement.querySelector('h3').textContent = newName.trim();
                }
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            })
            .catch(error => {
                console.error('Error updating deck:', error);
                alert('Failed to update deck. Please try again.');
                
                // Hide loading
                loadingOverlay.classList.add('hidden');
            });
    }).catch(error => {
        console.error('Authentication check failed:', error);
        loadingOverlay.classList.add('hidden');
    });
}

// Filter decks by search term
function filterDecks() {
    const searchTerm = deckSearch.value.toLowerCase().trim();
    const deckItems = document.querySelectorAll('.deck-item');
    
    deckItems.forEach(item => {
        const deckName = item.querySelector('h3').textContent.toLowerCase();
        
        if (deckName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Start review mode
function startReview() {
    if (!currentCards || currentCards.length === 0) {
        alert('No cards to review');
        return;
    }
    
    // Clone and shuffle cards for review
    reviewCards = [...currentCards].sort(() => Math.random() - 0.5);
    currentReviewIndex = 0;
    isCardFlipped = false;
    
    // Show the first card
    showReviewCard();
    
    // Show review mode
    reviewMode.style.display = 'block';
    
    // Update progress
    updateReviewProgress();
}

// Show review card
function showReviewCard() {
    if (currentReviewIndex >= reviewCards.length) {
        // End of review
        alert('Review completed!');
        reviewMode.style.display = 'none';
        return;
    }
    
    const card = reviewCards[currentReviewIndex];
    
    reviewFront.textContent = card.front;
    reviewBack.textContent = card.back;
    
    // Reset card to front side
    reviewCard.classList.remove('flipped');
    isCardFlipped = false;
}

// Flip card in review mode
function flipCard() {
    reviewCard.classList.toggle('flipped');
    isCardFlipped = !isCardFlipped;
}

// Mark card and move to next
function markCard(difficulty) {
    if (!isCardFlipped) {
        alert('Please flip the card before marking it');
        return;
    }
    
    const cardId = reviewCards[currentReviewIndex].id;
    
    // Update card difficulty and review stats in Firestore
    checkAuth().then(user => {
        const cardRef = db.collection('users').doc(user.uid)
            .collection('flashcard_decks').doc(currentDeckId)
            .collection('cards').doc(cardId);
        
        // Calculate next review date based on difficulty
        const now = new Date();
        let nextReview;
        
        switch (difficulty) {
            case 'hard':
                nextReview = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // 1 day
                break;
            case 'good':
                nextReview = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
                break;
            case 'easy':
                nextReview = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
                break;
        }
        
        cardRef.update({
            reviewCount: firebase.firestore.FieldValue.increment(1),
            lastReviewed: now,
            nextReview: nextReview,
            difficulty: difficulty
        }).catch(error => {
            console.error('Error updating card review stats:', error);
        });
    });
    
    // Move to next card
    currentReviewIndex++;
    showReviewCard();
    
    // Update progress
    updateReviewProgress();
}

// Update review progress
function updateReviewProgress() {
    const total = reviewCards.length;
    const current = currentReviewIndex + 1;
    
    // Update progress bar
    const progressPercent = (currentReviewIndex / total) * 100;
    reviewProgress.style.width = `${progressPercent}%`;
    
    // Update counter
    reviewCount.textContent = `${current <= total ? current : total}/${total}`;
}

// Add custom styles for flashcards
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        .deck-item {
            background-color: white;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .deck-item:hover {
            transform: translateY(-3px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        
        .deck-item.active {
            border-left: 4px solid var(--primary-color);
        }
        
        .deck-info h3 {
            margin-bottom: 5px;
            font-size: 1.1rem;
        }
        
        .deck-info p {
            color: var(--secondary-color);
            font-size: 0.9rem;
        }
        
        .deck-actions {
            display: flex;
            gap: 5px;
        }
        
        .btn-icon {
            background: none;
            border: none;
            color: var(--secondary-color);
            cursor: pointer;
            font-size: 1rem;
            padding: 5px;
            border-radius: 50%;
            transition: all 0.2s ease;
        }
        
        .btn-icon:hover {
            background-color: rgba(0, 0, 0, 0.05);
            color: var(--dark-color);
        }
        
        .delete-deck:hover, .delete-card:hover {
            color: var(--danger-color);
        }
        
        .card-item {
            background-color: white;
            border-radius: 8px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            position: relative;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            height: 150px;
        }
        
        .card-item:hover {
            transform: translateY(-3px);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
        }
        
        .card-front, .card-back {
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            height: 100%;
            overflow: auto;
            padding: 10px;
        }
        
        .card-front p, .card-back p {
            margin: 0;
            font-size: 1.1rem;
        }
        
        .card-back {
            background-color: #f8f9fa;
            border-radius: 0 0 8px 8px;
            display: none;
        }
        
        .card-item.preview .card-front {
            height: 50%;
            border-bottom: 1px solid var(--border-color);
        }
        
        .card-item.preview .card-back {
            display: flex;
            height: 50%;
        }
        
        .card-actions {
            position: absolute;
            top: 10px;
            right: 10px;
            display: flex;
            gap: 5px;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        
        .card-item:hover .card-actions {
            opacity: 1;
        }
        
        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
            padding: 20px;
        }
        
        /* Review Mode */
        .review-mode {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: var(--body-bg);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .card-container {
            width: 100%;
            max-width: 500px;
            height: 300px;
            perspective: 1000px;
            margin-bottom: 30px;
        }
        
        .flashcard {
            width: 100%;
            height: 100%;
            position: relative;
            transition: transform 0.6s;
            transform-style: preserve-3d;
        }
        
        .flashcard.flipped {
            transform: rotateY(180deg);
        }
        
        .card-inner {
            position: relative;
            width: 100%;
            height: 100%;
            text-align: center;
            transition: transform 0.6s;
            transform-style: preserve-3d;
        }
        
        .card-front, .card-back {
            position: absolute;
            width: 100%;
            height: 100%;
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
        }
        
        .card-back {
            transform: rotateY(180deg);
            background-color: #f8f9fa;
        }
        
        .review-controls {
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .review-actions {
            display: flex;
            gap: 15px;
        }
        
        .review-progress {
            width: 100%;
            max-width: 500px;
        }
        
        .progress-bar {
            width: 100%;
            height: 10px;
            background-color: #e9ecef;
            border-radius: 5px;
            margin-bottom: 10px;
        }
        
        .progress {
            height: 100%;
            background-color: var(--primary-color);
            border-radius: 5px;
        }
    `;
});