const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const {google} = require('googleapis');
const imaps = require('imap-simple');
const quotedPrintable = require('quoted-printable');
const utf8 = require('utf8');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const sharp = require('sharp');

const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'token.json';
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS || 'ardiumvpn@gmail.com';
const ATTACHMENT_DIR = 'attachments';

const SCOPES = ['https://mail.google.com/'];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg'];
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

const PROCESSED_DIR = 'processed_attachments';

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

        if (oAuth2Client.isTokenExpiring()) {
            await oAuth2Client.refreshAccessToken();
            console.log('Token refreshed');
        }

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
                            await fs.mkdir(ATTACHMENT_DIR, {recursive: true});
                            const filePath = path.join(ATTACHMENT_DIR, filename);
                            await fs.writeFile(filePath, partData);
                            console.log('Attachment saved:', filename);

                            // Process the attachment
                            await processAttachment(filePath, extension);
                        } catch (err) {
                            console.error('Error saving or processing attachment:', filename, err);
                            processedSuccessfully = false;
                        }
                    } else {
                        console.log(`Skipped attachment with disallowed type: ${filename}, MIME Type: ${mimeType}, Extension: ${extension}`);
                    }
                }
            }

            // Process email content
            const emailContent = await getEmailContent(connection, message);
            await processEmailContent(emailContent);

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
    const getAccessToken = async () => {
        if (auth.isTokenExpiring()) {
            await auth.refreshAccessToken();
            console.log('Token refreshed');
        }
        return auth.credentials.access_token;
    };

    const accessToken = await getAccessToken();
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
            authTimeout: 30000,
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

async function processAttachment(filePath, extension) {
    const fileName = path.basename(filePath);
    let processedContent = '';


    switch (extension.toLowerCase()) {
        case '.pdf':
            processedContent = await processPDF(filePath);
            break;
        case '.doc':
        case '.docx':
            processedContent = await processWord(filePath);
            break;
        case '.xls':
        case '.xlsx':
        case '.csv':
            processedContent = await processSpreadsheet(filePath);
            break;
        case '.png':
        case '.jpg':
        case '.jpeg':
            processedContent = await processImage(filePath);
            break;
        default:
            console.log(`Unsupported file format: ${extension}`);
            return;
    }

    const formatDir = extension.toLowerCase().replace('.', '');
    const destDir = path.join(PROCESSED_DIR, formatDir);
    await fs.mkdir(destDir, {recursive: true});

    const destFilePath = path.join(destDir, fileName);
    const processedFilePath = path.join(destDir, `${path.parse(fileName).name}_processed.txt`);

    await fs.copyFile(filePath, destFilePath);
    await fs.writeFile(processedFilePath, processedContent);
    // await fs.unlink(filePath); // Remove the original file from the attachments directory

    console.log(`Processed ${fileName} and saved results to ${processedFilePath}`);
}

async function processPDF(filePath) {
    try {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);
        return `PDF Content:\n${data.text}`;
    } catch (error) {
        console.error('Error processing PDF:', error);
        return `Error processing PDF: ${error.message}`;
    }
}

async function processWord(filePath) {
    try {
        const result = await mammoth.extractRawText({path: filePath});
        return `Word Document Content:\n${result.value}`;
    } catch (error) {
        console.error('Error processing Word document:', error);
        return `Error processing Word document: ${error.message}`;
    }
}

async function processSpreadsheet(filePath) {
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        return `Spreadsheet Data:\n${JSON.stringify(data, null, 2)}`;
    } catch (error) {
        console.error('Error processing spreadsheet:', error);
        return `Error processing spreadsheet: ${error.message}`;
    }
}

async function processImage(filePath) {
    try {
        const metadata = await sharp(filePath).metadata();
        return `Image Metadata:\n${JSON.stringify(metadata, null, 2)}`;
    } catch (error) {
        console.error('Error processing image:', error);
        return `Error processing image: ${error.message}`;
    }
}

async function processEmailContent(content) {
    const emailDir = path.join(PROCESSED_DIR, 'emails');
    await fs.mkdir(emailDir, {recursive: true});
    const emailFilePath = path.join(emailDir, `email_${Date.now()}.txt`);
    await fs.writeFile(emailFilePath, content);
    console.log(`Email content saved to ${emailFilePath}`);
}


async function getEmailContent(connection, message) {
    const parts = imaps.getParts(message.attributes.struct);
    const textParts = parts.filter(part => part.type === 'text' && part.subtype === 'plain');

    if (textParts.length > 0) {
        const partData = await connection.getPartData(message, textParts[0]);
        return partData.toString();
    }

    return '';
}

main();