// ─── CONSTANTS ───────────────────────────────────────────────────
const API = 'https://deckofcardsapi.com/api/deck';
const SUITS = { S:'♠', H:'♥', D:'♦', C:'♣' };
const RED = new Set(['H','D']);
const VALS = { ACE:'A', JACK:'J', QUEEN:'Q', KING:'K' };

const OPPONENTS = [
  { name:'Tobias, o Novato',    emoji:'🧑', desc:'Mal sabe segurar as cartas.',         lives:2, skill:0.10 },
  { name:'Mara das Travessas',  emoji:'👩', desc:'Esperta, mas ainda impulsiva.',         lives:2, skill:0.22 },
  { name:'Fen, o Calculista',   emoji:'🧔', desc:'Observa cada carta com cuidado.',       lives:3, skill:0.35 },
  { name:'Duquesa Vael',        emoji:'👸', desc:'Elegante e implacável.',               lives:3, skill:0.48 },
  { name:'Borcan, o Bruto',     emoji:'🪖', desc:'Força bruta e sorte inexplicável.',    lives:4, skill:0.60 },
  { name:'Sylvara, a Oráculo',  emoji:'🔮', desc:'Lê o baralho como um livro aberto.',  lives:4, skill:0.75 },
  { name:'O Mestre das Cartas', emoji:'🎭', desc:'Ninguém o derrotou antes.',            lives:5, skill:0.92 },
];

// ─── STATE ───────────────────────────────────────────────────────
let G = {};

