const fs = require('fs').promises;
const path = require('path');
const {processPDF} = require('./fileHandler/pdfHandler');
const {processWord} = require('./fileHandler/wordHandler');
const {processSpreadsheet} = require('./fileHandler/spreadsheetHandler');
const {processImage} = require('./fileHandler/imageHandler');
const {PROCESSED_DIR} = require('../../config/constants');
const {createLogger} = require('../utils/logger');
const logger = createLogger(__filename);


const fileProcessors = {
    '.pdf': processPDF,
    '.doc': processWord,
    '.docx': processWord,
    '.xls': processSpreadsheet,
    '.xlsx': processSpreadsheet,
    '.csv': processSpreadsheet,
    '.png': processImage,
    '.jpg': processImage,
    '.jpeg': processImage
};

async function processAttachment(filePath, extension) {
    const fileName = path.basename(filePath);
    const emailDir = path.dirname(filePath);
    let processedContent = '';

    const processor = fileProcessors[extension.toLowerCase()];

    if (!processor) {
        logger.warn(`Unsupported file format: ${extension}`);
        return null;
    }

    try {
        const processedContent = await processor(filePath);

        const processedFilePath = path.join(emailDir, `${path.parse(fileName).name}_processed.json`);
        await fs.writeFile(processedFilePath, processedContent);

        logger.info(`Processed ${fileName} and saved results to ${processedFilePath}`);
        return processedFilePath;
    } catch (error) {
        logger.error(`Error processing ${fileName}:`, error);
        return JSON.stringify({error: `Failed to process ${fileName}: ${error.message}`}, null, 2);
    }
}

module.exports = {
    processAttachment
};
