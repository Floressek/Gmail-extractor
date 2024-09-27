const fs = require("fs").promises;
const {createLogger} = require('../utils/logger');
const logger = createLogger(__filename);

async function deleteFile(filePath) {
    try {
        await fs.access(filePath);
        await fs.unlink(filePath);
        logger.info('File deleted', { filePath });
    } catch (err) {
        if (err.code === 'ENOENT') {
            logger.warn(`File not found: ${filePath}`);
        } else {
            logger.error(`Error deleting file ${filePath}:`, err);
        }
    }
}

module.exports = {deleteFile};
