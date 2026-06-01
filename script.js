// ─── CONSTANTS ───────────────────────────────────────────────────.red
const SUITS = { S:'♠', H:'♥', D:'♦', C:'♣' };
const RED = new Set(['H','D']);
const WINS_TO_DEFEAT = 2;

// Valores: ACE=1, 2-10=face, JACK=12, QUEEN=11 (sem KING)
// Exibição: sempre numérica
const CARD_DISPLAY = { ACE:'1', JACK:'12', QUEEN:'11' };
const CARD_SCORE   = { ACE:1,   JACK:12,   QUEEN:11  };

const ALL_VALUES = ['ACE','2','3','4','5','6','7','8','9','10','JACK','QUEEN'];

const OPPONENTS = [
  { name:'Tobias, o Novato',    emoji:'🧑', desc:'Mal sabe segurar as cartas.',         lives:2, skill:0.10 },
  { name:'Mara das Travessas',  emoji:'👩', desc:'Esperta, mas ainda impulsiva.',         lives:2, skill:0.22 },
  { name:'Fen, o Calculista',   emoji:'🧔', desc:'Observa cada carta com cuidado.',       lives:3, skill:0.35 },
  { name:'Duquesa Vael',        emoji:'👸', desc:'Elegante e implacável.',               lives:3, skill:0.48 },
  { name:'Borcan, o Bruto',     emoji:'🪖', desc:'Força bruta e sorte inexplicável.',    lives:4, skill:0.60 },
  { name:'Sylvara, a Oráculo',  emoji:'🔮', desc:'Lê o baralho como um livro aberto.',  lives:4, skill:0.75 },
  { name:'O Mestre das Cartas', emoji:'🎭', desc:'Ninguém o derrotou antes.',            lives:5, skill:0.92 },
];

// ─── DECK LOCAL ──────────────────────────────────────────────────
// Cada carta tem um code único: ex. "ACE_S", "10_H", "QUEEN_D"
// Usando value+"_"+suit garante unicidade sem colisão entre 10, JACK, QUEEN etc.
function buildDeck() {
  const deck = [];
  for (const suit of ['S','H','D','C']) {
    for (const value of ALL_VALUES) {
      deck.push({ suit, value, code: value + '_' + suit });
    }
  }
  return deck; // 48 cartas
}

