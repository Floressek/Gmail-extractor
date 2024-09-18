const imaps = require('imap-simple');
const fs = require('fs').promises;
const path = require('path');
const { EMAIL_ADDRESS, ATTACHMENT_DIR, PROCESSED_DIR } = require('../../config/constants');
const logger = require('../utils/logger');


async function resetEmailsAndAttachments(auth) {
    try {
        // Oznacz wszystkie wiadomości jako nieprzeczytane
        await markAllAsUnseen(auth);

        // Usuń foldery z załącznikami
        await removeDirectory(ATTACHMENT_DIR);
        await removeDirectory(PROCESSED_DIR);

        logger.info('Reset completed successfully.');
    } catch (error) {
        logger.error('Error during reset:', error);
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
            tlsOptions: { rejectUnauthorized: false }
        }
    };

    try {
        const connection = await imaps.connect(config);
        logger.info('Connected to IMAP server');

        await connection.openBox('INBOX');
        logger.info('Opened INBOX');

        return new Promise((resolve, reject) => {
            connection.imap.search(['ALL'], (err, results) => {
                if (err) {
                    logger.error('Error searching messages:', err);
                    reject(err);
                    return;
                }

                logger.info(`Found ${results.length} messages`);

                if (results.length === 0) {
                    logger.info('No messages to mark as unseen');
                    resolve();
                    return;
                }

                const f = connection.imap.fetch(results, { bodies: ['HEADER'] });
                f.on('message', (msg) => {
                    msg.on('attributes', (attrs) => {
                        const uid = attrs.uid;
                        connection.imap.delFlags(uid, ['\\Seen'], (err) => {
                            if (err) {
                                logger.error(`Error marking message ${uid} as unseen:`, err);
                            } else {
                                logger.info(`Marked message ${uid} as unseen`);
                            }
                        });
                    });
                });
                f.once('error', (err) => {
                    logger.error('Fetch error:', err);
                    reject(err);
                });
                f.once('end', () => {
                    logger.info('All messages processed');
                    connection.imap.end();
                    resolve();
                });
            });
        });
    } catch (error) {
        logger.error('Error in markAllAsUnseen:', error);
        throw error;
    }
}

function buildXOAuth2Token(user, accessToken) {
    const authString = `user=${user}\x01auth=Bearer ${accessToken}\x01\x01`;
    return Buffer.from(authString).toString('base64');
}

async function removeDirectory(dirPath) {
    try {
        await fs.rm(dirPath, { recursive: true, force: true });
        logger.info(`Removed directory: ${dirPath}`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            logger.error(`Error removing directory ${dirPath}:`, error);
        } else {
            logger.info(`Directory does not exist: ${dirPath}`);
        }
    }
}

module.exports = { resetEmailsAndAttachments };