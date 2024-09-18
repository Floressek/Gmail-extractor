const imaps = require('imap-simple');
const { processNewEmails } = require('./emailProcessor');
const { buildXOAuth2Token } = require('../auth/authHandler');
const { EMAIL_ADDRESS } = require('../../config/constants');

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

module.exports = {
    startImapListener
};