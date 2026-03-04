const express = require('express');
const router = express.Router();
const nhlService = require('../services/nhlService');

// GET /api/nhl/standings
router.get('/standings', async (req, res, next) => {
  try {
    const standings = await nhlService.getStandings();
    res.json({ standings });
  } catch (err) { next(err); }
});

// GET /api/nhl/schedule
router.get('/schedule', async (req, res, next) => {
  try {
    const schedule = await nhlService.getTodaySchedule();
    res.json({ schedule });
  } catch (err) { next(err); }
});

// GET /api/nhl/player/:playerId
router.get('/player/:playerId', async (req, res, next) => {
  try {
    const player = await nhlService.getPlayerDetails(req.params.playerId);
    res.json({ player });
  } catch (err) { next(err); }
});

// GET /api/nhl/leaders/skaters?category=points&limit=25
router.get('/leaders/skaters', async (req, res, next) => {
  try {
    const { category, limit } = req.query;
    const leaders = await nhlService.getSkaterLeaders(category || 'points', parseInt(limit) || 25);
    res.json({ leaders });
  } catch (err) { next(err); }
});

// GET /api/nhl/leaders/goalies
router.get('/leaders/goalies', async (req, res, next) => {
  try {
    const leaders = await nhlService.getGoalieLeaders();
    res.json({ leaders });
  } catch (err) { next(err); }
});

module.exports = router;
