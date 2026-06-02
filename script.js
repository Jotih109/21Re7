// ─── CONSTANTS ───────────────────────────────────────────────────
const SUITS = { S:'♠', H:'♥', D:'♦', C:'♣' };
const RED = new Set(['H','D']);
const WINS_TO_DEFEAT = 2;

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

// ─── CARTAS ESPECIAIS ─────────────────────────────────────────────
// Cada carta especial: { id, name, desc, category, param? }
const SPECIAL_CARDS = [
  // Compra específica
  { id:'buy2',      name:'Carta 2',       desc:'Compra o número 2 do baralho.',              category:'buy',    param:2  },
  { id:'buy5',      name:'Carta 5',       desc:'Compra o número 5 do baralho.',              category:'buy',    param:5  },
  { id:'buy7',      name:'Carta 7',       desc:'Compra o número 7 do baralho.',              category:'buy',    param:7  },
  // Aumento de aposta
  { id:'oneup',     name:'One-Up',        desc:'Aumenta o dano em +1 se você vencer.',       category:'stake',  param:1  },
  { id:'twoup',     name:'Two-Up',        desc:'Aumenta o dano em +2 se você vencer.',       category:'stake',  param:2  },
  { id:'twoup2',    name:'Two-Up+',       desc:'+2 de dano e remove a última carta do inimigo.', category:'stake+', param:2 },
  // Defesa
  { id:'shield',    name:'Shield',        desc:'Reduz o dano recebido em 1.',                category:'shield', param:1  },
  { id:'shieldp',   name:'Shield+',       desc:'Reduz o dano recebido em 2.',                category:'shield', param:2  },
  // Remoção
  { id:'remove',    name:'Remove',        desc:'Remove a última carta visível do inimigo.',   category:'remove'         },
  { id:'return',    name:'Return',        desc:'Remove sua última carta comprada.',            category:'return'         },
  // Troca
  { id:'exchange',  name:'Exchange',      desc:'Troca sua última carta visível com a última carta visível do inimigo.', category:'exchange' },
  // Destruição
  { id:'destroy',   name:'Destroy',       desc:'Remove uma carta especial ativa do inimigo.', category:'destroy'        },
  { id:'destroyp',  name:'Destroy+',      desc:'Remove todas as cartas especiais do inimigo.', category:'destroyp'      },
  { id:'destroypp', name:'Destroy++',     desc:'Remove todas e impede o inimigo de usar cartas especiais nesta rodada.', category:'destroypp' },
  // Mudança de meta
  { id:'gofor24',   name:'Go For 24',     desc:'A meta desta rodada vira 24.',               category:'goal',   param:24 },
  { id:'gofor27',   name:'Go For 27',     desc:'A meta desta rodada vira 27.',               category:'goal',   param:27 },
  { id:'gofor17',   name:'Go For 17',     desc:'A meta desta rodada vira 17.',               category:'goal',   param:17 },
  // Compra especial
  { id:'perfectdraw', name:'Perfect Draw', desc:'Compra a melhor carta possível para chegar na meta.', category:'perfectdraw' },
  { id:'ultimatedraw', name:'Ultimate Draw', desc:'Compra exatamente a carta mais vantajosa disponível.', category:'ultimatedraw' },
  // Recursos
  { id:'harvest',   name:'Harvest',       desc:'A cada carta especial usada, receba outra.',  category:'harvest'        },
];

// Pool que o jogador pode receber (sem as de chefe)
const PLAYER_SPECIAL_POOL = SPECIAL_CARDS.map(c => c.id);

function randomSpecialCard() {
  const id = PLAYER_SPECIAL_POOL[Math.floor(Math.random() * PLAYER_SPECIAL_POOL.length)];
  return SPECIAL_CARDS.find(c => c.id === id);
}

