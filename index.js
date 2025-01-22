const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs').promises;
const qrcode = require('qrcode');
const puppeteer = require('puppeteer');

// Configuration constants
const CONFIG = {
    port: process.env.PORT || 3000,
    uploadDir: './uploads',
    messageDir: './uploads/messages',
    clientId: 'whatsapp-bulk-sender',
    messageDelay: 1000
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
    return new Client({
        authStrategy: new LocalAuth({
            clientId: CONFIG.clientId,
            dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080'
            ],
            defaultViewport: {
                width: 1920,
                height: 1080
            },
            ignoreDefaultArgs: ['--disable-extensions']
        },
        clientId: CONFIG.clientId
    });
};

// Setup Express and Socket.IO
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Multer configuration
const storage = multer.diskStorage({
    destination: CONFIG.uploadDir,
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = 'contacts-' + uniqueSuffix + path.extname(file.originalname);
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

// Message sending utility
const sendWhatsAppMessage = async (client, contact, message) => {
    const number = contact.phone.toString().replace(/[^\d]/g, '');
    const chatId = `${number}@c.us`;

    const isRegistered = await client.isRegisteredUser(chatId);
    if (!isRegistered) {
        throw new Error('Number not registered on WhatsApp');
    }

    await client.sendMessage(chatId, message);
};

// Initialize WhatsApp client
let client = createWhatsAppClient();
let isClientReady = false;

// Setup client events
const setupClientEvents = (client) => {
    client.on('qr', async (qr) => {
        try {
            // Generate QR code as data URL
            const qrCodeDataUrl = await qrcode.toDataURL(qr);

            // Store QR code globally
            global.qrCode = qr;
            global.qrCodeDataUrl = qrCodeDataUrl;

            // Show QR in terminal (for debugging)
            qrcode.generate(qr, { small: true });

            // Emit to all connected clients
            io.emit('qr', qr);
            io.emit('qrDataUrl', qrCodeDataUrl);

            console.log('New QR code generated');
        } catch (err) {
            console.error('QR Code generation error:', err);
        }
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        isClientReady = true;
        global.qrCode = null;
        global.qrCodeDataUrl = null;
        io.emit('ready');
    });

    client.on('authenticated', () => {
        console.log('WhatsApp authentication successful');
    });

    client.on('auth_failure', (error) => {
        console.error('WhatsApp authentication failed:', error);
        isClientReady = false;
        global.qrCode = null;
        global.qrCodeDataUrl = null;
        io.emit('auth_failure');
    });

    client.on('disconnected', (reason) => {
        console.log('WhatsApp client disconnected:', reason);
        isClientReady = false;
        io.emit('disconnected', reason);
    });

    return client;
};

// Setup initial client with events
setupClientEvents(client);

// Initialize WhatsApp client with retry mechanism
const initializeClient = async () => {
    try {
        console.log('Initializing WhatsApp client...');
        await client.initialize();
    } catch (error) {
        console.error('Failed to initialize WhatsApp client:', error);
        // Retry after 5 seconds
        setTimeout(initializeClient, 5000);
    }
};

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');

    // If we have a stored QR code and client isn't ready, send it
    if (global.qrCodeDataUrl && !isClientReady) {
        socket.emit('qrDataUrl', global.qrCodeDataUrl);
    }

    // If client is already authenticated, emit ready event
    if (isClientReady) {
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
app.get('/status', (req, res) => {
    res.json({
        isClientReady,
        qrCode: global.qrCodeDataUrl
    });
});

app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'qr.html'));
});

app.post('/upload', upload.single('contactFile'), async (req, res) => {
    try {
        if (!isClientReady) {
            throw new Error('WhatsApp client not ready');
        }

        if (!req.file) {
            throw new Error('No file uploaded');
        }

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

        // Save message alongside contacts
        const messageFileName = await saveMessage(req.file.filename, message, contacts);

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

        // Create and initialize new client
        client = createWhatsAppClient();
        setupClientEvents(client);
        await client.initialize();
        isClientReady = false;

        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/send-messages', async (req, res) => {
    if (!isClientReady) {
        return res.status(400).json({
            success: false,
            error: 'WhatsApp client not ready'
        });
    }

    const { contacts, message } = req.body;

    try {
        const report = {
            total: contacts.length,
            successful: 0,
            failed: 0,
            notRegistered: 0,
            details: []
        };

        for (const contact of contacts) {
            try {
                await sendWhatsAppMessage(client, contact, message);

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

            // Add delay between messages to avoid rate limiting
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