const {google} = require("googleapis");
const dotenv = require("dotenv");
const fs = require("fs").promises;
const path = require("path");
const {createLogger} = require("../utils/logger");
const logger = createLogger(__filename);
dotenv.config();

const GOOGLE_SHEETS_ACCOUNT = JSON.parse(process.env.GOOGLE_SHEETS_ACCOUNT);
const {SPREADSHEET_ID, TEMPLATE_SHEET_ID} = process.env;

async function createUniqueSheetName(sheets, baseName) {
    let sheetName = baseName || "New Sheet";
    let counter = 1;
    let isUnique = false;

    while (!isUnique) {
        try {
            const existingSheets = await sheets.spreadsheets.get({
                spreadsheetId: SPREADSHEET_ID,
                fields: "sheets.properties.title",
            });

            const existingNames = existingSheets.data.sheets.map(
                (sheet) => sheet.properties.title
            );

            if (!existingNames.includes(sheetName)) {
                isUnique = true;
            } else {
                sheetName = `${baseName || "New Sheet"} - Copy ${counter}`;
                counter++;
            }
        } catch (error) {
            logger.error(`Error fetching existing sheet names: ${error.message}`);
            throw error;
        }
    }

    return sheetName;
}

async function createSheetAndInsertData(emailDir) {
    const emailId = path.basename(emailDir).replace("email_", "");
    const processedDataPath = path.join(
        emailDir,
        `processed_offer_${emailId}.json`
    );

    try {
        const rawData = await fs.readFile(processedDataPath, "utf8");
        const processedData = JSON.parse(rawData);

        logger.debug(`Processing data for email ${emailId}`);

        const auth = new google.auth.GoogleAuth({
            credentials: GOOGLE_SHEETS_ACCOUNT,
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const sheets = google.sheets({version: "v4", auth});

        const baseSheetName = processedData.supplier?.name || "New Offer";
        const sheetName = await createUniqueSheetName(sheets, baseSheetName);

        const duplicateRequest = {
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [
                    {
                        duplicateSheet: {
                            sourceSheetId: TEMPLATE_SHEET_ID,
                            insertSheetIndex: 1,
                            newSheetName: sheetName,
                        },
                    },
                ],
            },
        };

        await sheets.spreadsheets.batchUpdate(duplicateRequest);

        const values = [
            [
                processedData.supplier?.name || "N/A",
                processedData.offerDetails?.currency || "N/A",
                processedData.offerDetails?.deliveryTerms || "N/A",
                processedData.offerDetails?.deliveryDate || "N/A",
                processedData.offerDetails?.paymentTerms || "N/A",
            ],
            [],
            [],
            [],
            [],
            [],
        ];

        if (processedData.products && Array.isArray(processedData.products)) {
            processedData.products.forEach((product) => {
                values.push([
                    product.material || "N/A",
                    product.thickness || "N/A",
                    product.width || "N/A",
                    product.grade || "N/A",
                    product.surface || "N/A",
                    "N/A", // Paint coating - not in JSON
                    "N/A", // Manufacturer - not in JSON
                    product.price || "N/A",
                ]);
            });
        } else {
            logger.warn(`No product data found for email ${emailId}`);
        }

        const resource = {values};

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A2`,
            valueInputOption: "RAW",
            resource,
        });

        logger.info(`Sheet "${sheetName}" created and data inserted successfully for email ${emailId}.`);
    } catch (error) {
        logger.error(
            `Error creating sheet and inserting data for email ${emailId}: ${error.message}`
        );
        logger.debug(`Error stack: ${error.stack}`);
    }
}

module.exports = {
    createSheetAndInsertData,
};
