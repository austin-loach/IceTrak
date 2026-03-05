const jwt = require('jsonwebtoken');
const axios = require('axios');
const qs = require('qs');

const YAHOO_TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const isExpired = decoded.tokenExpiry && Date.now() > decoded.tokenExpiry - 5 * 60 * 1000;

    if (isExpired && decoded.yahooRefreshToken) {
      try {
        const credentials = Buffer.from(
          `${process.env.YAHOO_CLIENT_ID}:${process.env.YAHOO_CLIENT_SECRET}`
        ).toString('base64');

        const response = await axios.post(
          YAHOO_TOKEN_URL,
          qs.stringify({ grant_type: 'refresh_token', refresh_token: decoded.yahooRefreshToken }),
          {
            headers: {
              Authorization: `Basic ${credentials}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        decoded.yahooAccessToken = response.data.access_token;
        decoded.tokenExpiry = Date.now() + response.data.expires_in * 1000;
        if (response.data.refresh_token) decoded.yahooRefreshToken = response.data.refresh_token;

        // Mint a new JWT and send it back so the app can save it
        const newToken = jwt.sign(decoded, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.setHeader('X-New-Token', newToken);
      } catch (refreshErr) {
        console.error('[Token Refresh Error]', refreshErr.message);
        return res.status(401).json({ error: 'Token refresh failed' });
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authMiddleware };