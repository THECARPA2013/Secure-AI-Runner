// --- 1. CONFIGURATION --- //
const REQUIRED_TOP_KEY = "API key details";
const REQUIRED_INNER_KEYS = ["API Key", "Name", "Project name", "Project number"];
let CONFIG = null; // Variable to hold the final loaded JSON data
let API_KEY = null; // New variable to store the extracted API key
let selectedFile = null; // Variable to hold the selected image file

// --- 2. DOM ELEMENTS ---
const accessGate = document.getElementById('access-gate');
const mainAppContainer = document.getElementById('main-app-container');
const accessKeyInput = document.getElementById('access-key-input');
const accessKeySubmit = document.getElementById('access-key-submit');
const accessErrorMessage = document.getElementById('access-error-message');

const chatDisplay = document.getElementById('chat-display');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const loader = document.getElementById('loader');

const newChatBtn = document.getElementById('new-chat-btn');
const chatListUl = document.getElementById('chat-list');
const downloadBtn = document.getElementById('download-btn');
const uploadBtn = document.getElementById('upload-btn');
const uploadChatBtn = document.getElementById('upload-chat-btn');
const fileInput = document.getElementById('file-input');

const warningModal = document.getElementById('warning-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

// --- 3. STATE MANAGEMENT ---
let chats = {}; // Stores all chat history: { chatId: { title: '...', history: [...] } }
let currentChatId = null; // ID of the currently active chat
const CHAT_STORAGE_KEY = 'chatAppHistory';
const API_KEY_STORAGE_KEY = 'chatAppAPIKey';

// --- 4. UTILITIES ---

// Base64 encoding utility for image files
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

// Error logging (to be moved to the separate log window)
const logs = [];
const customConsoleLog = (message, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = isError ? `[ERROR ${timestamp}] ${message}` : `[INFO ${timestamp}] ${message}`;
    logs.push(logEntry);
    if (isError) {
        console.error(logEntry);
    } else {
        console.log(logEntry);
    }
};

// --- 5. CHAT LOGIC ---

// Function to check if a password is valid against the external list
const checkPassword = (enteredPassword) => {
    // Access the global variable loaded from the external JS file
    // Note: window.ALLOWED_ACCESS_PASSWORDS should be defined in external_passwords.js
    const passwords = window.ALLOWED_ACCESS_PASSWORDS;

    if (!passwords || typeof passwords !== 'object') {
        customConsoleLog('Error: Allowed access passwords not loaded correctly.', true);
        return false;
    }
    
    // Check if the entered password exists as a value in the passwords object
    const isValid = Object.values(passwords).includes(enteredPassword);
    
    if (isValid) {
        customConsoleLog(`Access granted with key: ${enteredPassword}`);
    } else {
        customConsoleLog(`Access denied: Invalid key entered: ${enteredPassword}`, true);
    }
    return isValid;
};

// Handles the access key submission
const handleAccessKeySubmission = async () => {
    const enteredKey = accessKeyInput.value.trim();
    accessErrorMessage.textContent = ''; // Clear previous error

    if (enteredKey === '') {
        accessErrorMessage.textContent = 'Please enter an access key.';
        return;
    }

    if (checkPassword(enteredKey)) {
        // For the sake of the Gemini API call later, we need to set API_KEY to an empty string
        // so the Canvas runtime can inject the real key.
        API_KEY = ""; 
        sessionStorage.setItem(API_KEY_STORAGE_KEY, "UNLOCKED");
        
        accessGate.style.display = 'none';
        mainAppContainer.style.display = 'flex';
        
        // Load chat history after successful unlock
        loadChatHistory();
        
    } else {
        accessErrorMessage.textContent = 'Invalid access key. Please try again.';
    }
};


const saveChatHistory = () => {
    try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats));
        customConsoleLog('Chat history saved to local storage.');
    } catch (e) {
        customConsoleLog(`Error saving chat history: ${e.message}`, true);
    }
};

