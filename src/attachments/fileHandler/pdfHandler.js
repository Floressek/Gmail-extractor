const fs = require('fs').promises;
const { PDFExtract } = require('pdf.js-extract');
const pdfExtract = new PDFExtract();

async function processPDF(filePath) {
    try {
        const data = await pdfExtract.extract(filePath, {});
        let result = `PDF Content:\n\n`;
        result += `Number of pages: ${data.pages.length}\n\n`;

        for (let i = 0; i < data.pages.length; i++) {
            const page = data.pages[i];
            result += `Page ${i + 1}:\n`;

            const tables = extractTables(page.content);
            if (tables.length > 0) {
                result += `Tables found on page ${i + 1}:\n`;
                tables.forEach((table, index) => {
                    result += `Table ${index + 1}:\n${formatTable(table)}\n\n`;
                });
            } else {
                result += `No tables found on this page.\n`;
            }

            result += `Text content:\n${extractTextContent(page.content)}\n\n`;
        }

        return result;
    } catch (error) {
        console.error('Error processing PDF:', error);
        return `Error processing PDF: ${error.message}`;
    }
}

function extractTables(content) {
    const tables = [];
    let currentTable = [];
    let lastY = null;
    let inTable = false;

    content.sort((a, b) => a.y - b.y || a.x - b.x);

    content.forEach(item => {
        if (lastY === null || Math.abs(item.y - lastY) > 5) {
            if (inTable) {
                if (currentTable.length > 1) {  // Uznajemy za tabelę, jeśli ma więcej niż jeden wiersz
                    tables.push(currentTable);
                }
                currentTable = [];
            }
            inTable = isLikelyTableRow(content, item);
        }

        if (inTable) {
            if (!currentTable[currentTable.length - 1] || Math.abs(item.y - lastY) > 2) {
                currentTable.push([]);
            }
            currentTable[currentTable.length - 1].push(item.str);
        }

        lastY = item.y;
    });

    if (inTable && currentTable.length > 1) {
        tables.push(currentTable);
    }

    return tables;
}

function isLikelyTableRow(content, item) {
    const sameYItems = content.filter(i => Math.abs(i.y - item.y) < 2);
    return sameYItems.length >= 3;  // Uznajemy za wiersz tabeli, jeśli ma co najmniej 3 elementy w tej samej linii
}

function formatTable(table) {
    return table.map(row => row.join(' | ')).join('\n');
}

function extractTextContent(content) {
    return content
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map(item => item.str)
        .join(' ');
}

module.exports = { processPDF };