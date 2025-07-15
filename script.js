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
        this.setupDatePickerListeners();
        this.loadInitialData();
    }

    // Create calendar-style date picker for 2025
    createDatePicker(inputId, initialValue = '') {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        // Parse initial value if provided
        let selectedMonth = new Date().getMonth(); // Default to current month
        let selectedDay = new Date().getDate(); // Default to current day
        let selectedTime = '';
        
        if (initialValue && initialValue !== 'No date set') {
            const dateTimeMatch = initialValue.match(/(\w+)\s+(\d+),\s*2025(?:\s*-\s*(.+))?/);
            if (dateTimeMatch) {
                const monthName = dateTimeMatch[1];
                const day = parseInt(dateTimeMatch[2]);
                const time = dateTimeMatch[3] || '';
                const monthIndex = months.findIndex(m => m.toLowerCase().startsWith(monthName.toLowerCase()));
                if (monthIndex !== -1) {
                    selectedMonth = monthIndex;
                    selectedDay = day;
                    selectedTime = time;
                }
            }
        }
        
        const datePickerHtml = `
            <div class="calendar-date-picker" data-input="${inputId}">
                <div class="calendar-header">
                    <button type="button" class="calendar-nav calendar-nav-prev">&larr;</button>
                    <span class="calendar-month-year">${months[selectedMonth]} 2025</span>
                    <button type="button" class="calendar-nav calendar-nav-next">&rarr;</button>
                </div>
                <div class="calendar-grid">
                    <div class="calendar-day-header">S</div>
                    <div class="calendar-day-header">M</div>
                    <div class="calendar-day-header">T</div>
                    <div class="calendar-day-header">W</div>
                    <div class="calendar-day-header">T</div>
                    <div class="calendar-day-header">F</div>
                    <div class="calendar-day-header">S</div>
                    ${this.generateCalendarDays(selectedMonth, selectedDay)}
                </div>
                <div class="time-input-section">
                    <label for="${inputId}-time">Time (optional):</label>
                    <input type="text" id="${inputId}-time" class="time-input" placeholder="e.g., 10:00 AM, 2:30 PM" value="${selectedTime}">
                </div>
                <input type="hidden" id="${inputId}" value="${this.formatDateTimeValue(selectedMonth, selectedDay, selectedTime)}">
                <input type="hidden" class="selected-month" value="${selectedMonth}">
                <input type="hidden" class="selected-day" value="${selectedDay}">
            </div>
        `;
        
        return datePickerHtml;
    }
    
    generateCalendarDays(monthIndex, selectedDay = 1) {
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const maxDays = daysInMonth[monthIndex];
        
        // Get first day of month (0 = Sunday, 1 = Monday, etc.)
        const firstDay = new Date(2025, monthIndex, 1).getDay();
        
        let calendarHtml = '';
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < firstDay; i++) {
            calendarHtml += '<div class="calendar-day empty"></div>';
        }
        
        // Add actual days of the month
        for (let day = 1; day <= maxDays; day++) {
            const isSelected = day === selectedDay ? 'selected' : '';
            calendarHtml += `<div class="calendar-day ${isSelected}" data-day="${day}" onclick="this.closest('.calendar-date-picker').dispatchEvent(new CustomEvent('daySelected', {detail: {day: ${day}}}))">${day}</div>`;
        }
        
        return calendarHtml;
    }
    
    formatDateTimeValue(monthIndex, day, time = '') {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const dateStr = `${months[monthIndex]} ${day}, 2025`;
        return time ? `${dateStr} - ${time}` : dateStr;
    }
    
    updateCalendar(container, inputId, newMonth, selectedDay) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        // Update month display
        container.querySelector('.calendar-month-year').textContent = `${months[newMonth]} 2025`;
        
        // Update calendar grid
        const calendarGrid = container.querySelector('.calendar-grid');
        const daysContainer = calendarGrid.querySelectorAll('.calendar-day');
        daysContainer.forEach(day => day.remove());
        
        calendarGrid.innerHTML = `
            <div class="calendar-day-header">S</div>
            <div class="calendar-day-header">M</div>
            <div class="calendar-day-header">T</div>
            <div class="calendar-day-header">W</div>
            <div class="calendar-day-header">T</div>
            <div class="calendar-day-header">F</div>
            <div class="calendar-day-header">S</div>
            ${this.generateCalendarDays(newMonth, selectedDay)}
        `;
        
        // Update hidden month value
        container.querySelector('.selected-month').value = newMonth;
        
        // Update the main input value
        const timeInput = container.querySelector('.time-input');
        const time = timeInput ? timeInput.value.trim() : '';
        const hiddenInput = document.getElementById(inputId);
        hiddenInput.value = this.formatDateTimeValue(newMonth, selectedDay, time);
    }
    
    // Truncate note text for display
    truncateNote(noteText, maxLength = 50) {
        if (!noteText || noteText === 'No note added' || noteText.length <= maxLength) {
            return noteText;
        }
        return noteText.substring(0, maxLength) + '...';
    }
    
    setupDatePickerListeners() {
        // Date field clicks disabled - calendar is now available in activity forms
        // document.addEventListener('click', (e) => {
        //     if (e.target.closest('[data-field="activityDate"]') && !e.target.closest('.date-time-editor')) {
        //         const dateCell = e.target.closest('[data-field="activityDate"]');
        //         const activityRow = dateCell.closest('.activity-table-row');
        //         const activityId = activityRow.dataset.activityId;
        //         this.showDateTimeEditor(dateCell, activityId);
        //     }
        // });
        
        // Handle calendar navigation and day selection using event delegation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('calendar-nav-prev')) {
                const container = e.target.closest('.calendar-date-picker');
                this.navigateCalendar(container, -1);
                e.preventDefault();
                e.stopPropagation();
            } else if (e.target.classList.contains('calendar-nav-next')) {
                const container = e.target.closest('.calendar-date-picker');
                this.navigateCalendar(container, 1);
                e.preventDefault();
                e.stopPropagation();
            } else if (e.target.classList.contains('calendar-day') && !e.target.classList.contains('empty')) {
                const container = e.target.closest('.calendar-date-picker');
                const day = parseInt(e.target.dataset.day);
                this.selectCalendarDay(container, day);
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        // Handle time input changes
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('time-hour') || e.target.classList.contains('time-minute') || e.target.classList.contains('time-ampm')) {
                const container = e.target.closest('.date-time-editor');
                this.updateDateTimeFromInputs(container);
            }
        });
    }

    // Create new date picker with icon and modal
    createDatePickerWithIcon(inputId, initialValue = '') {
        return `
            <div class="date-picker-container">
                <input type="text" id="${inputId}" class="date-input" placeholder="e.g., July 15, 2025 - 10:00 AM" value="${initialValue}">
                <button type="button" class="calendar-icon-btn" onclick="planner.openCalendarModal('${inputId}')">
                    <i class="fas fa-calendar-alt"></i>
                </button>
            </div>
        `;
    }

    // Open calendar modal for date selection
    openCalendarModal(inputId) {
        const currentValue = document.getElementById(inputId).value.trim();
        
        // Parse current value if provided
        let selectedMonth = new Date().getMonth();
        let selectedDay = new Date().getDate();
        let selectedHour = 12;
        let selectedMinute = 0;
        let selectedAMPM = 'PM';

        if (currentValue && currentValue !== 'No date set') {
            const dateTimeMatch = currentValue.match(/(\w+)\s+(\d+),\s*2025(?:\s*-\s*(.+))?/);
            if (dateTimeMatch) {
                const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const monthName = dateTimeMatch[1];
                const day = parseInt(dateTimeMatch[2]);
                const timeStr = dateTimeMatch[3] || '';
                
                const monthIndex = months.findIndex(m => m.toLowerCase().startsWith(monthName.toLowerCase()));
                if (monthIndex !== -1) {
                    selectedMonth = monthIndex;
                    selectedDay = day;
                }

                if (timeStr) {
                    const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
                    if (timeMatch) {
                        selectedHour = parseInt(timeMatch[1]);
                        selectedMinute = parseInt(timeMatch[2]);
                        selectedAMPM = timeMatch[3].toUpperCase();
                    }
                }
            }
        }

        const modal = document.createElement('div');
        modal.className = 'calendar-picker-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Select Date & Time</h3>
                    <button class="close-modal" onclick="this.closest('.calendar-picker-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="calendar-modal-section">
                        <h4>Date:</h4>
                        ${this.createCalendarPicker(selectedMonth, selectedDay)}
                    </div>
                    <div class="time-modal-section">
                        <h4>Time (optional):</h4>
                        <div class="enhanced-time-picker">
                            <select class="time-hour">
                                ${Array.from({length: 12}, (_, i) => {
                                    const hour = i + 1;
                                    return `<option value="${hour}" ${hour === selectedHour ? 'selected' : ''}>${hour}</option>`;
                                }).join('')}
                            </select>
                            <span class="time-separator">:</span>
                            <select class="time-minute">
                                ${Array.from({length: 60}, (_, i) => {
                                    const minute = i.toString().padStart(2, '0');
                                    return `<option value="${minute}" ${i === selectedMinute ? 'selected' : ''}>${minute}</option>`;
                                }).join('')}
                            </select>
                            <select class="time-ampm">
                                <option value="AM" ${selectedAMPM === 'AM' ? 'selected' : ''}>AM</option>
                                <option value="PM" ${selectedAMPM === 'PM' ? 'selected' : ''}>PM</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" onclick="this.closest('.calendar-picker-modal').remove()">Cancel</button>
                    <button class="btn-ok" onclick="planner.confirmCalendarSelection('${inputId}')">OK</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupCalendarEventListeners(modal);
    }

    // Confirm calendar selection and update input
    confirmCalendarSelection(inputId) {
        const modal = document.querySelector('.calendar-picker-modal');
        const container = modal.querySelector('.calendar-date-picker');
        
        const selectedMonth = parseInt(container.querySelector('.selected-month').value);
        const selectedDay = parseInt(container.querySelector('.selected-day').value);
        const hour = modal.querySelector('.time-hour').value;
        const minute = modal.querySelector('.time-minute').value;
        const ampm = modal.querySelector('.time-ampm').value;

        // Format the date and time
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const dateStr = `${months[selectedMonth]} ${selectedDay}, 2025`;
        const timeStr = `${hour}:${minute} ${ampm}`;
        const fullDateTime = `${dateStr} - ${timeStr}`;

        // Update the input field
        document.getElementById(inputId).value = fullDateTime;

        // Close modal
        modal.remove();
    }

    // Format date for display (remove year, clean format)
    formatDateForDisplay(dateStr) {
        if (!dateStr || dateStr === 'No date set') {
            return dateStr;
        }
        
        // Remove year and clean up the date format
        // "July 15, 2025" becomes "July 15"
        // "December 3, 2025" becomes "December 3"
        return dateStr.replace(/,\s*2025/g, '').trim();
    }

    // Setup calendar event listeners for modals
    setupCalendarEventListeners(modal) {
        // Handle calendar navigation and day selection within this modal
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('calendar-nav-prev') || e.target.classList.contains('calendar-nav-next')) {
                const container = e.target.closest('.calendar-date-picker');
                const direction = e.target.classList.contains('calendar-nav-prev') ? -1 : 1;
                this.navigateCalendar(container, direction);
                e.preventDefault();
                e.stopPropagation();
            } else if (e.target.classList.contains('calendar-day') && !e.target.classList.contains('empty')) {
                const container = e.target.closest('.calendar-date-picker');
                const day = parseInt(e.target.dataset.day);
                this.selectCalendarDay(container, day);
                
                // Update the hidden input value
                this.updateCalendarHiddenInput(container);
                e.preventDefault();
                e.stopPropagation();
            }
        });

        // Handle time input changes
        modal.addEventListener('change', (e) => {
            if (e.target.classList.contains('time-input')) {
                const container = e.target.closest('.calendar-date-picker');
                this.updateCalendarHiddenInput(container);
            }
        });
    }

    // Update hidden input with calendar and time values
    updateCalendarHiddenInput(container) {
        const selectedMonth = parseInt(container.querySelector('.selected-month').value);
        const selectedDay = parseInt(container.querySelector('.selected-day').value);
        const timeInput = container.querySelector('.time-input');
        const time = timeInput ? timeInput.value.trim() : '';
        const hiddenInput = container.querySelector('input[type="hidden"]:not(.selected-month):not(.selected-day)');
        
        if (hiddenInput) {
            hiddenInput.value = this.formatDateTimeValue(selectedMonth, selectedDay, time);
        }
    }

    // Show date/time editor when clicking on date field
    showDateTimeEditor(dateCell, activityId) {
        // Get current date/time values
        const currentDateText = dateCell.querySelector('.date-line')?.textContent.trim() || 'No date set';
        const currentTimeText = dateCell.querySelector('.time-line')?.textContent.trim() || '';
        
        // Parse current values
        let selectedMonth = new Date().getMonth();
        let selectedDay = new Date().getDate();
        let selectedHour = 12;
        let selectedMinute = 0;
        let selectedAMPM = 'PM';
        
        if (currentDateText !== 'No date set') {
            const dateMatch = currentDateText.match(/(\w+)\s+(\d+),?\s*2025/);
            if (dateMatch) {
                const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const monthIndex = months.findIndex(m => m.toLowerCase().startsWith(dateMatch[1].toLowerCase()));
                if (monthIndex !== -1) {
                    selectedMonth = monthIndex;
                    selectedDay = parseInt(dateMatch[2]);
                }
            }
        }
        
        if (currentTimeText) {
            const timeMatch = currentTimeText.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (timeMatch) {
                selectedHour = parseInt(timeMatch[1]);
                selectedMinute = parseInt(timeMatch[2]);
                selectedAMPM = timeMatch[3].toUpperCase();
            }
        }
        
        // Create modal with calendar and time picker
        const modal = document.createElement('div');
        modal.className = 'date-time-editor-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit Date & Time</h3>
                    <button class="close-modal" onclick="this.closest('.date-time-editor-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="date-time-editor" data-activity-id="${activityId}">
                        <div class="calendar-section">
                            <h4>Select Date:</h4>
                            ${this.createCalendarPicker(selectedMonth, selectedDay)}
                        </div>
                        <div class="time-section">
                            <h4>Select Time (optional):</h4>
                            <div class="time-picker">
                                <select class="time-hour">
                                    ${Array.from({length: 12}, (_, i) => {
                                        const hour = i + 1;
                                        return `<option value="${hour}" ${hour === selectedHour ? 'selected' : ''}>${hour}</option>`;
                                    }).join('')}
                                </select>
                                <span>:</span>
                                <select class="time-minute">
                                    ${Array.from({length: 60}, (_, i) => {
                                        const minute = i.toString().padStart(2, '0');
                                        return `<option value="${minute}" ${i === selectedMinute ? 'selected' : ''}>${minute}</option>`;
                                    }).join('')}
                                </select>
                                <select class="time-ampm">
                                    <option value="AM" ${selectedAMPM === 'AM' ? 'selected' : ''}>AM</option>
                                    <option value="PM" ${selectedAMPM === 'PM' ? 'selected' : ''}>PM</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" onclick="this.closest('.date-time-editor-modal').remove()">Cancel</button>
                    <button class="btn-save" onclick="planner.saveDateTimeChanges('${activityId}')">Save Changes</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    createCalendarPicker(selectedMonth, selectedDay) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        return `
            <div class="calendar-date-picker">
                <div class="calendar-header">
                    <button type="button" class="calendar-nav calendar-nav-prev">&larr;</button>
                    <span class="calendar-month-year">${months[selectedMonth]} 2025</span>
                    <button type="button" class="calendar-nav calendar-nav-next">&rarr;</button>
                </div>
                <div class="calendar-grid">
                    <div class="calendar-day-header">S</div>
                    <div class="calendar-day-header">M</div>
                    <div class="calendar-day-header">T</div>
                    <div class="calendar-day-header">W</div>
                    <div class="calendar-day-header">T</div>
                    <div class="calendar-day-header">F</div>
                    <div class="calendar-day-header">S</div>
                    ${this.generateCalendarDays(selectedMonth, selectedDay)}
                </div>
                <input type="hidden" class="selected-month" value="${selectedMonth}">
                <input type="hidden" class="selected-day" value="${selectedDay}">
            </div>
        `;
    }

    navigateCalendar(container, direction) {
        const currentMonth = parseInt(container.querySelector('.selected-month').value);
        const selectedDay = parseInt(container.querySelector('.selected-day').value);
        
        let newMonth = currentMonth + direction;
        if (newMonth < 0) newMonth = 11;
        if (newMonth > 11) newMonth = 0;
        
        this.updateCalendarDisplay(container, newMonth, selectedDay);
    }

    selectCalendarDay(container, day) {
        const currentMonth = parseInt(container.querySelector('.selected-month').value);
        
        // Update selected day in the UI
        container.querySelectorAll('.calendar-day').forEach(dayEl => dayEl.classList.remove('selected'));
        container.querySelector(`[data-day="${day}"]`).classList.add('selected');
        
        // Update hidden input
        container.querySelector('.selected-day').value = day;
    }

    updateCalendarDisplay(container, newMonth, selectedDay) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        // Update month display
        container.querySelector('.calendar-month-year').textContent = `${months[newMonth]} 2025`;
        
        // Update calendar grid
        const calendarGrid = container.querySelector('.calendar-grid');
        const daysContainer = calendarGrid.querySelectorAll('.calendar-day');
        daysContainer.forEach(day => day.remove());
        
        calendarGrid.innerHTML = `
            <div class="calendar-day-header">S</div>
            <div class="calendar-day-header">M</div>
            <div class="calendar-day-header">T</div>
            <div class="calendar-day-header">W</div>
            <div class="calendar-day-header">T</div>
            <div class="calendar-day-header">F</div>
            <div class="calendar-day-header">S</div>
            ${this.generateCalendarDays(newMonth, selectedDay)}
        `;
        
        // Update hidden month value
        container.querySelector('.selected-month').value = newMonth;
    }

    updateDateTimeFromInputs(container) {
        const selectedMonth = parseInt(container.querySelector('.selected-month').value);
        const selectedDay = parseInt(container.querySelector('.selected-day').value);
        const hour = container.querySelector('.time-hour').value;
        const minute = container.querySelector('.time-minute').value;
        const ampm = container.querySelector('.time-ampm').value;
        
        // Store current values for saving
        container.dataset.currentDate = this.formatDateTimeValue(selectedMonth, selectedDay, `${hour}:${minute} ${ampm}`);
    }

    saveDateTimeChanges(activityId) {
        const modal = document.querySelector('.date-time-editor-modal');
        const container = modal.querySelector('.date-time-editor');
        
        const selectedMonth = parseInt(container.querySelector('.selected-month').value);
        const selectedDay = parseInt(container.querySelector('.selected-day').value);
        const hour = container.querySelector('.time-hour').value;
        const minute = container.querySelector('.time-minute').value;
        const ampm = container.querySelector('.time-ampm').value;
        
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const dateStr = `${months[selectedMonth]} ${selectedDay}, 2025`;
        const timeStr = `${hour}:${minute} ${ampm}`;
        const fullDateTime = `${dateStr} - ${timeStr}`;
        
        // Update the activity in the database
        const updateData = {
            id: parseInt(activityId),
            activityDate: fullDateTime
        };
        
        console.log('Updating activity date/time:', updateData);
        this.socket.emit('update-activity', updateData);
        
        modal.remove();
    }

    // Custom modal system for user-friendly dialogs
    showCustomAlert(message, title = 'Notification') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'custom-alert-modal';
            modal.innerHTML = `
                <div class="modal-content alert-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-ok" onclick="this.closest('.custom-alert-modal').remove(); arguments[0].resolve()">OK</button>
                    </div>
                </div>
            `;
            
            // Store resolve function for the button onclick
            modal.querySelector('.btn-ok').addEventListener('click', () => {
                modal.remove();
                resolve();
            });
            
            document.body.appendChild(modal);
            modal.querySelector('.btn-ok').focus();
        });
    }

    showCustomConfirm(message, title = 'Confirm Action') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'custom-confirm-modal';
            modal.innerHTML = `
                <div class="modal-content confirm-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-cancel" onclick="this.closest('.custom-confirm-modal').remove()">Cancel</button>
                        <button class="btn-confirm" onclick="this.closest('.custom-confirm-modal').remove()">Confirm</button>
                    </div>
                </div>
            `;
            
            modal.querySelector('.btn-cancel').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });
            
            modal.querySelector('.btn-confirm').addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });
            
            document.body.appendChild(modal);
            modal.querySelector('.btn-confirm').focus();
        });
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

        // Library activity management
        this.socket.on('library-activity-added', (libraryActivity) => {
            console.log('Received library-activity-added event:', libraryActivity);
            this.addLibraryActivityToDisplay(libraryActivity);
        });

        this.socket.on('library-activity-removed', (activityId) => {
            console.log('Received library-activity-removed event:', activityId);
            this.removeLibraryActivityFromDisplay(activityId);
        });

        this.socket.on('library-activities-loaded', (libraryActivities) => {
            console.log('Loading custom library activities:', libraryActivities);
            libraryActivities.forEach(activity => {
                this.addLibraryActivityToDisplay(activity);
            });
        });
    }

    setupEventListeners() {
        document.getElementById('add-day-btn').addEventListener('click', () => {
            this.socket.emit('add-day');
        });

        document.getElementById('clear-all-btn').addEventListener('click', async () => {
            const confirmed = await this.showCustomConfirm('Are you sure you want to clear all days? This action cannot be undone.', 'Clear All Days');
            if (confirmed) {
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

    addActivityDirectly(dayId) {
        const position = document.querySelector(`[data-day-id="${dayId}"] .day-activities`).children.length;
        
        // Create empty activity data for direct entry
        const emptyActivityData = {
            name: '',
            type: 'custom',
            icon: 'fas fa-star'
        };
        
        // Show form for activity details
        this.showDirectActivityForm(dayId, emptyActivityData, position);
    }

    showDirectActivityForm(dayId, activityData, position) {
        // Create modal form for direct activity entry
        const modal = document.createElement('div');
        modal.className = 'activity-details-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add New Activity</h3>
                    <button class="close-modal" onclick="this.closest('.activity-details-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="direct-activity-name">Activity Name:</label>
                        <input type="text" id="direct-activity-name" placeholder="Enter activity name" required>
                    </div>
                    <div class="form-group">
                        <label for="direct-activity-date">Date:</label>
                        ${this.createDatePickerWithIcon('direct-activity-date', '')}
                    </div>
                    <div class="form-group">
                        <label for="direct-activity-location">Location:</label>
                        <input type="text" id="direct-activity-location" placeholder="e.g., Waikiki Beach, Honolulu">
                    </div>
                    <div class="form-group">
                        <label for="direct-activity-category">Category:</label>
                        <select id="direct-activity-category">
                            <option value="custom">Custom</option>
                            <option value="beaches">Beaches</option>
                            <option value="restaurants">Restaurants</option>
                            <option value="attractions">Attractions</option>
                            <option value="shopping">Shopping</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="direct-activity-note">Note:</label>
                        <textarea id="direct-activity-note" placeholder="e.g., Cost $7 to enter the temple, bring sunscreen, etc." rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Location Preview:</label>
                        <div id="direct-location-preview" class="location-preview">
                            <div class="no-location">Select a location to see preview</div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" onclick="this.closest('.activity-details-modal').remove()">Cancel</button>
                    <button class="btn-add" onclick="planner.confirmAddDirectActivity(${dayId}, ${position})">Add Activity</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add location autocomplete to the location input
        const locationInput = modal.querySelector('#direct-activity-location');
        this.createLocationAutocomplete(locationInput);
        
        // Focus first input
        modal.querySelector('#direct-activity-name').focus();
    }

    showActivityDetailsForm(dayId, activityData, position) {
        // Create modal form
        const modal = document.createElement('div');
        modal.className = 'activity-details-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add New Activity</h3>
                    <button class="close-modal" onclick="this.closest('.activity-details-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="activity-name">Activity Name:</label>
                        <input type="text" id="activity-name" placeholder="Enter activity name" value="${activityData.name}" required>
                    </div>
                    <div class="form-group">
                        <label for="activity-date">Date:</label>
                        ${this.createDatePickerWithIcon('activity-date', '')}
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
        modal.querySelector('#activity-name').focus();
    }

    confirmAddActivity(dayId, activityData, position) {
        const modal = document.querySelector('.activity-details-modal');
        const name = modal.querySelector('#activity-name') ? modal.querySelector('#activity-name').value.trim() : activityData.name;
        const date = modal.querySelector('#activity-date').value.trim();
        const location = modal.querySelector('#activity-location').value.trim();
        const category = modal.querySelector('#activity-category').value;
        const note = modal.querySelector('#activity-note').value.trim();
        
        // Create activity object with all the form data
        const newActivityData = {
            dayId: parseInt(dayId),
            name: name,
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

    async confirmAddDirectActivity(dayId, position) {
        const modal = document.querySelector('.activity-details-modal');
        const name = modal.querySelector('#direct-activity-name').value.trim();
        const date = modal.querySelector('#direct-activity-date').value.trim();
        const location = modal.querySelector('#direct-activity-location').value.trim();
        const category = modal.querySelector('#direct-activity-category').value;
        const note = modal.querySelector('#direct-activity-note').value.trim();
        
        // Validate activity name is provided
        if (!name) {
            await this.showCustomAlert('Please enter an activity name to continue.', 'Missing Activity Name');
            modal.querySelector('#direct-activity-name').focus();
            return;
        }
        
        // Create activity object with all the form data
        const newActivityData = {
            dayId: parseInt(dayId),
            name: name,
            type: category,
            icon: this.getCategoryIcon(category),
            position: position,
            activityDate: date,
            location: location,
            category: category,
            note: note
        };
        
        console.log('Sending direct activity data:', newActivityData);
        this.socket.emit('add-activity', newActivityData);
        
        modal.remove();
    }

    // Add library activity to display
    addLibraryActivityToDisplay(libraryActivity) {
        // Create custom category if it doesn't exist
        if (libraryActivity.category === 'custom' && !document.querySelector('[data-category="custom"]')) {
            this.createCustomCategory();
        }

        const container = document.querySelector(`[data-category="${libraryActivity.category}"] .activities`);
        if (!container) {
            console.error('Category container not found for category:', libraryActivity.category);
            return;
        }

        const newActivity = document.createElement('div');
        newActivity.className = 'activity';
        newActivity.draggable = true;
        newActivity.dataset.type = libraryActivity.type;
        newActivity.dataset.libraryId = libraryActivity.id; // Store the database ID
        newActivity.innerHTML = `
            <i class="${libraryActivity.icon}"></i>
            <span>${libraryActivity.name}</span>
            <button class="delete-activity" onclick="planner.deleteActivity(this)" title="Remove activity">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        newActivity.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                name: libraryActivity.name, 
                type: libraryActivity.type, 
                icon: libraryActivity.icon
            }));
            newActivity.classList.add('dragging');
        });
        newActivity.addEventListener('dragend', () => newActivity.classList.remove('dragging'));
        
        container.appendChild(newActivity);
    }

    // Remove library activity from display
    removeLibraryActivityFromDisplay(activityId) {
        const activityElement = document.querySelector(`[data-library-id="${activityId}"]`);
        if (activityElement) {
            activityElement.remove();
        }
    }



    // Load custom library activities when page loads
    loadCustomLibraryActivities() {
        console.log('Loading custom library activities...');
        this.socket.emit('load-library-activities');
    }

    async addCustomActivity() {
        const name = document.getElementById('custom-activity-name').value.trim();
        const type = document.getElementById('custom-activity-type').value;
        if (!name) {
            await this.showCustomAlert('Please enter an activity name to add it to the library.', 'Missing Activity Name');
            return;
        }

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

        // Save to database instead of directly adding to DOM
        const libraryActivityData = {
            name: name,
            type: type,
            icon: iconMap[type],
            category: categoryMap[type]
        };

        console.log('Saving custom activity to database:', libraryActivityData);
        this.socket.emit('add-library-activity', libraryActivityData);
        
        // Clear the input
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

    async deleteActivity(button) {
        const confirmed = await this.showCustomConfirm('Are you sure you want to remove this activity from the library?', 'Remove Activity');
        if (confirmed) {
            const activityElement = button.closest('.activity');
            const libraryId = activityElement.dataset.libraryId;
            
            if (libraryId) {
                // This is a custom activity - remove from database
                console.log('Deleting custom library activity:', libraryId);
                this.socket.emit('remove-library-activity', parseInt(libraryId));
            } else {
                // This is a default activity - just remove from DOM
                activityElement.remove();
            }
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

    async removeDay(dayId) {
        const confirmed = await this.showCustomConfirm('Are you sure you want to remove this day and all its activities?', 'Remove Day');
        if (confirmed) {
            this.socket.emit('remove-day', dayId);
        }
    }

    async removeActivity(activityId) {
        const confirmed = await this.showCustomConfirm('Are you sure you want to remove this activity from your itinerary?', 'Remove Activity');
        if (confirmed) {
            this.socket.emit('remove-activity', activityId);
        }
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
                <div class="day-header-actions">
                    <button class="add-activity-btn" onclick="planner.addActivityDirectly(${dayData.id})" title="Add activity directly">
                        <i class="fas fa-plus"></i> Add Activity
                    </button>
                    <button class="remove-day" onclick="planner.removeDay(${dayData.id})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
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
            activityElement.dataset.activityName = activityData.name;
            
            // Store location preview data for hover functionality
            if (activityData.locationPreview) {
                activityElement.dataset.locationPreview = JSON.stringify(activityData.locationPreview);
            }
            
            // Get category icon
            const categoryIcon = this.getCategoryIcon(activityData.category || activityData.type);
            
            // Show the actual values or placeholder text
            const rawDateText = activityData.activityDate && activityData.activityDate.trim() ? activityData.activityDate : 'No date set';
            const locationText = activityData.location && activityData.location.trim() ? activityData.location : 'No location set';
            const noteText = activityData.note && activityData.note.trim() ? activityData.note : 'No note added';
            
            // Parse date and time for separate display
            let dateDisplay = rawDateText;
            let timeDisplay = '';
            
            if (rawDateText !== 'No date set' && rawDateText.includes(' - ')) {
                const [datePart, timePart] = rawDateText.split(' - ');
                dateDisplay = this.formatDateForDisplay(datePart.trim());
                timeDisplay = timePart.trim();
            } else if (rawDateText !== 'No date set') {
                dateDisplay = this.formatDateForDisplay(rawDateText);
            }
            
            activityElement.innerHTML = `
                <div class="activity-cell" data-field="activityDate">
                    <div class="date-line">${dateDisplay}</div>
                    ${timeDisplay ? `<div class="time-line">${timeDisplay}</div>` : ''}
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
                <div class="activity-cell note-cell-container" data-field="note">
                    <span class="note-text" data-full-note="${noteText === 'No note added' ? '' : noteText}" title="Click to expand full note">
                        ${this.truncateNote(noteText)}
                    </span>
                </div>
                <div class="activity-cell actions-cell">
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
            
            // Add note hover/click listeners for note expansion
            const noteSpan = activityElement.querySelector('.note-text');
            if (noteSpan && noteSpan.dataset.fullNote) {
                this.addNoteHoverListeners(noteSpan);
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
        
        const activityName = activityElement.dataset.activityName;
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
                        <label for="edit-activity-name">Activity Name:</label>
                        <input type="text" id="edit-activity-name" placeholder="Enter activity name" value="${activityName}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-activity-date">Date:</label>
                        ${this.createDatePickerWithIcon('edit-activity-date', currentDate)}
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
        modal.querySelector('#edit-activity-name').focus();
    }
    
    saveEditedActivity(activityId) {
        const modal = document.querySelector('.activity-details-modal');
        const name = modal.querySelector('#edit-activity-name').value.trim();
        const date = modal.querySelector('#edit-activity-date').value.trim();
        const location = modal.querySelector('#edit-activity-location').value.trim();
        const category = modal.querySelector('#edit-activity-category').value;
        const note = modal.querySelector('#edit-activity-note').value.trim();
        
        // Update activity with all the form data
        const updateData = {
            id: activityId,
            name: name,
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

    addNoteHoverListeners(noteSpan) {
        let hoverTimeout;

        noteSpan.addEventListener('mouseenter', (e) => {
            // Clear any pending hide timeout
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }

            const fullNote = noteSpan.dataset.fullNote;
            const displayedNote = noteSpan.textContent.trim();
            
            // Only show expanded note if it's actually truncated
            if (fullNote && fullNote !== displayedNote && !displayedNote.startsWith('No note')) {
                hoverTimeout = setTimeout(() => {
                    this.showNoteHoverPreview(e.target, fullNote);
                }, 500); // 500ms delay before showing tooltip
            }
        });

        noteSpan.addEventListener('mouseleave', () => {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }
            // Add a delay before hiding to allow user to move to tooltip
            this.hideTimeout = setTimeout(() => {
                this.hideNoteHoverPreview();
            }, 300); // 300ms delay before hiding
        });

        // Also add click functionality for mobile
        noteSpan.addEventListener('click', (e) => {
            const fullNote = noteSpan.dataset.fullNote;
            const displayedNote = noteSpan.textContent.trim();
            
            if (fullNote && fullNote !== displayedNote && !displayedNote.startsWith('No note')) {
                e.preventDefault();
                this.showNoteHoverPreview(e.target, fullNote);
            }
        });

        // Hide on scroll
        document.addEventListener('scroll', () => {
            this.hideNoteHoverPreview();
        });
    }

    showNoteHoverPreview(targetElement, fullNote) {
        // Remove any existing note tooltip
        this.hideNoteHoverPreview();

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'note-hover-tooltip';
        tooltip.innerHTML = `
            <div class="note-tooltip-content">
                <div class="note-tooltip-header">
                    <h4>Full Note</h4>
                </div>
                <div class="note-tooltip-body">
                    <p>${fullNote}</p>
                </div>
            </div>
        `;

        // Position tooltip relative to target element
        document.body.appendChild(tooltip);
        this.positionNoteTooltip(tooltip, targetElement);

        // Add hover listeners to tooltip to keep it visible
        this.addNoteTooltipHoverListeners(tooltip);

        // Store reference for cleanup
        this.currentNoteTooltip = tooltip;
    }

    positionNoteTooltip(tooltip, targetElement) {
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

    addNoteTooltipHoverListeners(tooltip) {
        tooltip.addEventListener('mouseenter', () => {
            // Clear any pending hide timeout when entering tooltip
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }
        });

        tooltip.addEventListener('mouseleave', () => {
            // Hide tooltip when leaving it
            this.hideNoteHoverPreview();
        });
    }

    hideNoteHoverPreview() {
        if (this.currentNoteTooltip) {
            this.currentNoteTooltip.remove();
            this.currentNoteTooltip = null;
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
                    } else if (inputElement.id === 'direct-activity-location') {
                        // In direct add activity modal
                        this.showDirectLocationPreviewInModal(suggestion.name);
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

    async showDirectLocationPreviewInModal(locationText) {
        const previewContainer = document.getElementById('direct-location-preview');
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

    updateActivityDisplay(activityData) {
        const activityElement = document.querySelector(`[data-activity-id="${activityData.id}"]`);
        if (activityElement) {
            const dateCell = activityElement.querySelector('[data-field="activityDate"]');
            const locationSpan = activityElement.querySelector('.location-text');
            const categoryCell = activityElement.querySelector('[data-field="category"]');
            const noteCell = activityElement.querySelector('[data-field="note"]');
            
            // Update stored activity name
            if (activityData.name) {
                activityElement.dataset.activityName = activityData.name;
            }
            
            // Update stored location preview data
            if (activityData.locationPreview) {
                activityElement.dataset.locationPreview = JSON.stringify(activityData.locationPreview);
            } else {
                delete activityElement.dataset.locationPreview;
            }
            
            if (dateCell) {
                const rawDateText = activityData.activityDate || 'No date set';
                
                // Parse date and time for separate display
                let dateDisplay = rawDateText;
                let timeDisplay = '';
                
                if (rawDateText !== 'No date set' && rawDateText.includes(' - ')) {
                    const [datePart, timePart] = rawDateText.split(' - ');
                    dateDisplay = this.formatDateForDisplay(datePart.trim());
                    timeDisplay = timePart.trim();
                } else if (rawDateText !== 'No date set') {
                    dateDisplay = this.formatDateForDisplay(rawDateText);
                }
                
                dateCell.innerHTML = `
                    <div class="date-line">${dateDisplay}</div>
                    ${timeDisplay ? `<div class="time-line">${timeDisplay}</div>` : ''}
                `;
            }
            
            if (locationSpan) {
                const locationText = activityData.location || 'No location set';
                locationSpan.textContent = locationText;
                locationSpan.dataset.location = locationText === 'No location set' ? '' : locationText;
                // Re-add hover listeners for the updated location with preview data
                if (locationSpan.dataset.location) {
                    this.addLocationHoverListeners(locationSpan, activityData.locationPreview);
                }
            }
            
            if (noteCell) {
                const noteText = activityData.note || 'No note added';
                const noteSpan = noteCell.querySelector('.note-text');
                if (noteSpan) {
                    noteSpan.dataset.fullNote = noteText === 'No note added' ? '' : noteText;
                    noteSpan.textContent = this.truncateNote(noteText);
                } else {
                    noteCell.textContent = noteText;
                }
            }
            
            if (categoryCell) {
                const icon = this.getCategoryIcon(activityData.category);
                categoryCell.innerHTML = `<i class="${icon}"></i><span>${activityData.category}</span>`;
            }
            
            // Re-add note hover listeners after update
            const noteSpan = activityElement.querySelector('.note-text');
            if (noteSpan && noteSpan.dataset.fullNote) {
                this.addNoteHoverListeners(noteSpan);
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
                    <div class="day-header-actions">
                        <button class="add-activity-btn" onclick="planner.addActivityDirectly(${day.id})" title="Add activity directly">
                            <i class="fas fa-plus"></i> Add Activity
                        </button>
                        <button class="remove-day" onclick="planner.removeDay(${day.id})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
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

// Tropical Night Shooting Stars System
class ShootingStar {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.reset();
    }
    
    reset() {
        // Start from random position along top and left edges
        if (Math.random() > 0.5) {
            this.x = Math.random() * this.canvas.width;
            this.y = -10;
        } else {
            this.x = -10;
            this.y = Math.random() * this.canvas.height * 0.4; // Only in upper portion for tropical night sky
        }
        
        // Velocity for diagonal movement
        this.vx = Math.random() * 2 + 1.5; // Slower, more elegant
        this.vy = Math.random() * 2 + 1.5;
        
        // Trail properties
        this.trail = [];
        this.trailLength = Math.random() * 15 + 10;
        this.size = Math.random() * 1.2 + 0.8;
        this.brightness = Math.random() * 0.4 + 0.6;
        this.life = 1.0;
        this.decay = Math.random() * 0.012 + 0.008;
        
        // Color variation - tropical night colors (blues, whites, subtle greens)
        this.hue = Math.random() * 60 + 180; // Blue to cyan range
    }
    
    update() {
        // Store current position in trail
        this.trail.push({ x: this.x, y: this.y, life: this.life });
        
        // Remove old trail points
        if (this.trail.length > this.trailLength) {
            this.trail.shift();
        }
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Fade out over time
        this.life -= this.decay;
        
        // Check if off screen or faded
        return this.life > 0 && 
               this.x < this.canvas.width + 50 && 
               this.y < this.canvas.height + 50;
    }
    
    draw() {
        this.ctx.save();
        
        // Draw trail
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            const trailOpacity = (i / this.trail.length) * point.life * this.brightness;
            const trailSize = (i / this.trail.length) * this.size;
            
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, trailSize, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsla(${this.hue}, 70%, 85%, ${trailOpacity})`;
            this.ctx.fill();
            
            // Add gentle glow effect
            this.ctx.shadowBlur = 6;
            this.ctx.shadowColor = `hsla(${this.hue}, 70%, 85%, ${trailOpacity * 0.3})`;
            this.ctx.fill();
        }
        
        // Draw main star (brightest point)
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.size * 1.2, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsla(${this.hue}, 80%, 90%, ${this.life * this.brightness})`;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = `hsla(${this.hue}, 80%, 85%, ${this.life * 0.5})`;
        this.ctx.fill();
        
        this.ctx.restore();
    }
}

class TropicalNightStarSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.stars = [];
        this.maxStars = 3; // Fewer stars for subtle tropical effect
        
        this.resizeCanvas();
        this.animate();
        
        // Create new stars more gently
        this.starInterval = setInterval(() => {
            if (this.stars.length < this.maxStars && Math.random() > 0.7) {
                this.stars.push(new ShootingStar(this.canvas));
            }
        }, 3000); // Less frequent for peaceful tropical night
        
        // Handle resize
        this.resizeHandler = () => this.resizeCanvas();
        window.addEventListener('resize', this.resizeHandler);
    }
    
    resizeCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }
    
    animate() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update and draw stars
        this.stars = this.stars.filter(star => {
            const alive = star.update();
            if (alive) {
                star.draw();
            }
            return alive;
        });
        
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
    
    destroy() {
        if (this.starInterval) clearInterval(this.starInterval);
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    }
}

// Tropical Night Floating Particles System
function createTropicalNightParticles() {
    const container = document.body;
    const particleCount = Math.min(8, Math.floor(window.innerWidth / 200));
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'tropical-night-particle';
        
        const initialSize = Math.random() * 3 + 2;
        const hue = Math.random() * 60 + 180; // Blue to cyan range
        
        particle.style.cssText = `
            position: fixed;
            width: ${initialSize}px;
            height: ${initialSize}px;
            background: radial-gradient(circle, hsla(${hue}, 70%, 85%, 0.8), hsla(${hue}, 70%, 85%, 0.3));
            border-radius: 50%;
            left: ${Math.random() * window.innerWidth}px;
            top: ${Math.random() * (window.innerHeight * 0.7)}px;
            pointer-events: none;
            z-index: 2;
            animation: tropicalFloat ${Math.random() * 8 + 6}s ease-in-out infinite;
            animation-delay: ${Math.random() * 8}s;
            box-shadow: 0 0 10px hsla(${hue}, 70%, 85%, 0.4);
        `;
        
        container.appendChild(particle);
        
        // Remove particle after animation completes multiple cycles
        setTimeout(() => {
            if (particle.parentNode) {
                particle.remove();
            }
        }, 60000); // Remove after 1 minute
    }
    
    // Create new particles periodically
    setTimeout(() => {
        if (document.body) {
            createTropicalNightParticles();
        }
    }, Math.random() * 15000 + 10000); // Every 10-25 seconds
}

// Initialize
let planner;
let starSystem;
document.addEventListener('DOMContentLoaded', () => {
    planner = new HawaiiItineraryPlanner();
    
    // Load custom library activities after connection is established
    setTimeout(() => {
        planner.loadCustomLibraryActivities();
    }, 1000);
    
    // Initialize tropical night shooting stars
    starSystem = new TropicalNightStarSystem('shooting-stars-canvas');
    
    // Initialize floating tropical particles
    setTimeout(() => {
        createTropicalNightParticles();
    }, 2000); // Start particles after 2 seconds
}); 