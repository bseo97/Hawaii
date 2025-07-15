const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
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

// PostgreSQL setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway.app') ? { rejectUnauthorized: false } : false
});

// Helper to run queries
async function query(sql, params) {
    const client = await pool.connect();
    try {
        return await client.query(sql, params);
    } finally {
        client.release();
    }
}

// Initialize tables if not exist
async function initDb() {
    await query(`CREATE TABLE IF NOT EXISTS trips (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        dates TEXT,
        islands TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS days (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER REFERENCES trips(id),
        day_number INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        day_id INTEGER REFERENCES days(id),
        name TEXT NOT NULL,
        type TEXT,
        icon TEXT,
        position INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // Ensure default trip exists
    const res = await query('SELECT id FROM trips WHERE id = $1', [1]);
    if (res.rows.length === 0) {
        await query('INSERT INTO trips (id, title, dates, islands) VALUES ($1, $2, $3, $4)', [1, 'Our Hawaiian Dream Vacation', 'Dec 15-22, 2024', 'Oahu']);
    }
}

initDb();

const DEFAULT_TRIP_ID = 1;

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send current itinerary to new user
    socket.emit('load-itinerary', { tripId: DEFAULT_TRIP_ID });

    // Handle trip info updates
    socket.on('update-trip-info', async (data) => {
        await query('UPDATE trips SET title = $1, dates = $2, islands = $3 WHERE id = $4',
            [data.title, data.dates, data.islands, DEFAULT_TRIP_ID]);
        socket.broadcast.emit('trip-info-updated', data);
    });

    // Handle adding a day
    socket.on('add-day', async () => {
        const res = await query('SELECT COALESCE(MAX(day_number), 0) + 1 AS next_day FROM days WHERE trip_id = $1', [DEFAULT_TRIP_ID]);
        const nextDay = res.rows[0].next_day;
        const insert = await query('INSERT INTO days (trip_id, day_number) VALUES ($1, $2) RETURNING id', [DEFAULT_TRIP_ID, nextDay]);
        const dayData = { id: insert.rows[0].id, dayNumber: nextDay };
        io.emit('day-added', dayData);
    });

    // Handle removing a day
    socket.on('remove-day', async (dayId) => {
        await query('DELETE FROM activities WHERE day_id = $1', [dayId]);
        await query('DELETE FROM days WHERE id = $1', [dayId]);
        io.emit('day-removed', dayId);
    });

    // Handle adding an activity
    socket.on('add-activity', async (data) => {
        const insert = await query('INSERT INTO activities (day_id, name, type, icon, position) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [data.dayId, data.name, data.type, data.icon, data.position]);
        const activityData = {
            id: insert.rows[0].id,
            dayId: data.dayId,
            name: data.name,
            type: data.type,
            icon: data.icon,
            position: data.position
        };
        io.emit('activity-added', activityData);
    });

    // Handle removing an activity
    socket.on('remove-activity', async (activityId) => {
        await query('DELETE FROM activities WHERE id = $1', [activityId]);
        io.emit('activity-removed', activityId);
    });

    // Handle clearing all
    socket.on('clear-all', async () => {
        await query('DELETE FROM activities');
        await query('DELETE FROM days WHERE trip_id = $1', [DEFAULT_TRIP_ID]);
        io.emit('all-cleared');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// API Routes
app.get('/api/itinerary', async (req, res) => {
    const rows = (await query(`
        SELECT 
            t.id as trip_id, t.title, t.dates, t.islands,
            d.id as day_id, d.day_number,
            a.id as activity_id, a.name, a.type, a.icon, a.position
        FROM trips t
        LEFT JOIN days d ON t.id = d.trip_id
        LEFT JOIN activities a ON d.id = a.day_id
        WHERE t.id = $1
        ORDER BY d.day_number, a.position
    `, [DEFAULT_TRIP_ID])).rows;

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

app.get('/api/summary', async (req, res) => {
    const row = (await query(`
        SELECT 
            COUNT(DISTINCT d.id) as total_days,
            COUNT(a.id) as total_activities,
            SUM(CASE WHEN a.type = 'beach' THEN 1 ELSE 0 END) as beach_count,
            SUM(CASE WHEN a.type = 'restaurant' THEN 1 ELSE 0 END) as restaurant_count
        FROM trips t
        LEFT JOIN days d ON t.id = d.trip_id
        LEFT JOIN activities a ON d.id = a.day_id
        WHERE t.id = $1
    `, [DEFAULT_TRIP_ID])).rows[0];
    res.json(row);
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌺 Hawaii Itinerary Planner running on port ${PORT}`);
}); 