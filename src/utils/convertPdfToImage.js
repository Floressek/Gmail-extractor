const {Poppler} = require("node-poppler");
const path = require("path");
const fs = require("fs").promises;
const {replacePolishCharacters} = require("./fileUtils.js");
const {createLogger} = require('../utils/logger');
const logger = createLogger(__filename);

async function convertPdfToImages(pdfFilePath, saveFolder) {
    const {default: camelcase} = await import("camelcase");
    logger.info(`Starting conversion of PDF: ${pdfFilePath}`);
    const poppler = new Poppler();
    const outputPrefix = replacePolishCharacters(
        path.basename(pdfFilePath, path.extname(pdfFilePath))
    );
    const outputFilePath = path.join(saveFolder, `${outputPrefix}`);
    const pdfInfo = {};

    try {
        await fs.mkdir(saveFolder, {recursive: true});

        logger.info(`Getting PDF info for: ${pdfFilePath}`);
        const ret = await poppler.pdfInfo(pdfFilePath);

        ret.split('\n').map(r => r.split(': ')).forEach(r => {
            if (r.length > 1) {
                pdfInfo[camelcase(r[0])] = r[1].trim();
            }
        });

        logger.info(`PDF info: ${JSON.stringify(pdfInfo)}`);

        const options = {
            firstPageToConvert: 1,
            lastPageToConvert: parseInt(pdfInfo.pages),
            pngFile: true,
        };

        logger.info(`Converting PDF to images with options: ${JSON.stringify(options)}`);
        await poppler.pdfToCairo(pdfFilePath, outputFilePath, options);

        const imagePaths = [];
        for (let i = options.firstPageToConvert; i <= options.lastPageToConvert; i++) {
            const imagePathWithoutLeadingZero = `${outputFilePath}-${i}.png`;
            const imagePathWithLeadingZero = `${outputFilePath}-${i.toString().padStart(2, '0')}.png`;

            try {
                await fs.access(imagePathWithoutLeadingZero);
                imagePaths.push(imagePathWithoutLeadingZero);
            } catch {
                try {
                    await fs.access(imagePathWithLeadingZero);
                    imagePaths.push(imagePathWithLeadingZero);
                } catch {
                    logger.warn(`Expected image file not found: ${imagePathWithoutLeadingZero} or ${imagePathWithLeadingZero}`);
                }
            }
        }

        logger.info(`Converted PDF to ${imagePaths.length} images`);
        return imagePaths;
    } catch (err) {
        logger.error("Error converting PDF to image:", err);
        return []; // Return an empty array instead of throwing an error
    }
}

module.exports = {convertPdfToImages};
