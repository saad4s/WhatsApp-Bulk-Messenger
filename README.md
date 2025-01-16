Install the required dependencies

npm init -y
npm install express multer xlsx whatsapp-web.js qrcode-terminal

Run the application

node index.js

Important notes:

The Excel file should have columns named "name" and "phone"

Phone numbers should include the country code

The application includes a 1-second delay between messages to avoid rate limiting

WhatsApp has usage limits and policies - make sure to comply with them

Always test with a small group first

Keep your WhatsApp session active