function newGame() {
  G = {
    deckId: null,
    deckRemaining: 0,
    playerLives: 5,
    opponentIdx: 0,
    opponentLives: 0,
    playerCards: [],
    opponentCards: [],
    playerSecret: null,
    opponentSecret: null,
    playerStopped: false,
    opponentStopped: false,
    activeSide: 'player',
    phase: 'loading',
    usedCards: [],
    roundNumber: 0,
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────
function vLabel(v) { return VALS[v] || v; }
function sSymbol(s) { return SUITS[s] || s; }
function isRed(s) { return RED.has(s); }

function cardScore(card) {
  if (['JACK','QUEEN','KING'].includes(card.value)) return 10;
  if (card.value === 'ACE') return 11;
  return parseInt(card.value);
}

function handScore(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    let v = cardScore(c);
    if (v === 11) aces++;
    total += v;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function determineWinner(ps, os) {
  const pb = ps > 21, ob = os > 21;
  if (pb && ob) return ps < os ? 'player' : os < ps ? 'opponent' : 'draw';
  if (pb) return 'opponent';
  if (ob) return 'player';
  if (ps === os) return 'draw';
  return ps > os ? 'player' : 'opponent';
}

function opponentShouldHit(score, skill, usedCards) {
  const highCards = usedCards.filter(c => cardScore(c) >= 10).length;
  const adjustedSkill = skill + (highCards > 8 ? 0.1 : 0);

  if (score >= 21) return false;
  if (score <= 11) return true;

  const threshold = 14 + skill * 5;

  if (score >= 19) return Math.random() < (skill * 0.3);
  if (score >= threshold) return false;
  return true;
}

async function initDeck() {
  const r = await fetch(`${API}/new/shuffle/?deck_count=4`);
  const d = await r.json();
  G.deckId = d.deck_id;
  G.deckRemaining = d.remaining;
}

async function drawCards(n) {
  const r = await fetch(`${API}/${G.deckId}/draw/?count=${n}`);
  const d = await r.json();
  G.deckRemaining = d.remaining;
  if (G.deckRemaining < 30) await reshuffleDeck();
  updateDeckInfo();
  return d.cards;
}

async function reshuffleDeck() {
  await fetch(`${API}/${G.deckId}/shuffle/`);
  G.usedCards = [];
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-'+id).classList.add('active');
}

function renderCard(card, hidden, glow) {
  if (hidden) {
    return `<div class="card hidden" title="Carta escondida"></div>`;
  }
  const col = isRed(card.suit) ? 'red' : 'black';
  const vl = vLabel(card.value);
  const sym = sSymbol(card.suit);
  const glowClass = glow ? ' secret-glow' : '';
  return `<div class="card ${col}${glowClass}" title="${card.value} de ${card.suit}">
    <div class="card-corner">${vl}<br>${sym}</div>
    <div class="card-suit-big">${sym}</div>
    <div class="card-corner-bot">${vl}<br>${sym}</div>
  </div>`;
}

function renderPlayerHearts() {
  const el = document.getElementById('player-hearts');
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += `<span class="hud-heart ${i < G.playerLives ? 'full' : 'empty'}">${i < G.playerLives ? '♥' : '♡'}</span>`;
  }
  el.innerHTML = html;
}

function renderOpponentBanner() {
  const opp = OPPONENTS[G.opponentIdx];
  G.opponentLives = G.opponentLives || opp.lives;
  let pips = '';
  for (let i = 0; i < opp.lives; i++) {
    pips += `<div class="hp-pip ${i < G.opponentLives ? 'full' : ''}" id="opp-pip-${i}"></div>`;
  }
  document.getElementById('opponent-banner').innerHTML = `
    <div class="opponent-avatar">${opp.emoji}</div>
    <div class="opponent-info">
      <div class="opponent-name">${opp.name}</div>
      <div class="opponent-desc">${opp.desc}</div>
      <div class="opponent-hp-bar">${pips}</div>
    </div>
    <div style="font-family:'Cinzel',serif;font-size:11px;color:var(--text-muted);letter-spacing:2px;">Oponente ${G.opponentIdx+1}/7</div>
  `;
}

function renderArena(revealBoth) {
  let playerHtml = '';
  for (let i = 0; i < G.playerCards.length; i++) {
    const isSecret = G.playerCards[i] === G.playerSecret;
    playerHtml += renderCard(G.playerCards[i], false, isSecret);
  }

  let oppHtml = '';
  for (let i = 0; i < G.opponentCards.length; i++) {
    const isSecret = i === 0;
    oppHtml += renderCard(G.opponentCards[i], isSecret && !revealBoth, isSecret && revealBoth);
  }

  document.getElementById('player-cards').innerHTML = playerHtml;
  document.getElementById('opp-cards').innerHTML = oppHtml;

  const ps = handScore(G.playerCards);
  const visibleOppCards = revealBoth ? G.opponentCards : G.opponentCards.slice(1);
  const oppVisScore = handScore(visibleOppCards);

  const pEl = document.getElementById('player-score');
  pEl.textContent = G.playerCards.length ? ps : '—';
  pEl.className = 'score-num' + (ps > 21 ? ' danger' : ps >= 18 ? ' safe' : '');

  const oEl = document.getElementById('opp-score');
  if (G.opponentCards.length) {
    oEl.textContent = revealBoth ? handScore(G.opponentCards) : oppVisScore;
    const fs = revealBoth ? handScore(G.opponentCards) : oppVisScore;
    oEl.className = 'score-num' + (fs > 21 ? ' danger' : fs >= 18 ? ' safe' : '');
  } else {
    oEl.textContent = '—';
    oEl.className = 'score-num';
  }

  document.getElementById('player-stopped').innerHTML =
    G.playerStopped ? '<div class="stopped-badge">Parou</div>' : '';
  document.getElementById('opp-stopped').innerHTML =
    G.opponentStopped && (revealBoth || G.opponentStopped) ? '<div class="stopped-badge">Parou</div>' : '';

  setActiveSide(G.activeSide);
}

function renderUsedCards() {
  const area = document.getElementById('used-area');
  if (!G.usedCards.length) { area.style.display='none'; return; }
  area.style.display='block';
  document.getElementById('used-cards-row').innerHTML = G.usedCards.map(c => {
    const vl = vLabel(c.value);
    const sym = sSymbol(c.suit);
    return `<div class="used-card-mini ${isRed(c.suit)?'red':'black'}" title="${c.value}">${vl}${sym}</div>`;
  }).join('');
}

function updateDeckInfo() {
  document.getElementById('deck-info').textContent = `Cartas no baralho: ${G.deckRemaining}`;
}

function setLog(html, cls='') {
  document.getElementById('round-log').innerHTML = `<div class="log-line ${cls}">${html}</div>`;
}

function setActions(showHit, showStand) {
  document.getElementById('btn-hit').disabled = !showHit;
  document.getElementById('btn-stand').disabled = !showStand;
  document.getElementById('action-area').style.display = (showHit||showStand) ? 'block' : 'none';
}

function setActiveSide(side) {
  if (side !== 'player' && side !== 'opponent') return;
  G.activeSide = side;
  document.getElementById('arena-player').classList.toggle('active-side', side === 'player');
  document.getElementById('arena-opponent').classList.toggle('active-side', side === 'opponent');
  const status = document.getElementById('control-status');
  if (status) status.textContent = `Controle: ${side === 'player' ? 'Você' : 'Oponente'}`;
}

function showResult(type, title, detail) {
  const el = document.getElementById('result-overlay');
  el.className = type+'-overlay';
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-detail').textContent = detail;
  el.style.display = 'block';
  document.getElementById('action-area').style.display = 'none';
}

function hideResult() {
  document.getElementById('result-overlay').style.display = 'none';
}

async function startGame() {
  showScreen('loading');
  newGame();
  try {
    await initDeck();
    G.opponentLives = OPPONENTS[0].lives;
    showScreen('game');
    renderPlayerHearts();
    renderOpponentBanner();
    await startRound();
  } catch(e) {
    console.error(e);
    document.getElementById('screen-loading').innerHTML =
      '<div style="color:#e74c3c;padding:40px;text-align:center;font-family:Cinzel,serif">Erro ao conectar à API. Verifique a conexão.</div>';
    showScreen('loading');
  }
}

async function startRound() {
  G.roundNumber++;
  G.playerCards = [];
  G.opponentCards = [];
  G.playerSecret = null;
  G.opponentSecret = null;
  G.playerStopped = false;
  G.opponentStopped = false;
  G.usedCards = [];
  hideResult();
  document.getElementById('used-area').style.display = 'none';

  renderArena(false);
  renderPlayerHearts();
  renderOpponentBanner();
  setLog('Distribuindo cartas...', 'info');
  setActions(false, false);

  const cards = await drawCards(4);
  G.playerSecret = cards[0];
  G.playerCards = [cards[0], cards[2]];
  G.opponentSecret = cards[1];
  G.opponentCards = [cards[1], cards[3]];
  G.usedCards.push(...cards);

  G.phase = 'player-turn';
  renderArena(false);
  renderUsedCards();
  setActiveSide('player');

  const ps = handScore(G.playerCards);
  setLog(`Sua mão: ${ps}. Sua carta secreta brilha em ouro — só você a vê. O oponente tem uma carta escondida também.`);
  setActions(true, true);
}

async function playerHit() {
  if (G.phase !== 'player-turn') return;
  setActions(false, false);

  const [card] = await drawCards(1);
  G.playerCards.push(card);
  G.usedCards.push(card);

  renderArena(false);
  renderUsedCards();

  const ps = handScore(G.playerCards);
  if (ps > 21) {
    setLog(`Você recebeu ${vLabel(card.value)}${sSymbol(card.suit)}. Total: ${ps}. Estourou!`, '');
    G.playerStopped = true;
    renderArena(false);
    await revealAndResolve();
  } else if (ps === 21) {
    setLog(`Você recebeu ${vLabel(card.value)}${sSymbol(card.suit)}. Total: 21! Perfeito — parando automaticamente.`);
    await playerStand();
  } else {
    setLog(`Você recebeu ${vLabel(card.value)}${sSymbol(card.suit)}. Total: ${ps}.`);
    G.phase = 'opp-turn';
    setActiveSide('opponent');
    await delay(600);
    await opponentTurn();
  }
}

async function playerStand() {
  if (G.phase !== 'player-turn') return;
  G.phase = 'opp-turn';
  G.playerStopped = true;
  setActions(false, false);
  renderArena(false);
  setActiveSide('opponent');
  setLog('Você parou. Agora o oponente joga...');

  await delay(600);
  await opponentTurn();
}

async function opponentTurn() {
  const opp = OPPONENTS[G.opponentIdx];
  const score = handScore(G.opponentCards);
  const shouldHit = opponentShouldHit(score, opp.skill, G.usedCards);

  if (!shouldHit || score >= 21) {
    G.opponentStopped = true;
    setLog(`${opp.name} decide parar.`);
    if (G.playerStopped) {
      await delay(500);
      await revealAndResolve();
      return;
    }
    G.phase = 'player-turn';
    setActiveSide('player');
    setActions(true, !G.playerStopped);
    return;
  }

  setLog(`${opp.name} está pensando...`);
  await delay(700 + Math.random()*400);

  const [card] = await drawCards(1);
  G.opponentCards.push(card);
  G.usedCards.push(card);

  renderArena(false);
  renderUsedCards();
  setLog(`${opp.name} comprou ${vLabel(card.value)}${sSymbol(card.suit)}.`);

  const os = handScore(G.opponentCards);
  if (os > 21) {
    G.opponentStopped = true;
    await delay(500);
    await revealAndResolve();
    return;
  }

  G.phase = 'player-turn';
  setActiveSide('player');
  setActions(true, true);
}

async function revealAndResolve() {
  G.phase = 'reveal';
  setLog('Revelando as cartas secretas...');
  await delay(600);

  renderArena(true);
  renderUsedCards();
  await delay(800);

  const ps = handScore(G.playerCards);
  const os = handScore(G.opponentCards);
  const winner = determineWinner(ps, os);
  const opp = OPPONENTS[G.opponentIdx];

  await delay(400);

  if (winner === 'player') {
    G.opponentLives--;
    setLog(`Você: ${ps} — ${opp.name}: ${os}. Você venceu!`, 'win');
    renderOpponentBanner();

    if (G.opponentLives <= 0) {
      await delay(500);
      if (G.opponentIdx >= 6) {
        showScreen('victory');
        return;
      }
      showResult('win', `${opp.name} foi derrotado!`, `Oponente ${G.opponentIdx+1} eliminado. Prepare-se para o próximo.`);
      document.getElementById('result-btn').textContent = `Enfrentar ${OPPONENTS[G.opponentIdx+1].name} →`;
      document.getElementById('result-btn').onclick = advanceOpponent;
    } else {
      showResult('win', 'Rodada Vencida!', `Você: ${ps} — ${opp.name}: ${os}. ${opp.name} tem ${G.opponentLives} vida(s) restante(s).`);
      document.getElementById('result-btn').textContent = 'Próxima Rodada';
      document.getElementById('result-btn').onclick = nextRound;
    }
  } else if (winner === 'opponent') {
    G.playerLives--; 
    setLog(`Você: ${ps} — ${opp.name}: ${os}. Você perdeu.`, 'lose');
    renderPlayerHearts();
    document.getElementById('arena-player').classList.add('shake');
    setTimeout(() => document.getElementById('arena-player').classList.remove('shake'), 400);

    if (G.playerLives <= 0) {
      await delay(800);
      showScreen('gameover');
      return;
    }
    showResult('lose', 'Rodada Perdida', `Você: ${ps} — ${opp.name}: ${os}. Você perdeu uma vida. ${G.playerLives} vida(s) restante(s).`);
    document.getElementById('result-btn').textContent = 'Continuar';
    document.getElementById('result-btn').onclick = nextRound;
  } else {
    setLog(`Empate! Você: ${ps} — ${opp.name}: ${os}. Ninguém perde vida.`, '');
    showResult('draw', 'Empate', `Ambos com ${ps}. Nenhuma vida perdida.`);
    document.getElementById('result-btn').textContent = 'Próxima Rodada';
    document.getElementById('result-btn').onclick = nextRound;
  }
}

function advanceOpponent() {
  G.opponentIdx++;
  G.opponentLives = OPPONENTS[G.opponentIdx].lives;
  hideResult();
  startRound();
}

function nextRound() {
  hideResult();
  startRound();
}

function restartGame() {
  startGame();
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  showScreen('title');
})();
