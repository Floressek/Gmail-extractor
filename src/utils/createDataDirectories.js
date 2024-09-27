const {createLogger} = require('../utils/logger');
const logger = createLogger(__filename);
const {DATA_DIR, PROCESSED_DIR, TEMP_DIR} = require("../../config/constants");
const fs = require("fs").promises;

async function createDataDirectories() {
    const directories = [DATA_DIR, PROCESSED_DIR, TEMP_DIR];

    for (const dir of directories) {
        try {
            await fs.mkdir(dir, { recursive: true });
            logger.info(`Directory created or verified: ${dir}`);
        } catch (err) {
            logger.error(`Error creating directory ${dir}:`, err);
            // Instead of throwing, we'll continue to the next directory
        }
    }

    logger.info("Finished creating/verifying data directories.");
}

module.exports = {
    createDataDirectories,
};