const axios = require('axios');

const NHL_BASE = 'https://api-web.nhle.com/v1';
const NHL_STATS_BASE = 'https://api.nhle.com/stats/rest/en';

// ─── Get current NHL standings ────────────────────────────────────────────────
async function getStandings() {
  const { data } = await axios.get(`${NHL_BASE}/standings/now`);
  return data.standings.map((team) => ({
    teamAbbrev: team.teamAbbrev?.default,
    teamName: team.teamName?.default,
    teamLogo: team.teamLogo,
    conference: team.conferenceName,
    division: team.divisionName,
    gamesPlayed: team.gamesPlayed,
    wins: team.wins,
    losses: team.losses,
    otLosses: team.otLosses,
    points: team.points,
    pointPct: team.pointPctg,
    regulationWins: team.regulationWins,
    goalFor: team.goalFor,
    goalAgainst: team.goalAgainst,
    goalDiff: team.goalDifferential,
    homeWins: team.homeWins,
    homeLosses: team.homeLosses,
    roadWins: team.roadWins,
    roadLosses: team.roadLosses,
    streakCode: team.streakCode,
    streakCount: team.streakCount,
    lastTen: `${team.l10Wins}-${team.l10Losses}-${team.l10OtLosses}`,
    clinchIndicator: team.clinchIndicator,
    wildcardSequence: team.wildcardSequence,
  }));
}

// ─── Get today's schedule ─────────────────────────────────────────────────────
async function getTodaySchedule() {
  const { data } = await axios.get(`${NHL_BASE}/schedule/now`);
  return data;
}

// ─── Get player details ───────────────────────────────────────────────────────
async function getPlayerDetails(playerId) {
  const { data } = await axios.get(`${NHL_BASE}/player/${playerId}/landing`);
  return {
    id: data.playerId,
    name: `${data.firstName?.default} ${data.lastName?.default}`,
    headshot: data.headshot,
    teamAbbrev: data.currentTeamAbbrev,
    position: data.position,
    shoots: data.shootsCatches,
    number: data.sweaterNumber,
    birthDate: data.birthDate,
    birthCity: data.birthCity?.default,
    birthCountry: data.birthCountryCode,
    heightInInches: data.heightInInches,
    weightInPounds: data.weightInPounds,
    season: data.featuredStats?.season,
    stats: data.featuredStats?.regularSeason?.subSeason,
    careerStats: data.featuredStats?.regularSeason?.career,
    draftDetails: data.draftDetails,
  };
}

// ─── Get skater stats leaders ─────────────────────────────────────────────────
async function getSkaterLeaders(category = 'points', limit = 25) {
  const { data } = await axios.get(`${NHL_STATS_BASE}/skater/summary`, {
    params: {
      limit,
      start: 0,
      sort: category,
      direction: 'DESC',
      seasonId: getCurrentSeasonId(),
      gameTypeId: 2,
    },
  });
  return data.data || [];
}

// ─── Get goalie stats leaders ─────────────────────────────────────────────────
async function getGoalieLeaders(limit = 25) {
  const { data } = await axios.get(`${NHL_STATS_BASE}/goalie/summary`, {
    params: {
      limit,
      start: 0,
      sort: 'wins',
      direction: 'DESC',
      seasonId: getCurrentSeasonId(),
      gameTypeId: 2,
    },
  });
  return data.data || [];
}

// ─── Utility: current season ID ──────────────────────────────────────────────
function getCurrentSeasonId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // NHL season starts in October
  if (month >= 10) return `${year}${year + 1}`;
  return `${year - 1}${year}`;
}

module.exports = {
  getStandings,
  getTodaySchedule,
  getPlayerDetails,
  getSkaterLeaders,
  getGoalieLeaders,
};
