const fs = require('fs').promises;
const path = require('path');
const imaps = require('imap-simple');
const {processAttachment} = require('../attachments/attachmentProcessor');
const {decodeFilename, isAllowedFileType, getFileExtension} = require('../utils/fileUtils');
const {PROCESSED_DIR} = require('../../config/constants');
const {createLogger} = require('../utils/logger');
const logger = createLogger(__filename);
const util = require('util');
const {simpleParser} = require('mailparser');
const {combineEmailData} = require("../utils/combineEmailData");
const {processOfferData} = require("../zod-json/emailDataProcessor");
const {z} = require("zod");
const {Worker, isMainThread, parentPort, workerData} = require('worker_threads');
const {createSheetAndInsertData} = require("../google-sheets/google-sheets-api");

const MAX_WORKERS = parseInt(process.env.MAX_WORKERS) || 2;
const workerPool = new Set();


async function processEmail(connection, message) {
    const {uid} = message.attributes;
    const emailId = Date.now();
    const emailDir = path.join(PROCESSED_DIR, 'combined', `email_${emailId}`);

    logger.info(`Starting to process email ${emailId}`, {uid});

    try {
        // Make sure the directory exists
        await fs.mkdir(emailDir, {recursive: true});
        logger.info(`Created directory for email ${emailId}`, {uid});

        // Get email content
        logger.info(`Getting email content for email ${emailId}`, {uid});
        const emailContent = await getEmailContent(message);
        logger.info(`Got email content for email ${emailId}`, {uid});

        // Save email content
        logger.info(`Saving email content for email ${emailId}`);
        await saveEmailContent(emailContent, emailDir);
        logger.info(`Saved email content for email ${emailId}`);

        //Process attachments
        logger.info(`Processing attachments for email ${emailId}`);
        const attachmentResults = await processEmailAttachments(connection, message, emailDir);
        logger.info(`Processed attachments for email ${emailId}`);

        // Create metadata file
        logger.info(`Creating metadata for email ${emailId}`);
        await createMetadataFile(emailDir, emailContent, attachmentResults);
        logger.info(`Created metadata for email ${emailId}`);

        // Wait for all attachments to be processed
        await Promise.all(attachmentResults.map(result => result.processPromise));

        // Create a flag file to indicate initial email processing is complete
        await fs.writeFile(path.join(emailDir, 'processing_complete'), '');
        logger.info(`Created processing complete flag for email ${emailId}`);

        // Combine email data into a single JSON file
        logger.info(`Combining email data for email ${emailId}`);
        await combineEmailData(emailDir);
        logger.info(`Combined email data for email ${emailId}`);

        // Create a flag file to indicate all data is present and combined
        await fs.writeFile(path.join(emailDir, 'all_present'), '');
        logger.info(`Created all present flag for email ${emailId}`);

        await markMessageAsSeen(connection.imap, uid);
        logger.info(`Marked message ${uid} as seen`);

        startWorker(emailDir, emailId);
    } catch (error) {
        logger.error(`Error processing email ${emailId}:`, error);
    }
}

function startWorker(emailDir, emailId) {
    if (workerPool.size >= MAX_WORKERS) {
        setTimeout(() => startWorker(emailDir, emailId), 1000);
        return;
    }

    const worker = new Worker(__filename, {
        workerData: {emailDir, emailId}
    });

    workerPool.add(worker);

    worker.on('message', (msg) => {
        if (msg === 'done') {
            workerPool.delete(worker);
        }
    });

    worker.on('error', (err) => {
        logger.error(`Worker error for email ${emailId}:`, err);
        workerPool.delete(worker);
    });

    worker.on('exit', (code) => {
        if (code !== 0) {
            logger.error(`Worker stopped with exit code ${code} for email ${emailId}`);
        } else {
            logger.info(`Worker completed processing for email ${emailId}`);
        }
        workerPool.delete(worker);
    });

    logger.info(`Worker started for email ${emailId}`);
}

