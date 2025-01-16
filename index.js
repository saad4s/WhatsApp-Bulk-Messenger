const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

const app = express();
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

client.on('qr', (qr) => {
    // Generate and display QR code in terminal
    qrcode.generate(qr, { small: true });
    console.log('Please scan the QR code to authenticate WhatsApp Web');
});

client.on('ready', () => {
    console.log('Client is ready!');
});

// Initialize WhatsApp client
client.initialize();

// Serve static files from 'public' directory
app.use(express.static('public'));
app.use(express.json());

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
        details: []
    };

    for (const contact of contacts) {
        try {
            const number = contact.phone.toString().replace(/[^\d]/g, '');
            const chatId = number + "@c.us";
            
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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});