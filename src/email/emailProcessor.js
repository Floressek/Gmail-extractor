const fs = require('fs').promises;
const path = require('path');
const imaps = require('imap-simple');
const { processAttachment } = require('../attachments/attachmentProcessor');
const { decodeFilename, isAllowedFileType, getFileExtension } = require('../utils/fileUtils');
const { ATTACHMENT_DIR, PROCESSED_DIR } = require('../../config/constants');
const logger = require('../utils/logger');

async function processNewEmails(connection) {
    try {
        await connection.openBox('INBOX');
        logger.info('Opened INBOX');

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = {
            bodies: ['HEADER', 'TEXT', ''],
            markSeen: false,
            struct: true,
        };

        const messages = await connection.search(searchCriteria, fetchOptions);
        logger.info(`Found ${messages.length} new messages`);

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
                        logger.info(`Processing attachment: ${filename}`);
                        try {
                            const partData = await connection.getPartData(message, part);
                            await fs.mkdir(ATTACHMENT_DIR, { recursive: true });
                            const filePath = path.join(ATTACHMENT_DIR, filename);
                            await fs.writeFile(filePath, partData);
                            logger.info('Attachment saved:', filename);

                            await processAttachment(filePath, extension);
                        } catch (err) {
                            logger.error('Error processing attachment:', filename, err);
                            processedSuccessfully = false;
                        }
                    } else {
                        logger.warn(`Skipped disallowed attachment: ${filename}`);
                    }
                }
            }

            // Process email content
            const emailContent = await getEmailContent(connection, message);
            await processEmailContent(emailContent);

            if (processedSuccessfully) {
                try {
                    await markMessageAsSeen(connection.imap, uid);
                    logger.info(`Marked message ${uid} as seen`);
                } catch (err) {
                    logger.error('Error marking message as seen:', err);
                }
            }
        }

        logger.info('Finished processing all messages');
    } catch (error) {
        logger.error('Error processing new emails:', error);
    }
}

async function markMessageAsSeen(connection, uid) {
    return new Promise((resolve, reject) => {
        connection.addFlags(uid, ['\\Seen'], (err) => {
            if (err) {
                logger.error('Error marking message as seen:', err);
                reject(err);
            } else {
                logger.info(`Marked message ${uid} as seen`);
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
    logger.info(`Email content saved to ${emailFilePath}`);
}

module.exports = {
    processNewEmails,
};