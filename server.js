const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// Database setup
const db = new sqlite3.Database('hawaii_planner.db');

// Create tables
db.serialize(() => {
    // Trips table
    db.run(`CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        dates TEXT,
        islands TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Days table
    db.run(`CREATE TABLE IF NOT EXISTS days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id INTEGER,
        day_number INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trip_id) REFERENCES trips (id)
    )`);

    // Activities table
    db.run(`CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_id INTEGER,
        name TEXT NOT NULL,
        type TEXT,
        icon TEXT,
        position INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (day_id) REFERENCES days (id)
    )`);
});

// Default trip ID (for simplicity, we'll use trip ID 1)
const DEFAULT_TRIP_ID = 1;

// Ensure default trip exists
db.get("SELECT id FROM trips WHERE id = ?", [DEFAULT_TRIP_ID], (err, row) => {
    if (!row) {
        db.run("INSERT INTO trips (id, title, dates, islands) VALUES (?, ?, ?, ?)", 
            [DEFAULT_TRIP_ID, "Our Hawaiian Dream Vacation", "Dec 15-22, 2024", "Oahu"]);
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send current itinerary to new user
    socket.emit('load-itinerary', { tripId: DEFAULT_TRIP_ID });

    // Handle trip info updates
    socket.on('update-trip-info', (data) => {
        db.run("UPDATE trips SET title = ?, dates = ?, islands = ? WHERE id = ?", 
            [data.title, data.dates, data.islands, DEFAULT_TRIP_ID]);
        socket.broadcast.emit('trip-info-updated', data);
    });

    // Handle adding a day
    socket.on('add-day', () => {
        db.run("INSERT INTO days (trip_id, day_number) VALUES (?, (SELECT COALESCE(MAX(day_number), 0) + 1 FROM days WHERE trip_id = ?))", 
            [DEFAULT_TRIP_ID, DEFAULT_TRIP_ID], function(err) {
            if (!err) {
                const dayData = { id: this.lastID, dayNumber: this.lastID };
                io.emit('day-added', dayData);
            }
        });
    });

    // Handle removing a day
    socket.on('remove-day', (dayId) => {
        db.run("DELETE FROM activities WHERE day_id = ?", [dayId]);
        db.run("DELETE FROM days WHERE id = ?", [dayId], function(err) {
            if (!err) {
                io.emit('day-removed', dayId);
            }
        });
    });

    // Handle adding an activity
    socket.on('add-activity', (data) => {
        db.run("INSERT INTO activities (day_id, name, type, icon, position) VALUES (?, ?, ?, ?, ?)", 
            [data.dayId, data.name, data.type, data.icon, data.position], function(err) {
            if (!err) {
                const activityData = { 
                    id: this.lastID, 
                    dayId: data.dayId, 
                    name: data.name, 
                    type: data.type, 
                    icon: data.icon,
                    position: data.position 
                };
                io.emit('activity-added', activityData);
            }
        });
    });

    // Handle removing an activity
    socket.on('remove-activity', (activityId) => {
        db.run("DELETE FROM activities WHERE id = ?", [activityId], function(err) {
            if (!err) {
                io.emit('activity-removed', activityId);
            }
        });
    });

    // Handle clearing all
    socket.on('clear-all', () => {
        db.run("DELETE FROM activities");
        db.run("DELETE FROM days WHERE trip_id = ?", [DEFAULT_TRIP_ID], function(err) {
            if (!err) {
                io.emit('all-cleared');
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// API Routes
app.get('/api/itinerary', (req, res) => {
    const query = `
        SELECT 
            t.id as trip_id, t.title, t.dates, t.islands,
            d.id as day_id, d.day_number,
            a.id as activity_id, a.name, a.type, a.icon, a.position
        FROM trips t
        LEFT JOIN days d ON t.id = d.trip_id
        LEFT JOIN activities a ON d.id = a.day_id
        WHERE t.id = ?
        ORDER BY d.day_number, a.position
    `;
    
    db.all(query, [DEFAULT_TRIP_ID], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        // Organize data into itinerary structure
        const itinerary = [];
        let currentDay = null;

        rows.forEach(row => {
            if (row.day_id && (!currentDay || currentDay.id !== row.day_id)) {
                currentDay = {
                    id: row.day_id,
                    dayNumber: row.day_number,
                    activities: []
                };
                itinerary.push(currentDay);
            }
            
            if (row.activity_id && currentDay) {
                currentDay.activities.push({
                    id: row.activity_id,
                    name: row.name,
                    type: row.type,
                    icon: row.icon,
                    position: row.position
                });
            }
        });

        res.json({
            tripInfo: {
                title: rows[0]?.title || "Our Hawaiian Dream Vacation",
                dates: rows[0]?.dates || "Dec 15-22, 2024",
                islands: rows[0]?.islands || "Oahu"
            },
            itinerary: itinerary
        });
    });
});

app.get('/api/summary', (req, res) => {
    const query = `
        SELECT 
            COUNT(DISTINCT d.id) as total_days,
            COUNT(a.id) as total_activities,
            SUM(CASE WHEN a.type = 'beach' THEN 1 ELSE 0 END) as beach_count,
            SUM(CASE WHEN a.type = 'restaurant' THEN 1 ELSE 0 END) as restaurant_count
        FROM trips t
        LEFT JOIN days d ON t.id = d.trip_id
        LEFT JOIN activities a ON d.id = a.day_id
        WHERE t.id = ?
    `;
    
    db.get(query, [DEFAULT_TRIP_ID], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row);
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌺 Hawaii Itinerary Planner running on port ${PORT}`);
    console.log(`📱 Access it at: http://localhost:${PORT}`);
    console.log(`🌐 Share with your girlfriend: http://192.168.1.167:${PORT}`);
}); 