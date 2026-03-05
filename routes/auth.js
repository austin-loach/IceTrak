const express = require('express');
const router = express.Router();
const axios = require('axios');
const qs = require('qs');
const jwt = require('jsonwebtoken');
const { refreshYahooToken } = require('../services/yahooService');

const YAHOO_AUTH_URL = 'https://api.login.yahoo.com/oauth2/request_auth';
const YAHOO_TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';

// ─── Step 1: Redirect user to Yahoo OAuth ─────────────────────────────────────
// GET /auth/yahoo
router.get('/yahoo', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.YAHOO_CLIENT_ID,
    redirect_uri: process.env.YAHOO_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid fspt-r',
  });
  res.redirect(`${YAHOO_AUTH_URL}?${params.toString()}`);
});

// ─── Step 2: Yahoo redirects here with auth code ──────────────────────────────
// GET /auth/yahoo/callback
router.get('/yahoo/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect(`icetrak://auth/error?message=${encodeURIComponent('Yahoo authorization denied')}`);
  }

  try {
    const credentials = Buffer.from(
      `${process.env.YAHOO_CLIENT_ID}:${process.env.YAHOO_CLIENT_SECRET}`
    ).toString('base64');

    const tokenResponse = await axios.post(
      YAHOO_TOKEN_URL,
      qs.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.YAHOO_REDIRECT_URI,
      }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in, xoauth_yahoo_guid } = tokenResponse.data;

    // Mint our own JWT containing the Yahoo tokens
    const appToken = jwt.sign(
      {
        userId: xoauth_yahoo_guid,
        yahooAccessToken: access_token,
        yahooRefreshToken: refresh_token,
        tokenExpiry: Date.now() + expires_in * 1000,
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Deep-link back into the app
    res.redirect(`icetrak://auth/success?token=${appToken}`);
  } catch (err) {
    console.error('[Yahoo OAuth Error]', err.response?.data || err.message);
    res.redirect(`icetrak://auth/error?message=${encodeURIComponent('Token exchange failed')}`);
  }
});

// ─── Refresh Yahoo access token ───────────────────────────────────────────────
// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });

  try {
    const data = await refreshYahooToken(refreshToken);
    const appToken = jwt.sign(
      {
        userId: data.userId,
        yahooAccessToken: data.access_token,
        yahooRefreshToken: data.refresh_token || refreshToken,
        tokenExpiry: Date.now() + data.expires_in * 1000,
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token: appToken });
  } catch (err) {
    res.status(401).json({ error: 'Failed to refresh token' });
  }
});

// ─── Manual league key login ──────────────────────────────────────────────────
// POST /auth/manual
router.post('/manual', async (req, res) => {
  const { leagueKey } = req.body;
  if (!leagueKey) return res.status(400).json({ error: 'leagueKey is required' });

  // For manual mode, we create a limited token without Yahoo OAuth
  // The user won't be able to set lineup/make trades, but can view data
  const appToken = jwt.sign(
    { userId: `manual_${leagueKey}`, leagueKey, isManual: true },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token: appToken, isManual: true });
});

module.exports = router;
