const fs = require('fs').promises;
const path = require('path');
const imaps = require('imap-simple');
const { processAttachment } = require('../attachments/attachmentProcessor');
const { decodeFilename, isAllowedFileType, getFileExtension } = require('../utils/fileUtils');
const { ATTACHMENT_DIR, PROCESSED_DIR } = require('../../config/constants');

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

            // Process attachments
            for (const part of parts) {
                if (part.disposition && part.disposition.type.toUpperCase() === 'ATTACHMENT') {
                    const filename = decodeFilename(part.disposition.params.filename);
                    const mimeType = part.type;
                    const extension = getFileExtension(filename);

                    if (isAllowedFileType(filename, mimeType)) {
                        console.log(`Processing attachment: ${filename}`);
                        try {
                            const partData = await connection.getPartData(message, part);
                            await fs.mkdir(ATTACHMENT_DIR, { recursive: true });
                            const filePath = path.join(ATTACHMENT_DIR, filename);
                            await fs.writeFile(filePath, partData);
                            console.log('Attachment saved:', filename);

                            await processAttachment(filePath, extension);
                        } catch (err) {
                            console.error('Error processing attachment:', filename, err);
                            processedSuccessfully = false;
                        }
                    } else {
                        console.log(`Skipped disallowed attachment: ${filename}`);
                    }
                }
            }

            // Process email content
            const emailContent = await getEmailContent(connection, message);
            await processEmailContent(emailContent);

            if (processedSuccessfully) {
                try {
                    await markMessageAsSeen(connection.imap, uid);
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
        connection.addFlags(uid, ['\\Seen'], (err) => {
            if (err) {
                console.error('Error marking message as seen:', err);
                reject(err);
            } else {
                console.log(`Marked message ${uid} as seen`);
                resolve();
            }
        });
    });
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

async function processEmailContent(content) {
    const emailDir = path.join(PROCESSED_DIR, 'emails');
    await fs.mkdir(emailDir, { recursive: true });
    const emailFilePath = path.join(emailDir, `email_${Date.now()}.txt`);
    await fs.writeFile(emailFilePath, content);
    console.log(`Email content saved to ${emailFilePath}`);
}

module.exports = {
    processNewEmails,
};