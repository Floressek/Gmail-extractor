const imaps = require('imap-simple');
const {processNewEmails, processEmail} = require('./emailProcessor');
const {buildXOAuth2Token, refreshTokenIfNeeded} = require('../auth/authHandler');
const {EMAIL_ADDRESS} = require('../../config/constants');
const {saveToken} = require('../auth/authHandler.js');
const {createLogger} = require('../utils/logger');
const logger = createLogger(__filename);

async function startImapListener(auth) {
    const getAccessToken = async () => {
        await refreshTokenIfNeeded();
        return auth.credentials.access_token;
    };

    const startConnection = async () => {
        const accessToken = await getAccessToken();

        if (!accessToken) {
            logger.error('Failed to obtain access token. Aborting connection attempt.');
            return;
        }

        const xoauth2Token = buildXOAuth2Token(EMAIL_ADDRESS, accessToken);
        logger.info(`Generated XOAUTH2 token (first 10 characters): ${xoauth2Token.substring(0, 10)}...`);

        const config = {
            imap: {
                user: EMAIL_ADDRESS,
                xoauth2: xoauth2Token,
                host: 'imap.gmail.com',
                port: 993,
                tls: true,
                tlsOptions: {rejectUnauthorized: false},
                authTimeout: 30000,
            },
            onmail: async () => {
                logger.info('New email received. Processing...');
                try {
                    const connection = await imaps.connect(config);
                    await processNewEmail(connection);
                    await connection.end();
                } catch (error) {
                    logger.error('Error processing new email:', error);
                }
            },
        };

        try {
            logger.info(`Attempting to connect to IMAP using address: ${EMAIL_ADDRESS}`);
            const connection = await imaps.connect(config);
            logger.info('Connected to IMAP server');

            await processNewEmails(connection);

            logger.info('Listening for new emails...');
            connection.imap.on('mail', config.onmail);

            connection.imap.on('error', (err) => {
                logger.error('IMAP connection error:', err);
                setTimeout(() => startImapListener(auth), 60000);
            });
        } catch (err) {
            logger.error('Error during IMAP connection attempt:', err);
            setTimeout(() => startImapListener(auth), 60000);
        }
    };

    await startConnection();

    // Update the IMAP connection when tokens are refreshed
    auth.on('tokens', async (tokens) => {
        logger.info('Received new tokens');
        await saveToken(tokens);
        await startConnection();
    });
}

async function processNewEmail(connection) {
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
            try {
                await processEmail(connection, message);
            } catch (error) {
                logger.error('Error processing message:', error);
            }
        }

        logger.info('Finished processing new messages');
    } catch (error) {
        logger.error('Error in processNewEmail:', error);
    }
}

module.exports = {
    startImapListener
};