const fs = require('fs').promises;
const pdf = require('pdf-parse');

const options = {
    pagerender: function pagerender(pageData) {
        return "";
    }
};

async function processPDF(filePath) {
    try {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);
        return `PDF Content:\n${data.text}`;
    } catch (error) {
        console.error('Error processing PDF:', error);
        return `Error processing PDF: ${error.message}`;
    }
}

module.exports = {
    processPDF
};