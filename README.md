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

3. # Gmail Extractor

## Configuration

### Environment Variables

1. Copy the `.env.example` file to `.env`:
   ```
   cp .env.example .env
   ```

2. Edit the `.env` file and fill in your specific details:
   - `EMAIL_ADDRESS`: Your Gmail address
   - `EMAIL_PASSWORD`: Your app password or OAuth token (see Gmail security settings)
   - `ATTACHMENT_DIR` and `PROCESSED_DIR`: Customize if needed
   - `CLIENT_ID` and `CLIENT_SECRET`: From your Google Cloud Console project
   - `REDIRECT_URI`: Should match one of the authorized redirect URIs in your Google Cloud Console project
   - Adjust other settings as needed

### Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Enable the Gmail API for your project.
4. Go to "Credentials" and create an OAuth 2.0 Client ID.
5. Set up the OAuth consent screen if prompted.
6. For "Application type", choose "Web application".
7. Add `http://localhost:3000/auth/google/callback` to the "Authorized redirect URIs".
8. After creating, you'll see your Client ID and Client Secret.

### Credentials File

1. Create a `credentials.json` file in the root directory of the project.
2. Use the following template, replacing the placeholders with your actual credentials:

```json
{
  "web": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "project_id": "your-project-name",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uris": ["http://localhost:3000/auth/google/callback"]
  }
}
```

Replace `YOUR_CLIENT_ID` and `YOUR_CLIENT_SECRET` with the values from your Google Cloud Console project.

### Gmail Account Settings

1. Enable IMAP in your Gmail settings.
2. If not using OAuth, create an App Password:
   - Go to your Google Account settings.
   - Select "Security".
   - Under "Signing in to Google," select "App Passwords".
   - Generate a new App Password for "Mail" and "Other (Custom name)".
   - Use this password in your `.env` file instead of your regular Gmail password.

After configuring these files and settings, your Gmail Extractor should be ready to authenticate and access your Gmail account.

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