const loadChatHistory = () => {
    try {
        const storedChats = localStorage.getItem(CHAT_STORAGE_KEY);
        if (storedChats) {
            chats = JSON.parse(storedChats);
            customConsoleLog('Chat history loaded from local storage.');
            
            // Set the first chat as current, or create a new one if none exists
            const chatIds = Object.keys(chats);
            if (chatIds.length > 0) {
                currentChatId = chatIds[0];
                switchChat(currentChatId);
            } else {
                createNewChat();
            }
        } else {
            // If no chats, create a new one
            createNewChat();
        }
    } catch (e) {
        customConsoleLog(`Error loading chat history: ${e.message}`, true);
        chats = {};
        createNewChat();
    }
    updateChatList();
};

const createNewChat = () => {
    const newId = crypto.randomUUID();
    const chatCount = Object.keys(chats).length + 1;
    chats[newId] = {
        title: `New Chat ${chatCount}`,
        history: []
    };
    currentChatId = newId;
    switchChat(newId);
    updateChatList();
    userInput.focus();
};

const switchChat = (chatId) => {
    currentChatId = chatId;
    renderChat(chats[currentChatId].history);
    updateChatList();
};

const renderChat = (history) => {
    chatDisplay.innerHTML = '';
    history.forEach(message => {
        const messageHtml = createMessageBubble(message);
        chatDisplay.appendChild(messageHtml);
    });
    chatDisplay.scrollTop = chatDisplay.scrollHeight; // Auto-scroll to bottom
};

const createMessageBubble = (message) => {
    const isUser = message.role === 'user';
    const container = document.createElement('div');
    container.className = `message-container ${isUser ? 'user-message-container' : 'bot-message-container'}`;

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isUser ? 'user-message' : 'bot-message'}`;

    if (message.imageUrl) {
        const img = document.createElement('img');
        img.src = message.imageUrl;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '5px';
        img.style.marginBottom = '10px';
        bubble.appendChild(img);
    }
    
    const textContent = isUser ? message.text : marked.parse(message.text || '');
    const textDiv = document.createElement('div');
    textDiv.innerHTML = textContent;
    bubble.appendChild(textDiv);

    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.textContent = new Date(message.timestamp).toLocaleTimeString();
    bubble.appendChild(timestampSpan);

    container.appendChild(bubble);
    return container;
};

const updateChatList = () => {
    chatListUl.innerHTML = '';
    Object.entries(chats).forEach(([id, chat]) => {
        const listItem = document.createElement('li');
        listItem.className = 'chat-item';
        listItem.dataset.chatId = id;

        // Chat Title (Click to switch)
        const titleSpan = document.createElement('span');
        titleSpan.className = `chat-item-text ${id === currentChatId ? 'active' : ''}`;
        titleSpan.textContent = chat.title;
        titleSpan.addEventListener('click', () => switchChat(id));
        listItem.appendChild(titleSpan);

        // Rename Button (Pencil icon)
        const renameBtn = document.createElement('button');
        renameBtn.className = 'chat-action-btn';
        renameBtn.innerHTML = '✏️';
        renameBtn.title = 'Rename Chat';
        renameBtn.addEventListener('click', () => renameChat(id));
        listItem.appendChild(renameBtn);

        // Delete Button (X icon)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'chat-action-btn';
        deleteBtn.innerHTML = '❌';
        deleteBtn.title = 'Delete Chat';
        deleteBtn.addEventListener('click', (e) => showDeleteWarning(e, id));
        listItem.appendChild(deleteBtn);

        chatListUl.appendChild(listItem);
    });
    saveChatHistory();
};

const renameChat = (chatId) => {
    const chat = chats[chatId];
    if (!chat) return;

    const newTitle = prompt(`Enter a new title for "${chat.title}"`);
    if (newTitle && newTitle.trim() !== '') {
        chat.title = newTitle.trim();
        updateChatList();
    }
};

const showDeleteWarning = (e, chatId) => {
    e.stopPropagation(); // Prevent switching chat when clicking the delete button
    warningModal.dataset.chatIdToDelete = chatId;
    warningModal.style.display = 'flex';
};

// --- 6. FILE HANDLERS ---

const downloadChat = () => {
    if (!currentChatId || !chats[currentChatId]) {
        customConsoleLog('No active chat to download.', true);
        return;
    }

    const chatData = chats[currentChatId];
    const filename = `${chatData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    const dataStr = JSON.stringify(chatData.history, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    customConsoleLog(`Chat downloaded as ${filename}`);
};

const uploadChat = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const uploadedHistory = JSON.parse(event.target.result);
                if (Array.isArray(uploadedHistory)) {
                    const newId = crypto.randomUUID();
                    const title = `Uploaded Chat: ${file.name.replace('.json', '')}`;
                    
                    chats[newId] = { title: title, history: uploadedHistory };
                    currentChatId = newId;
                    switchChat(newId);
                    customConsoleLog(`Chat uploaded from ${file.name}`);
                } else {
                    throw new Error('File content is not a valid chat history array.');
                }
            } catch (error) {
                customConsoleLog(`Error reading or parsing uploaded chat file: ${error.message}`, true);
                // NOTE: Using a custom error message instead of window.alert()
                // In a real application, this would show a custom modal.
                console.error('Error: Could not process the uploaded file. Please ensure it is a valid JSON chat history array.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};


// --- 7. API INTERACTION ---

// Function to handle exponential backoff for API calls
const withExponentialBackoff = async (fn, maxRetries = 5, delay = 1000) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries - 1) {
                throw error;
            }
            const sleepTime = delay * 2 ** attempt;
            await new Promise(resolve => setTimeout(resolve, sleepTime));
        }
    }
};

