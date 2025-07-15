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
            this.addActivityToDisplay(activityData);
            this.updateSummary();
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
        this.socket.emit('add-activity', {
            dayId: parseInt(dayId),
            name: activityData.name,
            type: activityData.type,
            icon: activityData.icon,
            position: position
        });
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

        const container = document.querySelector(`[data-category="${type}"] .activities`);
        const newActivity = document.createElement('div');
        newActivity.className = 'activity';
        newActivity.draggable = true;
        newActivity.dataset.type = type;
        newActivity.innerHTML = `<i class="${iconMap[type]}"></i><span>${name}</span>`;
        
        newActivity.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                name: name, type: type, icon: iconMap[type]
            }));
            newActivity.classList.add('dragging');
        });
        newActivity.addEventListener('dragend', () => newActivity.classList.remove('dragging'));
        
        container.appendChild(newActivity);
        document.getElementById('custom-activity-name').value = '';
        document.getElementById('custom-activity-type').value = 'custom';
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
            <div class="day-activities">
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
        const dayElement = document.querySelector(`[data-day-id="${activityData.dayId}"]`);
        if (dayElement) {
            const activitiesContainer = dayElement.querySelector('.day-activities');
            const activityElement = document.createElement('div');
            activityElement.className = 'day-activity slide-in';
            activityElement.dataset.activityId = activityData.id;
            
            activityElement.innerHTML = `
                <div class="activity-info">
                    <i class="${activityData.icon}"></i>
                    <span>${activityData.name}</span>
                </div>
                <button class="remove-activity" onclick="planner.removeActivity(${activityData.id})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            activitiesContainer.appendChild(activityElement);
        }
    }

    removeActivityFromDisplay(activityId) {
        const activityElement = document.querySelector(`[data-activity-id="${activityId}"]`);
        if (activityElement) {
            activityElement.remove();
        }
    }

    clearDisplay() {
        document.getElementById('days-container').innerHTML = `
            <div class="day-column">
                <div class="day-header">
                    <div class="day-title">Day 1</div>
                </div>
                <div class="day-activities drop-zone">
                    <p>Drag activities here to start planning!</p>
                </div>
            </div>
        `;
        this.setupDropZones();
    }

    renderDays() {
        const container = document.getElementById('days-container');
        container.innerHTML = '';

        if (this.itinerary.length === 0) {
            container.innerHTML = `
                <div class="day-column">
                    <div class="day-header">
                        <div class="day-title">Day 1</div>
                    </div>
                    <div class="day-activities drop-zone">
                        <p>Drag activities here to start planning!</p>
                    </div>
                </div>
            `;
            this.setupDropZones();
            return;
        }

        this.itinerary.forEach((day) => {
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
                <div class="day-activities">
                    ${day.activities.map(activity => `
                        <div class="day-activity" data-activity-id="${activity.id}">
                            <div class="activity-info">
                                <i class="${activity.icon}"></i>
                                <span>${activity.name}</span>
                            </div>
                            <button class="remove-activity" onclick="planner.removeActivity(${activity.id})">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
            
            container.appendChild(dayColumn);
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
        let csvContent = `Hawaii Itinerary - ${this.tripInfo.title}\nDates: ${this.tripInfo.dates}\nIslands: ${this.tripInfo.islands}\n\nDay,Activity,Type\n`;
        
        this.itinerary.forEach((day) => {
            if (day.activities.length === 0) {
                csvContent += `Day ${day.dayNumber},No activities planned,\n`;
            } else {
                day.activities.forEach(activity => {
                    csvContent += `Day ${day.dayNumber},"${activity.name}","${activity.type}"\n`;
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
            <style>body{font-family:Arial,sans-serif;margin:20px}
            .header{text-align:center;margin-bottom:30px}
            .day{margin-bottom:20px}
            .day-title{font-size:18px;font-weight:bold;color:#333;margin-bottom:10px}
            .activity{margin:5px 0;padding:5px 0;border-bottom:1px solid #eee}
            .activity-type{color:#666;font-size:12px}</style></head><body>
            <div class="header">
                <h1>🌺 Hawaii Itinerary</h1><h2>${this.tripInfo.title}</h2>
                <p><strong>Dates:</strong> ${this.tripInfo.dates}</p>
                <p><strong>Islands:</strong> ${this.tripInfo.islands}</p>
            </div>
        `;

        this.itinerary.forEach((day) => {
            printContent += `<div class="day"><div class="day-title">Day ${day.dayNumber}</div>`;
            if (day.activities.length === 0) {
                printContent += `<div class="activity">No activities planned</div>`;
            } else {
                day.activities.forEach(activity => {
                    printContent += `
                        <div class="activity">
                            <strong>${activity.name}</strong>
                            <div class="activity-type">${activity.type}</div>
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

// Initialize
let planner;
document.addEventListener('DOMContentLoaded', () => {
    planner = new HawaiiItineraryPlanner();
}); 