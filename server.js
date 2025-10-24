const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
// Middleware setup
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'frontend' directory
app.use(express.static(path.join(__dirname, 'frontend')));

// --- START: SECURE PASSWORD SETUP (Reads from Render Environment) ---
// If running on Render, it will use the secure Environment Variables you set.
// If running locally (npm start), it uses the fallback default passwords.

const MASTER_PASSWORD = process.env.MASTER_PASSWORD || "supersecuremasterkey";
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || "client123";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin456";

// Central object for all password constants
const PASSWORDS = {
    MASTER: MASTER_PASSWORD,
    CLIENT: CLIENT_PASSWORD,
    ADMIN: ADMIN_PASSWORD
};

// --- END: SECURE PASSWORD SETUP ---


// Route 1: Default access redirects to the client login page
app.get('/', (req, res) => {
    // Redirect to the default client login page
    res.redirect('/client_login.html');
});


// Route 2: Handle Login attempts
app.post('/api/login', (req, res) => {
    // Passwords are sent in the request body (req.body)
    const { password } = req.body;
    // Role (master, client, or admin) is sent as a query parameter (req.query)
    const role = req.query.role;

    let expectedPassword;
    let redirectUrl;
    let cookieName;
    let cookieMaxAge = 1000 * 60 * 60; // 1 hour

    switch (role) {
        case 'master':
            expectedPassword = PASSWORDS.MASTER;
            redirectUrl = '/owner_login.html'; // Assuming this page is the master/admin dashboard view
            cookieName = 'master_auth';
            break;
        case 'client':
            expectedPassword = PASSWORDS.CLIENT;
            redirectUrl = '/client.html'; // Client dashboard
            cookieName = 'client_auth';
            break;
        case 'admin':
            expectedPassword = PASSWORDS.ADMIN;
            redirectUrl = '/admin.html'; // Admin dashboard
            cookieName = 'admin_auth';
            break;
        default:
            return res.status(400).json({ success: false, message: 'Invalid role specified.' });
    }

    if (password === expectedPassword) {
        // Successful login: Set an authenticated cookie
        // httpOnly: Cookie cannot be accessed by client-side JavaScript (XSS protection)
        // secure: Only send cookie over HTTPS (important for Render deployment)
        res.cookie(cookieName, 'authenticated', { httpOnly: true, secure: true, maxAge: cookieMaxAge });
        return res.json({ success: true, redirect: redirectUrl });
    } else {
        // Failed login
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
});


// Route 3: Handle Verification (Used by frontend pages to check if the user is logged in)
app.get('/api/verify', (req, res) => {
    const role = req.query.role;
    let cookieName;

    switch (role) {
        case 'master':
            cookieName = 'master_auth';
            break;
        case 'client':
            cookieName = 'client_auth';
            break;
        case 'admin':
            cookieName = 'admin_auth';
            break;
        default:
            return res.status(400).json({ verified: false, message: 'Invalid verification role.' });
    }

    // Check if the appropriate authentication cookie is present and valid
    if (req.cookies[cookieName] === 'authenticated') {
        res.json({ verified: true });
    } else {
        // If the cookie is missing or incorrect, deny access
        res.status(401).json({ verified: false, message: 'Not authenticated.' });
    }
});


// Route 4: Handle Logout
app.post('/api/logout', (req, res) => {
    // Clear all potential auth cookies
    res.clearCookie('master_auth');
    res.clearCookie('client_auth');
    res.clearCookie('admin_auth');

    // Respond with success
    res.status(200).send('Logged out successfully');
});


// Configure the server port
// It uses the PORT environment variable (set by Render) or defaults to 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Local URL: http://localhost:${PORT}`);
});

// IMPORTANT: The server must listen on the PORT provided by the environment (Render)
