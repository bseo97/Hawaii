require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');

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
    connectionString: process.env.DATABASE_URL || 'postgresql://bogyeongseo@localhost:5432/hawaii_planner',
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway.app') ? { rejectUnauthorized: false } : false
});

// Helper to run queries
async function query(sql, params) {
    const client = await pool.connect();
    try {
        console.log(`🔍 DB Query: ${sql.substring(0, 50)}...`, params || []);
        const result = await client.query(sql, params);
        console.log(`✅ DB Result: ${result.rowCount} rows affected`);
        return result;
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
        activity_date TEXT,
        location TEXT,
        category TEXT,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // Add new columns if they don't exist (for migration)
    try {
        await query('ALTER TABLE activities ADD COLUMN IF NOT EXISTS activity_date TEXT');
        await query('ALTER TABLE activities ADD COLUMN IF NOT EXISTS location TEXT');
        await query('ALTER TABLE activities ADD COLUMN IF NOT EXISTS category TEXT');
        await query('ALTER TABLE activities ADD COLUMN IF NOT EXISTS note TEXT');
    } catch (e) {
        console.log('Migration columns may already exist');
    }
    
    // Ensure default trip exists
    const res = await query('SELECT id FROM trips WHERE id = $1', [1]);
    if (res.rows.length === 0) {
        await query('INSERT INTO trips (id, title, dates, islands) VALUES ($1, $2, $3, $4)', [1, 'Our Hawaiian Dream Vacation', 'Dec 15-22, 2024', 'Oahu']);
    }
}

initDb();

const DEFAULT_TRIP_ID = 1;

// Google Places API configuration
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const GOOGLE_PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

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
        console.log('Received activity data on server:', data);
        
        // Get location preview data if location is provided
        let locationPreview = null;
        if (data.location && data.location.trim()) {
            try {
                console.log('🔍 Fetching location preview for:', data.location);
                
                if (GOOGLE_PLACES_API_KEY) {
                    const searchResponse = await axios.get(GOOGLE_PLACES_URL, {
                        params: {
                            input: data.location.trim(),
                            key: GOOGLE_PLACES_API_KEY,
                            types: 'establishment|geocode',
                            language: 'en'
                        }
                    });

                    if (searchResponse.data.status === 'OK' && searchResponse.data.predictions.length > 0) {
                        const firstResult = searchResponse.data.predictions[0];
                        
                        const detailsResponse = await axios.get(GOOGLE_PLACE_DETAILS_URL, {
                            params: {
                                place_id: firstResult.place_id,
                                key: GOOGLE_PLACES_API_KEY,
                                fields: 'name,formatted_address,photos,website,rating,opening_hours,place_id,user_ratings_total'
                            }
                        });

                        if (detailsResponse.data.status === 'OK') {
                            const place = detailsResponse.data.result;
                            locationPreview = {
                                place_id: place.place_id,
                                name: place.name,
                                formatted_address: place.formatted_address,
                                photos: place.photos?.slice(0, 1).map(photo => 
                                    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`
                                ) || [],
                                website: place.website,
                                rating: place.rating,
                                user_ratings_total: place.user_ratings_total,
                                opening_hours: place.opening_hours
                            };
                            console.log('✅ Location preview fetched successfully');
                        }
                    }
                }
            } catch (error) {
                console.log('⚠️ Could not fetch location preview:', error.message);
            }
        }
        
        const insert = await query('INSERT INTO activities (day_id, name, type, icon, position, activity_date, location, category, note, location_preview) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
            [data.dayId, data.name, data.type, data.icon, data.position, data.activityDate || '', data.location || '', data.category || data.type, data.note || '', JSON.stringify(locationPreview)]);
        
        const activityData = {
            id: insert.rows[0].id,
            dayId: data.dayId,
            name: data.name,
            type: data.type,
            icon: data.icon,
            position: data.position,
            activityDate: data.activityDate || '',
            location: data.location || '',
            category: data.category || data.type,
            note: data.note || '',
            locationPreview: locationPreview
        };
        
        console.log('Sending back activity data:', activityData);
        io.emit('activity-added', activityData);
    });

    // Handle updating an activity
    socket.on('update-activity', async (data) => {
        // Get current activity to preserve name if not provided
        const currentActivity = await query('SELECT name, location_preview FROM activities WHERE id = $1', [data.id]);
        const activityName = data.name || currentActivity.rows[0].name;
        
        // Get location preview data if location is provided and changed
        let locationPreview = null;
        if (data.location && data.location.trim()) {
            try {
                console.log('🔍 Fetching updated location preview for:', data.location);
                
                if (GOOGLE_PLACES_API_KEY) {
                    const searchResponse = await axios.get(GOOGLE_PLACES_URL, {
                        params: {
                            input: data.location.trim(),
                            key: GOOGLE_PLACES_API_KEY,
                            types: 'establishment|geocode',
                            language: 'en'
                        }
                    });

                    if (searchResponse.data.status === 'OK' && searchResponse.data.predictions.length > 0) {
                        const firstResult = searchResponse.data.predictions[0];
                        
                        const detailsResponse = await axios.get(GOOGLE_PLACE_DETAILS_URL, {
                            params: {
                                place_id: firstResult.place_id,
                                key: GOOGLE_PLACES_API_KEY,
                                fields: 'name,formatted_address,photos,website,rating,opening_hours,place_id,user_ratings_total'
                            }
                        });

                        if (detailsResponse.data.status === 'OK') {
                            const place = detailsResponse.data.result;
                            locationPreview = {
                                place_id: place.place_id,
                                name: place.name,
                                formatted_address: place.formatted_address,
                                photos: place.photos?.slice(0, 1).map(photo => 
                                    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`
                                ) || [],
                                website: place.website,
                                rating: place.rating,
                                user_ratings_total: place.user_ratings_total,
                                opening_hours: place.opening_hours
                            };
                            console.log('✅ Updated location preview fetched successfully');
                        }
                    }
                }
            } catch (error) {
                console.log('⚠️ Could not fetch location preview:', error.message);
                // Keep existing preview if available
                if (currentActivity.rows[0].location_preview) {
                    locationPreview = JSON.parse(currentActivity.rows[0].location_preview);
                }
            }
        }
        
        await query('UPDATE activities SET name = $1, activity_date = $2, location = $3, category = $4, note = $5, location_preview = $6 WHERE id = $7',
            [activityName, data.activityDate, data.location, data.category, data.note, JSON.stringify(locationPreview), data.id]);
        
        const updatedData = {
            ...data,
            name: activityName,
            locationPreview: locationPreview
        };
        
        io.emit('activity-updated', updatedData);
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

// Location search endpoint
app.get('/api/search-locations', async (req, res) => {
    const { query } = req.query;
    
    if (!query || query.length < 3) {
        return res.json([]);
    }

    try {
        // Try Google Places API first if API key is available
        if (GOOGLE_PLACES_API_KEY) {
            console.log(`🔍 Searching locations with Google Places API: "${query}"`);
            
            const response = await axios.get(GOOGLE_PLACES_URL, {
                params: {
                    input: query,
                    key: GOOGLE_PLACES_API_KEY,
                    types: 'establishment|geocode',
                    language: 'en'
                }
            });

            if (response.data.status === 'OK') {
                const suggestions = response.data.predictions.map(prediction => ({
                    place_id: prediction.place_id,
                    name: prediction.structured_formatting.main_text,
                    formatted: prediction.description,
                    secondary: prediction.structured_formatting.secondary_text || ''
                }));
                
                console.log(`✅ Found ${suggestions.length} suggestions from Google Places`);
                return res.json(suggestions);
            } else {
                console.log(`⚠️  Google Places API error: ${response.data.status}`);
            }
        }

        // Fallback to OpenStreetMap Nominatim API
        console.log(`🔍 Using fallback search (OpenStreetMap) for: "${query}"`);
        
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                format: 'json',
                q: query,
                limit: 5,
                addressdetails: 1
            },
            headers: {
                'User-Agent': 'Hawaii-Itinerary-Planner/1.0'
            }
        });

        const suggestions = response.data.map(item => ({
            place_id: item.place_id,
            name: item.name || item.display_name.split(',')[0],
            formatted: item.display_name,
            secondary: item.display_name.split(',').slice(1, 3).join(',').trim()
        }));

        console.log(`✅ Found ${suggestions.length} suggestions from OpenStreetMap`);
        res.json(suggestions);

    } catch (error) {
        console.error('❌ Location search error:', error.message);
        res.json([]);
    }
});

