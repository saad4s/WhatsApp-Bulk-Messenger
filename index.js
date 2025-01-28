const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs').promises;
const qrcode = require('qrcode');
const puppeteer = require('puppeteer');
const qrcodeTerminal = require('qrcode-terminal');
const util = require('util');
const readdir = fs.readdir;

// Configuration object with environment-specific settings
const CONFIG = {
    port: process.env.PORT || 3000,
    uploadDir: './uploads',
    messageDir: './uploads/messages',
    clientId: 'whatsapp-bulk-sender',
    messageDelay: Number(process.env.MESSAGE_DELAY) || 1000,
    puppeteerArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-web-security'
    ],
    webVersion: '2.2318.11'
};

// Directory creation with error handling
const createDirectories = async () => {
    const dirs = [
        CONFIG.uploadDir,
        CONFIG.messageDir,
        './.wwebjs_auth',
        './.wwebjs_cache'
    ];

    await Promise.all(
        dirs.map(dir => fs.mkdir(dir, { recursive: true }).catch(err => {
            console.error(`Error creating directory ${dir}:`, err);
        }))
    );
};

// Improved WhatsApp client factory with consistent configuration
const createWhatsAppClient = () => new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: CONFIG.puppeteerArgs
    },
    webVersion: CONFIG.webVersion,
    webVersionCache: {
        type: 'local',
        path: './.wwebjs_cache'
    }
});

// Express and Socket.IO setup
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Optimized Multer configuration for file and image uploads
const storage = multer.diskStorage({
    destination: CONFIG.uploadDir,
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        const filename = `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`;
        req.uploadedFileName = filename;
        cb(null, filename);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.xlsx', '.xls', '.png', '.jpg', '.jpeg'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel and image files are allowed.'));
        }
    }
});

// Template storage (in-memory for now)
let templates = [];

// Add a new template
app.post('/template', (req, res) => {
    const { name, content } = req.body;
    if (!name || !content) {
        return res.status(400).json({ success: false, error: 'Name and content are required' });
    }
    templates.push({ name, content });
    res.json({ success: true, templates });
});

// Get all templates
app.get('/templates', (req, res) => {
    res.json({ success: true, templates });
});

// Update a template
app.put('/template/:name', (req, res) => {
    const { name } = req.params;
    const { content } = req.body;
    const template = templates.find(t => t.name === name);
    if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
    }
    template.content = content;
    res.json({ success: true, templates });
});

// Delete a template
app.delete('/template/:name', (req, res) => {
    const { name } = req.params;
    const index = templates.findIndex(t => t.name === name);
    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Template not found' });
    }
    templates.splice(index, 1);
    res.json({ success: true, templates });
});

// Optimized message saving with better error handling
const saveMessage = async (fileName, message, contacts, report) => {
    const messageData = {
        timestamp: new Date().toISOString(),
        contactFile: fileName,
        message,
        totalContacts: contacts.length,
        whatsappId: global.whatsappId,
        report: {
            total: report.total,
            successful: report.successful,
            failed: report.failed,
            details: report.details
        },
        contacts
    };

    const messageFileName = `message-${path.parse(fileName).name}.json`;
    const messagePath = path.join(CONFIG.messageDir, messageFileName);

    try {
        await fs.writeFile(messagePath, JSON.stringify(messageData, null, 2));
        return messageFileName;
    } catch (error) {
        console.error('Error saving message:', error);
        throw new Error('Failed to save message data');
    }
};

// Improved WhatsApp message sending with validation and image support
const sendWhatsAppMessage = async (client, contact, message, imagePath) => {
    const number = contact.phone.toString().replace(/[^\d]/g, '');
    if (!number) {
        throw new Error('Invalid phone number');
    }

    const chatId = `${number}@c.us`;
    const isRegistered = await client.isRegisteredUser(chatId);

    if (!isRegistered) {
        throw new Error('Number not registered on WhatsApp');
    }

    if (imagePath) {
        const media = MessageMedia.fromFilePath(imagePath);
        return client.sendMessage(chatId, media, { caption: message });
    } else {
        return client.sendMessage(chatId, message);
    }
};

// Improved client event handling
const setupClientEvents = (client) => {
    const events = {
        qr: async (qr) => {
            try {
                const qrCodeDataUrl = await qrcode.toDataURL(qr);
                global.qrCode = qr;
                global.qrCodeDataUrl = qrCodeDataUrl;
                io.emit('qr', qr);
                io.emit('qrDataUrl', qrCodeDataUrl);
            } catch (err) {
                console.error('QR Code generation error:', err);
            }
        },

        ready: async () => {
            try {
                const info = await client.info;
                global.whatsappId = info.wid._serialized;
                console.log('Client is ready!');
                global.isClientReady = true;
                global.qrCode = null;
                global.qrCodeDataUrl = null;
                io.emit('ready', { whatsappId: global.whatsappId });
            } catch (error) {
                console.error('Error getting WhatsApp info:', error);
            }
        },
        authenticated: () => {
            console.log('WhatsApp authentication successful');
            global.isClientReady = true;
        },
        auth_failure: (error) => {
            console.error('WhatsApp authentication failed:', error);
            global.isClientReady = false;
            global.qrCode = null;
            global.qrCodeDataUrl = null;
            io.emit('auth_failure');
        },
        disconnected: async (reason) => {
            console.log('WhatsApp client disconnected:', reason);
            global.isClientReady = false;
            io.emit('disconnected', reason);

            try {
                await client.destroy();
                const newClient = createWhatsAppClient();
                setupClientEvents(newClient);
                await newClient.initialize();
                return newClient;
            } catch (error) {
                console.error('Error reinitializing client:', error);
                throw error;
            }
        }
    };

    Object.entries(events).forEach(([event, handler]) => {
        client.on(event, handler);
    });

    return client;
};

