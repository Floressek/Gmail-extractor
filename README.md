# Gmail Extractor

This project is an automated system for processing email attachments from a Gmail account. It downloads attachments, processes them based on their file type, and saves the processed data in a structured format.

## Table of Contents
1. [Project Structure](#project-structure)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Usage](#usage)
5. [File Processing](#file-processing)
6. [Contributing](#contributing)
7. [License](#license)

## Project Structure

```
gmail-extractor/
│
├── config/
│   └── constants.js
│
├── logs/
│
├── node_modules/
│
├── src/
│   ├── attachments/
│   │   ├── fileHandler/
│   │   │   ├── imageHandler.js
│   │   │   ├── pdfHandler.js
│   │   │   ├── spreadsheetHandler.js
│   │   │   └── wordHandler.js
│   │   └── attachmentProcessor.js
│   │
│   ├── auth/
│   │   └── authHandler.js
│   │
│   ├── email/
│   │   ├── emailProcessor.js
│   │   ├── imapListener.js
│   │   └── resetEmailsAndAttachments.js
│   │
│   └── utils/
│       ├── fileUtils.js
│       └── logger.js
│
├── .env
├── .gitignore
├── credentials.json
├── index.js
├── package.json
├── package-lock.json
├── README.md
├── token.json
└── yarn.lock
```

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/gmail-extractor.git
   ```

2. Install dependencies:
   ```
   npm install
   ```
   or if you're using Yarn:
   ```
   yarn install
   ```

3. Set up your Gmail account for IMAP access and obtain OAuth2 credentials.

4. Create a `.env` file based on the existing `.env` file in the root directory.

## Configuration

### Environment Variables

Ensure your `.env` file in the root directory contains the necessary configuration:

```
EMAIL_ADDRESS=your.email@gmail.com
ATTACHMENT_DIR=attachments
PROCESSED_DIR=processed_attachments
```

### Credentials

You need to obtain OAuth2 credentials from the Google Cloud Console. The `credentials.json` file should be in the root directory and structured as follows:

```json
{
  "web": {
    "client_id": "YOUR_CLIENT_ID",
    "project_id": "YOUR_PROJECT_ID",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uris": ["http://localhost:3000/auth/google/callback"]
  }
}
```

## Usage

To start the Gmail extractor:

```
npm start
```

On first run, you'll be prompted to authorize the application. Follow the URL provided in the console to complete the OAuth2 flow.

## File Processing

The system processes the following file types:
- PDF: Handled by `pdfHandler.js`
- Word (.doc, .docx): Handled by `wordHandler.js`
- Excel (.xls, .xlsx), CSV: Handled by `spreadsheetHandler.js`
- Images (.png, .jpg, .jpeg): Handled by `imageHandler.js`

Processed files and their extracted data are managed by the `attachmentProcessor.js`.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
