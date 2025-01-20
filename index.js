const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = 3000;

// Set up multer for handling file uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, 'contacts-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Set up WhatsApp client with Puppeteer's bundled Chromium
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-bulk-sender"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
        // Remove executablePath to use bundled Chromium
    }
});

// Serve static files from 'public' directory
app.use(express.static('public'));
app.use(express.json());

// Serve the QR code page
app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'qr.html'));
});

// Socket.IO connection handling
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

// WhatsApp client event handlers
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

// Add error event handler
client.on('disconnected', (reason) => {
    console.log('Client was disconnected:', reason);
    io.emit('disconnected', reason);
});

// Initialize WhatsApp client with better error handling
client.initialize()
    .catch(err => {
        console.error('Failed to initialize WhatsApp client:', err);
        // Attempt to recreate the client after a delay if initialization fails
        setTimeout(() => {
            console.log('Attempting to reinitialize client...');
            client.initialize();
        }, 5000);
    });

// Routes remain the same
app.post('/upload', upload.single('contactFile'), async (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const contacts = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        res.json({ success: true, contacts });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
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
            const number = contact.phone.toString().replace(/[^\d]/g, '');
            const chatId = number + "@c.us";

            const isRegistered = await client.isRegisteredUser(chatId);

            if (!isRegistered) {
                report.notRegistered++;
                report.details.push({
                    name: contact.name,
                    number: contact.phone,
                    status: 'failed',
                    error: 'Number not registered on WhatsApp'
                });
                continue;
            }

            await client.sendMessage(chatId, message);

            report.successful++;
            report.details.push({
                name: contact.name,
                number: contact.phone,
                status: 'success'
            });
        } catch (error) {
            report.failed++;
            report.details.push({
                name: contact.name,
                number: contact.phone,
                status: 'failed',
                error: error.message
            });
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    res.json({ success: true, report });
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});