const generateGeminiContent = async (userQuery, imageBase64, mimeType) => {
    if (!API_KEY && !sessionStorage.getItem(API_KEY_STORAGE_KEY)) {
        throw new Error("API Key is not set. Please unlock the application.");
    }
    
    const parts = [{ text: userQuery }];
    if (imageBase64 && mimeType) {
        parts.push({
            inlineData: {
                mimeType: mimeType,
                data: imageBase64
            }
        });
    }

    const payload = {
        contents: [{ role: "user", parts: parts }],
        tools: [{ "google_search": {} }],
        // Using an empty system instruction to keep the model flexible for a chat app
        systemInstruction: {
            parts: [{ text: "You are a helpful and friendly general-purpose AI assistant. Your responses should be concise, well-structured using markdown, and directly address the user's query." }]
        },
    };

    const apiKey = ""; // Canvas runtime will inject the key
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    const fetchFunction = async () => {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            customConsoleLog(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`, true);
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        return response.json();
    };
    
    return withExponentialBackoff(fetchFunction);
};

// --- 8. MAIN EXECUTION FLOW ---

const sendMessage = async () => {
    const queryText = userInput.value.trim();
    const currentFile = selectedFile; // Capture file state for this message

    if (queryText === '' && !currentFile) {
        return;
    }

    userInput.value = ''; // Clear input field
    userInput.style.height = '40px'; // Reset textarea height
    sendBtn.disabled = true;
    uploadBtn.disabled = true;
    loader.style.display = 'block';

    try {
        const userMessage = { 
            role: 'user', 
            text: queryText, 
            timestamp: Date.now() 
        };
        
        let imageBase64 = null;
        let mimeType = null;

        if (currentFile) {
            mimeType = currentFile.type;
            const reader = new FileReader();
            imageBase64 = await fileToBase64(currentFile);
            
            // Add image URL to user message for display
            userMessage.imageUrl = URL.createObjectURL(currentFile); 
            customConsoleLog(`File attached: ${currentFile.name} (${mimeType})`);
        }
        
        // Add user message to history and render
        chats[currentChatId].history.push(userMessage);
        renderChat(chats[currentChatId].history);
        
        // --- API CALL ---
        const apiResponse = await generateGeminiContent(queryText, imageBase64, mimeType);
        
        const candidate = apiResponse.candidates?.[0];
        let botText = "Sorry, I couldn't generate a response.";

        if (candidate && candidate.content?.parts?.[0]?.text) {
            botText = candidate.content.parts[0].text;
            
            // Optional: Extract citations if grounding was used
            let sources = [];
            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                    .map(attribution => ({
                        uri: attribution.web?.uri,
                        title: attribution.web?.title,
                    }))
                    .filter(source => source.uri && source.title);
            }
            
            if (sources.length > 0) {
                let citationText = "\n\n**Sources:**\n";
                sources.forEach((source, index) => {
                    citationText += `- [${source.title}](${source.uri})\n`;
                });
                botText += citationText;
            }
        }

        const botMessage = { 
            role: 'model', 
            text: botText, 
            timestamp: Date.now() 
        };
        
        // Add bot message to history and render
        chats[currentChatId].history.push(botMessage);
        renderChat(chats[currentChatId].history);
        
    } catch (error) {
        customConsoleLog(`Fatal Error during message sending: ${error.message}`, true);
        const errorMessage = {
            role: 'model',
            text: `An error occurred: ${error.message}. Please check the console for details.`,
            timestamp: Date.now()
        };
        chats[currentChatId].history.push(errorMessage);
        renderChat(chats[currentChatId].history);
    } finally {
        sendBtn.disabled = false;
        uploadBtn.disabled = false;
        loader.style.display = 'none';
        selectedFile = null; // Clear selected file after use
        fileInput.value = ''; // Clear file input element
        saveChatHistory();
    }
};

const setupInitialScreen = () => {
    // Check if the key is already stored (i.e., user was previously logged in)
    if (sessionStorage.getItem(API_KEY_STORAGE_KEY) === "UNLOCKED") {
        API_KEY = "";
        accessGate.style.display = 'none';
        mainAppContainer.style.display = 'flex';
        loadChatHistory();
        customConsoleLog('Application unlocked via session storage.');
    } else {
        // Show the access gate if not unlocked
        accessGate.style.display = 'flex';
        mainAppContainer.style.display = 'none';
        customConsoleLog('Showing access gate. Key required to unlock application.');
    }
}


// --- 9. EVENT LISTENERS AND INITIALIZATION ---
window.onload = setupInitialScreen;

// Event Listener for the Access Gate
accessKeySubmit.addEventListener('click', handleAccessKeySubmission);
accessKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleAccessKeySubmission();
    }
});

// Listener for logging
window.addEventListener('keydown', (e) => {
    // Ctrl+L to show logs
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        const logWindow = window.open('', 'ErrorLogs', 'width=600,height=400');
        logWindow.document.write(`
            <html>
            <head>
                <title>Application Logs</title>
                <style>
                    body { font-family: monospace; padding: 10px; background-color: #f4f4f4; }
                    pre { white-space: pre-wrap; word-break: break-word; }\n
                    button { margin-top: 10px; padding: 8px 12px; background-color: #333; color: white; border: none; border-radius: 4px; cursor: pointer; }
                </style>
            </head>
            <body>
                <h2>Logs & Errors</h2>
                <pre>${logs.join('\n')}</pre>
                <button onclick="window.close()">Close</button>
            </body>
            </html>
        `);
        logWindow.document.close();
    }
});

// ========== Existing Event Listeners (ensure they are attached only after unlock) ==========
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
newChatBtn.addEventListener('click', createNewChat);
downloadBtn.addEventListener('click', downloadChat);
uploadBtn.addEventListener('click', () => fileInput.click());
uploadChatBtn.addEventListener('click', uploadChat);
fileInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0] || null;
});

confirmDeleteBtn.addEventListener('click', () => {
    const chatIdToDelete = warningModal.dataset.chatIdToDelete;
    if (chatIdToDelete && chats[chatIdToDelete]) {
        delete chats[chatIdToDelete];
        if (chatIdToDelete === currentChatId) {
            currentChatId = null;
            createNewChat();
        } else {
            // If the deleted chat wasn't the active one, just update the list
            // If the active chat was deleted, createNewChat handled switching.
            // If it was another chat, we need to ensure an active chat is selected.
            const remainingChatIds = Object.keys(chats);
            if (remainingChatIds.length > 0 && !currentChatId) {
                 // This case should ideally not happen if createNewChat runs, but as a fallback:
                switchChat(remainingChatIds[0]);
            } else if (remainingChatIds.length === 0) {
                 // All chats deleted, create new one
                createNewChat();
            } else {
                updateChatList();
            }
        }
    }
    warningModal.style.display = 'none';
});

cancelDeleteBtn.addEventListener('click', () => {
    warningModal.style.display = 'none';
});
