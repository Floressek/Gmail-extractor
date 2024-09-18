const fs = require('fs').promises;
const { authorize } = require('./src/auth/authHandler');
const { startImapListener } = require('./src/email/imapListener');
const { resetEmailsAndAttachments } = require('./src/email/resetEmailsAndAttachments');
const { CREDENTIALS_PATH } = require('./config/constants');
const logger = require('./src/utils/logger');

async function main() {
    try {
        const content = await fs.readFile(CREDENTIALS_PATH);
        const oAuth2Client = await authorize(JSON.parse(content));

        // Sprawdź, czy argument --reset jest obecny
        const shouldReset = process.argv.includes('--reset');

        if (shouldReset) {
            logger.info('Resetting emails and removing attachment folders...');
            await resetEmailsAndAttachments(oAuth2Client);
            logger.info('Reset completed.');
        } else {
            // Normalny tryb pracy - nasłuchiwanie i przetwarzanie nowych e-maili
            await startImapListener(oAuth2Client);
        }
    } catch (error) {
        logger.error('Error occurred:', error);
    }
}

main();