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
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS || 'ardiumvpn@gmail.com';
const ATTACHMENT_DIR = 'attachments';

const SCOPES = ['https://mail.google.com/'];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg'];
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/png',
    'image/jpeg'
];

let oAuth2Client;

async function main() {
    try {
        const content = await fs.readFile(CREDENTIALS_PATH);
        oAuth2Client = await authorize(JSON.parse(content));
        await startImapListener(oAuth2Client);
    } catch (error) {
        console.error('Error occurred:', error);
    }
}

async function authorize(credentials) {
    const {client_secret, client_id, redirect_uris} = credentials.web;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    try {
        const token = JSON.parse(await fs.readFile(TOKEN_PATH));
        oAuth2Client.setCredentials(token);
        oAuth2Client.on('tokens', (tokens) => {
            if (tokens.refresh_token) {
                token.refresh_token = tokens.refresh_token;
            }
            token.access_token = tokens.access_token;
            token.expiry_date = tokens.expiry_date;
            fs.writeFile(TOKEN_PATH, JSON.stringify(token));
            console.log('Token updated and saved to file');
        });

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

    if (filename.startsWith('=?UTF-8?Q?')) {
        filename = filename.replace('=?UTF-8?Q?', '').replace('?=', '');
        filename = utf8.decode(quotedPrintable.decode(filename));
    }
    return filename.replace(/[/\\?%*:|"<>]/g, '-');
}

async function processNewEmails(connection) {
    try {
        await connection.openBox('INBOX');
        console.log('Opened INBOX');

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = {
            bodies: ['HEADER', 'TEXT', ''],
            markSeen: false,
            struct: true,
        };

        const messages = await connection.search(searchCriteria, fetchOptions);
        console.log(`Found ${messages.length} new messages`);

        for (const message of messages) {
            const uid = message.attributes.uid;
            const parts = imaps.getParts(message.attributes.struct);
            let processedSuccessfully = true;

            for (const part of parts) {
                if (part.disposition && part.disposition.type.toUpperCase() === 'ATTACHMENT') {
                    const filename = decodeFilename(part.disposition.params.filename);
                    const mimeType = part.type;
                    const extension = getFileExtension(filename);

                    if (isAllowedFileType(filename, mimeType)) {
                        console.log(`Allowed attachment detected: ${filename}, MIME Type: ${mimeType}, Extension: ${extension}`);
                        try {
                            const partData = await connection.getPartData(message, part);
                            await fs.mkdir(ATTACHMENT_DIR, { recursive: true });
                            const filePath = path.join(ATTACHMENT_DIR, filename);
                            await fs.writeFile(filePath, partData);
                            console.log('Attachment saved:', filename);
                        } catch (err) {
                            console.error('Error saving attachment:', filename, err);
                            processedSuccessfully = false;
                        }
                    } else {
                        console.log(`Skipped attachment with disallowed type: ${filename}, MIME Type: ${mimeType}, Extension: ${extension}`);
                    }
                }
            }

            if (processedSuccessfully) {
                try {
                    await markMessageAsSeen(connection, uid);
                    console.log(`Marked message ${uid} as seen`);
                } catch (err) {
                    console.error('Error marking message as seen:', err);
                }
            }
        }

        console.log('Finished processing all messages');
    } catch (error) {
        console.error('Error processing new emails:', error);
    }
}

async function markMessageAsSeen(connection, uid) {
    return new Promise((resolve, reject) => {
        connection.imap.addFlags(uid, '\\Seen', (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
async function startImapListener(auth) {
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
        onmail: async () => {
            console.log('New email received. Processing...');
            try {
                const connection = await imaps.connect(config);
                await processNewEmails(connection);
                await connection.end();
            } catch (error) {
                console.error('Error processing new email:', error);
            }
        },
    };

    try {
        const connection = await imaps.connect(config);
        console.log('Connected to IMAP server');

        // Initial scan of unseen messages
        await processNewEmails(connection);

        console.log('Listening for new emails...');

        // Keep the connection open to listen for new emails
        connection.imap.on('mail', config.onmail);
    } catch (err) {
        console.error('IMAP connection error:', err);
    }
}

main();