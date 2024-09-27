const {google} = require("googleapis");
const dotenv = require("dotenv");
const fs = require("fs").promises;
const path = require("path");
const {createLogger} = require("../utils/logger");
const logger = createLogger(__filename);
dotenv.config();

const GOOGLE_SHEETS_ACCOUNT = JSON.parse(process.env.GOOGLE_SHEETS_ACCOUNT);
const {SPREADSHEET_ID, TEMPLATE_SHEET_ID} = process.env;

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

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
            return null;
        }
    }

    return sheetName;
}

async function retryOperation(operation, retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY) {
    try {
        return await operation();
    } catch (error) {
        if (retries > 0 && (error.code === 502 || error.message.includes("502"))) {
            logger.warn(`Encountered error 502. Retrying in ${delay}ms. Retries left: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryOperation(operation, retries - 1, delay * 2);
        }
        return { error };  // Zwracamy obiekt z błędem zamiast rzucać wyjątek
    }
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
        const sheetNameResult = await retryOperation(() => createUniqueSheetName(sheets, baseSheetName));

        if (sheetNameResult.error) {
            logger.error(`Failed to create unique sheet name for email ${emailId}: ${sheetNameResult.error.message}`);
            return;  // Kończymy przetwarzanie tego e-maila, ale nie przerywamy całego procesu
        }

        const sheetName = sheetNameResult;

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

        const duplicateResult = await retryOperation(() => sheets.spreadsheets.batchUpdate(duplicateRequest));

        if (duplicateResult.error) {
            logger.error(`Failed to duplicate sheet for email ${emailId}: ${duplicateResult.error.message}`);
            return;
        }

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

        const updateResult = await retryOperation(() => sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A2`,
            valueInputOption: "RAW",
            resource,
        }));

        if (updateResult.error) {
            logger.error(`Failed to update sheet values for email ${emailId}: ${updateResult.error.message}`);
            return;
        }

        logger.info(`Sheet "${sheetName}" created and data inserted successfully for email ${emailId}.`);
    } catch (error) {
        logger.error(
            `Error processing data for email ${emailId}: ${error.message}`
        );
        logger.debug(`Error stack: ${error.stack}`);
    }
}

module.exports = {
    createSheetAndInsertData,
};
