const axios = require('axios');
const qs = require('qs');
const { XMLParser } = require('fast-xml-parser');

const YAHOO_FANTASY_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';
const YAHOO_TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '_',
  isArray: (name) => ['team', 'player', 'matchup', 'stat', 'roster_position'].includes(name),
});

// ─── Core request helper ──────────────────────────────────────────────────────
async function yahooRequest(accessToken, path) {
  const url = `${YAHOO_FANTASY_BASE}${path}`;
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { format: 'xml' },
    });
    return parser.parse(response.data);
  } catch (err) {
    const status = err.response?.status;
    if (status === 401) throw Object.assign(new Error('Yahoo token expired'), { status: 401 });
    throw new Error(err.response?.data || err.message);
  }
}

// ─── Refresh Yahoo token ──────────────────────────────────────────────────────
async function refreshYahooToken(refreshToken) {
  const credentials = Buffer.from(
    `${process.env.YAHOO_CLIENT_ID}:${process.env.YAHOO_CLIENT_SECRET}`
  ).toString('base64');

  const response = await axios.post(
    YAHOO_TOKEN_URL,
    qs.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
  return response.data;
}

// ─── Get all user NHL leagues ─────────────────────────────────────────────────
async function getUserLeagues(accessToken) {
  const data = await yahooRequest(
    accessToken,
    '/users;use_login=1/games;game_keys=nhl/leagues'
  );
  const leagues = data?.fantasy_content?.users?.user?.games?.game?.leagues?.league;
  if (!leagues) return [];
  return (Array.isArray(leagues) ? leagues : [leagues]).map((l) => ({
    leagueKey: l.league_key,
    leagueId: l.league_id,
    name: l.name,
    season: l.season,
    numTeams: l.num_teams,
    scoringType: l.scoring_type,
    leagueType: l.league_type,
    draftStatus: l.draft_status,
    currentWeek: l.current_week,
    isFinished: l.is_finished,
  }));
}

// ─── Get league details + teams ──────────────────────────────────────────────
async function getLeague(accessToken, leagueKey) {
  const data = await yahooRequest(
    accessToken,
    `/league/${leagueKey};out=settings,standings,scoreboard`
  );
  return data?.fantasy_content?.league;
}

// ─── Get league standings ─────────────────────────────────────────────────────
async function getLeagueStandings(accessToken, leagueKey) {
  const data = await yahooRequest(
    accessToken,
    `/league/${leagueKey}/standings`
  );
  const teams = data?.fantasy_content?.league?.standings?.teams?.team || [];
  return (Array.isArray(teams) ? teams : [teams]).map((t) => ({
    teamKey: t.team_key,
    teamId: t.team_id,
    name: t.name,
    logo: t.team_logos?.team_logo?.url,
    manager: t.managers?.manager?.nickname,
    wins: t.team_standings?.outcome_totals?.wins,
    losses: t.team_standings?.outcome_totals?.losses,
    ties: t.team_standings?.outcome_totals?.ties,
    percentage: t.team_standings?.outcome_totals?.percentage,
    rank: t.team_standings?.rank,
    pointsFor: t.team_standings?.points_for,
    pointsAgainst: t.team_standings?.points_against,
    streak: t.team_standings?.streak,
  }));
}

// ─── Get user's team roster ───────────────────────────────────────────────────
async function getTeamRoster(accessToken, teamKey) {
  const data = await yahooRequest(
    accessToken,
    `/team/${teamKey}/roster/players`
  );
  const players = data?.fantasy_content?.team?.roster?.players?.player || [];
  return (Array.isArray(players) ? players : [players]).map(parsePlayer);
}

// ─── Get current week scoreboard ─────────────────────────────────────────────
async function getScoreboard(accessToken, leagueKey) {
  const data = await yahooRequest(
    accessToken,
    `/league/${leagueKey}/scoreboard`
  );
  return data?.fantasy_content?.league?.scoreboard;
}

// ─── Get player stats ─────────────────────────────────────────────────────────
async function getPlayerStats(accessToken, leagueKey, playerKeys) {
  const keyStr = playerKeys.join(',');
  const data = await yahooRequest(
    accessToken,
    `/league/${leagueKey}/players;player_keys=${keyStr}/stats`
  );
  const players = data?.fantasy_content?.league?.players?.player || [];
  return (Array.isArray(players) ? players : [players]).map(parsePlayerStats);
}

// ─── Get top available players (waiver wire) ──────────────────────────────────
async function getAvailablePlayers(accessToken, leagueKey, position = '', count = 25) {
  const posFilter = position ? `;position=${position}` : '';
  const data = await yahooRequest(
    accessToken,
    `/league/${leagueKey}/players;status=A${posFilter};count=${count};sort=AR/stats`
  );
  const players = data?.fantasy_content?.league?.players?.player || [];
  return (Array.isArray(players) ? players : [players]).map(parsePlayerStats);
}

// ─── Get player details for trade analyzer ────────────────────────────────────
async function getPlayersForTrade(accessToken, leagueKey, playerKeys) {
  const keyStr = playerKeys.join(',');
  const data = await yahooRequest(
    accessToken,
    `/league/${leagueKey}/players;player_keys=${keyStr}/stats;type=season`
  );
  const players = data?.fantasy_content?.league?.players?.player || [];
  return (Array.isArray(players) ? players : [players]).map(parsePlayerStats);
}

// ─── Get league settings (scoring categories) ────────────────────────────────
async function getLeagueSettings(accessToken, leagueKey) {
  const data = await yahooRequest(accessToken, `/league/${leagueKey}/settings`);
  return data?.fantasy_content?.league;
}

// ─── Get all teams with stats (for league analyzer) ──────────────────────────
async function getAllTeamStats(accessToken, leagueKey) {
  const data = await yahooRequest(
    accessToken,
    `/league/${leagueKey}/teams/stats`
  );
  const teams = data?.fantasy_content?.league?.teams?.team || [];
  return Array.isArray(teams) ? teams : [teams];
}

// ─── Parse player object from Yahoo XML ──────────────────────────────────────
function parsePlayer(p) {
  return {
    playerKey: p.player_key,
    playerId: p.player_id,
    name: p.name?.full,
    firstName: p.name?.first,
    lastName: p.name?.last,
    team: p.editorial_team_abbr,
    position: p.display_position,
    eligiblePositions: p.eligible_positions?.position || [],
    status: p.status,
    injuryNote: p.injury_note,
    headshot: p.headshot?.url,
    selectedPosition: p.selected_position?.position,
    isUndroppable: p.is_undroppable,
    ownershipPercent: p.percent_owned,
  };
}

function parsePlayerStats(p) {
  const base = parsePlayer(p);
  const stats = {};
  const statList = p.player_stats?.stats?.stat || [];
  (Array.isArray(statList) ? statList : [statList]).forEach((s) => {
    stats[s.stat_id] = parseFloat(s.value) || 0;
  });
  return {
    ...base,
    stats,
    rank: p.player_advanced_stats?.rank,
    fantasyPoints: p.player_points?.total,
  };
}

async function getUserTeamInLeague(accessToken, leagueKey) {
  const data = await yahooRequest(accessToken, `/league/${leagueKey}/teams;use_login=1`);
  const teams = data?.fantasy_content?.league?.teams?.team;
  if (!teams) return null;
  const team = Array.isArray(teams) ? teams[0] : teams;
  return { teamKey: team.team_key, teamId: team.team_id, name: team.name };
}

module.exports = {
  refreshYahooToken,
  getUserLeagues,
  getLeague,
  getLeagueStandings,
  getTeamRoster,
  getScoreboard,
  getPlayerStats,
  getAvailablePlayers,
  getPlayersForTrade,
  getLeagueSettings,
  getAllTeamStats,
  getUserTeamInLeague,
};
