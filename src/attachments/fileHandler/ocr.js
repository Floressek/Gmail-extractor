const vision = require("@google-cloud/vision");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const {convertPdfToImages} = require("../../utils/convertPdfToImage.js");
const {deleteFile} = require("../../utils/deleteFile.js");
const {createLogger} = require("../../utils/logger");
const logger = createLogger(__filename);
const {DATA_DIR} = require("../../../config/constants");
dotenv.config();

const VISION_AUTH = {
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handling the private key newline issue
    },
    fallback: true,  // Force use of REST API instead of gRPC
};

async function pdfOCR(pdfFilePath) {
    const inputPdfFolder = path.join(DATA_DIR, "attachments");
    const imagesFolder = path.join(DATA_DIR, "images");
    const outputTextFolder = path.join(DATA_DIR, "processed_attachments/pdf");
    const fileBaseName = path.basename(pdfFilePath, ".pdf");

    [inputPdfFolder, imagesFolder, outputTextFolder].forEach((folder) => {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, {recursive: true});
        }
    });

    try {
        const imageFilePaths = await convertPdfToImages(pdfFilePath, imagesFolder);
        logger.info(`🖼️ Converted PDF to images: ${imageFilePaths.join(", ")}`);

        if (imageFilePaths.length === 0) {
            logger.error("No images were generated from the PDF");
            return [];
        }

        const allResults = [];
        for (const imageFilePath of imageFilePaths) {
            const ocrResults = await fileOcr(imageFilePath, outputTextFolder);
            allResults.push(...ocrResults); // Append each image's OCR result
        }

        // Concatenate all OCR results into a single string
        const concatenatedResults = allResults
            .map((result) => result.googleVisionText)
            .join("\n");

        // Save the concatenated OCR result to a single text file
        const savePdfData = (folder, text) => {
            const fileNameWithoutExt = path.basename(pdfFilePath, ".pdf");
            const textPath = path.join(folder, `${fileNameWithoutExt}.txt`);
            fs.writeFileSync(textPath, text, "utf8");
        };

        savePdfData(outputTextFolder, concatenatedResults);

        logger.info(` 💚 Successfully processed and saved the OCR results for ${pdfFilePath}`);

        // Delete the image files after processing
        for (const imageFilePath of imageFilePaths) {
            logger.warn(`Deleting temporary image: ${imageFilePath}`);
            await deleteFile(imageFilePath); // Ensure you await the deletion process
        }

        return concatenatedResults;
    } catch (err) {
        logger.error(`Error processing ${pdfFilePath}:`, err);
        return ""; // Return an empty string instead of undefined to prevent container shutdown
    }
}

async function fileOcr(imageFilePath) {
    const client = new vision.ImageAnnotatorClient(VISION_AUTH);
    const results = [];

    logger.info(` 🕶️ Processing image with Google Vision: ${imageFilePath}`);
    try {
        const [result] = await client.documentTextDetection(imageFilePath);

        // Getting text from the image
        let googleVisionText = "";
        if (result.fullTextAnnotation) {
            googleVisionText = result.fullTextAnnotation.text + "\n";
            results.push({googleVisionText});
        }

        logger.info(` 💚 Successfully processed image ${imageFilePath}`);
    } catch (err) {
        logger.error(`Error during Google Vision OCR processing: ${err.message}`);
        // Instead of throwing an error, we'll just log it and continue
    }

    return results;
}

module.exports = {pdfOCR, fileOcr};
