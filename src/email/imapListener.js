const imaps = require('imap-simple');
const { processNewEmails } = require('./emailProcessor');
const { buildXOAuth2Token } = require('../auth/authHandler');
const { EMAIL_ADDRESS } = require('../../config/constants');
const logger = require('../utils/logger');

async function startImapListener(auth) {
    const getAccessToken = async () => {
        if (auth.isTokenExpiring()) {
            await auth.refreshAccessToken();
            logger.info('Token refreshed');
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
            logger.info('New email received. Processing...');
            try {
                const connection = await imaps.connect(config);
                await processNewEmails(connection);
                await connection.end();
            } catch (error) {
                logger.error('Error processing new email:', error);
            }
        },
    };

    try {
        const connection = await imaps.connect(config);
        logger.info('Connected to IMAP server');

        // Initial scan of unseen messages
        await processNewEmails(connection);

        logger.info('Listening for new emails...');

        // Keep the connection open to listen for new emails
        connection.imap.on('mail', config.onmail);
    } catch (err) {
        logger.error('IMAP connection error:', err);
    }
}

module.exports = {
    startImapListener
};