// Task for worker threads
if (!isMainThread) {
    const {emailDir, emailId} = workerData;

    async function processEmailWorker() {
        try {
            await waitForFile(path.join(emailDir, 'processing_complete'));
            await waitForFile(path.join(emailDir, 'all_present'));
            logger.info(`Processing offer data for email ${emailId}`);
            await processOfferData(emailDir);
            logger.info(`Processed email ${emailId}`);
            parentPort.postMessage('done');

            await createSheetAndInsertData(emailDir);
            logger.info(`Inserted data to Google Sheets for email ${emailId}`);
        } catch (error) {
            logger.error(`Error processing email ${emailId} in worker:`, error);
        }
    }

    processEmailWorker();
}

async function waitForFile(filePath, timeout = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            await fs.access(filePath);
            return;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw new Error('Timeout waiting for file');
}


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

        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            logger.info(`Processing message ${i + 1} of ${messages.length}`);
            try {
                await processEmail(connection, message);
            } catch (error) {
                logger.error(`Error processing message ${i + 1}:`, error);
                // Continue processing next messages
            }
        }

        logger.info('Finished processing all messages');
    } catch (error) {
        logger.error('Error in processNewEmails:', error);
    }
}

async function getEmailContent(message) {
    const {uid} = message.attributes;
    logger.debug('Fetching message', {uid});

    try {
        // Find the part that contains the full email content
        const all = message.parts.find(part => part.which === '');
        const rawEmail = all.body;
        logger.debug('Raw email data retrieved', {uid});

        logger.debug('Starting email parsing', {uid});
        const parsedMail = await simpleParser(rawEmail);

        logger.debug('Email parsing completed', {
            subject: parsedMail.subject,
            bodyLength: parsedMail.text ? parsedMail.text.length : 0,
            uid
        });

        return {
            subject: parsedMail.subject,
            body: parsedMail.text
        };
    } catch (err) {
        logger.error('Error fetching or parsing email', {error: err, uid});
        return { subject: 'Error', body: 'Failed to parse email' };
    }
}


async function saveEmailContent(emailContent, emailDir) {
    const subjectFilePath = path.join(emailDir, 'email_subject.txt');
    const bodyFilePath = path.join(emailDir, 'email_body.txt');

    await fs.writeFile(subjectFilePath, emailContent.subject, {encoding: 'utf8'});
    await fs.writeFile(bodyFilePath, emailContent.body, {encoding: 'utf8'});

    logger.info(`Email subject saved to ${subjectFilePath}`);
    logger.info(`Email body saved to ${bodyFilePath}`);
}

async function processEmailAttachments(connection, message, emailDir) {
    const parts = imaps.getParts(message.attributes.struct);
    const attachmentResults = [];

    for (const part of parts) {
        if (part.disposition && part.disposition.type.toUpperCase() === 'ATTACHMENT') {
            const filename = decodeFilename(part.disposition.params.filename);
            const mimeType = part.type;
            const extension = getFileExtension(filename);

            if (isAllowedFileType(filename, mimeType)) {
                try {
                    const partData = await connection.getPartData(message, part);
                    const filePath = path.join(emailDir, filename);
                    await fs.writeFile(filePath, partData);

                    const processPromise = processAttachment(filePath, extension).then(processedFilePath => {
                        logger.info(`Processed attachment: ${filename}`);
                        return {filename, originalPath: filePath, processedPath: processedFilePath};
                    }).catch(err => {
                        logger.error(`Error processing attachment ${filename}:`, err);
                        return {filename, originalPath: filePath, error: err.message};
                    });

                    attachmentResults.push({filename, processPromise});
                } catch (err) {
                    logger.error('Error saving attachment:', filename, err);
                }
            } else {
                logger.warn(`Skipped disallowed attachment: ${filename}`);
            }
        }
    }

    return attachmentResults;
}

async function createMetadataFile(emailDir, emailContent, attachmentResults) {
    const metadata = {
        emailId: path.basename(emailDir).replace('email_', ''),
        content: emailContent,
        attachments: attachmentResults.map(att => ({
            filename: att.filename,
            processed: true
        }))
    };

    const metadataPath = path.join(emailDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    logger.info(`Metadata saved to ${metadataPath}`);
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

if (isMainThread) {
    module.exports = {
        processNewEmails,
        processEmail,
    };
}