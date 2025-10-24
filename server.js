const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// NEW: Define the path to the frontend files
const FRONTEND_DIR = path.join(__dirname, 'frontend');

// --- CRITICAL SECURITY CONFIGURATION (Change these credentials immediately) ---

// 1. Owner Credentials (for accessing /owner.html and /admin.html)
const OWNER_USERNAME = 'THECAPRA2013';
// IMPORTANT: You MUST change this password!
const OWNER_PASSWORD_HASH = crypto.createHash('sha256').update('MicahLevi13!').digest('hex');
const OWNER_SESSION_SECRET = 'your-very-secret-owner-session-key-12345'; // Used to sign cookies

// 2. Client User Accounts (New: Username/Password for frontend access)
const CLIENT_USERS = {
    // Default Client User: 'user1' / 'password123'
    'user1': crypto.createHash('sha256').update('password123').digest('hex'), 
    // Default Client User: 'student_a' / 'schoolpass'
    'student_a': crypto.createHash('sha256').update('schoolpass').digest('hex'), 
};
const CLIENT_SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour session

// 3. SECURE API Credentials (Dynamically managed and stored on the server only)
// This is the server's private database of API keys.
let SECURE_API_KEYS = {
    'gemini-flash-default': { 
        apiKey: 'AIzaSyA_DEMO_GEMINI_FLASH_KEY', 
        endpoint: 'gemini-2.5-flash-preview-09-2025',
        name: 'Gemini Flash (Default)'
    },
    'gemini-pro-default': { 
        apiKey: 'AIzaSyA_DEMO_GEMINI_PRO_KEY', 
        endpoint: 'gemini-2.5-pro-preview-09-2025',
        name: 'Gemini Pro (Advanced)'
    }
};
// --- END OF SECURITY CONFIGURATION ---

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser(OWNER_SESSION_SECRET)); 

// =========================================================================
//            AUTH FUNCTIONS & MIDDLEWARE
// =========================================================================

const isClientLoggedIn = (username) => {
    return username && CLIENT_USERS.hasOwnProperty(username);
};

// Middleware to protect the Owner/Admin content
const ownerAccessGuard = (req, res, next) => {
    const ownerSession = req.signedCookies.owner_session;
    if (ownerSession === OWNER_USERNAME) {
        return next();
    }
    // OWNER REDIRECT: Ensure unauthorized owners go to the owner login page
    res.redirect('/owner_login.html');
};

/**
 * Middleware to protect the main client application page ('index.html').
 * This runs after the root route is handled.
 */
const clientAccessGuard = (req, res, next) => {
    // Only check authentication for the index.html file
    if (req.path.endsWith('/index.html')) {
        const clientUsername = req.cookies.client_username;
        if (isClientLoggedIn(clientUsername)) {
            return next(); // Client is logged in, allow access
        } else {
            // Client is NOT logged in, redirect to the client login page
            return res.redirect('/client_login.html');
        }
    }
    
    // For all other paths (logins, CSS, JS, etc.), continue normally.
    next();
};

app.use(clientAccessGuard); 

// =========================================================================
//                             ROUTES
// =========================================================================

// --- 1. Root Path Handling (PUBLIC ENTRY POINT) ---
// This explicit route takes precedence and guarantees the client-first experience.
app.get('/', (req, res) => {
    const clientUsername = req.cookies.client_username;
    if (isClientLoggedIn(clientUsername)) {
        // If client is logged in, show the main app
        res.sendFile('index.html', { root: FRONTEND_DIR });
    } else {
        // If client is NOT logged in, redirect to the public client login page
        res.redirect('/client_login.html');
    }
});

// --- 2. Protected HTML File Serving (OWNER ONLY) ---

// Serve the owner panel (protected by ownerAccessGuard)
app.get('/owner.html', ownerAccessGuard, (req, res) => {
    res.sendFile('owner.html', { root: FRONTEND_DIR });
});

// Serve the admin panel (protected by ownerAccessGuard)
app.get('/admin.html', ownerAccessGuard, (req, res) => {
    res.sendFile('admin.html', { root: FRONTEND_DIR });
});


// --- 3. Static Assets Serving ---
// Serve all public assets (login pages, css, js) from the 'frontend' folder.

// Static Route A: Serves files at the root (e.g., /client_login.html, /styles.css)
app.use(express.static(FRONTEND_DIR));

// Static Route B: Serves files under the /frontend prefix (e.g., /frontend/index.html)
app.use('/frontend', express.static(FRONTEND_DIR));


// --- 4. Client Authentication API ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const inputHash = crypto.createHash('sha256').update(password || '').digest('hex');

    if (CLIENT_USERS[username] && CLIENT_USERS[username] === inputHash) {
        // Successful client login
        res.cookie('client_username', username, { 
            httpOnly: true, 
            maxAge: CLIENT_SESSION_TIMEOUT_MS,
            signed: false 
        });
        return res.json({ success: true, message: 'Client login successful.' });
    }

    res.status(401).json({ success: false, message: 'Invalid username or password.' });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('client_username');
    res.json({ success: true, message: 'Logged out successfully.' });
});


// --- 5. Owner Authentication API ---

