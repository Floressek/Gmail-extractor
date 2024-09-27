const fs = require('fs').promises;
const path = require('path');
const {PROCESSED_DIR} = require('../../config/constants');
const {createLogger} = require('../utils/logger');
const logger = createLogger(__filename);


async function combineEmailData(emailDir) {
    try {
        // Check if processing_complete flag exists
        const processingCompletePath = path.join(emailDir, 'processing_complete');
        try {
            await fs.access(processingCompletePath);
        } catch (err) {
            logger.warn(`Processing not complete for ${emailDir}, skipping combination.`);
            return;
        }

        const combinedData = {};

        // Read 'email_subject.txt'
        try {
            const subjectPath = path.join(emailDir, 'email_subject.txt');
            combinedData.subject = await fs.readFile(subjectPath, 'utf8');
        } catch (err) {
            logger.warn(`Subject file not found in ${emailDir}:`, err);
        }

        // Read 'email_body.txt'
        try {
            const bodyPath = path.join(emailDir, 'email_body.txt');
            combinedData.body = await fs.readFile(bodyPath, 'utf8');
        } catch (err) {
            logger.warn(`Body file not found in ${emailDir}:`, err);
        }

        // Read 'metadata.json'
        try {
            const metadataPath = path.join(emailDir, 'metadata.json');
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            combinedData.metadata = JSON.parse(metadataContent);
        } catch (err) {
            logger.warn(`Metadata file not found or invalid in ${emailDir}:`, err);
        }

        // Read any '*processed.json' files (e.g., attachments)
        const filesInDir = await fs.readdir(emailDir);
        const processedJsonFiles = filesInDir.filter(file => file.endsWith('processed.json'));

        combinedData.attachments = [];

        for (const processedFile of processedJsonFiles) {
            const processedFilePath = path.join(emailDir, processedFile);
            try {
                const processedContent = await fs.readFile(processedFilePath, 'utf8');
                const processedData = JSON.parse(processedContent);
                combinedData.attachments.push(processedData);
            } catch (err) {
                logger.warn(`Error reading processed attachment ${processedFile} in ${emailDir}:`, err);
            }
        }

        // Save combined data to 'all_{emailId}.json'
        const emailId = path.basename(emailDir).replace('email_', '');
        const allJsonPath = path.join(emailDir, `all_${emailId}.json`);
        await fs.writeFile(allJsonPath, JSON.stringify(combinedData, null, 2), 'utf8');

        logger.info(`Combined data saved to ${allJsonPath}`);
    } catch (err) {
        logger.error('Error combining email data:', err);
    }
}

module.exports = {
    combineEmailData
};
