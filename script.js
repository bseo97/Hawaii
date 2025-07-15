// Hawaii Itinerary Planner - Real-time Collaborative Version
class HawaiiItineraryPlanner {
    constructor() {
        this.itinerary = [];
        this.tripInfo = {
            title: "Our Hawaiian Dream Vacation",
            dates: "Dec 15-22, 2024",
            islands: "Oahu"
        };
        this.socket = io();
        this.hideTimeout = null; // For tooltip hover management
        this.init();
    }

    init() {
        this.setupSocketListeners();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.loadInitialData();
    }

    setupSocketListeners() {
        // Load initial data
        this.socket.on('load-itinerary', (data) => {
            this.loadItineraryFromServer();
        });

        // Trip info updates
        this.socket.on('trip-info-updated', (data) => {
            this.tripInfo = data;
            this.updateTripInfoDisplay();
        });

        // Day management
        this.socket.on('day-added', (dayData) => {
            this.addDayToDisplay(dayData);
            this.updateSummary();
        });

        this.socket.on('day-removed', (dayId) => {
            this.removeDayFromDisplay(dayId);
            this.updateSummary();
        });

        // Activity management
        this.socket.on('activity-added', (activityData) => {
            console.log('Received activity-added event:', activityData);
            this.addActivityToDisplay(activityData);
            this.updateSummary();
        });

        this.socket.on('activity-updated', (activityData) => {
            this.updateActivityDisplay(activityData);
        });

        this.socket.on('activity-removed', (activityId) => {
            this.removeActivityFromDisplay(activityId);
            this.updateSummary();
        });

        // Clear all
        this.socket.on('all-cleared', () => {
            this.clearDisplay();
            this.updateSummary();
        });
    }

