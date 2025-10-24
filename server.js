// Import the Express framework and middleware
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Define the correct access code. 
// NOTE: In production, you MUST load this from Render's Environment Variables!
// The frontend password must match this hardcoded value: "my-secure-access-code"
const MASTER_PASSWORD = "5X9K4QJ3M7B2R1P6F8Z0D"; 
const CLIENT_PASSWORD = "0X3MS7FD7QHMFLJ29OAZ";
const ADMIN_PASSWORD = "EEMW05P77MPOQPMODT4Q";
// Initialize the Express application
const app = express();
// Use the port provided by the hosting environment (Render) or default to 3000 locally
const port = process.env.PORT || 3000;

// --- Middleware Setup ---
// 1. Enable CORS (Cross-Origin Resource Sharing)
// This allows your separate frontend to talk to this backend.
app.use(cors({
    origin: '*', // Allows all origins for easy testing
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Parse incoming JSON request bodies (needed to read the password)
app.use(bodyParser.json());

// Simple root path check (for server health status)
app.get('/', (req, res) => {
    res.status(200).send({ message: "Server is running. Ready for /api/auth requests." });
});


// --- The Crucial /api/auth Endpoint ---
/**
 * Handles POST requests to the /api/auth endpoint for authentication.
 */
app.post('/api/auth', (req, res) => {
    // Extract the password from the JSON request body
    const { password } = req.body;

    if (!password) {
        // If the password field is missing from the request body
        return res.status(400).json({ message: 'Password is required.' });
    }

    // Check if the provided password matches the hardcoded key
    if (password === MASTER_PASSWORD) {
        // Success
        console.log("Authentication successful!");
        return res.status(200).json({ 
            message: 'Access Granted. Welcome to the secure area.',
            token: 'mock-jwt-token-for-client-use'
        });
    } else {
        // Failure: 401 Unauthorized
        console.warn(`Authentication failed for attempt: ${password}`);
        return res.status(401).json({ message: 'Invalid access code.' });
    }
});

// --- Start the Server ---
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
