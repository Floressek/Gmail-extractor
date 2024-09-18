const path = require('path');
const quotedPrintable = require('quoted-printable');
const utf8 = require('utf8');
const { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } = require('../../config/constants');

function getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
}

function isAllowedFileType(filename, mimeType) {
    const extension = getFileExtension(filename);
    return ALLOWED_EXTENSIONS.includes(extension) || ALLOWED_MIME_TYPES.includes(mimeType);
}

let unnamedCounter = 0;

function decodeFilename(filename) {
    if (!filename) {
        unnamedCounter++;
        return `unnamed_attachment_${unnamedCounter}`;
    }

    if (filename.startsWith('=?UTF-8?Q?')) {
        filename = filename.replace('=?UTF-8?Q?', '').replace('?=', '');
        filename = utf8.decode(quotedPrintable.decode(filename));
    }
    return filename.replace(/[/\\?%*:|"<>]/g, '-');
}

module.exports = {
    getFileExtension,
    isAllowedFileType,
    decodeFilename
};