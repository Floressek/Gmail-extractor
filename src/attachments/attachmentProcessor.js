const fs = require('fs').promises;
const path = require('path');
const { processPDF } = require('./fileHandler/pdfHandler');
const { processWord } = require('./fileHandler/wordHandler');
const { processSpreadsheet } = require('./fileHandler/spreadsheetHandler');
const { processImage } = require('./fileHandler/imageHandler');
const { PROCESSED_DIR } = require('../../config/constants');
const logger = require('../utils/logger');


async function processAttachment(filePath, extension) {
    const fileName = path.basename(filePath);
    let processedContent = '';

    switch (extension.toLowerCase()) {
        case '.pdf':
            processedContent = await processPDF(filePath);
            break;
        case '.doc':
        case '.docx':
            processedContent = await processWord(filePath);
            break;
        case '.xls':
        case '.xlsx':
        case '.csv':
            processedContent = await processSpreadsheet(filePath);
            break;
        case '.png':
        case '.jpg':
        case '.jpeg':
            processedContent = await processImage(filePath);
            break;
        default:
            console.log(`Unsupported file format: ${extension}`);
            return;
    }

    const formatDir = extension.toLowerCase().replace('.', '');
    const destDir = path.join(PROCESSED_DIR, formatDir);
    await fs.mkdir(destDir, { recursive: true });

    const destFilePath = path.join(destDir, fileName);
    const processedFilePath = path.join(destDir, `${path.parse(fileName).name}_processed.txt`);

    await fs.copyFile(filePath, destFilePath);
    await fs.writeFile(processedFilePath, processedContent);

    logger.info(`Processed ${fileName} and saved results to ${processedFilePath}`);
}

module.exports = {
    processAttachment
};