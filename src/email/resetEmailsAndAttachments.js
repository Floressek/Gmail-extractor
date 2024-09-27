const imaps = require('imap-simple');
const fs = require('fs').promises;
const {EMAIL_ADDRESS, DATA_DIR} = require('../../config/constants');
const {createLogger} = require('../utils/logger');
const logger = createLogger(__filename);


async function resetEmailsAndAttachments(auth) {
    let connection = null;
    try {
        // Mark all messages as unread
        connection = await markAllAsUnseen(auth);

        // Remove directories with attachments
        await removeDirectory(DATA_DIR);

        logger.info('Reset completed successfully.');
    } catch (error) {
        logger.error('Error during reset:', error);
    } finally {
        if (connection) {
            try {
                await connection.end();
                logger.info('IMAP connection closed.');
            } catch (err) {
                logger.error('Error closing IMAP connection:', err);
            }
        }
    }
}

async function markAllAsUnseen(auth) {
    const xoauth2Token = buildXOAuth2Token(EMAIL_ADDRESS, auth.credentials.access_token);

    const config = {
        imap: {
            user: EMAIL_ADDRESS,
            xoauth2: xoauth2Token,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            authTimeout: 3000,
            tlsOptions: {rejectUnauthorized: false}
        }
    };

    try {
        const connection = await imaps.connect(config);
        logger.info('Connected to IMAP server');

        await connection.openBox('INBOX');
        logger.info('Opened INBOX');

        const results = await connection.search(['ALL'], {bodies: ['HEADER']});
        logger.info(`Found ${results.length} messages`);

        if (results.length === 0) {
            logger.info('No messages to mark as unseen');
            return connection;
        }

        for (const result of results) {
            await new Promise((resolve, reject) => {
                connection.imap.delFlags(result.attributes.uid, ['\\Seen'], (err) => {
                    if (err) {
                        logger.error(`Error marking message ${result.attributes.uid} as unseen:`, err);
                        reject(err);
                    } else {
                        logger.info(`Marked message ${result.attributes.uid} as unseen`);
                        resolve();
                    }
                });
            });
        }

        logger.info('All messages processed');
        return connection;
    } catch (error) {
        logger.error('Error in markAllAsUnseen:', error);
        return null;
    }
}

function buildXOAuth2Token(user, accessToken) {
    if (typeof user !== 'string' || typeof accessToken !== 'string') {
        logger.error(`Invalid input for buildXOAuth2Token. User: ${typeof user}, AccessToken: ${typeof accessToken}`);
        return ''; // Return empty string in case of invalid input
    }
    const authString = `user=${user}\x01auth=Bearer ${accessToken}\x01\x01`;
    return Buffer.from(authString).toString('base64');
}

async function removeDirectory(dirPath) {
    try {
        await fs.rm(dirPath, {recursive: true, force: true});
        logger.info(`Removed directory: ${dirPath}`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.error(`Error removing directory ${dirPath}:`, error);
        } else {
            logger.info(`Directory does not exist: ${dirPath}`);
        }
    }
}

module.exports = {resetEmailsAndAttachments};