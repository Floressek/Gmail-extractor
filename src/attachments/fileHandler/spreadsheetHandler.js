const xlsx = require('xlsx');
const {createLogger} = require("../../utils/logger");
const logger = createLogger(__filename);

async function processSpreadsheet(filePath) {
    try {
        // Read the spreadsheet file
        const workbook = xlsx.readFile(filePath);

        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert sheet to JSON
        const data = xlsx.utils.sheet_to_json(sheet);

        logger.info(`Successfully processed spreadsheet: ${filePath}`);
        return JSON.stringify(data, null, 2);
    } catch (error) {
        logger.error('Error processing spreadsheet:', error);
        // Return error message as JSON
        return JSON.stringify({error: `Error processing spreadsheet: ${error.message}`}, null, 2);
    }
}

module.exports = {
    processSpreadsheet
};