// Get place details including coordinates
app.get('/api/place-details', async (req, res) => {
    const { place_id, location } = req.query;
    
    // Handle both place_id and location name searches
    if (!place_id && !location) {
        return res.status(400).json({ error: 'place_id or location is required' });
    }

    try {
        if (GOOGLE_PLACES_API_KEY) {
            let place, placeDetails;
            
            if (place_id) {
                // Direct place details lookup
                console.log(`🔍 Getting place details for place_id: ${place_id}`);
                
                const response = await axios.get(GOOGLE_PLACE_DETAILS_URL, {
                    params: {
                        place_id: place_id,
                        key: GOOGLE_PLACES_API_KEY,
                        fields: 'name,formatted_address,geometry,photos,website,rating,opening_hours,place_id,user_ratings_total'
                    }
                });

                if (response.data.status === 'OK') {
                    place = response.data.result;
                } else {
                    console.log(`⚠️  Google Place Details API error: ${response.data.status}`);
                }
            } else if (location) {
                // Search by location name first, then get details
                console.log(`🔍 Searching for location: ${location}`);
                
                const searchResponse = await axios.get(GOOGLE_PLACES_URL, {
                    params: {
                        input: location,
                        key: GOOGLE_PLACES_API_KEY,
                        types: 'establishment|geocode',
                        language: 'en'
                    }
                });

                if (searchResponse.data.status === 'OK' && searchResponse.data.predictions.length > 0) {
                    const firstResult = searchResponse.data.predictions[0];
                    
                    // Now get details for the first result
                    const detailsResponse = await axios.get(GOOGLE_PLACE_DETAILS_URL, {
                        params: {
                            place_id: firstResult.place_id,
                            key: GOOGLE_PLACES_API_KEY,
                            fields: 'name,formatted_address,geometry,photos,website,rating,opening_hours,place_id,user_ratings_total'
                        }
                    });

                    if (detailsResponse.data.status === 'OK') {
                        place = detailsResponse.data.result;
                    }
                }
            }

            if (place) {
                placeDetails = {
                    success: true,
                    placeDetails: {
                        name: place.name,
                        formatted_address: place.formatted_address,
                        coordinates: place.geometry?.location,
                        photos: place.photos?.slice(0, 1).map(photo => 
                            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`
                        ) || [],
                        website: place.website,
                        rating: place.rating,
                        user_ratings_total: place.user_ratings_total,
                        opening_hours: place.opening_hours,
                        place_id: place.place_id,
                        map_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`
                    }
                };
                
                console.log(`✅ Retrieved place details for: ${place.name}`);
                return res.json(placeDetails);
            }
        }

        // Fallback - return basic info
        console.log(`📍 Using basic fallback for place details`);
        res.json({
            success: false,
            placeDetails: {
                name: location || 'Location',
                formatted_address: 'Address not available',
                coordinates: null,
                photos: [],
                map_url: `https://www.google.com/maps/search/?q=${encodeURIComponent(location || place_id)}`
            }
        });

    } catch (error) {
        console.error('❌ Place details error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get place details',
            placeDetails: null 
        });
    }
});

app.get('/api/itinerary', async (req, res) => {
    const rows = (await query(`
        SELECT 
            t.id as trip_id, t.title, t.dates, t.islands,
            d.id as day_id, d.day_number,
            a.id as activity_id, a.name, a.type, a.icon, a.position, a.activity_date, a.location, a.category, a.note, a.location_preview
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
            let locationPreview = null;
            if (row.location_preview) {
                try {
                    locationPreview = JSON.parse(row.location_preview);
                } catch (e) {
                    console.log('Could not parse location preview:', e);
                }
            }
            
            currentDay.activities.push({
                id: row.activity_id,
                name: row.name,
                type: row.type,
                icon: row.icon,
                position: row.position,
                activityDate: row.activity_date || '',
                location: row.location || '',
                category: row.category || row.type,
                note: row.note || '',
                locationPreview: locationPreview
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
    
    if (GOOGLE_PLACES_API_KEY) {
        console.log(`🗺️  Google Places API configured for enhanced location search`);
    } else {
        console.log(`📍 Using OpenStreetMap fallback (add GOOGLE_PLACES_API_KEY to .env for better results)`);
    }
}); 