app.post('/api/owner-login', (req, res) => {
    const { username, password } = req.body;
    const inputHash = crypto.createHash('sha256').update(password || '').digest('hex');

    if (username === OWNER_USERNAME && OWNER_PASSWORD_HASH === inputHash) {
        // Successful owner login
        res.cookie('owner_session', OWNER_USERNAME, { 
            httpOnly: true, 
            maxAge: CLIENT_SESSION_TIMEOUT_MS * 4, // Longer session for owner
            signed: true 
        });
        // Redirect to the protected admin page after successful owner login
        return res.json({ success: true, message: 'Owner login successful.' });
    }

    res.status(401).json({ success: false, message: 'Invalid owner credentials.' });
});

app.post('/api/owner-logout', (req, res) => {
    res.clearCookie('owner_session', { signed: true });
    res.json({ success: true, message: 'Owner logged out successfully.' });
});


// --- 6. Client API Config Endpoint (Secured by client session) ---

/**
 * Returns the non-sensitive model configuration for the AI Runner frontend.
 */
app.get('/api/runner-config', (req, res) => {
    const clientUsername = req.cookies.client_username;
    if (!isClientLoggedIn(clientUsername)) {
           return res.status(403).json({ success: false, message: 'Not authenticated.' });
    }

    // Prepare a safe list of APIs to send to the frontend (excluding secret keys)
    const availableApis = {};
    for (const key in SECURE_API_KEYS) {
        availableApis[key] = {
            endpoint: SECURE_API_KEYS[key].endpoint,
            name: SECURE_API_KEYS[key].name
            // NOTE: apiKey is intentionally excluded!
        };
    }
    
    res.json({ 
        success: true, 
        message: 'Configuration loaded.', 
        availableApis: availableApis 
    });
});


// --- 7. Owner API Key Management Endpoints (Secured by owner session) ---

/**
 * Retrieves the full list of API keys (including secret keys) for the Owner Panel.
 */
app.get('/api/owner/keys', ownerAccessGuard, (req, res) => {
    // Send the entire map, including the secret keys, only to the owner.
    res.json({ 
        success: true, 
        keys: SECURE_API_KEYS 
    });
});

/**
 * Adds or updates an API key entry.
 */
app.post('/api/owner/keys/add-update', ownerAccessGuard, (req, res) => {
    const { id, name, endpoint, apiKey } = req.body;
    
    if (!id || !name || !endpoint || !apiKey) {
        return res.status(400).json({ success: false, message: 'All fields (ID, Name, Endpoint, API Key) are required.' });
    }
    
    SECURE_API_KEYS[id] = { name, endpoint, apiKey };
    
    console.log(`[OWNER ACTION] Added/Updated API Key: ${id}`);
    res.json({ 
        success: true, 
        message: `API Key '${id}' updated successfully.`,
        keys: SECURE_API_KEYS
    });
});

/**
 * Removes an API key entry.
 */
app.post('/api/owner/keys/remove', ownerAccessGuard, (req, res) => {
    const { id } = req.body;
    
    if (!id || !SECURE_API_KEYS[id]) {
        return res.status(404).json({ success: false, message: `API Key ID '${id}' not found.` });
    }
    
    const removedKeyName = SECURE_API_KEYS[id].name;
    delete SECURE_API_KEYS[id];
    
    console.log(`[OWNER ACTION] Revoked API Key: ${removedKeyName} (${id})`);
    res.json({ 
        success: true, 
        message: `API Key '${removedKeyName}' successfully removed.`,
        keys: SECURE_API_KEYS
    });
});


// --- 8. API Runner Endpoint (The secure way to run the API) ---

/**
 * This is the ultimate security layer. The client sends the prompt, and the server
 * uses the secret key to make the API call. The secret key NEVER leaves the server.
 */
app.post('/api/run-ai', (req, res) => {
    const clientUsername = req.cookies.client_username;
    if (!isClientLoggedIn(clientUsername)) {
           return res.status(403).json({ success: false, message: 'Not authenticated.' });
    }
    
    const { modelId, prompt, history } = req.body;

    const modelConfig = SECURE_API_KEYS[modelId];

    if (!modelConfig) {
        return res.status(404).json({ success: false, message: 'Requested model ID is not configured.' });
    }

    // === CRITICAL STEP: SIMULATED API CALL ===
    // In a real application, you would put your actual `fetch` call to the 
    // Gemini API here, using `modelConfig.apiKey` and `modelConfig.endpoint`.
    
    const mockResponse = `Hello ${clientUsername}! I received your request for model '${modelConfig.name}'. The server securely handled your request. Your prompt was: "${prompt}".`;
    
    res.json({ 
        success: true, 
        response: mockResponse 
    });
    // =================================================================================
});


// --- Server Startup ---

// Fallback for any request not caught by static or specific routes
app.use((req, res) => {
    res.status(404).send('404: Page not found. Try navigating to /client_login.html or /owner_login.html');
});

app.listen(PORT, () => {
    console.log(`\n\n[SERVER STARTED]`);
    console.log(`Local URL: http://localhost:${PORT}`);
    console.log(`To access the main app: http://localhost:${PORT}/`);
    console.log(`To access the admin panel: http://localhost:${PORT}/admin.html`);
    console.log(`Owner Credentials: ${OWNER_USERNAME} / supersecuremasterkey (MUST CHANGE!)`);
    console.log(`Client Credentials: user1 / password123`);
});
