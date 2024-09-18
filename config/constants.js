const path = require('path');

module.exports = {
    CREDENTIALS_PATH: 'credentials.json',
    TOKEN_PATH: 'token.json',
    EMAIL_ADDRESS: process.env.EMAIL_ADDRESS || 'ardiumvpn@gmail.com',
    ATTACHMENT_DIR: 'attachments',
    PROCESSED_DIR: 'processed_attachments',
    ALLOWED_EXTENSIONS: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg'],
    ALLOWED_MIME_TYPES: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'image/png',
        'image/jpeg'
    ]
};