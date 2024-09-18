const fs = require('fs').promises;
const { authorize } = require('./src/auth/authHandler');
const { startImapListener } = require('./src/email/imapListener');
const { CREDENTIALS_PATH } = require('./config/constants');

async function main() {
    try {
        const content = await fs.readFile(CREDENTIALS_PATH);
        const oAuth2Client = await authorize(JSON.parse(content));
        await startImapListener(oAuth2Client);
    } catch (error) {
        console.error('Error occurred:', error);
    }
}

main();