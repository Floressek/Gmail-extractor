const mammoth = require('mammoth');
const {createLogger} = require("../../utils/logger");
const logger = createLogger(__filename);

async function processWord(filePath) {
    try {
        // Extract raw text from the Word document
        const result = await mammoth.extractRawText({path: filePath});

        logger.info(`Successfully processed Word document: ${filePath}`);

        // Return the content as a JSON object
        return JSON.stringify({
            content: result.value,
            warnings: result.warnings
        }, null, 2);
    } catch (error) {
        logger.error('Error processing Word document:', error);

        // Return error message as JSON
        return JSON.stringify({
            error: `Error processing Word document: ${error.message}`
        }, null, 2);
    }
}

module.exports = {
    processWord
};