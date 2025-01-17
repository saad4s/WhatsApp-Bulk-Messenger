# WhatsApp Bulk Messenger

A Node.js application that enables sending bulk WhatsApp messages using the official WhatsApp Business API. Upload an Excel file with contact details, compose your message, and send it to multiple recipients while getting detailed delivery reports.

## Features

- Excel file upload for contact management
- Web-based user interface
- Real-time delivery status tracking
- Detailed sending reports
- Rate limiting to comply with WhatsApp policies
- Error handling and retry mechanism
- WhatsApp Web authentication using QR code

## Prerequisites

Before running this application, make sure you have the following installed:
- Node.js (v14.0.0 or higher)
- npm (Node Package Manager)
- A WhatsApp account
- Excel files (.xlsx or .xls) containing contact information

## Installation

1. Clone the repository:
```bash
git clone https://github.com/saad4s/WhatsApp-Bulk-Messenger.git
cd whatsapp-bulk-messenger
```

2. Install dependencies:
```bash
npm install
```

3. Create required directories:
```bash
mkdir uploads
```

## Configuration

1. The application uses default configuration, but you can modify these in `index.js`:
   - Port number (default: 3000)
   - Upload directory (default: './uploads/')
   - Message delay (default: 1000ms)

2. Excel file format requirements:
   - Must include columns named "name" and "phone"
   - Phone numbers should include country code
   - Example format:
     ```
     name    | phone
     --------|-------------
     John    | +1234567890
     Alice   | +9876543210
     ```

## Usage

1. Start the application:
```bash
node index.js
```

2. Scan the QR code:
   - When you first run the application, a QR code will appear in the terminal
   - Open WhatsApp on your phone
   - Go to Settings > WhatsApp Web/Desktop
   - Scan the QR code
   - Wait for authentication confirmation

3. Access the web interface:
   - Open your browser and go to `http://localhost:3000`
   - Upload your Excel file with contacts
   - Type your message
   - Click "Send Messages"
   - Monitor the sending report for status updates

## WhatsApp Policies and Limitations

Please be aware of WhatsApp's usage policies:
- Respect daily message limits
- Ensure you have user consent
- Comply with content guidelines
- Maintain quality ratings
- Review the full policy details in the project documentation

## Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/AmazingFeature`
3. Commit your changes: `git commit -m 'Add some AmazingFeature'`
4. Push to the branch: `git push origin feature/AmazingFeature`
5. Open a Pull Request

### Areas for Contribution

- UI/UX improvements
- Additional message templates
- Better error handling
- Rate limiting improvements
- Documentation updates
- Test coverage
- Support for different file formats
- Message scheduling features

## Development

To set up the development environment:

1. Clone the repository
2. Install dependencies
3. Create a `.env` file based on `.env.example`
4. Run in development mode:
```bash
npm run dev
```

### Project Structure

```
project/
├── index.js              # Main application file
├── public/              
│   └── index.html       # Web interface
├── uploads/             # Temporary file storage
├── package.json         # Project dependencies
└── README.md           # Documentation
```

## Testing

Currently, the project doesn't include automated tests. Contributions in this area are welcome!

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security

- Never commit your WhatsApp session data
- Keep your node_modules up to date
- Monitor for unusual activity
- Report security issues via GitHub issues

## Support

If you need help or have questions:
1. Check existing issues or create a new one
2. Join our discussion forum (coming soon)
3. Read the WhatsApp Business API documentation

## Roadmap

Future improvements planned:
- [ ] Message templates
- [ ] Scheduled sending
- [ ] Multiple file format support
- [ ] Enhanced reporting
- [ ] User authentication
- [ ] Message customization
- [ ] Automated testing
- [ ] Docker support

## Acknowledgments

- WhatsApp Web JS library
- Excel file processing libraries
- Express.js framework
- All contributors

---
Made with ❤️ by the WhatsApp Bulk Messenger team
