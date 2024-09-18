const fs = require('fs').promises;
const pdf = require('pdf-parse');
const { extractTables } = require('pdf-table-extractor'); // Załóżmy, że używamy tej biblioteki do ekstrakcji tabel

async function processPDF(filePath) {
    try {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer, {
            // Opcje pdf-parse dla lepszej ekstrakcji
            pagerender: renderPage,
            max: 0, // 0 = nieograniczona liczba stron
            version: 'v2.0.550'
        });

        let result = `PDF Content:\n\n`;
        result += `Title: ${data.info.Title || 'N/A'}\n`;
        result += `Author: ${data.info.Author || 'N/A'}\n`;
        result += `Number of pages: ${data.numpages}\n\n`;
        result += `Text content:\n${data.text}\n\n`;

        // Tutaj możesz dodać więcej logiki do analizy i strukturyzacji tekstu

        return result;
    } catch (error) {
        console.error('Error processing PDF:', error);
        return `Error processing PDF: ${error.message}`;
    }
}

function renderPage(pageData) {
    let render_options = {
        normalizeWhitespace: false,
        disableCombineTextItems: false
    };

    return pageData.getTextContent(render_options)
        .then(function(textContent) {
            let lastY, text = '';
            for (let item of textContent.items) {
                if (lastY === item.transform[5] || !lastY){
                    text += item.str;
                }
                else{
                    text += '\n' + item.str;
                }
                lastY = item.transform[5];
            }
            return text;
        });
}

module.exports = { processPDF };