const {OpenAI} = require('openai');
const {zodToJsonSchema} = require('zod-to-json-schema');
const {EmailDataSchema, OutputSchema} = require('./emailDataSchema');
const fs = require('fs').promises;
const path = require('path');
const {createLogger}  = require('../utils/logger');
const logger = createLogger(__filename);

async function processOfferData(emailDir) {
    const emailId = path.basename(emailDir).replace('email_', '');
    const allJsonPath = path.join(emailDir, `all_${emailId}.json`);

    try {
        logger.debug(`Processing offer data for email ${emailId}`);
        const rawData = await fs.readFile(allJsonPath, 'utf8');
        const jsonData = JSON.parse(rawData);

        // Validate input data using Zod schema
        const validatedData = EmailDataSchema.parse(jsonData);

        const client = new OpenAI();

        // Convert Zod schema to JSON Schema
        const jsonSchema = zodToJsonSchema(OutputSchema, {
            topRef: false,      // Prevent top-level $ref
            definitions: false  // Do not include definitions
        });

        // Manually construct response_format
        const responseFormat = {
            type: 'json_schema',
            json_schema: {
                name: 'offerSummary', // Required by OpenAI
                schema: jsonSchema    // The fully expanded JSON schema
            }
        };

        // // Optional: Log the response_format for debugging
        // logger.debug(JSON.stringify(responseFormat, null, 2));

        const completion = await client.beta.chat.completions.parse({
            model: "gpt-4o-2024-08-06",
            messages: [
                {
                    role: "system",
                    content: `Jesteś asystentem specjalizującym się w analizie ofert handlowych i tworzeniu strukturyzowanych podsumowań. Obecna data to 24 września 2024.
        
        Przestrzegaj następujących zasad przy tworzeniu podsumowania:
        1. Używaj tylko informacji explicite podanych w danych wejściowych.
        2. Dla brakujących danych:
           - Używaj null dla brakujących liczb (np. quantity: null gdy nie podano ilości).
           - Używaj undefined dla brakujących stringów.
        3. Nie przenoś danych między polami - każde pole wypełniaj tylko danymi dla niego przeznaczonymi.
        4. Dla zakresów liczbowych (np. długość, grubość):
           - Użyj tablicy dwuelementowej [min, max] jeśli podano zakres np. min. 280 - max 300.
           - Użyj pojedynczej liczby, jeśli podano tylko jedną wartość np. 1240.
        5. Upewnij się, że wszystkie dane numeryczne są zapisane jako liczby, nie stringi.
        6. Jeżeli nie możesz łatwo znaleźć dostawcy, spróbuj znaleźć go z domenie mailowej.
        7. Dla pól produktów:
           - nameOfProduct: nazwa produktu (np. "Blacha stalowa")
           - material: rodzaj materiału (ta informacja często występuje przy kluczu 'Commodity' np. "stal zimnowalcowana")
           - thickness: grubość w mm
           - width: szerokość w mm
           - grade: gatunek stali (np. "HC220")
           - metalCoating: rodzaj powłoki metalicznej (jeśli podano)
           - paintCoating: rodzaj powłoki lakierniczej (jeśli podano)
           - manufacturer: producent (jeśli podano)
           - price: cena danego produktu (jeśli podano).
           - quantity: ilość (jesli podano, nie mieszaj z innymi polami)
        8. Dla szczegółów oferty (offerDetails):
           - currency: waluta oferty
           - deliveryTerms: warunki dostawy (np. CIP Gdańsk, DDP Płock)
           - deliveryDate: termin dostawy (np. Sept/Oct, )
           - paymentTerms: termin płatności (np. "net cash. 60 days date of invoice")
        9. Nie dodawaj żadnych informacji, których nie ma w danych wejściowych - lepiej zostawić pole puste niż zgadywać.`
                },
                {
                    role: "user",
                    content: `Przeanalizuj poniższe dane oferty i utwórz podsumowanie:
        
        Temat e-maila: ${validatedData.subject}
        Treść e-maila: ${validatedData.body}
        Załączniki: ${validatedData.metadata.attachments.map(att => att.filename).join(', ')}
        
        Dane z załączników (jeśli dostępne):
        ${JSON.stringify(validatedData.attachments || [], null, 2)}
        
        Utwórz strukturyzowane podsumowanie oferty zgodnie z podanym schematem, uwzględniając wszystkie dostępne informacje.`
                }
            ],
            response_format: responseFormat, // Use manually constructed response_format
        });

        // Log token usage
        const tokenUsage = completion.usage;
        logger.warn(`Used ${tokenUsage.total_tokens} tokens. (Prompts: ${tokenUsage.prompt_tokens}, Response: ${tokenUsage.completion_tokens})`);

        const message = completion.choices[0]?.message;
        if (message?.parsed) {
            // Additional data cleaning and validation
            const cleanedData = cleanAndValidateData(message.parsed);

            // Save processed data
            const processedDataPath = path.join(emailDir, `processed_offer_${emailId}.json`);
            await fs.writeFile(processedDataPath, JSON.stringify(cleanedData, null, 2));

            logger.debug(`Processed offer data saved to ${processedDataPath}`);
            return cleanedData;
        } else {
            logger.error('Unexpected response from OpenAI API:', message.refusal);
            return null; // Return null instead of throwing an error
        }
    } catch (error) {
        logger.error(`Error processing offer data: ${error.message}`);
        return null; // Return null instead of throwing an error
    }
}


function cleanAndValidateData(data) {
    const cleanValue = (value) => {
        if (Array.isArray(value)) {
            return value.map(cleanValue);
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed === '' ? undefined : trimmed;
        }
        if (typeof value === 'number') {
            return isNaN(value) ? null : value;
        }
        return value;
    };

    const cleanObject = (obj) => {
        if (Array.isArray(obj)) {
            return obj.map(cleanObject);
        }
        if (obj && typeof obj === 'object') {
            const cleaned = {};
            for (const [key, value] of Object.entries(obj)) {
                cleaned[key] = cleanObject(value);
            }
            return cleaned;
        }
        return cleanValue(obj);
    };

    return cleanObject(data);
}


module.exports = {
    processOfferData
};