// ─── DECK ────────────────────────────────────────────────────────
function buildDeck() {
  const deck = [];
  for (const suit of ['S','H','D','C']) {
    for (const value of ALL_VALUES) {
      deck.push({ suit, value, code: value + '_' + suit });
    }
  }
  return deck;
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
    deckPool: shuffleArray(buildDeck()),
    usedCodes: new Set(),
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
    usedPublic: [],
    roundNumber: 0,
    // Cartas especiais
    playerSpecials: [],       // mão de especiais do jogador
    opponentSpecials: [],     // mão de especiais do bot
    playerActiveStake: 0,     // dano extra acumulado para esta rodada
    playerActiveShield: 0,    // redução de dano acumulada
    opponentActiveStake: 0,
    opponentActiveShield: 0,
    playerBlockedSpecials: false,  // Destroy++ do oponente
    opponentBlockedSpecials: false,
    harvestActive: false,          // Harvest ligado
    roundGoal: 21,                 // meta da rodada (pode ser alterada por Go For)
    lastOpponentSpecialUsed: null, // última carta especial usada pelo bot
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────
function vDisplay(v) { return CARD_DISPLAY[v] || v; }
function sSymbol(s)  { return SUITS[s] || s; }
function isRed(s)    { return RED.has(s); }

function cardScore(card) {
  return CARD_SCORE[card.value] ?? parseInt(card.value);
}

function handScore(cards) {
  return cards.reduce((sum, c) => sum + cardScore(c), 0);
}

function scoreColor(s) {
  const goal = G.roundGoal || 21;
  const near = goal - 3;
  if (s > goal)             return '#e74c3c';
  if (s === goal)           return '#2ecc71';
  if (s >= near && s < goal) return '#f1c40f';
  return '';
}

function determineWinner(ps, os) {
  const goal = G.roundGoal || 21;
  const pb = ps > goal, ob = os > goal;
  if (pb && ob) return ps < os ? 'player' : os < ps ? 'opponent' : 'draw';
  if (pb) return 'opponent';
  if (ob) return 'player';
  if (ps === os) return 'draw';
  return ps > os ? 'player' : 'opponent';
}

function opponentShouldHit(score, skill, usedPublic) {
  const goal = G.roundGoal || 21;
  // agressividade crescente com número da rodada e índice do oponente
  const roundAgg = (G.roundNumber || 0) * 0.02; // +2% por rodada
  const oppAgg = (G.opponentIdx || 0) * 0.04;    // +4% por avanço de oponente
  const aggression = Math.min(0.6, roundAgg + oppAgg);

  if (score >= goal) return false;
  if (score <= 11) return true;
  // threshold reduzido pela agressividade (bots mais agressivos param menos)
  const threshold = (goal - 7) + skill * 5 - aggression * 6;
  if (score >= goal - 2) return Math.random() < (skill * 0.3 + aggression * 0.3);
  if (score >= threshold) return false;
  return true;
}

function drawCards(n) {
  const cards = [];
  const usedValuesThisRound = new Set();
  // Collect all values already in use this round (visible cards)
  for (const card of G.playerCards) usedValuesThisRound.add(card.value);
  for (const card of G.opponentCards) usedValuesThisRound.add(card.value);
  
  for (let i = 0; i < n; i++) {
    if (G.deckPool.length === 0) {
      const fresh = buildDeck().filter(c => !G.usedCodes.has(c.code));
      if (fresh.length === 0) {
        G.usedCodes.clear();
        G.deckPool = shuffleArray(buildDeck());
      } else {
        G.deckPool = shuffleArray(fresh);
      }
    }
    
    // Try to find a card without duplicate value in this round
    let card = null;
    for (let attempt = 0; attempt < G.deckPool.length; attempt++) {
      const candidate = G.deckPool[G.deckPool.length - 1 - attempt];
      if (!usedValuesThisRound.has(candidate.value)) {
        card = candidate;
        G.deckPool.splice(G.deckPool.indexOf(card), 1);
        break;
      }
    }
    
    // If no unique value found, just take the last card
    if (!card) {
      card = G.deckPool.pop();
    }
    
    G.usedCodes.add(card.code);
    usedValuesThisRound.add(card.value);
    cards.push(card);
  }
  updateDeckInfo();
  return cards;
}

// Saca carta específica por valor (para cartas de compra)
function drawSpecificValue(val) {
  const numVal = parseInt(val);
  const idx = G.deckPool.findIndex(c => {
    const cv = CARD_SCORE[c.value] ?? parseInt(c.value);
    return cv === numVal && !G.usedCodes.has(c.code);
  });
  if (idx === -1) return null;
  const [card] = G.deckPool.splice(idx, 1);
  G.usedCodes.add(card.code);
  updateDeckInfo();
  return card;
}

// Melhor carta para chegar na meta sem estourar
function bestCardForGoal() {
  const goal = G.roundGoal || 21;
  const cur = handScore(G.playerCards);
  const need = goal - cur;
  if (need <= 0) return null;
  // Tenta exato, depois menor que need
  let best = null;
  let bestDiff = Infinity;
  for (const c of G.deckPool) {
    if (G.usedCodes.has(c.code)) continue;
    const sv = cardScore(c);
    if (sv <= need) {
      const diff = need - sv;
      if (diff < bestDiff) { bestDiff = diff; best = c; }
    }
  }
  return best;
}

// ─── CARTAS ESPECIAIS — EFEITOS ──────────────────────────────────
async function useSpecialCard(idx) {
  if (G.phase !== 'player-turn') return;
  if (G.playerBlockedSpecials) { setLog('Suas cartas especiais estão bloqueadas esta rodada!', 'lose'); return; }
  const sp = G.playerSpecials[idx];
  if (!sp) return;

  G.playerSpecials.splice(idx, 1);
  renderSpecialsPanel();

  let msg = `Você usou <b>${sp.name}</b>. `;

  switch (sp.category) {
    case 'buy': {
      const card = drawSpecificValue(sp.param);
      if (card) {
        G.playerCards.push(card);
        G.usedPublic.push(card);
        msg += `Comprou ${vDisplay(card.value)}.`;
      } else {
        msg += `O ${sp.param} já saiu do baralho — nada acontece.`;
      }
      break;
    }
    case 'stake':
      G.playerActiveStake += sp.param;
      msg += `+${sp.param} de dano extra se vencer.`;
      break;
    case 'stake+': {
      G.playerActiveStake += sp.param;
      msg += `+${sp.param} de dano e `;
      const lastVisible = G.opponentCards.slice(1).pop();
      if (lastVisible) {
        G.opponentCards = G.opponentCards.filter(c => c.code !== lastVisible.code);
        G.usedPublic = G.usedPublic.filter(c => c.code !== lastVisible.code);
        msg += `removeu ${vDisplay(lastVisible.value)} do inimigo.`;
      } else { msg += `nenhuma carta visível para remover.`; }
      break;
    }
    case 'shield':
      G.playerActiveShield += sp.param;
      msg += `Reduz dano recebido em ${sp.param}.`;
      break;
    case 'remove': {
      const last = G.opponentCards.slice(1).pop();
      if (last) {
        G.opponentCards = G.opponentCards.filter(c => c.code !== last.code);
        G.usedPublic = G.usedPublic.filter(c => c.code !== last.code);
        msg += `Removeu ${vDisplay(last.value)} do inimigo.`;
      } else { msg += `Nenhuma carta visível do inimigo para remover.`; }
      break;
    }
    case 'return': {
      // Remove última carta (exceto a secreta)
      const removable = G.playerCards.filter(c => c.code !== G.playerSecret?.code);
      if (removable.length) {
        const last = removable[removable.length - 1];
        G.playerCards = G.playerCards.filter(c => c.code !== last.code);
        G.usedPublic = G.usedPublic.filter(c => c.code !== last.code);
        // devolve ao deck
        G.deckPool.unshift(last);
        G.usedCodes.delete(last.code);
        msg += `Devolveu ${vDisplay(last.value)} ao baralho.`;
      } else { msg += `Nenhuma carta para devolver.`; }
      break;
    }
    case 'exchange': {
      const myLast = G.playerCards.filter(c => c.code !== G.playerSecret?.code).pop();
      const oppLast = G.opponentCards.slice(1).pop();
      if (myLast && oppLast) {
        G.playerCards = G.playerCards.map(c => c.code === myLast.code ? oppLast : c);
        G.opponentCards = G.opponentCards.map(c => c.code === oppLast.code ? myLast : c);
        msg += `Trocou ${vDisplay(myLast.value)} por ${vDisplay(oppLast.value)}.`;
      } else { msg += `Não há cartas para trocar.`; }
      break;
    }
    case 'destroy': {
      if (G.opponentSpecials.length) {
        const removed = G.opponentSpecials.splice(Math.floor(Math.random() * G.opponentSpecials.length), 1)[0];
        msg += `Destruiu <b>${removed.name}</b> do inimigo.`;
      } else { msg += `O inimigo não tem cartas especiais.`; }
      break;
    }
    case 'destroyp':
      G.opponentSpecials = [];
      msg += `Destruiu todas as cartas especiais do inimigo.`;
      break;
    case 'destroypp':
      G.opponentSpecials = [];
      G.opponentBlockedSpecials = true;
      msg += `Destruiu todas as cartas especiais e bloqueou o inimigo por esta rodada.`;
      break;
    case 'goal':
      G.roundGoal = sp.param;
      msg += `Meta desta rodada agora é <b>${sp.param}</b>!`;
      renderGoalBadge();
      break;
    case 'perfectdraw': {
      const best = bestCardForGoal();
      if (best) {
        const i2 = G.deckPool.indexOf(best);
        if (i2 > -1) G.deckPool.splice(i2, 1);
        G.usedCodes.add(best.code);
        G.playerCards.push(best);
        G.usedPublic.push(best);
        updateDeckInfo();
        msg += `Comprou ${vDisplay(best.value)} (melhor carta disponível).`;
      } else { msg += `Não há carta útil disponível.`; }
      break;
    }
    case 'ultimatedraw': {
      // Compra a carta que deixa exatamente na meta
      const goal = G.roundGoal || 21;
      const cur = handScore(G.playerCards);
      const need = goal - cur;
      const exact = G.deckPool.find(c => !G.usedCodes.has(c.code) && cardScore(c) === need);
      if (exact) {
        const i3 = G.deckPool.indexOf(exact);
        G.deckPool.splice(i3, 1);
        G.usedCodes.add(exact.code);
        G.playerCards.push(exact);
        G.usedPublic.push(exact);
        updateDeckInfo();
        msg += `Comprou ${vDisplay(exact.value)} — exatamente ${goal}!`;
      } else {
        const best2 = bestCardForGoal();
        if (best2) {
          const i4 = G.deckPool.indexOf(best2);
          G.deckPool.splice(i4, 1);
          G.usedCodes.add(best2.code);
          G.playerCards.push(best2);
          G.usedPublic.push(best2);
          updateDeckInfo();
          msg += `Carta exata indisponível. Comprou ${vDisplay(best2.value)}.`;
        } else { msg += `Nenhuma carta útil disponível.`; }
      }
      break;
    }
    case 'harvest':
      G.harvestActive = true;
      msg += `Agora cada carta especial usada rende outra!`;
      break;
    default:
      msg += `Efeito aplicado.`;
  }

  setLog(msg);

  // Harvest: ganha nova carta especial ao usar qualquer uma
  if (G.harvestActive && sp.category !== 'harvest') {
    const bonus = randomSpecialCard();
    G.playerSpecials.push(bonus);
    setLog(msg + ` <span style="color:#f1c40f">[Harvest: +${bonus.name}]</span>`);
  }

  renderArena(false);
  renderUsedCards();
  renderSpecialsPanel();

  const ps = handScore(G.playerCards);
  if (ps > (G.roundGoal || 21)) {
    G.playerStopped = true;
    renderArena(false);
    await revealAndResolve();
  } else if (ps === (G.roundGoal || 21)) {
    setLog(msg + ' Total: ' + ps + '! Perfeito.');
    await playerStand();
  }
}

// IA do bot usa cartas especiais ocasionalmente
function botUseSpecials() {
  if (G.opponentBlockedSpecials || !G.opponentSpecials.length) return;
  const opp = OPPONENTS[G.opponentIdx];
  const os = handScore(G.opponentCards);
  const goal = G.roundGoal || 21;

  // agressividade crescente com número da rodada e índice do oponente
  const roundAgg = (G.roundNumber || 0) * 0.02; // +2% por rodada
  const oppAgg = (G.opponentIdx || 0) * 0.04;    // +4% por avanço de oponente
  const aggression = Math.min(0.7, roundAgg + oppAgg);

  // Probabilidade base de tentar usar uma especial aumenta com a skill e agressividade
  let useProb = 0.12 + opp.skill * 0.6 + aggression * 0.25; // boost por agressividade
  if (useProb > 0.95) useProb = 0.95;
  if (Math.random() > useProb) return;

  // Seleciona a carta especial mais adequada com heurística dependente da skill
  function chooseOpponentSpecialIndex() {
    if (!G.opponentSpecials.length) return -1;
    const skill = opp.skill;
    const scores = G.opponentSpecials.map(sp => {
      let score = 0;
      switch (sp.category) {
        case 'buy': {
          const need = goal - os;
          if (sp.param <= need) score += 40;
          score += Math.max(0, 10 - Math.abs(sp.param - (goal - os)));
          break;
        }
        case 'stake':
          score += 10 + Math.floor(skill * 20);
          break;
        case 'stake+':
          score += 12 + Math.floor(skill * 24);
          if (os >= goal - 6) score += 8;
          break;
        case 'shield': {
          const ps = handScore(G.playerCards);
          if (ps > os) score += 20;
          score += sp.param * 6;
          break;
        }
        case 'remove': {
          const last = G.playerCards.filter(c => c.code !== G.playerSecret?.code).pop();
          if (last) score += 40;
          break;
        }
        case 'return':
          score += 6 + Math.floor(skill * 6);
          break;
        case 'exchange': {
          const myLast = G.opponentCards.slice(1).pop();
          const theirLast = G.playerCards.filter(c => c.code !== G.playerSecret?.code).pop();
          if (myLast && theirLast) score += 28;
          break;
        }
        case 'destroy':
          if ((G.playerSpecials || []).length) score += 32;
          break;
        case 'destroyp':
        case 'destroypp':
          if ((G.playerSpecials || []).length) score += 40;
          score += skill * 10;
          break;
        case 'goal':
          score += 8 + skill * 20;
          break;
        case 'perfectdraw':
        case 'ultimatedraw':
          if (goal - os > 0) score += 30;
          break;
        case 'harvest':
          score += 4 + Math.floor(skill * 10);
          break;
        default:
          score += 2;
      }
      score += Math.random() * 8 * skill;
      return score;
    });
    let max = -Infinity, idx = -1;
    for (let i = 0; i < scores.length; i++) if (scores[i] > max) { max = scores[i]; idx = i; }
    const threshold = 8 - opp.skill * 6 - aggression * 8; // agressividade reduz o limiar
    return max >= threshold ? idx : -1;
  }

  const idx = chooseOpponentSpecialIndex();
  if (idx === -1) return;
  const sp = G.opponentSpecials[idx];
  G.opponentSpecials.splice(idx, 1);
  G.lastOpponentSpecialUsed = sp.name;

  let msg = `${opp.name} usou <b>${sp.name}</b>`;

  switch (sp.category) {
    case 'buy': {
      const need = goal - os;
      if (sp.param <= need) {
        const card = drawSpecificValue(sp.param);
        if (card) {
          G.opponentCards.push(card);
          G.usedPublic.push(card);
          msg += ` e comprou ${vDisplay(card.value)}.`;
        } else {
          msg += `, mas não encontrou ${sp.param} no baralho.`;
        }
      } else {
        msg += `, mas a carta não era útil no momento.`;
      }
      break;
    }
    case 'stake':
      G.opponentActiveStake += sp.param;
      msg += ` (+${sp.param} de stake).`;
      break;
    case 'stake+':
      G.opponentActiveStake += sp.param;
      msg += ` (+${sp.param} de stake).`;
      const lastP = G.playerCards.filter(c => c.code !== G.playerSecret?.code).pop();
      if (lastP) {
        G.playerCards = G.playerCards.filter(c => c.code !== lastP.code);
        G.usedPublic = G.usedPublic.filter(c => c.code !== lastP.code);
        msg += ` Removeu sua carta ${vDisplay(lastP.value)}.`;
      } else {
        msg += ` Mas não havia carta visível para remover.`;
      }
      break;
    case 'shield':
      G.opponentActiveShield += sp.param;
      msg += ` e ativou escudo (-${sp.param} de dano).`;
      break;
    case 'remove': {
      const last = G.playerCards.filter(c => c.code !== G.playerSecret?.code).pop();
      if (last) {
        G.playerCards = G.playerCards.filter(c => c.code !== last.code);
        G.usedPublic = G.usedPublic.filter(c => c.code !== last.code);
        msg += ` e removeu sua carta ${vDisplay(last.value)}.`;
      } else {
        msg += `, mas não havia carta visível para remover.`;
      }
      break;
    }
    case 'exchange': {
      const myLast = G.opponentCards.slice(1).pop();
      const theirLast = G.playerCards.filter(c => c.code !== G.playerSecret?.code).pop();
      if (myLast && theirLast) {
        const myIdx = G.opponentCards.findIndex(c => c.code === myLast.code);
        const theirIdx = G.playerCards.findIndex(c => c.code === theirLast.code);
        if (myIdx > -1 && theirIdx > -1) {
          const a = G.opponentCards[myIdx];
          G.opponentCards[myIdx] = G.playerCards[theirIdx];
          G.playerCards[theirIdx] = a;
          msg += ` e trocou cartas com você.`;
        }
      } else {
        msg += `, mas não havia cartas para trocar.`;
      }
      break;
    }
    case 'goal':
      G.roundGoal = sp.param;
      renderGoalBadge();
      msg += `! Meta agora é ${sp.param}.`;
      break;
    case 'perfectdraw':
    case 'ultimatedraw': {
      const best = bestCardForGoal();
      if (best) {
        const i2 = G.deckPool.indexOf(best);
        if (i2 > -1) G.deckPool.splice(i2, 1);
        G.usedCodes.add(best.code);
        G.opponentCards.push(best);
        G.usedPublic.push(best);
        updateDeckInfo();
        msg += ` e comprou ${vDisplay(best.value)}.`;
      } else {
        msg += `, mas não encontrou carta adequada.`;
      }
      break;
    }
    case 'destroy':
    case 'destroyp':
    case 'destroypp':
      G.playerSpecials = [];
      if (sp.category === 'destroypp') G.playerBlockedSpecials = true;
      msg += ` contra suas cartas especiais.`;
      break;
    case 'harvest':
      G.harvestActive = true;
      msg += ` e ativou Harvest.`;
      break;
    default:
      msg += ` e aplicou seu efeito.`;
      break;
  }

  setLog(msg);
  renderSpecialsPanel();
  renderArena(false);
  renderUsedCards();
  renderBotSpecialUsed();
}

function renderBotSpecialUsed() {
  const panel = document.getElementById('bot-special-used');
  if (!panel) return;
  if (G.lastOpponentSpecialUsed) {
    panel.innerHTML = `<div class="bot-special-used-text"><strong>Oponente usou:</strong> ${G.lastOpponentSpecialUsed}</div>`;
  } else {
    panel.innerHTML = '<div class="bot-special-used-text">Nenhuma carta especial usada ainda.</div>';
  }
}

// ─── PAINEL DE AJUDA ─────────────────────────────────────────────
function renderHelpPanel() {
  const panel = document.getElementById('help-panel');
  if (!panel) return;

  const seenCodes = new Set([
    ...G.usedPublic.map(c => c.code),
    ...G.playerCards.map(c => c.code),
    ...G.opponentCards.slice(1).map(c => c.code),
  ]);

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

// Painel de cartas especiais do jogador
function renderSpecialsPanel() {
  const panel = document.getElementById('specials-panel');
  if (!panel) return;

  if (!G.playerSpecials.length) {
    panel.innerHTML = '<div style="font-size:1.2em;color:var(--text-muted);font-style:italic;padding:12px 0;">Sem cartas especiais.</div>';
    return;
  }

  const blocked = G.playerBlockedSpecials;
  let html = '<div class="specials-title" style="font-size:1em;color:var(--text-muted);letter-spacing:1px;margin-bottom:8px;text-transform:uppercase;">⭐ Cartas Especiais</div>';
  
  G.playerSpecials.forEach((sp, i) => {
    const canUse = !blocked && G.phase === 'player-turn';
    const disabledClass = !canUse ? 'disabled' : '';
    html += `<button class="${disabledClass}" onclick="useSpecialCard(${i})" ${canUse ? '' : 'disabled'} title="${sp.desc}">
      <strong style="font-size:1.4em; margin-bottom:-7px;">${sp.name}</strong>
      <br><span style="font-size:1.2em;color:rgba(232,213,163,0.7);">${sp.desc}</span>
    </button>`;
  });
  
  html += '<div style="margin-top:12px;border-top:1px solid rgba(232,213,163,0.1);padding-top:8px;">';
  if (G.playerActiveStake > 0) html += `<div style="font-size:10px;color:#f1c40f;margin-bottom:4px;">⚔ Dano extra: +${G.playerActiveStake}</div>`;
  if (G.playerActiveShield > 0) html += `<div style="font-size:10px;color:#3498db;margin-bottom:4px;">🛡 Proteção: -${G.playerActiveShield}</div>`;
  if (G.harvestActive) html += `<div style="font-size:10px;color:#2ecc71;margin-bottom:4px;">🌾 Harvest ativo</div>`;
  if (blocked) html += `<div style="font-size:10px;color:#e74c3c;">🔒 Bloqueado esta rodada</div>`;
  html += '</div>';
  
  panel.innerHTML = html;
}

// Badge de meta da rodada
function renderGoalBadge() {
  const el = document.getElementById('goal-badge');
  if (!el) return;
  const goal = G.roundGoal || 21;
  el.textContent = `Meta: ${goal}`;
  el.style.color = goal !== 21 ? '#f1c40f' : 'var(--text-muted)';
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
  return `<div class="card ${col}${glowClass}" title="${num}">
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

  // Cartas especiais do oponente (mostra quantidade, não os nomes)
  const oppSp = G.opponentSpecials || [];
  const oppSpHtml = oppSp.length
    ? `<div style="font-size:10px;color:#e8d5a3;margin-top:4px;">🂠 ${oppSp.length} carta(s) especial(is)</div>`
    : '';

  document.getElementById('opponent-banner').innerHTML = `
    <div class="opponent-avatar">${opp.emoji}</div>
    <div class="opponent-info">
      <div class="opponent-name">${opp.name}</div>
      <div class="opponent-desc">${opp.desc}</div>
      <div class="opponent-hp-bar">${pips}</div>
      ${oppSpHtml}
    </div>
    <div style="font-family:'Cinzel',serif;font-size:11px;color:var(--text-muted);letter-spacing:2px;">Oponente ${G.opponentIdx+1}/7</div>
  `;
}

function renderArena(revealBoth) {
  let playerHtml = '';
  for (const card of G.playerCards) {
    const isSecret = card.code === G.playerSecret?.code;
    playerHtml += renderCard(card, false, isSecret);
  }

  let oppHtml = '';
  for (let i = 0; i < G.opponentCards.length; i++) {
    const isFirstCard = i === 0;
    oppHtml += renderCard(G.opponentCards[i], isFirstCard && !revealBoth, isFirstCard && revealBoth);
  }

  document.getElementById('player-cards').innerHTML = playerHtml;
  document.getElementById('opp-cards').innerHTML = oppHtml;

  // Score jogador
  const ps = handScore(G.playerCards);
  const pEl = document.getElementById('player-score');
  pEl.textContent = G.playerCards.length ? ps : '—';
  pEl.style.color = G.playerCards.length ? scoreColor(ps) : '';

  // Score oponente
  const oEl = document.getElementById('opp-score');
  if (G.opponentCards.length) {
    const visibleOppCards = revealBoth ? G.opponentCards : G.opponentCards.slice(1);
    const os = handScore(revealBoth ? G.opponentCards : visibleOppCards);
    oEl.textContent = os;
    oEl.className = 'score-num';
    if (revealBoth) {
      oEl.style.color = scoreColor(os);
    } else {
      const pubScore = handScore(G.opponentCards.slice(1));
      oEl.style.color = pubScore > (G.roundGoal || 21) ? '#e74c3c' : '';
    }
  } else {
    oEl.textContent = '—';
    oEl.className = 'score-num';
    oEl.style.color = '';
  }

  document.getElementById('player-stopped').innerHTML =
    G.playerStopped ? '<div class="stopped-badge">Parou</div>' : '';
  document.getElementById('opp-stopped').innerHTML =
    G.opponentStopped ? '<div class="stopped-badge">Parou</div>' : '';

  setActiveSide(G.activeSide);
  renderHelpPanel();
  renderGoalBadge();
  renderBotSpecialUsed();
}

function renderUsedCards() {
  const panel = document.getElementById('used-panel');
  if (!panel) return;
  
  if (!G.usedPublic.length) {
    panel.innerHTML = '<div style="font-size:11px;color:var(--text-muted);font-style:italic;padding:12px 0;">Nenhuma carta jogada.</div>';
    return;
  }

  let html = '<div id="used-panel-title">🂠 Cartas Jogadas</div>';
  html += '<div id="used-panel-content">';
  G.usedPublic.forEach(c => {
    html += `<div class="used-card-item" title="${c.value}">${vDisplay(c.value)}</div>`;
  });
  html += '</div>';
  panel.innerHTML = html;
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
    // Cada jogador começa com 3 cartas especiais
    G.playerSpecials   = [randomSpecialCard(), randomSpecialCard(), randomSpecialCard()];
    G.opponentSpecials = [randomSpecialCard(), randomSpecialCard(), randomSpecialCard()];
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
  G.playerActiveStake  = 0;
  G.playerActiveShield = 0;
  G.opponentActiveStake  = 0;
  G.opponentActiveShield = 0;
  G.playerBlockedSpecials   = false;
  G.opponentBlockedSpecials = false;
  G.harvestActive  = false;
  G.roundGoal      = 21;
  G.lastOpponentSpecialUsed = null;
  hideResult();

  renderArena(false);
  renderPlayerHearts();
  renderOpponentBanner();
  setLog('Distribuindo cartas...', 'info');
  setActions(false, false);

  // ── 2 cartas iniciais para cada jogador ──
  const playerCount   = 2;
  const opponentCount = 2;
  const totalNeeded   = playerCount + opponentCount;
  const cards = drawCards(totalNeeded);

  // Distribui alternado: p0, o0, p1, o1, p2, o2, [p3?], [o3?]
  const pCards = [], oCards = [];
  let pi = 0, oi = 0, turn = 'p';
  for (const c of cards) {
    if (turn === 'p' && pi < playerCount)   { pCards.push(c); pi++; turn = 'o'; }
    else if (turn === 'o' && oi < opponentCount) { oCards.push(c); oi++; turn = 'p'; }
    else if (pi < playerCount)   { pCards.push(c); pi++; }
    else                          { oCards.push(c); oi++; }
  }

  // Primeira carta de cada é a secreta
  G.playerSecret   = pCards[0];
  G.playerCards    = pCards;
  G.opponentSecret = oCards[0];
  G.opponentCards  = oCards;

  // usedPublic: todas exceto a secreta do bot
  G.usedPublic = [
    ...pCards,
    ...oCards.slice(1),
  ];

  // 25% de chance de ganhar carta especial no início da rodada
  if (Math.random() < 0.25) {
    const bonus = randomSpecialCard();
    G.playerSpecials.push(bonus);
    setLog(`✨ Você recebeu uma carta especial: <b>${bonus.name}</b>!`, 'info');
    await delay(900);
  }
  if (Math.random() < 0.25) {
    G.opponentSpecials.push(randomSpecialCard());
  }

  G.phase = 'player-turn';
  renderArena(false);
  renderUsedCards();
  renderSpecialsPanel();
  renderOpponentBanner();
  setActiveSide('player');

  const ps = handScore(G.playerCards);
  const extra = playerCount === 4 ? ' (bônus: 4 cartas!)' : '';
  setLog(`Sua mão: ${ps}${extra}. Sua carta secreta brilha em ouro — só você a vê.`);
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

  const goal = G.roundGoal || 21;
  const ps = handScore(G.playerCards);
  if (ps > goal) {
    setLog(`Você recebeu ${vDisplay(card.value)}. Total: ${ps}. Estourou!`);
    G.playerStopped = true;
    renderArena(false);
    await revealAndResolve();
  } else if (ps === goal) {
    setLog(`Você recebeu ${vDisplay(card.value)}. Total: ${ps}! Perfeito — parando automaticamente.`);
    await playerStand();
  } else {
    setLog(`Você recebeu ${vDisplay(card.value)}. Total: ${ps}.`);
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

  // Bot tenta usar cartas especiais antes de decidir
  botUseSpecials();
  await delay(300);

  const score = handScore(G.opponentCards);
  const goal  = G.roundGoal || 21;
  const shouldHit = opponentShouldHit(score, opp.skill, G.usedPublic);

  if (!shouldHit || score >= goal) {
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
    renderSpecialsPanel();
    return;
  }

  setLog(`${opp.name} está pensando...`);
  await delay(700 + Math.random()*400);

  const [card] = drawCards(1);
  G.opponentCards.push(card);
  G.usedPublic.push(card);

  renderArena(false);
  renderUsedCards();
  setLog(`${opp.name} comprou ${vDisplay(card.value)}`);

  const os = handScore(G.opponentCards);
  if (os > goal) {
    G.opponentStopped = true;
    await delay(500);
    await revealAndResolve();
    return;
  }

  G.phase = 'player-turn';
  setActiveSide('player');
  setActions(true, true);
  renderSpecialsPanel();
}

async function revealAndResolve() {
  G.phase = 'reveal';
  setLog('Revelando as cartas secretas...');
  await delay(600);

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
    const dmg = Math.max(1, 1 + G.playerActiveStake - G.opponentActiveShield);
    G.opponentLives -= dmg;
    if (G.opponentLives < 0) G.opponentLives = 0;
    const dmgNote = dmg !== 1 ? ` (dano: ${dmg})` : '';
    setLog(`Você: ${ps} — ${opp.name}: ${os}. Você venceu!${dmgNote}`, 'win');
    renderOpponentBanner();

    if (G.opponentLives <= 0) {
      await delay(500);
      if (G.opponentIdx >= 6) { showScreen('victory'); return; }
      showResult('win', `${opp.name} foi derrotado!`, `Você venceu e agora enfrenta o próximo oponente.`);
      document.getElementById('result-btn').textContent = `Enfrentar ${OPPONENTS[G.opponentIdx+1].name} →`;
      document.getElementById('result-btn').onclick = advanceOpponent;
    } else {
      showResult('win', 'Rodada Vencida!', `Você: ${ps} — ${opp.name}: ${os}. Falta ${G.opponentLives} vida(s) para derrotar ${opp.name}.`);
      document.getElementById('result-btn').textContent = 'Próxima Rodada';
      document.getElementById('result-btn').onclick = nextRound;
    }
  } else if (winner === 'opponent') {
    const dmg = Math.max(1, 1 + G.opponentActiveStake - G.playerActiveShield);
    G.playerLives -= dmg;
    if (G.playerLives < 0) G.playerLives = 0;
    const dmgNote = dmg !== 1 ? ` (dano: ${dmg})` : '';
    setLog(`Você: ${ps} — ${opp.name}: ${os}. Você perdeu.${dmgNote}`, 'lose');
    renderPlayerHearts();
    document.getElementById('arena-player').classList.add('shake');
    setTimeout(() => document.getElementById('arena-player').classList.remove('shake'), 400);

    if (G.playerLives <= 0) { await delay(800); showScreen('gameover'); return; }
    showResult('lose', 'Rodada Perdida', `Você: ${ps} — ${opp.name}: ${os}. Você perdeu ${dmg} vida(s). ${G.playerLives} restante(s).`);
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
  // Ganha 3 cartas especiais ao vencer um oponente
  G.playerSpecials.push(randomSpecialCard());
  G.playerSpecials.push(randomSpecialCard());
  G.playerSpecials.push(randomSpecialCard());
  hideResult();
  startRound();
}

function nextRound() { hideResult(); startRound(); }
function restartGame() { startGame(); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => { showScreen('title'); })();