/**
 * One-time OAuth2 authentication script for Google Search Console API.
 * Run this once to generate gsc-token.json, which is used by gsc-keywords.mjs.
 *
 * Usage: node scripts/gsc-auth.mjs
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { URL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = path.join(__dirname, 'gsc-credentials.json');
const TOKEN_PATH = path.join(__dirname, 'gsc-token.json');
const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];
const PORT = 3456;

if (!fs.existsSync(CREDENTIALS_PATH)) {
  console.error(`Missing credentials file at: ${CREDENTIALS_PATH}`);
  console.error('Download it from Google Cloud Console → APIs & Services → Credentials');
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
const { client_id, client_secret } = credentials.installed;

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  `http://localhost:${PORT}`
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent', // force refresh_token to be returned
});

console.log('\nOpening browser for Google authorisation...');
console.log('If it does not open automatically, visit this URL:\n');
console.log(authUrl);
console.log('\nWaiting for authorisation...\n');

// Open browser
const { exec } = await import('child_process');
exec(`open "${authUrl}"`);

// Start a local server to catch the OAuth redirect
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const code = reqUrl.searchParams.get('code');
  const error = reqUrl.searchParams.get('error');

  if (error) {
    res.writeHead(400);
    res.end(`<h2>Authorisation failed: ${error}</h2><p>You can close this tab.</p>`);
    server.close();
    console.error(`Authorisation failed: ${error}`);
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400);
    res.end('<h2>No authorisation code received.</h2>');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Authorisation successful!</h2><p>You can close this tab and return to your terminal.</p>');
    server.close();

    console.log('Authorisation successful!');
    console.log(`Token saved to: ${TOKEN_PATH}`);
    console.log('\nYou can now run: node scripts/gsc-keywords.mjs\n');
    process.exit(0);
  } catch (err) {
    res.writeHead(500);
    res.end(`<h2>Error exchanging token: ${err.message}</h2>`);
    server.close();
    console.error('Token exchange failed:', err.message);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  // Server is ready, waiting for redirect
});
