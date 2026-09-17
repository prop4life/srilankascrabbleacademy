const REPOSITORY = 'prop4life/srilankascrabbleacademy';
const BRANCH = 'main/(root)';
const BASE_PATH = 'results/senior-citizens-scrabble-2026';
const API_ROOT = `https://api.github.com/repos/${REPOSITORY}`;
const EVENTS = {
  championship: { name: 'Championship Category', folder: 'championship', rounds: 6 },
  plate: { name: 'Plate Category', folder: 'plate', rounds: 5 }
};

const byId = id => document.getElementById(id);
const eventSelect = byId('event-select');
const roundSelect = byId('round-select');
const tokenInput = byId('token-input');
const fileInput = byId('file-input');
const statusMessage = byId('status-message');

tokenInput.value = sessionStorage.getItem('slasc_results_token') || '';

function updateRoundOptions() {
  const count = EVENTS[eventSelect.value].rounds;
  const previous = Number(roundSelect.value) || 1;
  roundSelect.replaceChildren(...Array.from({ length: count }, (_, index) => new Option(`Round ${index + 1}`, String(index + 1))));
  roundSelect.value = String(Math.min(previous, count));
}

function showStatus(message, state = '') {
  statusMessage.className = `status-message ${state}`.trim();
  statusMessage.textContent = message;
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value) {
  const binary = atob(String(value || '').replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
}

function cleanPlayerId(value) {
  return String(value || '').trim().replace(/^#/, '').replace(/^A/i, '').replace(/[^0-9]/g, '');
}

function parseNumber(value) {
  const normalized = String(value || '').replace(/\s+/g, '').replace(/[−–—]/g, '-');
  return /^[+-]?\d+$/.test(normalized) ? Number(normalized) : null;
}

function playerFromCell(cell) {
  const text = (cell?.textContent || '').replace(/\s+/g, ' ').trim();
  const idMatch = text.match(/(?:#|A)\s*\d+/i);
  const id = cleanPlayerId(idMatch?.[0] || '');
  const namedNode = cell?.querySelector('.name');
  const name = namedNode
    ? namedNode.textContent.replace(/\s+/g, ' ').trim()
    : text.replace(idMatch?.[0] || '', '').replace(/\s+/g, ' ').trim();
  return { id, name };
}

function parseStandings(html, roundNumber) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const tables = [...parsed.querySelectorAll('table')];
  const table = tables.find(candidate => {
    const headers = [...candidate.querySelectorAll('tr:first-child th, tr:first-child td')]
      .map(cell => cell.textContent.trim().toLowerCase());
    return headers.some(value => value.includes('player')) && headers.some(value => value.includes('last game'));
  }) || tables[0];
  if (!table) return [];

  const rows = [...table.querySelectorAll('tr')];
  if (!rows.length) return [];
  const headers = [...rows[0].querySelectorAll('th, td')].map(cell => cell.textContent.trim().toLowerCase());
  let playerIndex = headers.findIndex(value => value.includes('player'));
  if (playerIndex < 0) playerIndex = 0;
  const lastGameIndex = headers.findIndex(value => value.includes('last game'));
  const spreadIndex = headers.findIndex(value => value.includes('spread'));
  const rankIndex = headers.findIndex(value => value.includes('rank'));
  const output = [];

  for (const row of rows.slice(1)) {
    const cells = [...row.children];
    if (!cells.length) continue;
    const player = playerFromCell(cells[playerIndex]);
    if (!player.id || !player.name) continue;
    const lastGameCell = lastGameIndex >= 0
      ? cells[lastGameIndex]
      : cells.find(cell => /(?:[WLT])\s*[: ]/.test(cell.textContent));
    const lastGame = lastGameCell?.textContent.replace(/\s+/g, ' ').trim() || '';
    const match = lastGame.match(/(?:\?\s*)?(?:\d+\s*)?([WLT])\s*[: ]\s*(\d+)\s*[-−–—]\s*(\d+)\s*[: ]\s*(?:#|A)?\s*(\d+)/i);
    let cumulativeSpread = spreadIndex >= 0 ? parseNumber(cells[spreadIndex]?.textContent) : null;
    if (cumulativeSpread === null) {
      const likelySpread = cells.find(cell => /^[+−-]\d+$/.test(cell.textContent.trim()));
      cumulativeSpread = likelySpread ? parseNumber(likelySpread.textContent) : null;
    }
    if (!match) continue;
    output.push({
      id: player.id,
      name: player.name,
      rank: rankIndex >= 0 ? Number.parseInt(cells[rankIndex]?.textContent, 10) || null : null,
      round: roundNumber,
      result: match[1].toUpperCase(),
      score: Number(match[2]),
      oppScore: Number(match[3]),
      opponentId: cleanPlayerId(match[4]),
      cumulativeSpread
    });
  }
  return output;
}

async function github(path, options = {}) {
  const token = tokenInput.value.trim();
  const response = await fetch(API_ROOT + path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `GitHub error ${response.status}`);
  return payload;
}

async function readRepositoryFile(path) {
  try {
    const payload = await github(`/contents/${encodeURIComponentPath(path)}?ref=${encodeURIComponent(BRANCH)}`);
    return payload.content ? decodeBase64(payload.content) : null;
  } catch (error) {
    if (/not found/i.test(error.message)) return null;
    throw error;
  }
}

async function writeRepositoryFile(path, text, message) {
  let existingSha;
  try {
    const existing = await github(`/contents/${encodeURIComponentPath(path)}?ref=${encodeURIComponent(BRANCH)}`);
    existingSha = existing.sha;
  } catch (error) {
    if (!/not found/i.test(error.message)) throw error;
  }
  const body = {
    message,
    content: encodeBase64(text),
    branch: BRANCH
  };
  if (existingSha) body.sha = existingSha;
  return github(`/contents/${encodeURIComponentPath(path)}`, { method: 'PUT', body: JSON.stringify(body) });
}

function encodeURIComponentPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function rebuildPlayerData(eventKey) {
  const event = EVENTS[eventKey];
  const allGames = [];
  for (let round = 1; round <= event.rounds; round += 1) {
    const file = `${BASE_PATH}/results-data/${event.folder}/round-${String(round).padStart(2, '0')}-standings.html`;
    const html = await readRepositoryFile(file);
    if (html) allGames.push(...parseStandings(html, round));
  }
  if (!allGames.length) throw new Error('No recognizable game records were found in the published standings file.');

  allGames.sort((a, b) => a.round - b.round);
  const players = {};
  const previousSpreads = {};
  for (const game of allGames) {
    const player = players[game.id] ||= {
      id: game.id,
      name: game.name,
      rank: null,
      wins: 0,
      losses: 0,
      ties: 0,
      spread: 0,
      games: []
    };
    player.name = game.name;
    if (game.rank !== null) player.rank = game.rank;
    const gameSpread = game.cumulativeSpread === null
      ? game.score - game.oppScore
      : game.cumulativeSpread - (previousSpreads[game.id] || 0);
    if (game.cumulativeSpread !== null) previousSpreads[game.id] = game.cumulativeSpread;
    player.games.push({
      round: game.round,
      opponentId: game.opponentId,
      opponentName: null,
      result: game.result,
      score: game.score,
      oppScore: game.oppScore,
      spread: gameSpread
    });
    if (game.result === 'W') player.wins += 1;
    else if (game.result === 'L') player.losses += 1;
    else player.ties += 1;
    player.spread += gameSpread;
  }

  const names = Object.fromEntries(Object.entries(players).map(([id, player]) => [id, player.name]));
  Object.values(players).forEach(player => player.games.forEach(game => {
    game.opponentName = names[game.opponentId] || game.opponentId;
  }));
  return JSON.stringify({ event: eventKey, updated: new Date().toISOString(), players }, null, 2);
}

async function chooseAndPublish(type) {
  if (!tokenInput.value.trim()) {
    showStatus('Enter the GitHub access token before publishing.', 'error');
    tokenInput.focus();
    return;
  }
  sessionStorage.setItem('slasc_results_token', tokenInput.value.trim());
  fileInput.value = '';
  fileInput.onchange = async () => {
    const selectedFile = fileInput.files?.[0];
    if (!selectedFile) return;
    const key = eventSelect.value;
    const event = EVENTS[key];
    const round = Number(roundSelect.value);
    const paddedRound = String(round).padStart(2, '0');
    try {
      showStatus('Checking the selected TSH file…', 'busy');
      const html = await selectedFile.text();
      if (type === 'standings' && !parseStandings(html, round).length) {
        throw new Error('The standings file did not contain recognizable TSH player and last-game records.');
      }
      const destination = `${BASE_PATH}/results-data/${event.folder}/round-${paddedRound}-${type}.html`;
      showStatus(`Publishing ${event.name} · Round ${round} ${type}…`, 'busy');
      await writeRepositoryFile(destination, html, `Publish ${event.name} round ${round} ${type}`);
      if (type === 'standings') {
        showStatus('Standings uploaded. Updating player profiles and statistics…', 'busy');
        const playerData = await rebuildPlayerData(key);
        await writeRepositoryFile(`${BASE_PATH}/data/${key}.json`, playerData, `Update ${event.name} player statistics`);
      }
      showStatus(`${event.name} · Round ${round} ${type} published successfully.${type === 'standings' ? '\nPlayer profiles and statistics were also updated.' : ''}`, 'success');
    } catch (error) {
      showStatus(`Publishing failed.\n${error.message}`, 'error');
    }
  };
  fileInput.click();
}

eventSelect.addEventListener('change', updateRoundOptions);
byId('pairings-button').addEventListener('click', () => chooseAndPublish('pairings'));
byId('standings-button').addEventListener('click', () => chooseAndPublish('standings'));
updateRoundOptions();
