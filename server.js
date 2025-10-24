// 1. Install dependencies: npm install express cors
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// --- CRITICAL CORS CONFIGURATION ---
// This line enables CORS for all routes and origins ('*').
// This allows your standalone HTML file, loaded from any URL,
// to successfully make fetch requests to this server.
app.use(cors());
// -----------------------------------

app.use(express.json());

// Simple root route
app.get('/', (req, res) => {
    res.send('Server is running and CORS is enabled. Use /api/data.');
});

// The data endpoint that the HTML frontend will fetch
app.get('/api/data', (req, res) => {
    console.log('Request received from external frontend.');
    const dataContent = {
        "title": "Data from Node.js Server (server.js)",
        "message": "CORS check successful! This content was served from port 3000.",
        "timestamp": new Date().toISOString()
    };
    // Send the JSON response
    res.json(dataContent);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Node.js Server running on http://localhost:${PORT}`);
    console.log(`Access data at http://localhost:${PORT}/api/data`);
});
