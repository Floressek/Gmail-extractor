const z = require('zod');

// Schema for email attachments
const AttachmentSchema = z.object({
    filename: z.string(),
    processed: z.boolean()
});

// Schema for the main email data
const EmailDataSchema = z.object({
    subject: z.string(),
    body: z.string(),
    metadata: z.object({
        emailId: z.string(),
        content: z.object({
            subject: z.string(),
            body: z.string()
        }),
        attachments: z.array(AttachmentSchema)
    }),
    attachments: z.array(z.any()).optional()
});

// Schema for individual product details
const ProductSchema = z.object({
    // nameOfProduct: z.string().optional(),
    itemNumber: z.string().optional(),
    material: z.string().optional(),
    grade: z.string().optional(),
    surface: z.string().optional(),
    thickness: z.union([z.number(), z.array(z.number()).length(2)]).optional(),
    width: z.union([z.number(), z.array(z.number()).length(2)]).optional(),
    length: z.union([z.number(), z.array(z.number()).length(2)]).optional(),
    quantity: z.number().optional(),
    price: z.number().optional(),
    // price: z.union([z.number(), z.object({ net: z.number(), gross: z.number() })]).optional(),
    // netValue: z.number().optional(), // idk czy to chcecie czy nie, bo wiekszosc dokumentow nie ma tego podzialu
    // grossValue: z.number().optional(),
});

// Schema for the overall output structure
const OutputSchema = z.object({
    offerNumber: z.string().optional(),
    offerDate: z.string().optional(),
    customer: z.object({
        name: z.string().optional(),
        location: z.string().optional()
    }).optional(),
    supplier: z.object({
        name: z.string().optional(),
        contact: z.object({
            name: z.string().optional(),
            email: z.string().optional(),
            phone: z.string().optional()
        }).optional()
    }).optional(),
    offerDetails: z.object({
        currency: z.string().optional(),
        deliveryTerms: z.string().optional(),
        deliveryDate: z.string().optional(),
        paymentTerms: z.string().optional(),
        totalQuantity: z.number().optional(),
        periodOffered: z.string().optional()
    }).optional(),
    products: z.array(ProductSchema).optional()
});


module.exports = {
    EmailDataSchema,
    OutputSchema
};