function shuffleArray(arr) {
  const d = [...arr];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ─── STATE ───────────────────────────────────────────────────────
let G = {};

function newGame() {
  G = {
    // Baralho único compartilhado — embaralhado uma vez por jogo
    // deckPool = cartas ainda não sacadas (como uma pilha)
    deckPool: shuffleArray(buildDeck()),
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
    usedPublic: [],   // cartas descartadas visíveis ao jogador
    roundNumber: 0,
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────
function vDisplay(v) { return CARD_DISPLAY[v] || v; }  // sempre número
function sSymbol(s)  { return SUITS[s] || s; }
function isRed(s)    { return RED.has(s); }

function cardScore(card) {
  return CARD_SCORE[card.value] ?? parseInt(card.value);
}

function handScore(cards) {
  return cards.reduce((sum, c) => sum + cardScore(c), 0);
}

function determineWinner(ps, os) {
  const pb = ps > 21, ob = os > 21;
  if (pb && ob) return ps < os ? 'player' : os < ps ? 'opponent' : 'draw';
  if (pb) return 'opponent';
  if (ob) return 'player';
  if (ps === os) return 'draw';
  return ps > os ? 'player' : 'opponent';
}

function opponentShouldHit(score, skill, usedPublic) {
  const highCards = usedPublic.filter(c => cardScore(c) >= 10).length;
  if (score >= 21) return false;
  if (score <= 11) return true;
  const threshold = 14 + skill * 5;
  if (score >= 19) return Math.random() < (skill * 0.3);
  if (score >= threshold) return false;
  return true;
}

// Saca N cartas do pool compartilhado — nunca repete
function drawCards(n) {
  const cards = [];
  for (let i = 0; i < n; i++) {
    if (G.deckPool.length === 0) {
      // Pool zerou: reembaralha apenas as cartas que não estão em mão
      const inPlay = new Set([
        ...G.playerCards.map(c => c.code),
        ...G.opponentCards.map(c => c.code),
      ]);
      const fresh = buildDeck().filter(c => !inPlay.has(c.code));
      G.deckPool = shuffleArray(fresh);
    }
    cards.push(G.deckPool.pop());
  }
  updateDeckInfo();
  return cards;
}

// ─── PAINEL DE AJUDA ─────────────────────────────────────────────
function renderHelpPanel() {
  const panel = document.getElementById('help-panel');
  if (!panel) return;

  // Cartas que o jogador já viu (públicas + cartas em mão do jogador)
  // A carta secreta do bot NÃO aparece aqui até o reveal
  const seenCodes = new Set([
    ...G.usedPublic.map(c => c.code),
    ...G.playerCards.map(c => c.code),
    ...G.opponentCards.slice(1).map(c => c.code), // cartas públicas do bot (exceto a [0] secreta)
  ]);

  // Conta quantas de cada valor ainda restam no pool
  const remaining = {};
  for (const v of ALL_VALUES) remaining[v] = 0;
  for (const card of G.deckPool) {
    if (!seenCodes.has(card.code)) remaining[card.value]++;
  }

  let html = '<div style="font-size:10px;color:var(--text-muted);letter-spacing:1px;margin-bottom:6px;">CARTAS DISPONÍVEIS</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
  for (const v of ALL_VALUES) {
    const count = remaining[v];
    const score = cardScore({ value: v });
    const dim = count === 0 ? 'opacity:0.25;' : '';
    html += `<div style="${dim}display:inline-flex;flex-direction:column;align-items:center;
      background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
      border-radius:4px;padding:3px 5px;min-width:28px;">
      <span style="font-size:11px;font-weight:bold;color:#e8d5a3;">${vDisplay(v)}</span>
      <span style="font-size:9px;color:var(--text-muted);">${score}pt</span>
      <span style="font-size:10px;color:${count > 0 ? '#7ecb7e' : '#e74c3c'};">×${count}</span>
    </div>`;
  }
  html += '</div>';
  panel.innerHTML = html;
}

// ─── UI ──────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-'+id).classList.add('active');
}

function renderCard(card, hidden, glow) {
  if (hidden) return `<div class="card hidden" title="Carta escondida"></div>`;
  const col = isRed(card.suit) ? 'red' : 'black';
  const num = vDisplay(card.value);
  const glowClass = glow ? ' secret-glow' : '';
  return `<div class="card ${col}${glowClass}" title="${card.value} ${sSymbol(card.suit)}">
    <div class="card-suit-big">${num}</div>
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
  if (G.opponentLives == null) G.opponentLives = WINS_TO_DEFEAT;
  let pips = '';
  for (let i = 0; i < WINS_TO_DEFEAT; i++) {
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
  // Cartas do jogador — todas visíveis, secreta com glow
  let playerHtml = '';
  for (const card of G.playerCards) {
    const isSecret = card.code === G.playerSecret?.code;
    playerHtml += renderCard(card, false, isSecret);
  }

  // Cartas do oponente — [0] fica escondida até reveal
  let oppHtml = '';
  for (let i = 0; i < G.opponentCards.length; i++) {
    const isFirstCard = i === 0;
    oppHtml += renderCard(G.opponentCards[i], isFirstCard && !revealBoth, isFirstCard && revealBoth);
  }

  document.getElementById('player-cards').innerHTML = playerHtml;
  document.getElementById('opp-cards').innerHTML = oppHtml;

const ps = handScore(G.playerCards);
const pEl = document.getElementById('player-score');

pEl.textContent = G.playerCards.length ? ps : '—';

// Cor baseada na pontuação
if (ps >= 18 && ps <= 20) {
    pEl.style.color = '#f1c40f'; // amarelo
} else if (ps === 21) {
    pEl.style.color = '#2ecc71'; // verde
} else if (ps > 21) {
    pEl.style.color = '#e74c3c'; // vermelho
} else {
    pEl.style.color = ''; // cor padrão
}


  const visibleOppCards = revealBoth ? G.opponentCards : G.opponentCards.slice(1);
  const oEl = document.getElementById('opp-score');
  if (G.opponentCards.length) {
    const fs = handScore(revealBoth ? G.opponentCards : visibleOppCards);
    oEl.textContent = fs;
    oEl.className = 'score-num';
  } else {
    oEl.textContent = '—';
    oEl.className = 'score-num';
  }

  document.getElementById('player-stopped').innerHTML =
    G.playerStopped ? '<div class="stopped-badge">Parou</div>' : '';
  document.getElementById('opp-stopped').innerHTML =
    G.opponentStopped ? '<div class="stopped-badge">Parou</div>' : '';

  setActiveSide(G.activeSide);
  renderHelpPanel();
}

function renderUsedCards() {
  const area = document.getElementById('used-area');
  if (!G.usedPublic.length) { area.style.display='none'; return; }
  area.style.display='block';
  document.getElementById('used-cards-row').innerHTML = G.usedPublic.map(c => {
    return `<div class="used-card-mini " title="${c.value}">${vDisplay(c.value)}</div>`;
  }).join('');
}

function updateDeckInfo() {
  document.getElementById('deck-info').textContent = `Cartas no baralho: ${G.deckPool.length}`;
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

// ─── GAME FLOW ───────────────────────────────────────────────────
async function startGame() {
  showScreen('loading');
  newGame();
  try {
    G.opponentLives = WINS_TO_DEFEAT;
    showScreen('game');
    renderPlayerHearts();
    renderOpponentBanner();
    await startRound();
  } catch(e) {
    console.error(e);
    document.getElementById('screen-loading').innerHTML =
      '<div style="color:#e74c3c;padding:40px;text-align:center;font-family:Cinzel,serif">Erro ao iniciar o jogo.</div>';
    showScreen('loading');
  }
}

async function startRound() {
  G.roundNumber++;
  G.playerCards    = [];
  G.opponentCards  = [];
  G.playerSecret   = null;
  G.opponentSecret = null;
  G.playerStopped  = false;
  G.opponentStopped = false;
  G.usedPublic     = [];
  hideResult();
  document.getElementById('used-area').style.display = 'none';

  renderArena(false);
  renderPlayerHearts();
  renderOpponentBanner();
  setLog('Distribuindo cartas...', 'info');
  setActions(false, false);

  // 4 cartas do pool único — garantidamente distintas
  const cards = drawCards(4);
  // cards[0] = carta secreta do jogador
  // cards[1] = carta secreta do bot (fica escondida)
  // cards[2] = segunda carta do jogador (visível)
  // cards[3] = segunda carta do bot (visível)
  G.playerSecret   = cards[0];
  G.playerCards    = [cards[0], cards[2]];
  G.opponentSecret = cards[1];
  G.opponentCards  = [cards[1], cards[3]];

  // usedPublic: cartas que o jogador já viu
  // cards[1] (secreta do bot) NÃO entra aqui
  G.usedPublic.push(cards[0], cards[2], cards[3]);

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

  const [card] = drawCards(1);
  G.playerCards.push(card);
  G.usedPublic.push(card);

  renderArena(false);
  renderUsedCards();

  const ps = handScore(G.playerCards);
  if (ps > 21) {
    setLog(`Você recebeu ${vDisplay(card.value)}${sSymbol(card.suit)}. Total: ${ps}. Estourou!`);
    G.playerStopped = true;
    renderArena(false);
    await revealAndResolve();
  } else if (ps === 21) {
    setLog(`Você recebeu ${vDisplay(card.value)}${sSymbol(card.suit)}. Total: 21! Perfeito — parando automaticamente.`);
    await playerStand();
  } else {
    setLog(`Você recebeu ${vDisplay(card.value)}${sSymbol(card.suit)}. Total: ${ps}.`);
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
  const shouldHit = opponentShouldHit(score, opp.skill, G.usedPublic);

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

  const [card] = drawCards(1);
  G.opponentCards.push(card);
  G.usedPublic.push(card); // cartas extras do bot são visíveis

  renderArena(false);
  renderUsedCards();
  setLog(`${opp.name} comprou ${vDisplay(card.value)}`);

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

  // Só agora a carta secreta do bot vai para o histórico público
  if (G.opponentSecret && !G.usedPublic.some(c => c.code === G.opponentSecret.code)) {
    G.usedPublic.push(G.opponentSecret);
  }

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
      if (G.opponentIdx >= 6) { showScreen('victory'); return; }
      showResult('win', `${opp.name} foi derrotado!`, `Você venceu ${WINS_TO_DEFEAT} vezes e agora enfrenta o próximo oponente.`);
      document.getElementById('result-btn').textContent = `Enfrentar ${OPPONENTS[G.opponentIdx+1].name} →`;
      document.getElementById('result-btn').onclick = advanceOpponent;
    } else {
      showResult('win', 'Rodada Vencida!', `Você: ${ps} — ${opp.name}: ${os}. Falta ${G.opponentLives} vitória(s) para derrotar ${opp.name}.`);
      document.getElementById('result-btn').textContent = 'Próxima Rodada';
      document.getElementById('result-btn').onclick = nextRound;
    }
  } else if (winner === 'opponent') {
    G.playerLives--;
    setLog(`Você: ${ps} — ${opp.name}: ${os}. Você perdeu.`, 'lose');
    renderPlayerHearts();
    document.getElementById('arena-player').classList.add('shake');
    setTimeout(() => document.getElementById('arena-player').classList.remove('shake'), 400);

    if (G.playerLives <= 0) { await delay(800); showScreen('gameover'); return; }
    showResult('lose', 'Rodada Perdida', `Você: ${ps} — ${opp.name}: ${os}. Você perdeu uma vida. ${G.playerLives} vida(s) restante(s).`);
    document.getElementById('result-btn').textContent = 'Continuar';
    document.getElementById('result-btn').onclick = nextRound;
  } else {
    setLog(`Empate! Você: ${ps} — ${opp.name}: ${os}. Ninguém perde vida.`);
    showResult('draw', 'Empate', `Ambos com ${ps}. Nenhuma vida perdida.`);
    document.getElementById('result-btn').textContent = 'Próxima Rodada';
    document.getElementById('result-btn').onclick = nextRound;
  }
}

function advanceOpponent() {
  G.opponentIdx++;
  G.opponentLives = WINS_TO_DEFEAT;
  hideResult();
  startRound();
}

function nextRound() { hideResult(); startRound(); }
function restartGame() { startGame(); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => { showScreen('title'); })();