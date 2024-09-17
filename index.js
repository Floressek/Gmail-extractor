const fs = require('fs').promises;
const fs_sync = require('fs');
const path = require('path');
const express = require('express');
const {google} = require('googleapis');
const imaps = require('imap-simple');
const quotedPrintable = require('quoted-printable');
const utf8 = require('utf8');

const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'token.json';
const EMAIL_ADDRESS = 'ardiumvpn@gmail.com'; // TODO: Move to environment variable
const ATTACHMENT_DIR = 'attachments';

const SCOPES = ['https://mail.google.com/'];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.eml', '.png', '.jpg'];
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'message/rfc822'
];

async function main() {
    try {
        const content = await fs.readFile(CREDENTIALS_PATH);
        const auth = await authorize(JSON.parse(content));
        await connectToImap(auth);
    } catch (error) {
        console.error('Error occurred:', error);
    }
}

async function authorize(credentials) {
    const {client_secret, client_id, redirect_uris} = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    try {
        const token = await fs.readFile(TOKEN_PATH);
        oAuth2Client.setCredentials(JSON.parse(token));
        return oAuth2Client;
    } catch (err) {
        return getNewToken(oAuth2Client);
    }
}

function getNewToken(oAuth2Client) {
    return new Promise((resolve, reject) => {
        const app = express();
        const port = 3000;

        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });

        app.get('/auth/google/callback', async (req, res) => {
            const {code} = req.query;
            try {
                const {tokens} = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);
                await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
                console.log('Token saved to file:', TOKEN_PATH);
                res.send('Authorization completed successfully! You can close this tab.');
                resolve(oAuth2Client);
            } catch (err) {
                console.error('Error fetching token:', err);
                res.send('Error fetching token.');
                reject(err);
            }
        });

        app.listen(port, () => {
            console.log(`Server listening at http://localhost:${port}`);
            console.log('Open this URL in your browser to authorize the app:', authUrl);
        });
    });
}

function buildXOAuth2Token(user, accessToken) {
    const authString = `user=${user}\x01auth=Bearer ${accessToken}\x01\x01`;
    return Buffer.from(authString).toString('base64');
}

function getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
}


function isAllowedFileType(filename, mimeType) {
    const extension = getFileExtension(filename);
    return ALLOWED_EXTENSIONS.includes(extension) || ALLOWED_MIME_TYPES.includes(mimeType);
}

let unnamedCounter = 0;

function decodeFilename(filename) {
    if (!filename) {
        unnamedCounter++;
        return `unnamed_attachment_${unnamedCounter}`;
    }

    // Decoding filename from MIME format
    if (filename.startsWith('=?UTF-8?Q?')) {
        filename = filename.replace('=?UTF-8?Q?', '').replace('?=', '');
        filename = utf8.decode(quotedPrintable.decode(filename));
    }
    // Removing illegal characters from the filename
    return filename.replace(/[/\\?%*:|"<>]/g, '-');
}

async function connectToImap(auth) {
    const accessToken = auth.credentials.access_token;
    const xoauth2Token = buildXOAuth2Token(EMAIL_ADDRESS, accessToken);

    const config = {
        imap: {
            user: EMAIL_ADDRESS,
            xoauth2: xoauth2Token,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: {
                rejectUnauthorized: false,
            },
            authTimeout: 3000,
        },
        onError: (err) => console.error('IMAP Error:', err),
    };

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = {
            bodies: ['HEADER', 'TEXT', ''],
            markSeen: false,
            struct: true,
        };

        const messages = await connection.search(searchCriteria, fetchOptions);
        const attachments = [];

        messages.forEach((message) => {
            const parts = imaps.getParts(message.attributes.struct);
            parts.forEach((part) => {
                if (part.disposition && part.disposition.type.toUpperCase() === 'ATTACHMENT') {
                    const filename = decodeFilename(part.disposition.params.filename);
                    const mimeType = part.type;
                    const extension = getFileExtension(filename);

                    if (isAllowedFileType(filename)) {
                        attachments.push({
                            uid: message.attributes.uid,
                            partID: part.partID,
                            filename: filename,
                            encoding: part.encoding,
                            mimeType: mimeType
                        });
                        console.log(`Allowed attachment detected: ${filename}, MIME Type: ${mimeType}, Extension: ${extension}`);
                    } else {
                        console.log(`Skipped attachment with disallowed type: ${filename}, MIME Type: ${mimeType}, Extension: ${extension}`);
                    }
                }
            });
        });

        await fs.mkdir(ATTACHMENT_DIR, { recursive: true });

        const attachmentPromises = attachments.map((attachment) => {
            return connection
                .getPartData({attributes: {uid: attachment.uid}}, attachment)
                .then((partData) => {
                    try {
                        const filePath = path.join(ATTACHMENT_DIR, attachment.filename);
                        fs_sync.writeFileSync(filePath, partData);
                        console.log('Attachment saved:', attachment.filename);
                    } catch (err) {
                        console.error('Error saving attachment:', attachment.filename, err);
                    }
                });
        });

        await Promise.all(attachmentPromises);
    } catch (err) {
        console.error('IMAP connection error:', err);
    }
}

main();