    setupEventListeners() {
        document.getElementById('add-day-btn').addEventListener('click', () => {
            this.socket.emit('add-day');
        });

        document.getElementById('clear-all-btn').addEventListener('click', () => {
            if (confirm('Clear all days?')) {
                this.socket.emit('clear-all');
            }
        });

        document.getElementById('add-custom-btn').addEventListener('click', () => {
            this.addCustomActivity();
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportItinerary();
        });

        document.getElementById('print-btn').addEventListener('click', () => {
            this.printItinerary();
        });

        // Trip info updates
        ['trip-title', 'trip-dates', 'islands'].forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                this.tripInfo[id.replace('trip-', '')] = e.target.value;
                this.socket.emit('update-trip-info', this.tripInfo);
            });
        });
    }

    setupDragAndDrop() {
        document.querySelectorAll('.activity').forEach(activity => {
            activity.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    name: activity.querySelector('span').textContent,
                    type: activity.dataset.type,
                    icon: activity.querySelector('i').className
                }));
                activity.classList.add('dragging');
            });
            activity.addEventListener('dragend', () => activity.classList.remove('dragging'));
        });
    }

    setupDropZones() {
        document.querySelectorAll('.day-activities').forEach(container => {
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                container.classList.add('drag-over');
            });
            container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.classList.remove('drag-over');
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const dayId = container.closest('.day-column').dataset.dayId;
                this.addActivityToDay(dayId, data);
            });
        });
    }

    addActivityToDay(dayId, activityData) {
        const position = document.querySelector(`[data-day-id="${dayId}"] .day-activities`).children.length;
        
        // Show form for additional details
        this.showActivityDetailsForm(dayId, activityData, position);
    }

    showActivityDetailsForm(dayId, activityData, position) {
        // Create modal form
        const modal = document.createElement('div');
        modal.className = 'activity-details-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add Activity Details: ${activityData.name}</h3>
                    <button class="close-modal" onclick="this.closest('.activity-details-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="activity-date">Date:</label>
                        <input type="text" id="activity-date" placeholder="e.g., Dec 15, 2024 or Day 1 Morning">
                    </div>
                    <div class="form-group">
                        <label for="activity-location">Location:</label>
                        <input type="text" id="activity-location" placeholder="e.g., Waikiki Beach, Honolulu">
                    </div>
                    <div class="form-group">
                        <label for="activity-category">Category:</label>
                        <select id="activity-category">
                            <option value="beaches" ${activityData.type === 'beach' ? 'selected' : ''}>Beaches</option>
                            <option value="restaurants" ${activityData.type === 'restaurant' ? 'selected' : ''}>Restaurants</option>
                            <option value="attractions" ${activityData.type === 'attraction' ? 'selected' : ''}>Attractions</option>
                            <option value="shopping" ${activityData.type === 'shopping' ? 'selected' : ''}>Shopping</option>
                            <option value="custom" ${activityData.type === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="activity-note">Note:</label>
                        <textarea id="activity-note" placeholder="e.g., Cost $7 to enter the temple, bring sunscreen, etc." rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Location Preview:</label>
                        <div id="location-preview" class="location-preview">
                            <div class="no-location">Select a location to see preview</div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" onclick="this.closest('.activity-details-modal').remove()">Cancel</button>
                    <button class="btn-add" onclick="planner.confirmAddActivity(${dayId}, ${JSON.stringify(activityData).replace(/"/g, '&quot;')}, ${position})">Add Activity</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add location autocomplete to the location input
        const locationInput = modal.querySelector('#activity-location');
        this.createLocationAutocomplete(locationInput);
        
        // Focus first input
        modal.querySelector('#activity-date').focus();
    }

    confirmAddActivity(dayId, activityData, position) {
        const modal = document.querySelector('.activity-details-modal');
        const date = modal.querySelector('#activity-date').value.trim();
        const location = modal.querySelector('#activity-location').value.trim();
        const category = modal.querySelector('#activity-category').value;
        const note = modal.querySelector('#activity-note').value.trim();
        
        // Create activity object with all the form data
        const newActivityData = {
            dayId: parseInt(dayId),
            name: activityData.name,
            type: activityData.type,
            icon: activityData.icon,
            position: position,
            activityDate: date,
            location: location,
            category: category,
            note: note
        };
        
        console.log('Sending activity data:', newActivityData);
        this.socket.emit('add-activity', newActivityData);
        
        modal.remove();
    }

    addCustomActivity() {
        const name = document.getElementById('custom-activity-name').value.trim();
        const type = document.getElementById('custom-activity-type').value;
        if (!name) return alert('Please enter an activity name');

        const iconMap = {
            'beach': 'fas fa-umbrella-beach',
            'restaurant': 'fas fa-utensils',
            'attraction': 'fas fa-mountain',
            'shopping': 'fas fa-shopping-bag',
            'custom': 'fas fa-star'
        };

        // Map dropdown values to category data attributes
        const categoryMap = {
            'beach': 'beaches',
            'restaurant': 'restaurants', 
            'attraction': 'attractions',
            'shopping': 'shopping',
            'custom': 'custom'
        };

        // Create custom category if it doesn't exist
        if (type === 'custom' && !document.querySelector('[data-category="custom"]')) {
            this.createCustomCategory();
        }

        const container = document.querySelector(`[data-category="${categoryMap[type]}"] .activities`);
        if (!container) {
            console.error('Category container not found for type:', type);
            return;
        }

        const newActivity = document.createElement('div');
        newActivity.className = 'activity';
        newActivity.draggable = true;
        newActivity.dataset.type = type;
        newActivity.innerHTML = `
            <i class="${iconMap[type]}"></i>
            <span>${name}</span>
            <button class="delete-activity" onclick="planner.deleteActivity(this)" title="Remove activity">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        newActivity.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                name: name, type: type, icon: iconMap[type]
            }));
            newActivity.classList.add('dragging');
        });
        newActivity.addEventListener('dragend', () => newActivity.classList.remove('dragging'));
        
        container.appendChild(newActivity);
        document.getElementById('custom-activity-name').value = '';
    }

    createCustomCategory() {
        const categoriesContainer = document.querySelector('.activity-categories');
        const customCategory = document.createElement('div');
        customCategory.className = 'category';
        customCategory.dataset.category = 'custom';
        customCategory.innerHTML = `
            <h3>
                <i class="fas fa-star"></i> 
                <span class="category-name" onclick="planner.editCategoryName(this)">Custom</span>
                <button class="edit-category" onclick="planner.editCategoryName(this.previousElementSibling)" title="Edit category name">
                    <i class="fas fa-cog"></i>
                </button>
            </h3>
            <div class="activities"></div>
        `;
        categoriesContainer.appendChild(customCategory);
    }

    deleteActivity(button) {
        if (confirm('Remove this activity from the library?')) {
            button.parentElement.remove();
        }
    }

    editCategoryName(nameElement) {
        const currentName = nameElement.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'category-name-input';
        
        input.addEventListener('blur', () => this.saveCategoryName(input, nameElement));
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveCategoryName(input, nameElement);
        });
        
        nameElement.parentNode.replaceChild(input, nameElement);
        input.focus();
        input.select();
    }

    saveCategoryName(input, originalElement) {
        const newName = input.value.trim() || originalElement.textContent;
        originalElement.textContent = newName;
        input.parentNode.replaceChild(originalElement, input);
    }

    removeDay(dayId) {
        if (confirm('Remove this day?')) {
            this.socket.emit('remove-day', dayId);
        }
    }

    removeActivity(activityId) {
        this.socket.emit('remove-activity', activityId);
    }

    loadInitialData() {
        this.loadItineraryFromServer();
        this.updateTripInfoDisplay();
    }

    async loadItineraryFromServer() {
        try {
            const response = await fetch('/api/itinerary');
            const data = await response.json();
            
            this.tripInfo = data.tripInfo;
            this.itinerary = data.itinerary;
            
            this.updateTripInfoDisplay();
            this.renderDays();
            this.updateSummary();
        } catch (error) {
            console.error('Error loading itinerary:', error);
        }
    }

    updateTripInfoDisplay() {
        document.getElementById('trip-title').value = this.tripInfo.title;
        document.getElementById('trip-dates').value = this.tripInfo.dates;
        document.getElementById('islands').value = this.tripInfo.islands;
    }

    addDayToDisplay(dayData) {
        const container = document.getElementById('days-container');
        
        // Check if we have the empty state and clear it when adding the first day
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            container.innerHTML = '';
        }
        
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column fade-in';
        dayColumn.dataset.dayId = dayData.id;
        
        dayColumn.innerHTML = `
            <div class="day-header">
                <div class="day-title">Day ${dayData.dayNumber}</div>
                <button class="remove-day" onclick="planner.removeDay(${dayData.id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="day-activities-container">
                <div class="activity-table-header">
                    <div class="activity-table-row header-row">
                        <div class="activity-cell header-cell">Date</div>
                        <div class="activity-cell header-cell">Location</div>
                        <div class="activity-cell header-cell">Category</div>
                        <div class="activity-cell header-cell">Note</div>
                        <div class="activity-cell header-cell actions-cell">Actions</div>
                    </div>
                </div>
                <div class="day-activities">
                </div>
            </div>
        `;
        
        container.appendChild(dayColumn);
        this.setupDropZones();
    }

    removeDayFromDisplay(dayId) {
        const dayElement = document.querySelector(`[data-day-id="${dayId}"]`);
        if (dayElement) {
            dayElement.remove();
        }
    }

    addActivityToDisplay(activityData) {
        console.log('Adding activity to display:', activityData);
        const dayElement = document.querySelector(`[data-day-id="${activityData.dayId}"]`);
        if (dayElement) {
            const activitiesContainer = dayElement.querySelector('.day-activities');
            const activityElement = document.createElement('div');
            activityElement.className = 'activity-table-row slide-in';
            activityElement.dataset.activityId = activityData.id;
            
            // Store location preview data for hover functionality
            if (activityData.locationPreview) {
                activityElement.dataset.locationPreview = JSON.stringify(activityData.locationPreview);
            }
            
            // Get category icon
            const categoryIcon = this.getCategoryIcon(activityData.category || activityData.type);
            
            // Show the actual values or placeholder text
            const dateText = activityData.activityDate && activityData.activityDate.trim() ? activityData.activityDate : 'No date set';
            const locationText = activityData.location && activityData.location.trim() ? activityData.location : 'No location set';
            const noteText = activityData.note && activityData.note.trim() ? activityData.note : 'No note added';
            
            activityElement.innerHTML = `
                <div class="activity-cell" data-field="activityDate">
                    ${dateText}
                </div>
                <div class="activity-cell location-cell-container">
                    <span class="location-text" data-location="${locationText === 'No location set' ? '' : locationText}" title="Hover to see location preview">
                        ${locationText}
                    </span>
                </div>
                <div class="activity-cell category-cell" data-field="category">
                    <i class="${categoryIcon}"></i>
                    <span>${activityData.category || activityData.type}</span>
                </div>
                <div class="activity-cell" data-field="note">
                    ${noteText}
                </div>
                <div class="activity-cell actions-cell">
                    <span class="activity-name">${activityData.name}</span>
                    <div class="activity-actions">
                        <button class="edit-activity-btn" onclick="planner.openEditActivityModal(${activityData.id})" title="Edit activity details">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button class="remove-activity" onclick="planner.removeActivity(${activityData.id})" title="Remove activity">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
            
            // Add location hover listeners for the location text span
            const locationSpan = activityElement.querySelector('.location-text');
            if (locationSpan && locationSpan.dataset.location) {
                this.addLocationHoverListeners(locationSpan, activityData.locationPreview);
            }
            
            activitiesContainer.appendChild(activityElement);
        }
    }

    removeActivityFromDisplay(activityId) {
        const activityElement = document.querySelector(`[data-activity-id="${activityId}"]`);
        if (activityElement) {
            activityElement.remove();
        }
    }

    getCategoryIcon(category) {
        const iconMap = {
            'beaches': 'fas fa-umbrella-beach',
            'beach': 'fas fa-umbrella-beach',
            'restaurants': 'fas fa-utensils',
            'restaurant': 'fas fa-utensils',
            'attractions': 'fas fa-mountain',
            'attraction': 'fas fa-mountain',
            'shopping': 'fas fa-shopping-bag',
            'custom': 'fas fa-star'
        };
        return iconMap[category.toLowerCase()] || 'fas fa-star';
    }

    openEditActivityModal(activityId) {
        // Get current activity data from the DOM
        const activityElement = document.querySelector(`[data-activity-id="${activityId}"]`);
        if (!activityElement) return;
        
        const activityName = activityElement.querySelector('.activity-name').textContent.trim();
        const currentDate = activityElement.querySelector('[data-field="activityDate"]').textContent.trim();
        const currentLocation = activityElement.querySelector('.location-text').dataset.location || '';
        const currentCategory = activityElement.querySelector('[data-field="category"] span').textContent.trim();
        const currentNote = activityElement.querySelector('[data-field="note"]').textContent.trim();
        
        // Get stored location preview data
        let storedLocationPreview = null;
        if (activityElement.dataset.locationPreview) {
            try {
                storedLocationPreview = JSON.parse(activityElement.dataset.locationPreview);
            } catch (e) {
                console.log('Could not parse stored location preview');
            }
        }
        
        // Create modal form with pre-populated data
        const modal = document.createElement('div');
        modal.className = 'activity-details-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit Activity Details: ${activityName}</h3>
                    <button class="close-modal" onclick="this.closest('.activity-details-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="edit-activity-date">Date:</label>
                        <input type="text" id="edit-activity-date" placeholder="e.g., Dec 15, 2024 or Day 1 Morning" value="${currentDate === 'No date set' ? '' : currentDate}">
                    </div>
                    <div class="form-group">
                        <label for="edit-activity-location">Location:</label>
                        <input type="text" id="edit-activity-location" placeholder="e.g., Waikiki Beach, Honolulu" value="${currentLocation}">
                    </div>
                    <div class="form-group">
                        <label for="edit-activity-category">Category:</label>
                        <select id="edit-activity-category">
                            <option value="beaches" ${currentCategory.toLowerCase() === 'beaches' ? 'selected' : ''}>Beaches</option>
                            <option value="restaurants" ${currentCategory.toLowerCase() === 'restaurants' ? 'selected' : ''}>Restaurants</option>
                            <option value="attractions" ${currentCategory.toLowerCase() === 'attractions' ? 'selected' : ''}>Attractions</option>
                            <option value="shopping" ${currentCategory.toLowerCase() === 'shopping' ? 'selected' : ''}>Shopping</option>
                            <option value="custom" ${currentCategory.toLowerCase() === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-activity-note">Note:</label>
                        <textarea id="edit-activity-note" placeholder="e.g., Cost $7 to enter the temple, bring sunscreen, etc." rows="3">${currentNote === 'No note added' ? '' : currentNote}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Location Preview:</label>
                        <div id="edit-location-preview" class="location-preview">
                            <div class="no-location">Select a location to see preview</div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" onclick="this.closest('.activity-details-modal').remove()">Cancel</button>
                    <button class="btn-add" onclick="planner.saveEditedActivity(${activityId})">Save Changes</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add location autocomplete to the location input
        const locationInput = modal.querySelector('#edit-activity-location');
        this.createLocationAutocomplete(locationInput);
        
        // Show stored location preview first, or fetch if location exists but no stored data
        if (storedLocationPreview) {
            this.showStoredLocationPreviewInModal(storedLocationPreview);
        } else if (currentLocation) {
            this.showLocationPreviewInModal(currentLocation);
        }
        
        // Focus first input
        modal.querySelector('#edit-activity-date').focus();
    }
    
    saveEditedActivity(activityId) {
        const modal = document.querySelector('.activity-details-modal');
        const date = modal.querySelector('#edit-activity-date').value.trim();
        const location = modal.querySelector('#edit-activity-location').value.trim();
        const category = modal.querySelector('#edit-activity-category').value;
        const note = modal.querySelector('#edit-activity-note').value.trim();
        
        // Update activity with all the form data
        const updateData = {
            id: activityId,
            activityDate: date,
            location: location,
            category: category,
            note: note
        };
        
        this.socket.emit('update-activity', updateData);
        modal.remove();
    }

    addLocationHoverListeners(locationSpan, locationPreview = null) {
        let hoverTimeout;

        locationSpan.addEventListener('mouseenter', (e) => {
            // Clear any pending hide timeout
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }

            const locationText = locationSpan.dataset.location || locationSpan.textContent.trim();
            
            // Only show preview if there's actual location data (not placeholder text)
            if (locationText && !locationText.startsWith('Click to') && locationText !== '' && locationText !== 'No location set') {
                hoverTimeout = setTimeout(() => {
                    // Try to get stored location preview data first
                    const activityRow = locationSpan.closest('.activity-table-row');
                    let storedPreview = locationPreview;
                    
                    if (!storedPreview && activityRow && activityRow.dataset.locationPreview) {
                        try {
                            storedPreview = JSON.parse(activityRow.dataset.locationPreview);
                        } catch (e) {
                            console.log('Could not parse stored location preview');
                        }
                    }
                    
                    if (storedPreview) {
                        this.showStoredLocationHoverPreview(e.target, storedPreview);
                    } else {
                        // Fallback to API call if no stored data
                        this.showLocationHoverPreview(e.target, locationText);
                    }
                }, 500); // 500ms delay before showing tooltip
            }
        });

        locationSpan.addEventListener('mouseleave', () => {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }
            // Add a delay before hiding to allow user to move to tooltip
            this.hideTimeout = setTimeout(() => {
                this.hideLocationHoverPreview();
            }, 300); // 300ms delay before hiding
        });

        // Also hide on scroll or click elsewhere
        document.addEventListener('scroll', () => {
            this.hideLocationHoverPreview();
        });
    }

    showStoredLocationHoverPreview(targetElement, locationPreview) {
        // Remove any existing tooltip
        this.hideLocationHoverPreview();

        // Create tooltip element using stored data
        const tooltip = document.createElement('div');
        tooltip.className = 'location-hover-tooltip';
        tooltip.innerHTML = `
            <div class="hover-tooltip-content">
                <div class="hover-location-header">
                    <h3>${locationPreview.name}</h3>
                    <p>${locationPreview.formatted_address || 'Address not available'}</p>
                </div>
                ${locationPreview.rating ? `
                    <div class="hover-rating">
                        <span class="rating-stars">⭐ ${locationPreview.rating}/5</span>
                        ${locationPreview.user_ratings_total ? `<span class="rating-count">(${locationPreview.user_ratings_total} reviews)</span>` : ''}
                    </div>
                ` : ''}
                ${locationPreview.photos && locationPreview.photos.length > 0 ? `
                    <div class="hover-photo">
                        <img src="${locationPreview.photos[0]}" alt="${locationPreview.name}" />
                    </div>
                ` : ''}
                ${locationPreview.opening_hours && locationPreview.opening_hours.open_now !== undefined ? `
                    <div class="hover-status">
                        <span class="status ${locationPreview.opening_hours.open_now ? 'open' : 'closed'}">
                            ${locationPreview.opening_hours.open_now ? '🟢 Open' : '🔴 Closed'}
                        </span>
                    </div>
                ` : ''}
                <div class="hover-actions">
                    ${locationPreview.website ? `<a href="${locationPreview.website}" target="_blank" class="hover-action-btn">🌐 Website</a>` : ''}
                    <a href="https://www.google.com/maps/place/?q=place_id:${locationPreview.place_id}" target="_blank" class="hover-action-btn">📍 View on Maps</a>
                </div>
            </div>
        `;

        // Position tooltip relative to target element
        document.body.appendChild(tooltip);
        this.positionHoverTooltip(tooltip, targetElement);

        // Add hover listeners to tooltip to keep it visible
        this.addTooltipHoverListeners(tooltip);

        // Store reference for cleanup
        this.currentHoverTooltip = tooltip;
    }

    async showLocationHoverPreview(targetElement, locationText) {
        try {
            // Remove any existing tooltip
            this.hideLocationHoverPreview();

            // Fetch location details
            const response = await fetch(`/api/place-details?location=${encodeURIComponent(locationText)}`);
            if (!response.ok) return;

            const data = await response.json();
            if (!data.success || !data.placeDetails) return;

            const place = data.placeDetails;

            // Create tooltip element
            const tooltip = document.createElement('div');
            tooltip.className = 'location-hover-tooltip';
            tooltip.innerHTML = `
                <div class="hover-tooltip-content">
                    <div class="hover-location-header">
                        <h3>${place.name}</h3>
                        <p>${place.formatted_address}</p>
                    </div>
                    ${place.rating ? `
                        <div class="hover-rating">
                            <span class="rating-stars">⭐ ${place.rating}/5</span>
                            ${place.user_ratings_total ? `<span class="rating-count">(${place.user_ratings_total} reviews)</span>` : ''}
                        </div>
                    ` : ''}
                    ${place.photos && place.photos.length > 0 ? `
                        <div class="hover-photo">
                            <img src="${place.photos[0]}" alt="${place.name}" />
                        </div>
                    ` : ''}
                    ${place.opening_hours ? `
                        <div class="hover-status">
                            <span class="status ${place.opening_hours.open_now ? 'open' : 'closed'}">
                                ${place.opening_hours.open_now ? '🟢 Open' : '🔴 Closed'}
                            </span>
                        </div>
                    ` : ''}
                    <div class="hover-actions">
                        ${place.website ? `<a href="${place.website}" target="_blank" class="hover-action-btn">🌐 Website</a>` : ''}
                        <a href="https://www.google.com/maps/place/?q=place_id:${place.place_id}" target="_blank" class="hover-action-btn">📍 View on Maps</a>
                    </div>
                </div>
            `;

            // Position tooltip relative to target element
            document.body.appendChild(tooltip);
            this.positionHoverTooltip(tooltip, targetElement);

            // Add hover listeners to tooltip to keep it visible
            this.addTooltipHoverListeners(tooltip);

            // Store reference for cleanup
            this.currentHoverTooltip = tooltip;

        } catch (error) {
            console.log('Could not load location preview:', error);
        }
    }

    positionHoverTooltip(tooltip, targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Position above the element by default
        let top = rect.top - tooltipRect.height - 10;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        // Adjust if tooltip would go off screen
        if (top < 10) {
            // Position below instead
            top = rect.bottom + 10;
        }
        
        if (left < 10) {
            left = 10;
        } else if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        tooltip.style.top = `${top + window.scrollY}px`;
        tooltip.style.left = `${left}px`;
    }

    addTooltipHoverListeners(tooltip) {
        tooltip.addEventListener('mouseenter', () => {
            // Clear any pending hide timeout when entering tooltip
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }
        });

        tooltip.addEventListener('mouseleave', () => {
            // Hide tooltip when leaving it
            this.hideLocationHoverPreview();
        });
    }

    hideLocationHoverPreview() {
        if (this.currentHoverTooltip) {
            this.currentHoverTooltip.remove();
            this.currentHoverTooltip = null;
        }
        // Clear any pending hide timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
    }

    showStoredLocationPreviewInModal(locationPreview) {
        const previewContainer = document.getElementById('edit-location-preview');
        if (!previewContainer) return;

        // Create location preview HTML using stored data
        const photoHtml = locationPreview.photos && locationPreview.photos.length > 0 
            ? `<img src="${locationPreview.photos[0]}" alt="${locationPreview.name}" class="location-photo">`
            : '<div class="no-photo">📍 No photo available</div>';

        const ratingHtml = locationPreview.rating 
            ? `<div class="location-rating">⭐ ${locationPreview.rating}/5</div>`
            : '';

        const statusHtml = locationPreview.opening_hours && locationPreview.opening_hours.open_now !== undefined
            ? `<div class="location-status ${locationPreview.opening_hours.open_now ? 'open' : 'closed'}">
                 ${locationPreview.opening_hours.open_now ? '🟢 Open now' : '🔴 Closed now'}
               </div>`
            : '';

        previewContainer.innerHTML = `
            <div class="location-details">
                <div class="location-photo-container">
                    ${photoHtml}
                </div>
                <div class="location-info">
                    <h4 class="location-name">${locationPreview.name}</h4>
                    <p class="location-address">${locationPreview.formatted_address || 'Address not available'}</p>
                    <div class="location-meta">
                        ${ratingHtml}
                        ${statusHtml}
                    </div>
                    <div class="location-actions">
                        ${locationPreview.website ? `<a href="${locationPreview.website}" target="_blank" class="view-on-map">🌐 Website</a>` : ''}
                        <a href="https://www.google.com/maps/place/?q=place_id:${locationPreview.place_id}" target="_blank" class="view-on-map">📍 View on Maps</a>
                    </div>
                </div>
            </div>
        `;
    }

    async showLocationPreviewInModal(locationText) {
        const previewContainer = document.getElementById('edit-location-preview');
        if (!previewContainer) return;

        // Show loading state
        previewContainer.innerHTML = '<div class="loading-preview">🔍 Loading location details...</div>';

        try {
            const response = await fetch(`/api/place-details?location=${encodeURIComponent(locationText)}`);
            if (!response.ok) {
                previewContainer.innerHTML = '<div class="no-location">Select a location to see preview</div>';
                return;
            }

            const data = await response.json();
            if (!data.success || !data.placeDetails) {
                previewContainer.innerHTML = '<div class="no-location">Select a location to see preview</div>';
                return;
            }

            const place = data.placeDetails;

            // Create location preview HTML
            const photoHtml = place.photos && place.photos.length > 0 
                ? `<img src="${place.photos[0]}" alt="${place.name}" class="location-photo">`
                : '<div class="no-photo">📍 No photo available</div>';

            const ratingHtml = place.rating 
                ? `<div class="location-rating">⭐ ${place.rating}/5</div>`
                : '';

            const statusHtml = place.opening_hours && place.opening_hours.open_now !== undefined
                ? `<div class="location-status ${place.opening_hours.open_now ? 'open' : 'closed'}">
                     ${place.opening_hours.open_now ? '🟢 Open now' : '🔴 Closed now'}
                   </div>`
                : '';

            previewContainer.innerHTML = `
                <div class="location-details">
                    <div class="location-photo-container">
                        ${photoHtml}
                    </div>
                    <div class="location-info">
                        <h4 class="location-name">${place.name}</h4>
                        <p class="location-address">${place.formatted_address}</p>
                        <div class="location-meta">
                            ${ratingHtml}
                            ${statusHtml}
                        </div>
                        <div class="location-actions">
                            ${place.website ? `<a href="${place.website}" target="_blank" class="view-on-map">🌐 Website</a>` : ''}
                            <a href="https://www.google.com/maps/place/?q=place_id:${place.place_id}" target="_blank" class="view-on-map">📍 View on Maps</a>
                        </div>
                    </div>
                </div>
            `;

        } catch (error) {
            console.log('Could not load location preview:', error);
            previewContainer.innerHTML = '<div class="no-location">Select a location to see preview</div>';
        }
    }



    async showLocationPreview(placeId) {
        const previewContainer = document.getElementById('location-preview');
        if (!previewContainer) return;

        // Show loading state
        previewContainer.innerHTML = '<div class="loading-preview">🔍 Loading location details...</div>';

        try {
            const response = await fetch(`/api/place-details?place_id=${encodeURIComponent(placeId)}`);
            if (!response.ok) {
                previewContainer.innerHTML = '<div class="error-preview">❌ Could not load location details</div>';
                return;
            }

            const data = await response.json();
            if (!data.success || !data.placeDetails) {
                previewContainer.innerHTML = '<div class="error-preview">❌ Could not load location details</div>';
                return;
            }

            const place = data.placeDetails;

            // Create location preview HTML
            const photoHtml = place.photos && place.photos.length > 0 
                ? `<img src="${place.photos[0]}" alt="${place.name}" class="location-photo">`
                : '<div class="no-photo">📍 No photo available</div>';

            const ratingHtml = place.rating 
                ? `<div class="location-rating">⭐ ${place.rating}/5</div>`
                : '';

            const statusHtml = place.opening_hours && place.opening_hours.open_now !== undefined
                ? `<div class="location-status ${place.opening_hours.open_now ? 'open' : 'closed'}">
                     ${place.opening_hours.open_now ? '🟢 Open now' : '🔴 Closed now'}
                   </div>`
                : '';

            previewContainer.innerHTML = `
                <div class="location-details">
                    <div class="location-photo-container">
                        ${photoHtml}
                    </div>
                    <div class="location-info">
                        <h4 class="location-name">${place.name}</h4>
                        <p class="location-address">${place.formatted_address}</p>
                        <div class="location-meta">
                            ${ratingHtml}
                            ${statusHtml}
                        </div>
                        <div class="location-actions">
                            ${place.website ? `<a href="${place.website}" target="_blank" class="view-on-map">🌐 Website</a>` : ''}
                            <a href="https://www.google.com/maps/place/?q=place_id:${place.place_id}" target="_blank" class="view-on-map">📍 View on Maps</a>
                        </div>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error loading location preview:', error);
            previewContainer.innerHTML = '<div class="error-preview">❌ Could not load location details</div>';
        }
    }

    async searchLocations(query, callback) {
        try {
            console.log(`🔍 Searching locations: "${query}"`);
            
            const response = await fetch(`/api/search-locations?query=${encodeURIComponent(query)}`);
            const suggestions = await response.json();
            
            console.log(`✅ Received ${suggestions.length} location suggestions`);
            callback(suggestions);
            
        } catch (error) {
            console.error('❌ Error searching locations:', error);
            callback([]);
        }
    }

    createLocationAutocomplete(inputElement) {
        let debounceTimer;
        let suggestionsList;
        
        const showSuggestions = (suggestions) => {
            // Remove existing suggestions
            if (suggestionsList) {
                suggestionsList.remove();
            }
            
            if (suggestions.length === 0) return;
            
            suggestionsList = document.createElement('div');
            suggestionsList.className = 'location-suggestions';
            
            suggestions.forEach(suggestion => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.innerHTML = `
                    <div class="suggestion-content">
                        <div class="suggestion-name">${suggestion.name}</div>
                        <div class="suggestion-details">${suggestion.secondary || suggestion.formatted}</div>
                    </div>
                `;
                
                item.addEventListener('click', () => {
                    inputElement.value = suggestion.name;
                    suggestionsList.remove();
                    suggestionsList = null;
                    
                    // Show location preview based on context (modal vs regular)
                    if (inputElement.id === 'edit-activity-location') {
                        // In edit modal
                        this.showLocationPreviewInModal(suggestion.name);
                    } else if (inputElement.id === 'activity-location') {
                        // In add activity modal
                        if (suggestion.place_id) {
                            this.showLocationPreview(suggestion.place_id);
                        }
                    }
                    
                    // Trigger input event
                    inputElement.dispatchEvent(new Event('input'));
                    inputElement.blur();
                });
                
                suggestionsList.appendChild(item);
            });
            
            // Position suggestions
            const rect = inputElement.getBoundingClientRect();
            suggestionsList.style.position = 'fixed';
            suggestionsList.style.top = rect.bottom + 'px';
            suggestionsList.style.left = rect.left + 'px';
            suggestionsList.style.width = rect.width + 'px';
            suggestionsList.style.zIndex = '1000';
            
            document.body.appendChild(suggestionsList);
        };
        
        inputElement.addEventListener('input', async (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();
            
            if (query.length < 3) {
                if (suggestionsList) {
                    suggestionsList.remove();
                    suggestionsList = null;
                }
                return;
            }
            
            debounceTimer = setTimeout(() => {
                // Show loading state
                inputElement.classList.add('location-searching');
                
                this.searchLocations(query, (suggestions) => {
                    showSuggestions(suggestions);
                    // Remove loading state
                    inputElement.classList.remove('location-searching');
                });
            }, 300);
        });
        
        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (suggestionsList && !suggestionsList.contains(e.target) && e.target !== inputElement) {
                suggestionsList.remove();
                suggestionsList = null;
            }
        });
        
        // Close suggestions on escape
        inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && suggestionsList) {
                suggestionsList.remove();
                suggestionsList = null;
            }
        });
    }

    updateActivityDisplay(activityData) {
        const activityElement = document.querySelector(`[data-activity-id="${activityData.id}"]`);
        if (activityElement) {
            const dateCell = activityElement.querySelector('[data-field="activityDate"]');
            const locationSpan = activityElement.querySelector('.location-text');
            const categoryCell = activityElement.querySelector('[data-field="category"]');
            const noteCell = activityElement.querySelector('[data-field="note"]');
            
            // Update stored location preview data
            if (activityData.locationPreview) {
                activityElement.dataset.locationPreview = JSON.stringify(activityData.locationPreview);
            } else {
                delete activityElement.dataset.locationPreview;
            }
            
            if (dateCell) dateCell.textContent = activityData.activityDate || 'No date set';
            
            if (locationSpan) {
                const locationText = activityData.location || 'No location set';
                locationSpan.textContent = locationText;
                locationSpan.dataset.location = locationText === 'No location set' ? '' : locationText;
                // Re-add hover listeners for the updated location with preview data
                if (locationSpan.dataset.location) {
                    this.addLocationHoverListeners(locationSpan, activityData.locationPreview);
                }
            }
            
            if (noteCell) noteCell.textContent = activityData.note || 'No note added';
            
            if (categoryCell) {
                const icon = this.getCategoryIcon(activityData.category);
                categoryCell.innerHTML = `<i class="${icon}"></i><span>${activityData.category}</span>`;
            }
        }
    }

    clearDisplay() {
        this.itinerary = [];
        document.getElementById('days-container').innerHTML = `
            <div class="empty-state">
                <div class="empty-content">
                    <i class="fas fa-calendar-plus"></i>
                    <h3>No days planned yet</h3>
                    <p>Click "Add Day" to start planning your Hawaiian adventure!</p>
                </div>
            </div>
        `;
    }

    renderDays() {
        const container = document.getElementById('days-container');
        container.innerHTML = '';

        if (this.itinerary.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-content">
                        <i class="fas fa-calendar-plus"></i>
                        <h3>No days planned yet</h3>
                        <p>Click "Add Day" to start planning your Hawaiian adventure!</p>
                    </div>
                </div>
            `;
            return;
        }

        this.itinerary.forEach((day) => {
            // Create day column element
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column fade-in';
            dayColumn.dataset.dayId = day.id;
            
            dayColumn.innerHTML = `
                <div class="day-header">
                    <div class="day-title">Day ${day.dayNumber}</div>
                    <button class="remove-day" onclick="planner.removeDay(${day.id})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="day-activities-container">
                    <div class="activity-table-header">
                        <div class="activity-table-row header-row">
                            <div class="activity-cell header-cell">Date</div>
                            <div class="activity-cell header-cell">Location</div>
                            <div class="activity-cell header-cell">Category</div>
                            <div class="activity-cell header-cell">Note</div>
                            <div class="activity-cell header-cell actions-cell">Actions</div>
                        </div>
                    </div>
                    <div class="day-activities">
                    </div>
                </div>
            `;
            
            container.appendChild(dayColumn);
            
            // Add activities to this day using the existing addActivityToDisplay method
            day.activities.forEach(activity => {
                // Set the dayId to match what addActivityToDisplay expects
                activity.dayId = day.id;
                this.addActivityToDisplay(activity);
            });
        });
        
        this.setupDropZones();
    }

    async updateSummary() {
        try {
            const response = await fetch('/api/summary');
            const data = await response.json();
            
            document.getElementById('total-days').textContent = data.total_days || 0;
            document.getElementById('total-activities').textContent = data.total_activities || 0;
            document.getElementById('beach-count').textContent = data.beach_count || 0;
            document.getElementById('restaurant-count').textContent = data.restaurant_count || 0;
        } catch (error) {
            console.error('Error updating summary:', error);
        }
    }

    exportItinerary() {
        let csvContent = `Hawaii Itinerary - ${this.tripInfo.title}\nDates: ${this.tripInfo.dates}\nIslands: ${this.tripInfo.islands}\n\nDay,Activity,Date,Location,Category,Note\n`;
        
        this.itinerary.forEach((day) => {
            if (day.activities.length === 0) {
                csvContent += `Day ${day.dayNumber},No activities planned,,,,,\n`;
            } else {
                day.activities.forEach(activity => {
                    csvContent += `Day ${day.dayNumber},"${activity.name}","${activity.activityDate || ''}","${activity.location || ''}","${activity.category || activity.type}","${activity.note || ''}"\n`;
                });
            }
        });

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hawaii-itinerary-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    printItinerary() {
        let printContent = `
            <html><head><title>Hawaii Itinerary</title>
            <style>
                body{font-family:Arial,sans-serif;margin:20px}
                .header{text-align:center;margin-bottom:30px}
                .day{margin-bottom:30px}
                .day-title{font-size:18px;font-weight:bold;color:#333;margin-bottom:15px;border-bottom:2px solid #667eea;padding-bottom:5px}
                .activity{margin:10px 0;padding:10px;border:1px solid #eee;border-radius:5px;background:#f9f9f9}
                .activity-name{font-weight:bold;color:#333;margin-bottom:5px}
                .activity-details{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;color:#666}
                .activity-detail{margin:2px 0}
                .activity-detail strong{color:#333}
                .activity-note{grid-column:1/-1;margin-top:5px;font-style:italic}
            </style></head><body>
            <div class="header">
                <h1>🌺 Hawaii Itinerary</h1><h2>${this.tripInfo.title}</h2>
                <p><strong>Dates:</strong> ${this.tripInfo.dates}</p>
                <p><strong>Islands:</strong> ${this.tripInfo.islands}</p>
            </div>
        `;

        this.itinerary.forEach((day) => {
            printContent += `<div class="day"><div class="day-title">Day ${day.dayNumber}</div>`;
            if (day.activities.length === 0) {
                printContent += `<div class="activity"><div class="activity-name">No activities planned</div></div>`;
            } else {
                day.activities.forEach(activity => {
                    printContent += `
                        <div class="activity">
                            <div class="activity-name">${activity.name}</div>
                            <div class="activity-details">
                                <div class="activity-detail"><strong>Date:</strong> ${activity.activityDate || 'Not specified'}</div>
                                <div class="activity-detail"><strong>Location:</strong> ${activity.location || 'Not specified'}</div>
                                <div class="activity-detail"><strong>Category:</strong> ${activity.category || activity.type}</div>
                                ${activity.note ? `<div class="activity-note"><strong>Note:</strong> ${activity.note}</div>` : ''}
                            </div>
                        </div>
                    `;
                });
            }
            printContent += `</div>`;
        });

        printContent += `</body></html>`;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    }
}

// Location autocomplete now handled server-side for security

// Initialize
let planner;
document.addEventListener('DOMContentLoaded', () => {
    planner = new HawaiiItineraryPlanner();
}); 