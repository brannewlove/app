const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '../.env');
console.log('Loading .env from:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading .env:', result.error.message);
} else {
    console.log('.env loaded successfully.');
    console.log('GOOGLE_BACKUP_FOLDER_ID:', process.env.GOOGLE_BACKUP_FOLDER_ID);
    console.log('Parsed keys:', Object.keys(result.parsed));
}
