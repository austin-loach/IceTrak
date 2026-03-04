const express = require('express');
const router = express.Router();
const yahooService = require('../services/yahooService');

// Helper to extract Yahoo access token from JWT payload
const getToken = (req) => req.user.yahooAccessToken;

// GET /api/yahoo/leagues
router.get('/leagues', async (req, res, next) => {
  try {
    const leagues = await yahooService.getUserLeagues(getToken(req));
    res.json({ leagues });
  } catch (err) { next(err); }
});

// GET /api/yahoo/league/:leagueKey
router.get('/league/:leagueKey', async (req, res, next) => {
  try {
    const league = await yahooService.getLeague(getToken(req), req.params.leagueKey);
    res.json({ league });
  } catch (err) { next(err); }
});

// GET /api/yahoo/league/:leagueKey/standings
router.get('/league/:leagueKey/standings', async (req, res, next) => {
  try {
    const standings = await yahooService.getLeagueStandings(getToken(req), req.params.leagueKey);
    res.json({ standings });
  } catch (err) { next(err); }
});

// GET /api/yahoo/league/:leagueKey/scoreboard
router.get('/league/:leagueKey/scoreboard', async (req, res, next) => {
  try {
    const scoreboard = await yahooService.getScoreboard(getToken(req), req.params.leagueKey);
    res.json({ scoreboard });
  } catch (err) { next(err); }
});

// GET /api/yahoo/team/:teamKey/roster
router.get('/team/:teamKey/roster', async (req, res, next) => {
  try {
    const roster = await yahooService.getTeamRoster(getToken(req), req.params.teamKey);
    res.json({ roster });
  } catch (err) { next(err); }
});

// GET /api/yahoo/league/:leagueKey/waiver?position=C&count=25
router.get('/league/:leagueKey/waiver', async (req, res, next) => {
  try {
    const { position, count } = req.query;
    const players = await yahooService.getAvailablePlayers(
      getToken(req),
      req.params.leagueKey,
      position,
      parseInt(count) || 25
    );
    res.json({ players });
  } catch (err) { next(err); }
});

// POST /api/yahoo/league/:leagueKey/trade-analyze
// Body: { givingPlayerKeys: [...], receivingPlayerKeys: [...] }
router.post('/league/:leagueKey/trade-analyze', async (req, res, next) => {
  try {
    const { givingPlayerKeys, receivingPlayerKeys } = req.body;
    const allKeys = [...(givingPlayerKeys || []), ...(receivingPlayerKeys || [])];
    if (!allKeys.length) return res.status(400).json({ error: 'Player keys required' });

    const players = await yahooService.getPlayersForTrade(
      getToken(req),
      req.params.leagueKey,
      allKeys
    );

    const giving = players.filter((p) => givingPlayerKeys.includes(p.playerKey));
    const receiving = players.filter((p) => receivingPlayerKeys.includes(p.playerKey));

    // Simple value score calculation based on fantasy points + ownership %
    const score = (group) =>
      group.reduce((sum, p) => sum + (parseFloat(p.fantasyPoints) || 0), 0);

    const givingScore = score(giving);
    const receivingScore = score(receiving);
    const diff = receivingScore - givingScore;

    let verdict = 'Even';
    if (diff > 15) verdict = 'Win';
    else if (diff > 5) verdict = 'Slight Win';
    else if (diff < -15) verdict = 'Loss';
    else if (diff < -5) verdict = 'Slight Loss';

    res.json({
      giving,
      receiving,
      givingScore: Math.round(givingScore * 10) / 10,
      receivingScore: Math.round(receivingScore * 10) / 10,
      diff: Math.round(diff * 10) / 10,
      verdict,
    });
  } catch (err) { next(err); }
});

// GET /api/yahoo/league/:leagueKey/analyze
router.get('/league/:leagueKey/analyze', async (req, res, next) => {
  try {
    const [standings, settings, allTeamStats] = await Promise.all([
      yahooService.getLeagueStandings(getToken(req), req.params.leagueKey),
      yahooService.getLeagueSettings(getToken(req), req.params.leagueKey),
      yahooService.getAllTeamStats(getToken(req), req.params.leagueKey),
    ]);

    res.json({ standings, settings, allTeamStats });
  } catch (err) { next(err); }
});

module.exports = router;
