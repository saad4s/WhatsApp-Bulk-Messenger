const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { Client } = require('whatsapp-web.js');
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

// Set up WhatsApp client
const client = new Client();

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

    // If there's an existing QR code, send it immediately
    if (global.qrCode) {
        socket.emit('qr', global.qrCode);
    }

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// WhatsApp client event handlers
client.on('qr', (qr) => {
    // Store QR code globally
    global.qrCode = qr;
    // Emit to all connected clients
    io.emit('qr', qr);
    console.log('New QR code generated');
});

client.on('ready', () => {
    console.log('Client is ready!');
    io.emit('ready');
});

// Initialize WhatsApp client
client.initialize();

// Routes
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

            // Check if the number is registered on WhatsApp
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