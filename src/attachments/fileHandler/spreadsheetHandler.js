const xlsx = require('xlsx');

async function processSpreadsheet(filePath) {
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        return `Spreadsheet Data:\n${JSON.stringify(data, null, 2)}`;
    } catch (error) {
        console.error('Error processing spreadsheet:', error);
        return `Error processing spreadsheet: ${error.message}`;
    }
}

module.exports = {
    processSpreadsheet
};