const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs').promises;

// Configuration constants
const CONFIG = {
    port: process.env.PORT || 3000,
    uploadDir: './uploads',
    messageDir: './uploads/messages', // New directory for messages
    clientId: 'whatsapp-bulk-sender',
    messageDelay: 1000,
    puppeteerArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
    ]
};

// Create necessary directories
async function createDirectories() {
    try {
        await fs.mkdir(CONFIG.uploadDir, { recursive: true });
        await fs.mkdir(CONFIG.messageDir, { recursive: true });
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}
createDirectories();


// WhatsApp client factory
const createWhatsAppClient = () => {
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: CONFIG.clientId }),
        puppeteer: {
            headless: true,
            args: CONFIG.puppeteerArgs
        }
    });

    return client;
};

// Setup Express and Socket.IO
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Multer configuration with message saving
const storage = multer.diskStorage({
    destination: CONFIG.uploadDir,
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = 'contacts-' + uniqueSuffix + path.extname(file.originalname);
        // Store filename in request for later use
        req.uploadedFileName = filename;
        cb(null, filename);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel files are allowed.'));
        }
    }
});

// Save message function
async function saveMessage(fileName, message, contacts) {
    const messageData = {
        timestamp: new Date().toISOString(),
        contactFile: fileName,
        message: message,
        totalContacts: contacts.length,
        contacts: contacts
    };

    const messageFileName = `message-${path.parse(fileName).name}.json`;
    const messagePath = path.join(CONFIG.messageDir, messageFileName);

    await fs.writeFile(messagePath, JSON.stringify(messageData, null, 2));
    return messageFileName;
}

// Initialize WhatsApp client
let client = createWhatsAppClient();

// Client event handlers
const setupClientEvents = (client) => {
    client.on('qr', (qr) => {
        global.qrCode = qr;
        io.emit('qr', qr);
        console.log('New QR code generated');
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        io.emit('ready');
        global.qrCode = null;
    });

    client.on('authenticated', () => {
        console.log('WhatsApp authentication successful!');
    });

    client.on('auth_failure', (error) => {
        console.error('WhatsApp authentication failed:', error);
        global.qrCode = null;
        io.emit('auth_failure');
    });

    client.on('disconnected', (reason) => {
        console.log('Client was disconnected:', reason);
        io.emit('disconnected', reason);
    });

    return client;
};

// Setup initial client
setupClientEvents(client);

// Initialize client with retry mechanism
const initializeClient = async () => {
    try {
        await client.initialize();
    } catch (error) {
        console.error('Failed to initialize WhatsApp client:', error);
        setTimeout(initializeClient, 5000);
    }
};

// Message sending utility
const sendWhatsAppMessage = async (contact, message) => {
    const number = contact.phone.toString().replace(/[^\d]/g, '');
    const chatId = `${number}@c.us`;

    const isRegistered = await client.isRegisteredUser(chatId);
    if (!isRegistered) {
        throw new Error('Number not registered on WhatsApp');
    }

    await client.sendMessage(chatId, message);
};

// Socket connection handling
io.on('connection', (socket) => {
    console.log('Client connected');

    if (global.qrCode && !client.authenticated) {
        socket.emit('qr', global.qrCode);
    }

    if (client.authenticated) {
        socket.emit('ready');
    }

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Express middleware
app.use(express.static('public'));
app.use(express.json());

// Routes
app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'qr.html'));
});

// Modify your upload route to handle both file and message
app.post('/upload', upload.single('contactFile'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }

        // Get message from the form data
        const message = req.body.message;
        if (!message) {
            throw new Error('No message provided');
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const contacts = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!contacts.length) {
            throw new Error('No contacts found in the file');
        }

        // Save message alongside the contact file
        const messageData = {
            timestamp: new Date().toISOString(),
            contactFile: req.file.filename,
            message: message,
            totalContacts: contacts.length,
            contacts: contacts
        };

        // Save message to JSON file
        const messageFileName = `message-${path.parse(req.file.filename).name}.json`;
        const messagePath = path.join(CONFIG.uploadDir, 'messages', messageFileName);

        // Ensure messages directory exists
        await fs.mkdir(path.join(CONFIG.uploadDir, 'messages'), { recursive: true });

        // Write message file
        await fs.writeFile(messagePath, JSON.stringify(messageData, null, 2));

        res.json({
            success: true,
            contacts,
            messageFile: messageFileName
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/logout', async (req, res) => {
    try {
        await client.logout();
        await client.destroy();

        client = createWhatsAppClient();
        setupClientEvents(client);
        await client.initialize();

        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Modified send messages route
app.post('/send-messages', async (req, res) => {
    const { contacts, message } = req.body;

    try {
        // Save message if we have the last upload information
        if (req.session && req.session.lastUpload) {
            await saveMessage(
                req.session.lastUpload.filename,
                message,
                contacts
            );
        }

        const report = {
            total: contacts.length,
            successful: 0,
            failed: 0,
            notRegistered: 0,
            details: []
        };

        for (const contact of contacts) {
            try {
                await sendWhatsAppMessage(contact, message);

                report.successful++;
                report.details.push({
                    name: contact.name,
                    number: contact.phone,
                    status: 'success'
                });
            } catch (error) {
                if (error.message === 'Number not registered on WhatsApp') {
                    report.notRegistered++;
                } else {
                    report.failed++;
                }

                report.details.push({
                    name: contact.name,
                    number: contact.phone,
                    status: 'failed',
                    error: error.message
                });
            }

            await new Promise(resolve => setTimeout(resolve, CONFIG.messageDelay));
        }

        res.json({ success: true, report });
    } catch (error) {
        console.error('Error sending messages:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
server.listen(CONFIG.port, () => {
    console.log(`Server running at http://localhost:${CONFIG.port}`);
});

// Initialize WhatsApp client
initializeClient();