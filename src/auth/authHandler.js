const path = require('path');
const fs = require('fs').promises;
const {google} = require('googleapis');
const express = require('express');
const {createLogger} = require('../utils/logger');
const logger = createLogger(__filename);

const TOKEN_PATH = path.join(__dirname, '../../token.json');

const SCOPES = ['https://mail.google.com/'];
const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

let oAuth2Client;

async function ensureDirectoryExists(dirPath) {
    try {
        await fs.mkdir(dirPath, {recursive: true});
        logger.info(`Directory ${dirPath} has been created or already exists`);
    } catch (error) {
        logger.error(`Error creating directory ${dirPath}:`, error);
        throw error;
    }
}

async function saveToken(tokens) {
    try {
        await ensureDirectoryExists(path.dirname(TOKEN_PATH));
        await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
        logger.info(`Token saved to file: ${TOKEN_PATH}`);
    } catch (error) {
        logger.error(`Error saving token:`, error);
        throw error;
    }
}

async function authorize(credentials) {
    const {client_secret, client_id, redirect_uris} = credentials;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    logger.info(`Attempting to read token from file: ${TOKEN_PATH}`);

    try {
        const token = JSON.parse(await fs.readFile(TOKEN_PATH));
        oAuth2Client.setCredentials(token);

        logger.info(`Token read from file: ${TOKEN_PATH}`);
        logger.info(`Access token type: ${typeof token.access_token}`);
        logger.info(`Access token length: ${token.access_token.length}`);

        if (!token.refresh_token) {
            logger.warn('No refresh token. Starting process to obtain new token.');
            return getNewToken(oAuth2Client);
        }

        const isTokenValid = await validateToken(oAuth2Client);
        if (!isTokenValid) {
            logger.warn('Token is invalid. Starting process to obtain new token.');
            return getNewToken(oAuth2Client);
        }

        oAuth2Client.on('tokens', async (tokens) => {
            logger.info('Received new tokens');
            logger.info(`New access token type: ${typeof tokens.access_token}`);
            logger.info(`New access token length: ${tokens.access_token.length}`);
            await saveToken(tokens);
            logger.info(`Token refreshed. New expiry date: ${new Date(tokens.expiry_date).toLocaleString()}`);
        });

        // Start automatic token refresh
        setInterval(refreshTokenIfNeeded, REFRESH_INTERVAL);

        logger.info(`Authentication successful, used token from: ${TOKEN_PATH}`);
        return oAuth2Client;
    } catch (err) {
        logger.warn(`Existing token not found or invalid. Starting process to obtain new token.`);
        logger.error(`Error reading token from ${TOKEN_PATH}:`, err);
        return getNewToken(oAuth2Client);
    }
}

async function validateToken(auth) {
    try {
        await auth.getAccessToken();
        return true;
    } catch (error) {
        logger.error('Error validating token:', error);
        return false;
    }
}

async function refreshTokenIfNeeded() {
    try {
        if (oAuth2Client.isTokenExpiring()) {
            logger.info('Token is expiring, attempting to refresh...');
            const {credentials} = await oAuth2Client.refreshAccessToken();
            oAuth2Client.setCredentials(credentials);
            await saveToken(credentials);
            logger.info('Token refreshed successfully');
            logger.info(`Refreshed access token type: ${typeof credentials.access_token}`);
            logger.info(`Refreshed access token length: ${credentials.access_token.length}`);
        } else {
            logger.silly('Token still valid, refresh not necessary');
        }
        return true;
    } catch (error) {
        logger.error('Error refreshing token:', error);
        return false;
    }
}

function getNewToken(oAuth2Client) {
    return new Promise((resolve) => {
        const app = express();
        const port = 3000;

        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent'  // Force consent prompt, which should always return a refresh token
        });

        logger.info(`Server listening on port: ${port}`);
        logger.info('Application URL: ' + authUrl);
        logger.warn(`Open this URL in your browser to authorize the application: ${authUrl}`);

        app.get('/auth/google/callback', async (req, res) => {
            const {code} = req.query;
            try {
                const {tokens} = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);
                await saveToken(tokens);
                logger.info(`New token saved to file: ${TOKEN_PATH}`);
                logger.silly(`Full path to token file: ${path.resolve(TOKEN_PATH)}`);
                res.send('Authorization successful! You can close this tab.');
                resolve(oAuth2Client);
            } catch (err) {
                logger.error('Error getting token:', err);
                res.send('Error getting token. Please try again.');
                resolve(null);
            }
        });

        app.listen(port, () => {
            logger.info(`Server listening on port: ${port}`);
            logger.info('Application URL: ' + authUrl);
            logger.warn(`Open this URL in your browser to authorize the application: ${authUrl}`);
        });
    });
}

function buildXOAuth2Token(user, accessToken) {
    if (typeof user !== 'string' || typeof accessToken !== 'string') {
        logger.error(`Invalid input for buildXOAuth2Token. User: ${typeof user}, AccessToken: ${typeof accessToken}`);
        return ''; // Return empty string in case of invalid input
    }
    const authString = `user=${user}\x01auth=Bearer ${accessToken}\x01\x01`;
    const token = Buffer.from(authString).toString('base64');
    logger.info(`Generated XOAUTH2 token (first 10 characters): ${token.substring(0, 10)}...`);
    return token;
}

module.exports = {
    authorize,
    saveToken,
    getNewToken,
    buildXOAuth2Token,
    refreshTokenIfNeeded
};