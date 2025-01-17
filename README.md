# WhatsApp Bulk Messenger

A Node.js application that enables sending bulk WhatsApp messages using the WhatsApp Web API. Upload an Excel file with contact details, compose your message, and send it to multiple recipients while getting detailed delivery reports.

## Features

- Web-based QR code authentication
- Real-time client connection status display
- Excel file upload for contact management
- Web-based user interface
- Real-time delivery status tracking
- Detailed sending reports
- Rate limiting to comply with WhatsApp policies
- Error handling and retry mechanism

## Prerequisites

Before running this application, make sure you have the following installed:
- Node.js (v14.0.0 or higher)
- npm (Node Package Manager)
- A WhatsApp account
- Excel files (.xlsx or .xls) containing contact information

## Installation

1. Clone the repository:
```bash
git clone https://github.com/saad4s/whatsapp-bulk-messenger.git
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

2. Access the web interface:
   - Open your browser and go to `http://localhost:3000`
   - The interface will display two main sections:
     - Left: Main interface for QR code/message sending
     - Right: Client connection status

3. Connect WhatsApp:
   - A QR code will be displayed in the web interface
   - Open WhatsApp on your phone
   - Go to Settings > WhatsApp Web/Desktop
   - Scan the QR code
   - The status panel will show "Is Client Ready: True" when connected
   - The interface will automatically switch to the message form

4. Send Messages:
   - Upload your Excel file with contacts
   - Type your message
   - Click "Send Messages"
   - Monitor the sending report for status updates

## Interface Components

1. Status Panel:
   - Shows real-time WhatsApp client connection status
   - Green "True" indicates active connection
   - Red "False" indicates no connection

2. Main Interface:
   - QR Code section (initially)
   - Message form (after connection):
     - Excel file upload
     - Message input
     - Send button
   - Sending report section:
     - Total messages count
     - Success/failure statistics
     - Detailed delivery status for each contact

## WhatsApp Policies and Limitations

Please be aware of WhatsApp's usage policies:
- Respect daily message limits
- Ensure you have user consent
- Comply with content guidelines
- Maintain quality ratings
- Review the full policy details in the project documentation

## Contributing

We welcome contributions! Please see our [contributing-guidelines.md](contributing-guidelines.md) for details on:
- Code of conduct
- Development setup
- Pull request process
- Coding standards

## Security

- Never commit your WhatsApp session data
- Keep your node_modules up to date
- Monitor for unusual activity
- Report security issues via GitHub issues

## Support

If you need help or have questions:
1. Check existing issues or create a new one
2. Join our discussion forum (coming soon)
3. Read the WhatsApp Web API documentation

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

## License

This project is licensed under the MIT License - see the [project-license.md](project-license.md) file for details.

## Acknowledgments

- WhatsApp Web JS library
- Excel file processing libraries
- Express.js framework
- All contributors

---
Made with ❤️ by the WhatsApp Bulk Messenger team
