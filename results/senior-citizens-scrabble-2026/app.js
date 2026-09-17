const TOURNAMENT = {
  title: 'Senior Citizens Scrabble Tournament 2026',
  date: '25 October 2026',
  venue: 'Hilton Hotel Colombo',
  events: {
    championship: { name: 'Championship Category', rounds: 6, folder: 'championship' },
    plate: { name: 'Plate Category', rounds: 5, folder: 'plate' }
  }
};

const params = () => new URLSearchParams(window.location.search);
const eventKey = () => {
  const requested = params().get('event');
  return Object.hasOwn(TOURNAMENT.events, requested) ? requested : 'championship';
};
const currentEvent = () => TOURNAMENT.events[eventKey()];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const safeId = value => String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '');

async function fetchText(path) {
  const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Not published');
  return response.text();
}

async function fetchJson(path) {
  const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Not published');
  return response.json();
}

async function publishedPath(event, round, type) {
  const path = `results-data/${event.folder}/round-${String(round).padStart(2, '0')}-${type}.html`;
  try {
    await fetchText(path);
    return path;
  } catch {
    return null;
  }
}

function playerFromCell(cell) {
  const text = (cell?.textContent || '').replace(/\s+/g, ' ').trim();
  const idMatch = text.match(/(?:#|[A-Z])\s*\d+/i);
  const id = (idMatch?.[0] || '').replace(/[^0-9]/g, '');
  const namedNode = cell?.querySelector('.name');
  const name = namedNode
    ? namedNode.textContent.replace(/\s+/g, ' ').trim()
    : text.replace(idMatch?.[0] || '', '').replace(/\s+/g, ' ').trim();
  return { id, name };
}

function findStandingsTable(documentNode) {
  const tables = [...documentNode.querySelectorAll('table')];
  return tables.find(table => {
    const headers = [...table.querySelectorAll('tr:first-child th, tr:first-child td')]
      .map(cell => cell.textContent.trim().toLowerCase());
    return headers.some(value => value.includes('player')) &&
      (headers.some(value => value.includes('spread')) || headers.some(value => value.includes('last game')));
  }) || tables[0] || null;
}

function makeProfileLink(cell, category) {
  const player = playerFromCell(cell);
  if (!player.id) return escapeHtml(cell.textContent.trim());
  const label = player.name || cell.textContent.replace(/\s+/g, ' ').trim();
  return `<a class="player-link" href="player.html?event=${encodeURIComponent(category)}&id=${encodeURIComponent(player.id)}">${escapeHtml(label)}</a>`;
}

function normalisePairingText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function parsePairingPlayer(value) {
  const text = normalisePairingText(value).replace(/\s*[:.;]+\s*$/, '');
  const match = text.match(/^(.*?)\s*\(\s*((?:[A-Z]|#)?\s*\d+)\s*\)\s*$/i);
  const rawId = match ? match[2].replace(/\s+/g, '').toUpperCase() : '';
  return {
    name: normalisePairingText(match ? match[1] : text),
    id: rawId,
    profileId: rawId.replace(/[^0-9]/g, '')
  };
}

function findPairingsTable(documentNode) {
  const tables = [...documentNode.querySelectorAll('table')];
  return documentNode.querySelector('table.pairings') || tables.find(table => {
    const heading = normalisePairingText(table.querySelector('tr')?.textContent).toLowerCase();
    return heading.includes('board') && (heading.includes('plays whom') || heading.includes('pairing'));
  }) || null;
}

function parsePairings(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const table = findPairingsTable(parsed);
  if (!table) throw new Error('No pairings table found');

  const matches = [];
  const byes = [];
  for (const row of table.querySelectorAll('tr')) {
    if (row.querySelector('th')) continue;
    const cells = [...row.querySelectorAll('td')];
    if (cells.length < 2) continue;

    const board = normalisePairingText(cells[0].textContent);
    const detail = cells[1];
    const isBye = Boolean(detail.querySelector('.bye')) || /\bbye\b/i.test(detail.textContent);

    if (isBye) {
      const explicitName = normalisePairingText(detail.querySelector('span.name')?.textContent);
      const explicitId = normalisePairingText(detail.querySelector('.id')?.textContent);
      let player;
      if (explicitName) {
        player = parsePairingPlayer(explicitId ? `${explicitName} (${explicitId})` : explicitName);
      } else {
        const cleaned = detail.cloneNode(true);
        cleaned.querySelectorAll('.bye').forEach(node => node.remove());
        player = parsePairingPlayer(normalisePairingText(cleaned.textContent));
      }
      if (player.name) byes.push(player);
      continue;
    }

    const markerText = normalisePairingText(detail.querySelector('.starts')?.textContent).toLowerCase();
    const marker = markerText.includes('first') ? 'starts' : markerText.includes('draw') ? 'draws' : '';
    const repeat = Boolean(detail.querySelector('.repeat')) || /\brepeat\b/i.test(detail.textContent);
    const cleaned = detail.cloneNode(true);
    cleaned.querySelectorAll('.starts, .repeat').forEach(node => node.remove());
    const players = normalisePairingText(cleaned.textContent).split(/\s+vs\.?\s+/i);
    if (!board || players.length !== 2) continue;

    const first = parsePairingPlayer(players[0]);
    const second = parsePairingPlayer(players[1]);
    if (!first.name || !second.name) continue;
    matches.push({ board, first, second, marker, repeat });
  }

  if (!matches.length && !byes.length) throw new Error('No pairings rows found');
  return { matches, byes };
}

function pairingPlayerMarkup(player, category, marker = '') {
  const markerLabel = marker === 'starts' ? 'Starts first' : marker === 'draws' ? 'Draws for start' : '';
  const profileLink = player.profileId
    ? `<a class="pairing-player-name" href="player.html?event=${encodeURIComponent(category)}&id=${encodeURIComponent(player.profileId)}" title="View ${escapeHtml(player.name)}’s player profile">${escapeHtml(player.name)}</a>`
    : `<span class="pairing-player-name">${escapeHtml(player.name)}</span>`;
  return `
    <div class="pairing-player${marker ? ` is-${marker}` : ''}">
      ${profileLink}
      ${player.id ? `<span class="pairing-player-id">${escapeHtml(player.id)}</span>` : ''}
      ${markerLabel ? `<span class="pairing-marker ${marker}">${markerLabel}</span>` : ''}
    </div>`;
}

function renderPairings(pairings, category, round) {
  const { matches, byes } = pairings;
  const hasStarts = matches.some(match => match.marker === 'starts');
  const hasDraws = matches.some(match => match.marker === 'draws');
  const hasRepeats = matches.some(match => match.repeat);
  const legends = [
    hasStarts ? '<span><span class="pairing-marker starts">Starts first</span> makes the first move</span>' : '',
    hasDraws ? '<span><span class="pairing-marker draws">Draws for start</span> draws to decide the first move</span>' : '',
    hasRepeats ? '<span><span class="repeat-tag">Repeat pairing</span> met in an earlier round</span>' : ''
  ].filter(Boolean);

  const byeMarkup = byes.length ? `
    <section class="bye-section" aria-labelledby="bye-heading">
      <h3 id="bye-heading">Round ${round} ${byes.length === 1 ? 'bye' : 'byes'}</h3>
      <div class="bye-list">
        ${byes.map(player => `
          <article class="bye-card">
            <span class="bye-badge" aria-hidden="true">BYE</span>
            <div>
              ${pairingPlayerMarkup(player, category)}
              <p>No game this round</p>
            </div>
          </article>`).join('')}
      </div>
    </section>` : '';

  const cards = matches.map(match => `
    <article class="pairing-card" role="listitem">
      <div class="pairing-card-top">
        <div class="board-tile" aria-label="Board ${escapeHtml(match.board)}">
          <span>Board</span>
          <strong>${escapeHtml(match.board)}</strong>
        </div>
        ${match.repeat ? '<span class="repeat-tag">Repeat pairing</span>' : ''}
      </div>
      <div class="pairing-matchup">
        ${pairingPlayerMarkup(match.first, category, match.marker)}
        <span class="versus-badge" aria-label="versus">VS</span>
        ${pairingPlayerMarkup(match.second, category)}
      </div>
    </article>`).join('');

  return `
    <div class="pairings-overview">
      <div>
        <p class="pairings-kicker">Round ${round} seating</p>
        <h2>Find your board</h2>
        <p>Check your board number and opponent before play begins.</p>
      </div>
      <div class="pairing-totals" aria-label="Round summary">
        <span><strong>${matches.length}</strong>${matches.length === 1 ? 'Board' : 'Boards'}</span>
        ${byes.length ? `<span><strong>${byes.length}</strong>${byes.length === 1 ? 'Bye' : 'Byes'}</span>` : ''}
      </div>
    </div>
    ${legends.length ? `<div class="pairings-legend"><strong>Pairing key</strong>${legends.join('')}</div>` : ''}
    ${byeMarkup}
    <div class="pairings-grid" role="list">${cards}</div>`;
}

async function renderCategory() {
  const event = currentEvent();
  const key = eventKey();
  document.title = `${event.name} · ${TOURNAMENT.title}`;
  document.getElementById('category-title').textContent = event.name;
  document.getElementById('round-summary').textContent = `${event.rounds} rounds · Pairings, standings and player results`;
  document.getElementById('profiles-link').href = `players.html?event=${encodeURIComponent(key)}`;

  const rounds = document.getElementById('rounds');
  const cards = await Promise.all(Array.from({ length: event.rounds }, async (_, index) => {
    const round = index + 1;
    const [pairings, standings] = await Promise.all([
      publishedPath(event, round, 'pairings'),
      publishedPath(event, round, 'standings')
    ]);
    const resultLink = (type, path) => path
      ? `<a class="result-button live" href="viewer.html?event=${encodeURIComponent(key)}&round=${round}&type=${type}">View ${type === 'pairings' ? 'Pairings' : 'Standings'}</a>`
      : `<span class="result-button" aria-disabled="true">${type === 'pairings' ? 'Pairings' : 'Standings'} · Awaiting</span>`;
    return `
      <article class="round-card">
        <div class="round-tile" aria-hidden="true">${round}</div>
        <div class="round-content">
          <h2>Round ${round}</h2>
          <div class="round-actions">
            ${resultLink('pairings', pairings)}
            ${resultLink('standings', standings)}
          </div>
        </div>
      </article>`;
  }));
  rounds.innerHTML = cards.join('');
  rounds.setAttribute('aria-busy', 'false');
}

async function renderViewer() {
  const event = currentEvent();
  const key = eventKey();
  const requestedRound = Number.parseInt(params().get('round'), 10);
  const round = Number.isInteger(requestedRound) && requestedRound >= 1 && requestedRound <= event.rounds ? requestedRound : 1;
  const type = params().get('type') === 'pairings' ? 'pairings' : 'standings';
  const typeLabel = type === 'pairings' ? 'Pairings' : 'Standings';
  const path = `results-data/${event.folder}/round-${String(round).padStart(2, '0')}-${type}.html`;

  document.title = `${event.name} · Round ${round} ${typeLabel}`;
  document.getElementById('back-link').href = `category.html?event=${encodeURIComponent(key)}`;
  document.getElementById('category-kicker').textContent = event.name;
  document.getElementById('viewer-title').textContent = `Round ${round} ${typeLabel}`;
  const view = document.getElementById('result-view');
  view.classList.toggle('pairings-panel', type === 'pairings');

  try {
    const html = await fetchText(path);
    if (type === 'pairings') {
      view.innerHTML = renderPairings(parsePairings(html), key, round);
    } else {
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const sourceTable = findStandingsTable(parsed);
      if (!sourceTable) throw new Error('No standings table found');
      const rows = [...sourceTable.querySelectorAll('tr')];
      if (!rows.length) throw new Error('No standings rows found');
      const headers = [...rows[0].children].map(cell => cell.textContent.replace(/\s+/g, ' ').trim());
      let markup = `<div class="table-scroll"><table class="results-table"><thead><tr>${headers.map(value => `<th>${escapeHtml(value)}</th>`).join('')}</tr></thead><tbody>`;
      for (const row of rows.slice(1)) {
        const cells = [...row.children];
        if (!cells.length) continue;
        let playerIndex = cells.findIndex(cell => /(?:#|[A-Z])\s*\d+/i.test(cell.textContent));
        if (playerIndex < 0) playerIndex = headers.findIndex(header => /player/i.test(header));
        markup += '<tr>' + cells.map((cell, index) => `<td>${index === playerIndex ? makeProfileLink(cell, key) : escapeHtml(cell.textContent.replace(/\s+/g, ' ').trim())}</td>`).join('') + '</tr>';
      }
      markup += '</tbody></table></div>';
      view.innerHTML = markup;
    }
  } catch {
    view.innerHTML = `<div class="empty-state"><h2>Result not published yet</h2><p>Please return to the category page and try again after the tournament desk publishes this round.</p></div>`;
  }
  view.setAttribute('aria-busy', 'false');
}

async function loadPlayerData() {
  try {
    return await fetchJson(`data/${eventKey()}.json`);
  } catch {
    return { players: {} };
  }
}

async function renderPlayers() {
  const event = currentEvent();
  const key = eventKey();
  document.title = `${event.name} Player Profiles · ${TOURNAMENT.title}`;
  document.getElementById('results-link').href = `category.html?event=${encodeURIComponent(key)}`;
  document.getElementById('players-title').textContent = `${event.name} Player Profiles`;

  const data = await loadPlayerData();
  const players = Object.entries(data.players || {})
    .map(([id, player]) => ({ id, ...player }))
    .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || String(a.name).localeCompare(String(b.name)));
  const list = document.getElementById('players-list');
  if (!players.length) {
    list.innerHTML = '<div class="empty-state"><h2>Player profiles are awaiting results</h2><p>Profiles will appear after the first standings are published.</p></div>';
  } else {
    list.innerHTML = players.map(player => `
      <a class="player-card" href="player.html?event=${encodeURIComponent(key)}&id=${encodeURIComponent(player.id)}">
        <span>
          <span class="player-name">${escapeHtml(player.name)}</span>
          <span class="player-meta">${player.rank ? `Rank ${player.rank} · ` : ''}${player.wins || 0}-${player.losses || 0}-${player.ties || 0} · Spread ${formatSpread(player.spread || 0)}</span>
        </span>
        <span class="player-arrow" aria-hidden="true">→</span>
      </a>`).join('');
  }
  list.setAttribute('aria-busy', 'false');
}

function formatSpread(value) {
  const number = Number(value || 0);
  return `${number >= 0 ? '+' : ''}${number}`;
}

async function renderPlayer() {
  const event = currentEvent();
  const key = eventKey();
  const id = safeId(params().get('id'));
  document.getElementById('players-link').href = `players.html?event=${encodeURIComponent(key)}`;
  document.getElementById('category-link').href = `category.html?event=${encodeURIComponent(key)}`;
  const profile = document.getElementById('player-profile');
  const data = await loadPlayerData();
  const player = data.players?.[id];

  if (!player) {
    profile.innerHTML = '<div class="empty-state"><h2>Player profile not available</h2><p>This profile will appear once standings containing the player are published.</p></div>';
    profile.setAttribute('aria-busy', 'false');
    return;
  }

  document.title = `${player.name} · ${event.name}`;
  const games = [...(player.games || [])].sort((a, b) => a.round - b.round);
  const headToHead = {};
  for (const game of games) {
    if (!game.opponentId) continue;
    const record = headToHead[game.opponentId] ||= {
      id: game.opponentId,
      name: game.opponentName || game.opponentId,
      games: 0, wins: 0, losses: 0, ties: 0, spread: 0
    };
    record.games += 1;
    record.spread += Number(game.spread || 0);
    if (game.result === 'W') record.wins += 1;
    else if (game.result === 'L') record.losses += 1;
    else record.ties += 1;
  }

  const gameRows = games.length ? games.map(game => `
    <tr>
      <td>${game.round}</td>
      <td>${game.opponentId ? `<a class="player-link" href="player.html?event=${encodeURIComponent(key)}&id=${encodeURIComponent(game.opponentId)}">${escapeHtml(game.opponentName || game.opponentId)}</a>` : 'Bye'}</td>
      <td>${game.score ?? ''}</td>
      <td>${game.oppScore ?? ''}</td>
      <td>${escapeHtml(game.result || '')}</td>
      <td>${game.spread == null ? '' : formatSpread(game.spread)}</td>
    </tr>`).join('') : '<tr><td colspan="6">No completed games published yet.</td></tr>';
  const headRows = Object.values(headToHead).length ? Object.values(headToHead).map(record => `
    <tr>
      <td><a class="player-link" href="player.html?event=${encodeURIComponent(key)}&id=${encodeURIComponent(record.id)}">${escapeHtml(record.name)}</a></td>
      <td>${record.games}</td><td>${record.wins}</td><td>${record.losses}</td><td>${record.ties}</td><td>${formatSpread(record.spread)}</td>
    </tr>`).join('') : '<tr><td colspan="6">No head-to-head results published yet.</td></tr>';

  profile.innerHTML = `
    <section class="profile-header">
      <p class="eyebrow">${escapeHtml(event.name)}</p>
      <h1>${escapeHtml(player.name)}</h1>
      <div class="stat-grid">
        <div class="stat-card"><span class="stat-value">${player.wins || 0}</span><span class="stat-label">Wins</span></div>
        <div class="stat-card"><span class="stat-value">${player.losses || 0}</span><span class="stat-label">Losses</span></div>
        <div class="stat-card"><span class="stat-value">${player.ties || 0}</span><span class="stat-label">Ties</span></div>
        <div class="stat-card"><span class="stat-value">${formatSpread(player.spread || 0)}</span><span class="stat-label">Total spread</span></div>
      </div>
    </section>
    <section class="profile-section">
      <h2>Game History</h2>
      <div class="table-scroll"><table class="results-table">
        <thead><tr><th>Round</th><th>Opponent</th><th>Score</th><th>Opp.</th><th>Result</th><th>Spread</th></tr></thead>
        <tbody>${gameRows}</tbody>
      </table></div>
    </section>
    <section class="profile-section">
      <h2>Head-to-Head</h2>
      <div class="table-scroll"><table class="results-table">
        <thead><tr><th>Opponent</th><th>Games</th><th>W</th><th>L</th><th>T</th><th>Spread</th></tr></thead>
        <tbody>${headRows}</tbody>
      </table></div>
    </section>`;
  profile.setAttribute('aria-busy', 'false');
}
