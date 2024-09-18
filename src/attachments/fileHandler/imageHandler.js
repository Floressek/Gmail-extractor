const sharp = require('sharp');

async function processImage(filePath) {
    try {
        const metadata = await sharp(filePath).metadata();
        return `Image Metadata:\n${JSON.stringify(metadata, null, 2)}`;
    } catch (error) {
        console.error('Error processing image:', error);
        return `Error processing image: ${error.message}`;
    }
}

module.exports = {
    processImage
};