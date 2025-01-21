const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Configuration constants
const CONFIG = {
    port: process.env.PORT || 3000,
    uploadDir: './uploads',
    clientId: 'whatsapp-bulk-sender',
    messageDelay: 1000, // Delay between messages in ms
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

// Multer configuration
const storage = multer.diskStorage({
    destination: CONFIG.uploadDir,
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'contacts-' + uniqueSuffix + path.extname(file.originalname));
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

app.post('/upload', upload.single('contactFile'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const contacts = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!contacts.length) {
            throw new Error('No contacts found in the file');
        }

        res.json({ success: true, contacts });
    } catch (error) {
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

app.post('/send-messages', async (req, res) => {
    const { contacts, message } = req.body;
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