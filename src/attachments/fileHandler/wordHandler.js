const mammoth = require('mammoth');

async function processWord(filePath) {
    try {
        const result = await mammoth.extractRawText({path: filePath});
        return `Word Document Content:\n${result.value}`;
    } catch (error) {
        console.error('Error processing Word document:', error);
        return `Error processing Word document: ${error.message}`;
    }
}

module.exports = {
    processWord
};