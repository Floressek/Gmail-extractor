const fs = require("fs").promises;
const {authorize} = require("./src/auth/authHandler");
const {startImapListener} = require("./src/email/imapListener");
const {resetEmailsAndAttachments} = require("./src/email/resetEmailsAndAttachments");
const {createLogger} = require("./src/utils/logger");
const logger = createLogger(__filename);
const {createDataDirectories} = require("./src/utils/createDataDirectories");

async function main() {
    try {
        // Create necessary data directories
        await createDataDirectories();

        // Set up OAuth2 credentials
        const CREDENTIALS = {
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            redirect_uris: process.env.REDIRECT_URIS,
        };

        // Authorize the OAuth2 client
        const oAuth2Client = await authorize(CREDENTIALS);

        // Check if the --reset argument is present
        const shouldReset = process.argv.includes("--reset");

        if (shouldReset) {
            logger.info("Resetting emails and removing attachment folders...");
            await resetEmailsAndAttachments(oAuth2Client);
            logger.info("Reset completed.");
            process.exit(0); // Exit successfully after reset
        } else {
            // Normalny tryb pracy - nasłuchiwanie i przetwarzanie nowych e-maili
            await startImapListener(oAuth2Client);
        }
    } catch (error) {
        logger.error("An error occurred during execution:", error);
        process.exit(1); // Exit with error code
    }
}

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

main();