// Initialize client with retry mechanism
let client = setupClientEvents(createWhatsAppClient());
global.isClientReady = false;

const initializeClient = async (retries = 3, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Initializing WhatsApp client (attempt ${i + 1}/${retries})...`);
            await client.initialize();
            return;
        } catch (error) {
            console.error(`Failed to initialize WhatsApp client (attempt ${i + 1}):`, error);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw new Error('Failed to initialize WhatsApp client after multiple attempts');
};

// Optimized Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');

    if (global.qrCodeDataUrl && !global.isClientReady) {
        socket.emit('qrDataUrl', global.qrCodeDataUrl);
    }

    if (global.isClientReady) {
        socket.emit('ready');
    }

    socket.on('disconnect', () => console.log('Client disconnected'));
});

// Express middleware and static files
app.use(express.static('public'));
app.use(express.json());

// Optimized routes with better error handling
app.get('/status', (req, res) => {
    res.json({
        isClientReady: global.isClientReady,
        qrCode: global.qrCodeDataUrl
    });
});

app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'qr.html'));
});

app.get('/message-history', async (req, res) => {
    try {
        if (!global.isClientReady || !global.whatsappId) {
            throw new Error('WhatsApp client not ready');
        }

        const files = await readdir(CONFIG.messageDir);
        const messageHistory = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(CONFIG.messageDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                const messageData = JSON.parse(content);

                // Only include messages for current WhatsApp account
                if (messageData.whatsappId === global.whatsappId) {
                    messageHistory.push({
                        id: file,
                        timestamp: messageData.timestamp,
                        message: messageData.message,
                        totalContacts: messageData.totalContacts,
                        report: messageData.report
                    });
                }
            }
        }

        // Sort by timestamp, newest first
        messageHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            success: true,
            history: messageHistory
        });
    } catch (error) {
        console.error('Error fetching message history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/upload', upload.fields([
    { name: 'contactFile', maxCount: 1 },
    { name: 'imageFile', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!global.isClientReady) {
            throw new Error('WhatsApp client not ready');
        }

        if (!req.files['contactFile'] || !req.body.message) {
            throw new Error('Missing required fields');
        }

        const workbook = xlsx.readFile(req.files['contactFile'][0].path);
        const contacts = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        if (!contacts.length) {
            throw new Error('No contacts found in the file');
        }

        // Initial report with no messages sent yet
        const initialReport = {
            total: contacts.length,
            successful: 0,
            failed: 0,
            details: []
        };

        const messageFileName = await saveMessage(req.files['contactFile'][0].filename, req.body.message, contacts, initialReport);

        res.json({
            success: true,
            contacts,
            messageFile: req.files['contactFile'][0].filename,
            imageFile: req.files['imageFile'] ? req.files['imageFile'][0].filename : null
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

        client = setupClientEvents(createWhatsAppClient());
        await client.initialize();
        global.isClientReady = false;

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
    if (!global.isClientReady) {
        return res.status(400).json({
            success: false,
            error: 'WhatsApp client not ready'
        });
    }

    const { contacts, message, messageFile, imageFile } = req.body;
    const report = {
        total: contacts.length,
        successful: 0,
        failed: 0,
        details: []
    };

    try {
        await Promise.all(contacts.map(async (contact) => {
            try {
                const imagePath = imageFile ? path.join(CONFIG.uploadDir, imageFile) : null;
                await sendWhatsAppMessage(client, contact, message, imagePath);
                report.successful++;
                report.details.push({
                    name: contact.name,
                    number: contact.phone,
                    status: 'success',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                report.failed++;
                report.details.push({
                    name: contact.name,
                    number: contact.phone,
                    status: 'failed',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
            await new Promise(resolve => setTimeout(resolve, CONFIG.messageDelay));
        }));

        // Save the updated report to the message file
        await saveMessage(messageFile, message, contacts, report);

        res.json({ success: true, report });
    } catch (error) {
        console.error('Error sending messages:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});

app.delete('/message-history/:messageId', async (req, res) => {
    try {
        if (!global.isClientReady) {
            throw new Error('WhatsApp client not ready');
        }

        const messageFile = path.join(CONFIG.messageDir, req.params.messageId);

        // Verify the file exists and belongs to current user
        const fileContent = await fs.readFile(messageFile, 'utf8');
        const messageData = JSON.parse(fileContent);

        if (messageData.whatsappId !== global.whatsappId) {
            throw new Error('Unauthorized access');
        }

        await fs.unlink(messageFile);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Initialize server and WhatsApp client
const startServer = async () => {
    try {
        await createDirectories();
        await initializeClient();

        server.listen(CONFIG.port, () => {
            console.log(`Server running at http://localhost:${CONFIG.port}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();