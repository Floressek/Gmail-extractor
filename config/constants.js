const path = require('path');

// Bazowy katalog w wolumenie Railway
const BASE_VOLUME_DIR = path.join('/app/processed_attachments');

// Definiowanie folderów
const DATA_DIR = path.join(BASE_VOLUME_DIR, 'data');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
const TEMP_DIR = path.join(DATA_DIR, 'temp');

// const DATA_DIR = path.join(__dirname, '../data');
// const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
// const TEMP_DIR = path.join(DATA_DIR, 'temp');
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS || 'ardiumvpn@gmail.com';
const ALLOWED_EXTENSIONS = [
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.csv',
    '.png',
    '.jpg',
    '.jpeg'];
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/png',
    'image/jpeg'];

module.exports = {
    DATA_DIR,
    PROCESSED_DIR,
    TEMP_DIR,
    EMAIL_ADDRESS,
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES
};