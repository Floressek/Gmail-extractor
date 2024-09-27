const sharp = require("sharp");
const {fileOcr} = require("./ocr.js");
const {createLogger} = require("../../utils/logger");
const logger = createLogger(__filename);

async function processImage(filePath) {
    try {
        const metadata = await sharp(filePath).metadata();
        const ocrData = await fileOcr(filePath);

        let ocrContent = ocrData
            .map((item) => item.googleVisionText || "")
            .join("\n");

        const result = {
            metadata: metadata,
            ocrContent: ocrContent
        };

        logger.info(`Successfully processed image: ${filePath}`);
        return JSON.stringify(result, null, 2);
    } catch (error) {
        // Log the error instead of throwing it to prevent container shutdown
        logger.error("Error processing image:", error);
    }
}

module.exports = {
    processImage,
};
