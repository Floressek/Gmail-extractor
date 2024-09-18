const fs = require('fs').promises;
const {google} = require('googleapis');
const express = require('express');

const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'token.json';
const SCOPES = ['https://mail.google.com/'];

let oAuth2Client;

async function authorize(credentials) {
    const {client_secret, client_id, redirect_uris} = credentials.web;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    try {
        const token = JSON.parse(await fs.readFile(TOKEN_PATH));
        oAuth2Client.setCredentials(token);

        oAuth2Client.on('tokens', (tokens) => {
            if (tokens.refresh_token) {
                token.refresh_token = tokens.refresh_token;
            }
            token.access_token = tokens.access_token;
            token.expiry_date = tokens.expiry_date;
            fs.writeFile(TOKEN_PATH, JSON.stringify(token));
            console.log('Token updated and saved to file');
        });

        if (oAuth2Client.isTokenExpiring()) {
            await oAuth2Client.refreshAccessToken();
            console.log('Token refreshed');
        }

        return oAuth2Client;
    } catch (err) {
        return getNewToken(oAuth2Client);
    }
}

function getNewToken(oAuth2Client) {
    return new Promise((resolve, reject) => {
        const app = express();
        const port = 3000;

        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });

        app.get('/auth/google/callback', async (req, res) => {
            const {code} = req.query;
            try {
                const {tokens} = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);
                await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
                console.log('Token saved to file:', TOKEN_PATH);
                res.send('Authorization completed successfully! You can close this tab.');
                resolve(oAuth2Client);
            } catch (err) {
                console.error('Error fetching token:', err);
                res.send('Error fetching token.');
                reject(err);
            }
        });

        app.listen(port, () => {
            console.log(`Server listening at http://localhost:${port}`);
            console.log('Open this URL in your browser to authorize the app:', authUrl);
        });
    });
}

function buildXOAuth2Token(user, accessToken) {
    const authString = `user=${user}\x01auth=Bearer ${accessToken}\x01\x01`;
    return Buffer.from(authString).toString('base64');
}

module.exports = {
    authorize,
    getNewToken,
    buildXOAuth2Token
};