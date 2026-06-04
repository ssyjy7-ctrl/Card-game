const suits = [
  { symbol: "♠", color: "black" },
  { symbol: "♥", color: "red" },
  { symbol: "♣", color: "black" },
  { symbol: "♦", color: "red" },
];
const ranks = [
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10", value: 10 },
  { label: "J", value: 11 },
  { label: "Q", value: 12 },
  { label: "K", value: 13 },
  { label: "A", value: 14 },
];

const playerNames = ["你", "阿强", "小美"];
const ante = 20;
const raiseStep = 20;
const communityCount = 5;
const chipValues = [100, 50, 20, 10];
const modes = {
  texas: { title: "德州扑克", holeCount: 2, communityCount: 5, revealSteps: [3, 1, 1], maxBettingRounds: 4 },
  zjh: { title: "炸金花", holeCount: 3, communityCount: 0, revealSteps: [], maxBettingRounds: 8 },
  turtle: { title: "憋王八", holeCount: 0, communityCount: 0, revealSteps: [], maxBettingRounds: 0 },
};

let state;
let currentMode = null;
let audioContext = null;
let soundEnabled = true;
let voiceEnabled = false;
let voiceStopTimer = null;

const els = {
  modeMenu: document.querySelector("#modeMenu"),
  texasModeBtn: document.querySelector("#texasModeBtn"),
  zjhModeBtn: document.querySelector("#zjhModeBtn"),
  turtleModeBtn: document.querySelector("#turtleModeBtn"),
  homeBtn: document.querySelector("#homeBtn"),
  modeTitle: document.querySelector("#modeTitle"),
  communityPanel: document.querySelector(".community-panel"),
  players: document.querySelector("#players"),
  communityCards: document.querySelector("#communityCards"),
  potChipStack: document.querySelector("#potChipStack"),
  arenaPot: document.querySelector("#arenaPot"),
  chipFlight: document.querySelector("#chipFlight"),
  roundInfo: document.querySelector("#roundInfo"),
  pot: document.querySelector("#pot"),
  currentBet: document.querySelector("#currentBet"),
  playerChips: document.querySelector("#playerChips"),
  logPanel: document.querySelector(".log-panel"),
  log: document.querySelector("#log"),
  lookBtn: document.querySelector("#lookBtn"),
  callBtn: document.querySelector("#callBtn"),
  raiseBtn: document.querySelector("#raiseBtn"),
  raisePanel: document.querySelector("#raisePanel"),
  compareBtn: document.querySelector("#compareBtn"),
  foldBtn: document.querySelector("#foldBtn"),
  newRoundBtn: document.querySelector("#newRoundBtn"),
  soundBtn: document.querySelector("#soundBtn"),
  voiceBtn: document.querySelector("#voiceBtn"),
  lockLandscapeBtn: document.querySelector("#lockLandscapeBtn"),
};

const voiceLines = {
  look: ["看一眼。", "瞄下。", "能玩。"],
  call: ["跟。", "接。", "跟你。", "不跑。"],
  raise: ["加。", "抬一下。", "上压力。", "再加。"],
  fold: ["不要。", "我撤。", "弃了。", "不硬撑。"],
  showdown: ["开。", "亮牌。", "别藏了。"],
  thinking: ["快点。", "花都谢了。", "别演了。", "想好了没？"],
  win: ["收了。", "舒服。", "可以。"],
  lose: ["啧。", "认了。", "下把。"],
};

const voiceProfiles = [
  { rate: 0.98, pitch: 0.92 },
  { rate: 0.9, pitch: 0.82 },
  { rate: 1.04, pitch: 1.08 },
];

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => chooseChineseVoice();
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function chooseChineseVoice() {
  const voices = window.speechSynthesis.getVoices?.() || [];
  const voiceText = (voice) => `${voice.lang} ${voice.name} ${voice.voiceURI || ""}`;
  const isCantonese = (voice) => /粤|粵|Cantonese|Hong Kong|香港|zh-HK|zh_MO/i.test(voiceText(voice));
  return (
    voices.find((voice) => /^zh-CN$/i.test(voice.lang) && !isCantonese(voice)) ||
    voices.find((voice) => /Mandarin|普通话|普通話|Putonghua|China/i.test(voiceText(voice)) && !isCantonese(voice)) ||
    voices.find((voice) => /^zh/i.test(voice.lang) && !isCantonese(voice)) ||
    null
  );
}

function speakLine(kind, playerId = state?.turn ?? 0) {
  if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
  const text = randomItem(voiceLines[kind] || []);
  if (!text) return;
  window.speechSynthesis.cancel();
  if (voiceStopTimer) clearTimeout(voiceStopTimer);
  const utterance = new SpeechSynthesisUtterance(text);
  const profile = voiceProfiles[playerId] || voiceProfiles[0];
  const voice = chooseChineseVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = "zh-CN";
  utterance.rate = profile.rate + 0.18 + (Math.random() * 0.08 - 0.04);
  utterance.pitch = profile.pitch + (Math.random() * 0.1 - 0.05);
  utterance.volume = 0.92;
  window.speechSynthesis.speak(utterance);
  voiceStopTimer = setTimeout(() => {
    window.speechSynthesis.cancel();
    voiceStopTimer = null;
  }, 900);
}

function getAudioContext() {
  if (!soundEnabled || typeof window === "undefined") return null;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioContext) audioContext = new AudioCtor();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function tone(frequency, start, duration, type = "sine", gain = 0.05) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + start);
  volume.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  volume.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  volume.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  oscillator.connect(volume);
  volume.connect(ctx.destination);
  oscillator.start(ctx.currentTime + start);
  oscillator.stop(ctx.currentTime + start + duration + 0.02);
}

function noise(start, duration, gain = 0.05) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const source = ctx.createBufferSource();
  const volume = ctx.createGain();
  source.buffer = buffer;
  volume.gain.setValueAtTime(gain, ctx.currentTime + start);
  volume.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  source.connect(volume);
  volume.connect(ctx.destination);
  source.start(ctx.currentTime + start);
  source.stop(ctx.currentTime + start + duration);
}

function chipToneForValue(value) {
  if (value >= 100) return 520;
  if (value >= 50) return 680;
  if (value >= 20) return 860;
  return 1040;
}

function playChipSound(chips = [20]) {
  if (!soundEnabled) return;
  const limited = chips.slice(0, 14);
  limited.forEach((value, index) => {
    const start = index * 0.055;
    noise(start, 0.028, 0.08);
    tone(chipToneForValue(value), start + 0.004, 0.035, "triangle", 0.038);
    tone(chipToneForValue(value) * 1.52, start + 0.018, 0.026, "square", 0.012);
  });
  if (chips.length > limited.length) {
    noise(limited.length * 0.055, 0.09, 0.1);
  }
}

function playSound(name, detail) {
  if (!soundEnabled) return;
  if (name === "deal") {
    for (let i = 0; i < 9; i += 1) noise(i * 0.045, 0.035, 0.035);
  } else if (name === "flip") {
    noise(0, 0.06, 0.045);
    tone(520, 0.02, 0.08, "triangle", 0.035);
  } else if (name === "chip") {
    playChipSound(detail?.chips || [20]);
  } else if (name === "fold") {
    tone(180, 0, 0.1, "sawtooth", 0.025);
  } else if (name === "win") {
    for (let i = 0; i < 5; i += 1) noise(i * 0.045, 0.035, 0.04);
    tone(660, 0, 0.08, "triangle", 0.04);
    tone(880, 0.09, 0.1, "triangle", 0.04);
    tone(1180, 0.2, 0.14, "triangle", 0.045);
  } else if (name === "lose") {
    tone(260, 0, 0.12, "sawtooth", 0.035);
    tone(180, 0.12, 0.16, "sawtooth", 0.026);
  }
}

function clearAnimationSoon() {
  if (typeof setTimeout !== "function") return;
  setTimeout(() => {
    if (!state || state.ended) return;
    state.animateDeal = false;
    state.lastRevealed = -1;
    render();
  }, 760);
}

function clearChipMoveSoon() {
  if (typeof setTimeout !== "function") return;
  setTimeout(() => {
    if (!state) return;
    state.chipMove = null;
    renderChipFlight();
  }, 560);
}

function buildDeck() {
  return suits.flatMap((suit) =>
    ranks.map((rank) => ({
      suit: suit.symbol,
      color: suit.color,
      rank: rank.label,
      value: rank.value,
    })),
  );
}

function buildTurtleDeck() {
  return [
    ...buildDeck(),
    { suit: "★", color: "red", rank: "大王", value: 99, joker: true },
  ];
}

function shuffle(cards) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function createInventory(amount) {
  const inventory = { 100: 0, 50: 0, 20: 0, 10: 0 };
  let remaining = amount;
  chipValues.forEach((value) => {
    inventory[value] = Math.floor(remaining / value);
    remaining %= value;
  });
  return inventory;
}

function cloneInventory(inventory) {
  return { 100: inventory[100], 50: inventory[50], 20: inventory[20], 10: inventory[10] };
}

function addInventory(inventory, amount) {
  const extra = createInventory(amount);
  chipValues.forEach((value) => {
    inventory[value] += extra[value];
  });
}

function breakChip(player, target) {
  if (target === 50 && player.inventory[100] > 0) {
    player.inventory[100] -= 1;
    player.inventory[50] += 2;
    return true;
  }
  if (target === 20 && player.inventory[100] > 0) {
    player.inventory[100] -= 1;
    player.inventory[20] += 5;
    return true;
  }
  if (target === 10) {
    if (player.inventory[20] > 0) {
      player.inventory[20] -= 1;
      player.inventory[10] += 2;
      return true;
    }
    if (player.inventory[50] > 0) {
      player.inventory[50] -= 1;
      player.inventory[10] += 5;
      return true;
    }
    if (player.inventory[100] > 0) {
      player.inventory[100] -= 1;
      player.inventory[10] += 10;
      return true;
    }
  }
  return false;
}

function ensureChip(player, value) {
  if (player.inventory[value] > 0) return true;
  return breakChip(player, value);
}

function paymentChips(player, amount) {
  const paid = [];
  let remaining = amount;
  [50, 20, 10].forEach((value) => {
    while (remaining >= value) {
      if (!ensureChip(player, value)) break;
      player.inventory[value] -= 1;
      paid.push(value);
      remaining -= value;
    }
  });

  while (remaining > 0 && ensureChip(player, 10)) {
    player.inventory[10] -= 1;
    paid.push(10);
    remaining -= 10;
  }

  return paid;
}

function canPayAmount(player, amount) {
  if (amount > player.chips || amount < 0) return false;
  const clone = { inventory: cloneInventory(player.inventory) };
  return paymentChips(clone, amount).reduce((sum, value) => sum + value, 0) === amount;
}

function modeConfig() {
  return modes[currentMode || "texas"];
}

function startMode(mode) {
  currentMode = mode;
  els.modeMenu.classList.add("hidden");
  newRound(false);
}

function showModeMenu() {
  currentMode = null;
  state = null;
  els.modeMenu.classList.remove("hidden");
}

function newRound(keepChips = false) {
  if (!currentMode) return;
  if (currentMode === "turtle") {
    newTurtleRound();
    return;
  }
  const config = modeConfig();
  const oldChips = state?.players?.map((player) => player.chips) || [1000, 1000, 1000];
  const deck = shuffle(buildDeck());
  const players = playerNames.map((name, index) => ({
    id: index,
    name,
    chips: keepChips ? Math.max(oldChips[index], 0) : 1000,
    inventory: createInventory(keepChips ? Math.max(oldChips[index], 0) : 1000),
    roundBet: 0,
    hole: deck.splice(0, config.holeCount),
    seen: false,
    folded: false,
    winner: false,
  }));

  state = {
    deck,
    mode: currentMode,
    community: deck.splice(0, config.communityCount),
    revealed: 0,
    pot: 0,
    potChips: [],
    currentBet: ante,
    turn: 0,
    bettingRound: 1,
    ended: false,
    actionsThisRound: new Set(),
    raiseMenuOpen: false,
    endMessageLogged: false,
    logs: [],
    players,
    animateDeal: true,
    animateLook: false,
    lastRevealed: -1,
    chipMove: null,
  };

  state.players.forEach((player) => pay(player, ante));
  addLog(`进入${config.title}，每人下底注 ${ante}。`);
  addLog(`每人拿到 ${config.holeCount} 张底牌。`);
  playSound("deal");
  render();
  clearAnimationSoon();
}

function pay(player, amount, animate = false) {
  const realAmount = Math.min(player.chips, amount);
  const paidChips = paymentChips(player, realAmount);
  player.chips -= realAmount;
  state.pot += realAmount;
  state.potChips.push(...paidChips);
  if (animate && realAmount > 0) {
    state.chipMove = { playerId: player.id, amount: realAmount, chips: paidChips, nonce: Date.now() };
    clearChipMoveSoon();
  }
  return { amount: realAmount, chips: paidChips };
}

function activePlayers() {
  return state.players.filter((player) => !player.folded);
}

function bettingPlayers() {
  return state.players.filter((player) => !player.folded && player.chips > 0);
}

function human() {
  return state.players[0];
}

function visibleCommunity() {
  return state.community.slice(0, state.revealed);
}

function addLog(text) {
  state.logs.push(text);
}

function turtlePairCleanup(player) {
  const buckets = player.hole.reduce((map, card) => {
    if (card.joker) return map;
    map[card.value] ||= [];
    map[card.value].push(card);
    return map;
  }, {});
  const removed = [];
  Object.values(buckets).forEach((cards) => {
    while (cards.length >= 2) {
      removed.push(cards.pop(), cards.pop());
    }
  });
  if (!removed.length) return 0;
  const removeSet = new Set(removed);
  player.hole = player.hole.filter((card) => !removeSet.has(card));
  return removed.length / 2;
}

function cleanupAllTurtlePairs() {
  state.players.forEach((player) => {
    const pairs = turtlePairCleanup(player);
    if (pairs) addLog(`${player.name}打出 ${pairs} 对。`);
  });
}

function newTurtleRound() {
  const deck = shuffle(buildTurtleDeck());
  const players = playerNames.map((name, index) => ({
    id: index,
    name,
    chips: 0,
    inventory: createInventory(0),
    roundBet: 0,
    hole: [],
    seen: index === 0,
    folded: false,
    winner: false,
  }));
  deck.forEach((card, index) => {
    players[index % players.length].hole.push(card);
  });

  state = {
    deck: [],
    mode: "turtle",
    community: [],
    revealed: 0,
    pot: 0,
    potChips: [],
    currentBet: 0,
    turn: 0,
    bettingRound: 1,
    ended: false,
    actionsThisRound: new Set(),
    raiseMenuOpen: false,
    logs: [],
    players,
    animateDeal: true,
    animateLook: false,
    lastRevealed: -1,
    chipMove: null,
    endMessageLogged: false,
  };
  addLog("进入憋王八：去小王留大王，发给三人。");
  cleanupAllTurtlePairs();
  addLog("轮流从下家抽一张牌，抽完自动打对子。");
  render();
  clearAnimationSoon();
}

function turtleActivePlayers() {
  return state.players.filter((player) => player.hole.length > 0);
}

function nextTurtlePlayer(fromId) {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const player = state.players[(fromId + offset) % state.players.length];
    if (player.hole.length > 0) return player;
  }
  return null;
}

function advanceTurtleTurn() {
  const active = turtleActivePlayers();
  if (active.length <= 1) {
    endTurtleRound(active[0] || state.players.find((player) => player.hole.some((card) => card.joker)));
    return;
  }
  do {
    state.turn = (state.turn + 1) % state.players.length;
  } while (state.players[state.turn].hole.length === 0);
  render();
  if (state.turn !== 0) {
    if (Math.random() < 0.3) speakLine("thinking", state.turn);
    setTimeout(cpuTurtleAction, 650);
  }
}

function drawTurtleCard(drawer, target, cardIndex = null) {
  if (state.ended || !target || !target.hole.length) return;
  const index = cardIndex ?? Math.floor(Math.random() * target.hole.length);
  const [card] = target.hole.splice(index, 1);
  drawer.hole.push(card);
  addLog(`${drawer.name}从${target.name}手里抽走 1 张牌。`);
  const pairs = turtlePairCleanup(drawer);
  if (pairs) addLog(`${drawer.name}打出 ${pairs} 对。`);
  if (card.joker) addLog(`${drawer.name}摸到了那张不妙的牌。`);
  playSound("flip");
  advanceTurtleTurn();
}

function canHumanDrawFrom(player) {
  return state?.mode === "turtle" && !state.ended && state.turn === 0 && player.id !== 0 && player.hole.length > 0;
}

function cpuTurtleAction() {
  if (state.ended || state.turn === 0) return;
  drawTurtleCard(state.players[state.turn], nextTurtlePlayer(state.turn));
}

function endTurtleRound(loser) {
  const finalLoser = loser || state.players.find((player) => player.hole.some((card) => card.joker));
  state.ended = true;
  state.players.forEach((player) => {
    player.seen = true;
    player.winner = player.id !== finalLoser?.id;
  });
  addLog(`${finalLoser?.name || "没人"}手里剩下大王，输了。`);
  addLog("本局结束，可重新开局。");
  playSound(finalLoser?.id === 0 ? "lose" : "win");
  render();
}

function combinations(cards, size) {
  const result = [];
  function walk(start, combo) {
    if (combo.length === size) {
      result.push(combo);
      return;
    }
    for (let i = start; i <= cards.length - (size - combo.length); i += 1) {
      walk(i + 1, [...combo, cards[i]]);
    }
  }
  walk(0, []);
  return result;
}

function scoreFive(cards) {
  const values = cards.map((card) => card.value).sort((a, b) => b - a);
  const suitsSame = cards.every((card) => card.suit === cards[0].suit);
  const counts = values.reduce((map, value) => {
    map[value] = (map[value] || 0) + 1;
    return map;
  }, {});
  const groups = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  const unique = [...new Set(values)];
  const wheel = unique.join(",") === "14,5,4,3,2";
  const straight = unique.length === 5 && (wheel || unique[0] - unique[4] === 4);
  const straightHigh = wheel ? 5 : unique[0];

  if (straight && suitsSame) return { level: 9, name: "同花顺", ranks: [straightHigh], cards };
  if (groups[0].count === 4) {
    return { level: 8, name: "四条", ranks: [groups[0].value, groups[1].value], cards };
  }
  if (groups[0].count === 3 && groups[1].count === 2) {
    return { level: 7, name: "葫芦", ranks: [groups[0].value, groups[1].value], cards };
  }
  if (suitsSame) return { level: 6, name: "同花", ranks: values, cards };
  if (straight) return { level: 5, name: "顺子", ranks: [straightHigh], cards };
  if (groups[0].count === 3) {
    return {
      level: 4,
      name: "三条",
      ranks: [groups[0].value, ...groups.filter((group) => group.count === 1).map((group) => group.value)],
      cards,
    };
  }
  if (groups[0].count === 2 && groups[1].count === 2) {
    const pairs = groups.filter((group) => group.count === 2).map((group) => group.value);
    const kicker = groups.find((group) => group.count === 1).value;
    return { level: 3, name: "两对", ranks: [...pairs, kicker], cards };
  }
  if (groups[0].count === 2) {
    return {
      level: 2,
      name: "一对",
      ranks: [groups[0].value, ...groups.filter((group) => group.count === 1).map((group) => group.value)],
      cards,
    };
  }
  return { level: 1, name: "高牌", ranks: values, cards };
}

function compareScores(left, right) {
  if (left.level !== right.level) return left.level - right.level;
  const length = Math.max(left.ranks.length, right.ranks.length);
  for (let i = 0; i < length; i += 1) {
    if ((left.ranks[i] || 0) !== (right.ranks[i] || 0)) {
      return (left.ranks[i] || 0) - (right.ranks[i] || 0);
    }
  }
  return 0;
}

function bestScore(cards) {
  if (cards.length < 5) return null;
  return combinations(cards, 5).reduce((best, combo) => {
    const score = scoreFive(combo);
    return !best || compareScores(score, best) > 0 ? score : best;
  }, null);
}

function scoreThree(cards) {
  const values = cards.map((card) => card.value).sort((a, b) => b - a);
  const suitsSame = cards.every((card) => card.suit === cards[0].suit);
  const counts = values.reduce((map, value) => {
    map[value] = (map[value] || 0) + 1;
    return map;
  }, {});
  const groups = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  const wheel = values.join(",") === "14,3,2";
  const straightHigh = wheel ? 3 : values[0];
  const straight = wheel || values[0] - 1 === values[1] && values[1] - 1 === values[2];

  if (groups[0].count === 3) return { level: 6, name: "豹子", ranks: [groups[0].value], cards };
  if (straight && suitsSame) return { level: 5, name: "同花顺", ranks: [straightHigh], cards };
  if (suitsSame) return { level: 4, name: "同花", ranks: values, cards };
  if (straight) return { level: 3, name: "顺子", ranks: [straightHigh], cards };
  if (groups[0].count === 2) {
    const kicker = groups.find((group) => group.count === 1).value;
    return { level: 2, name: "对子", ranks: [groups[0].value, kicker], cards };
  }
  return { level: 1, name: "散牌", ranks: values, cards };
}

function playerScore(player, revealAll = false) {
  if (state.mode === "zjh") return scoreThree(player.hole);
  const publicCards = revealAll ? state.community : visibleCommunity();
  return bestScore([...player.hole, ...publicCards]);
}

function roughStrength(player) {
  const score = playerScore(player);
  if (score) return score.level;
  const values = player.hole.map((card) => card.value);
  const unique = new Set(values);
  if (unique.size === 1) return 5;
  if (unique.size === 2) return 3;
  return Math.max(...values) >= 12 ? 2 : 1;
}

function requiredCall(player) {
  return Math.min(player.chips, Math.max(0, state.currentBet - player.roundBet));
}

function noteAction(player) {
  state.actionsThisRound.add(player.id);
}

function call(player) {
  const payment = pay(player, requiredCall(player), true);
  player.roundBet += payment.amount;
  noteAction(player);
  state.raiseMenuOpen = false;
  addLog(payment.amount > 0 ? `${player.name}跟注 ${payment.amount}。` : `${player.name}已无可用筹码，等待摊牌。`);
  playSound("chip", payment);
  if (payment.amount > 0) speakLine("call", player.id);
  afterAction();
}

function possibleRaiseAmounts(player) {
  const amounts = [];
  const minRaise = state.currentBet + raiseStep;
  const maxTotal = player.roundBet + player.chips;
  const maxShown = Math.min(maxTotal, state.currentBet + 200);
  for (let amount = minRaise; amount <= maxShown; amount += 10) {
    if (canPayAmount(player, amount - player.roundBet)) amounts.push(amount);
  }
  if (maxTotal > maxShown && canPayAmount(player, maxTotal - player.roundBet)) {
    amounts.push(maxTotal);
  }
  return amounts;
}

function raise(player, amount = state.currentBet + raiseStep) {
  const target = Math.min(player.roundBet + player.chips, amount);
  const needed = target - player.roundBet;
  if (target <= state.currentBet || needed <= 0 || !canPayAmount(player, needed)) {
    addLog(`${player.name}没有可用筹码完成这次加注。`);
    render();
    return;
  }
  state.currentBet = target;
  const payment = pay(player, needed, true);
  player.roundBet += payment.amount;
  state.actionsThisRound.clear();
  noteAction(player);
  state.raiseMenuOpen = false;
  addLog(`${player.name}加注到 ${state.currentBet}，投入 ${payment.amount}。`);
  playSound("chip", payment);
  speakLine("raise", player.id);
  afterAction();
}

function fold(player) {
  player.folded = true;
  noteAction(player);
  state.raiseMenuOpen = false;
  addLog(`${player.name}弃牌。`);
  playSound("fold");
  speakLine("fold", player.id);
  afterAction();
}

function afterAction() {
  if (state.ended) return;
  const alive = activePlayers();
  if (alive.length === 1) {
    endRound(alive[0], "其他玩家都已弃牌");
    return;
  }

  const playersWhoCanBet = bettingPlayers();
  if (!playersWhoCanBet.length) {
    showdown("所有剩余玩家都已全下");
    return;
  }

  const everyoneActed = playersWhoCanBet.every((player) => state.actionsThisRound.has(player.id));
  if (everyoneActed) {
    advanceRound();
    return;
  }

  moveTurn();
}

function advanceRound() {
  if (state.mode === "zjh") {
    state.actionsThisRound.clear();
    state.players.forEach((player) => {
      player.roundBet = 0;
    });
    state.bettingRound += 1;
    if (state.bettingRound > modeConfig().maxBettingRounds) {
      showdown("达到封顶轮数");
      return;
    }
    state.turn = firstBettingPlayerId();
    addLog(`进入第 ${state.bettingRound} 轮下注。`);
    render();
    if (state.turn !== 0) {
      if (Math.random() < 0.28) speakLine("thinking", state.turn);
      setTimeout(cpuAction, 650);
    }
    return;
  }
  advanceCommunity();
}

function advanceCommunity() {
  state.actionsThisRound.clear();
  state.players.forEach((player) => {
    player.roundBet = 0;
  });

  if (state.revealed < modeConfig().communityCount) {
    const step = modeConfig().revealSteps[Math.min(state.bettingRound - 1, modeConfig().revealSteps.length - 1)] || 1;
    const from = state.revealed;
    state.revealed = Math.min(modeConfig().communityCount, state.revealed + step);
    state.lastRevealed = state.revealed - 1;
    const shown = state.community.slice(from, state.revealed).map((card) => `${card.rank}${card.suit}`).join("、");
    addLog(`公共牌翻出：${shown}。`);
    playSound("flip");
    state.bettingRound += 1;
    state.turn = firstBettingPlayerId();
    render();
    clearAnimationSoon();
    if (state.turn !== 0) {
      if (Math.random() < 0.28) speakLine("thinking", state.turn);
      setTimeout(cpuAction, 650);
    }
    return;
  }

  showdown("五张公共牌全部翻出");
}

function firstActivePlayerId() {
  return activePlayers()[0].id;
}

function firstBettingPlayerId() {
  return (bettingPlayers()[0] || activePlayers()[0]).id;
}

function moveTurn() {
  if (state.ended) return;
  do {
    state.turn = (state.turn + 1) % state.players.length;
  } while (state.players[state.turn].folded || state.players[state.turn].chips <= 0);

  render();
  if (state.turn !== 0) {
    if (Math.random() < 0.28) speakLine("thinking", state.turn);
    setTimeout(cpuAction, 650);
  }
}

function showdown(reason = "摊牌") {
  state.revealed = communityCount;
  const scoredPlayers = activePlayers().map((player) => ({
    player,
    score: playerScore(player, true),
  }));
  const best = scoredPlayers.reduce((winner, current) =>
    compareScores(current.score, winner.score) > 0 ? current : winner,
  );
  const winners = scoredPlayers
    .filter((entry) => compareScores(entry.score, best.score) === 0)
    .map((entry) => entry.player);
  endRound(winners, reason, best.score);
}

function endRound(winners, reason, winningScore = null) {
  const winnerList = Array.isArray(winners) ? winners : [winners];
  state.ended = true;
  winnerList.forEach((winner) => {
    winner.winner = true;
  });
  state.players.forEach((player) => {
    player.seen = true;
  });

  const pot = state.pot;
  const share = Math.floor(pot / winnerList.length);
  const remainder = pot % winnerList.length;
  winnerList.forEach((winner, index) => {
    const payout = share + (index === 0 ? remainder : 0);
    winner.chips += payout;
    addInventory(winner.inventory, payout);
  });

  const score = winningScore || playerScore(winnerList[0], true);
  const scoreText = score ? `以${score.name}` : "";
  if (winnerList.length === 1) {
    addLog(`${reason}，${winnerList[0].name}${scoreText}赢得 ${pot}。`);
  } else {
    addLog(`${reason}，${winnerList.map((winner) => winner.name).join("、")}同为${score.name}，平分 ${pot}。`);
  }
  if (!state.endMessageLogged) {
    addLog("本局结束，可重新开局。");
    state.endMessageLogged = true;
  }
  const humanWon = winnerList.some((winner) => winner.id === 0);
  playSound(humanWon ? "win" : "lose");
  speakLine(humanWon ? "win" : "lose", winnerList[0]?.id ?? 0);
  state.pot = 0;
  state.potChips = [];
  render();
}

function cpuAction() {
  if (state.ended || state.turn === 0) return;
  const player = state.players[state.turn];
  player.seen = true;
  if (player.chips <= 0) {
    noteAction(player);
    afterAction();
    return;
  }
  const strength = roughStrength(player);
  const pressure = state.currentBet / Math.max(player.chips, 1);

  if (strength <= 1 && pressure > 0.16 && Math.random() < 0.45) {
    fold(player);
  } else if (strength >= 4 && Math.random() < 0.38) {
    const options = possibleRaiseAmounts(player);
    if (options.length) {
      raise(player, options[Math.min(2, options.length - 1)]);
    } else {
      call(player);
    }
  } else {
    call(player);
  }
}

function makeCard(card, hidden, extraClass = "", delay = 0) {
  const style = delay ? ` style="animation-delay: ${delay}ms"` : "";
  if (hidden) return `<div class="card back ${extraClass}"${style} aria-label="暗牌"></div>`;
  if (card.joker) {
    return `
      <div class="card joker-card red ${extraClass}"${style} aria-label="大王">
        <span class="rank">王</span>
        <span class="suit">★</span>
        <span class="rank bottom">大</span>
      </div>
    `;
  }
  return `
    <div class="card ${card.color === "red" ? "red" : ""} ${extraClass}"${style} aria-label="${card.rank}${card.suit}">
      <span class="rank">${card.rank}</span>
      <span class="suit">${card.suit}</span>
      <span class="rank bottom">${card.rank}</span>
    </div>
  `;
}

function chipClass(value) {
  if (value >= 100) return "chip black-chip";
  if (value >= 50) return "chip red-chip";
  if (value >= 20) return "chip blue-chip";
  return "chip gold-chip";
}

function chipsFromInventory(inventory) {
  return chipValues.flatMap((value) => Array.from({ length: inventory[value] }, () => value));
}

function renderChipPiles(chips) {
  if (!chips.length) return `<span class="empty-stack">空</span>`;
  const piles = chipValues.flatMap((value) => {
    const group = chips.filter((chip) => chip === value);
    const chunks = [];
    for (let i = 0; i < group.length; i += 5) {
      chunks.push(group.slice(i, i + 5));
    }
    return chunks;
  });
  return piles
    .map((group) => {
      const value = group[0];
      return `
        <span class="chip-pile chip-pile-${value}">
          ${group
            .map((chip, index) => `<span class="${chipClass(chip)}" style="--chip-index:${index}">${chip}</span>`)
            .join("")}
        </span>
      `;
    })
    .join("");
}

function renderPlayerChips(player) {
  const chips = chipsFromInventory(player.inventory);
  return renderChipPiles(chips);
}

function renderPotChips() {
  const chips = state.potChips;
  if (!chips.length) return "";
  return renderChipPiles(chips);
}

function renderChipFlight() {
  if (!els.chipFlight) return;
  if (!state?.chipMove) {
    els.chipFlight.className = "chip-flight";
    els.chipFlight.textContent = "";
    return;
  }
  els.chipFlight.className = `chip-flight fly from-${state.chipMove.playerId}`;
  els.chipFlight.innerHTML = renderChipPiles(state.chipMove.chips);
}

function renderCommunity() {
  els.communityPanel.classList.toggle("hidden", state.mode === "zjh" || state.mode === "turtle");
  els.communityCards.innerHTML = state.community
    .map((card, index) => {
      const extraClass = index === state.lastRevealed ? "flip-in" : "";
      return makeCard(card, index >= state.revealed, extraClass);
    })
    .join("");
}

function renderPlayers() {
  if (state.mode === "turtle") {
    renderTurtlePlayers();
    return;
  }
  els.players.innerHTML = state.players
    .map((player) => {
      const hidden = player.id === 0 ? !player.seen && !state.ended : !state.ended;
      const score = playerScore(player, state.ended);
      const typeText = score ? `最佳：${score.name}` : "等待更多公共牌";
      const lookFlip = player.id === 0 && state.animateLook;
      return `
        <article class="player seat-${player.id} ${state.turn === player.id && !state.ended ? "active" : ""} ${player.folded ? "folded" : ""} ${player.winner ? "winner" : ""}">
          <div class="player-head">
            <div>
              <div class="name">${player.name}</div>
              <div>${player.id === 0 && player.seen ? "已看私牌" : "私牌"}</div>
            </div>
            <div>${player.folded ? "已弃牌" : state.turn === player.id && !state.ended ? "行动中" : "等待"}</div>
          </div>
          <div class="cards">${player.hole.map((card, cardIndex) => {
            const delay = state.animateDeal ? player.id * 120 + cardIndex * 45 : 0;
            const extraClass = `${state.animateDeal ? "deal-in" : ""} ${lookFlip ? "look-flip" : ""}`;
            return makeCard(card, hidden, extraClass, delay);
          }).join("")}</div>
          <div class="player-bank">
            <div class="chip-stack">${renderPlayerChips(player)}</div>
            <strong>${player.chips}</strong>
          </div>
          <div class="hand-type">${player.id === 0 && player.seen || state.ended ? typeText : ""}</div>
        </article>
      `;
    })
    .join("");
}

function renderTurtlePlayers() {
  els.players.innerHTML = state.players
    .map((player) => {
      const canDraw = canHumanDrawFrom(player);
      const status = player.hole.length === 0 ? "已出完" : state.turn === player.id && !state.ended ? "行动中" : "等待";
      return `
        <article class="player turtle-player seat-${player.id} ${state.turn === player.id && !state.ended ? "active" : ""} ${player.winner ? "winner" : ""}">
          <div class="player-head">
            <div>
              <div class="name">${player.name}</div>
              <div>${player.hole.length} 张手牌</div>
            </div>
            <div>${status}</div>
          </div>
          <div class="cards turtle-cards">${player.hole.map((card, cardIndex) => {
            const showFace = player.id === 0 || state.ended;
            const cardHtml = makeCard(card, !showFace, canDraw ? "draw-target" : "", 0);
            return canDraw
              ? `<button class="draw-card-button" data-player-id="${player.id}" data-card-index="${cardIndex}" aria-label="抽${player.name}第${cardIndex + 1}张牌">${cardHtml}</button>`
              : cardHtml;
          }).join("")}</div>
          <div class="hand-type">${player.id === 0 ? "点击对手背面牌抽牌" : canDraw ? "可抽" : ""}</div>
        </article>
      `;
    })
    .join("");
}

function renderControls() {
  if (state.mode === "turtle") {
    const isHumanTurn = !state.ended && state.turn === 0;
    els.lookBtn.disabled = true;
    els.lookBtn.textContent = isHumanTurn ? "点牌抽" : "等待";
    els.callBtn.disabled = true;
    els.raiseBtn.disabled = true;
    els.compareBtn.disabled = true;
    els.foldBtn.disabled = true;
    els.raisePanel.innerHTML = "";
    els.raisePanel.classList.remove("open");
    return;
  }
  const isHumanTurn = !state.ended && state.turn === 0 && !human().folded;
  const raiseOptions = isHumanTurn ? possibleRaiseAmounts(human()) : [];
  els.lookBtn.disabled = !isHumanTurn || human().seen;
  els.callBtn.disabled = !isHumanTurn || human().chips <= 0;
  els.raiseBtn.disabled = !isHumanTurn || !raiseOptions.length;
  els.raiseBtn.textContent = state.raiseMenuOpen ? "收起" : "加注";
  els.compareBtn.disabled = !isHumanTurn || activePlayers().length < 2;
  els.compareBtn.textContent = state.mode === "zjh" || state.revealed < modeConfig().communityCount ? "强开" : "摊牌";
  els.foldBtn.disabled = !isHumanTurn;
  renderRaisePanel(isHumanTurn, raiseOptions);
}

function renderRaisePanel(isHumanTurn, raiseOptions) {
  if (!els.raisePanel) return;
  if (!isHumanTurn || !state.raiseMenuOpen || !raiseOptions.length) {
    els.raisePanel.innerHTML = "";
    els.raisePanel.classList.remove("open");
    return;
  }

  const shown = raiseOptions.slice(0, 12);
  els.raisePanel.classList.add("open");
  els.raisePanel.innerHTML = `
    <span>加注到</span>
    ${shown.map((amount) => `<button class="raise-option" data-amount="${amount}">${amount}</button>`).join("")}
  `;
}

function render() {
  if (!state) return;
  document.body.dataset.mode = state.mode;
  renderCommunity();
  renderPlayers();
  els.potChipStack.innerHTML = renderPotChips();
  els.arenaPot.textContent = state.pot;
  document.querySelector(".table-pot").classList.toggle("hidden", state.mode === "turtle");
  renderChipFlight();
  els.pot.textContent = state.pot;
  els.currentBet.textContent = state.currentBet;
  els.playerChips.textContent = human().chips;
  els.modeTitle.textContent = modeConfig().title;
  els.roundInfo.textContent = state.ended
    ? ""
    : state.mode === "zjh"
      ? `第 ${state.bettingRound} 轮 · ${state.players[state.turn].name}行动`
      : `第 ${state.bettingRound} 轮 · 公共牌 ${state.revealed}/${modeConfig().communityCount} · ${state.players[state.turn].name}行动`;
  els.log.innerHTML = state.logs.map((entry) => `<li>${entry}</li>`).join("");
  if (els.logPanel) els.logPanel.scrollTop = els.logPanel.scrollHeight;
  renderControls();
}

els.lookBtn.addEventListener("click", () => {
  getAudioContext();
  human().seen = true;
  state.animateLook = true;
  addLog("你看了自己的 3 张私牌，其他人看不到。");
  playSound("flip");
  speakLine("look", 0);
  render();
  setTimeout(() => {
    state.animateLook = false;
    render();
  }, 540);
});

els.callBtn.addEventListener("click", () => call(human()));
els.raiseBtn.addEventListener("click", () => {
  state.raiseMenuOpen = !state.raiseMenuOpen;
  renderControls();
});
els.raisePanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-amount]");
  if (!button) return;
  raise(human(), Number(button.dataset.amount));
});
els.players.addEventListener("click", (event) => {
  const button = event.target.closest(".draw-card-button");
  if (!button || state?.mode !== "turtle" || state.turn !== 0 || state.ended) return;
  const target = state.players[Number(button.dataset.playerId)];
  drawTurtleCard(human(), target, Number(button.dataset.cardIndex));
});
els.compareBtn.addEventListener("click", () => {
  speakLine("showdown", 0);
  call(human());
  if (!state.ended) showdown(state.mode === "zjh" || state.revealed < modeConfig().communityCount ? "你强行开牌" : "你选择摊牌");
});
els.foldBtn.addEventListener("click", () => fold(human()));
els.newRoundBtn.addEventListener("click", () => {
  getAudioContext();
  newRound(true);
});
els.soundBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  els.soundBtn.textContent = soundEnabled ? "♪" : "×";
  if (soundEnabled) {
    getAudioContext();
    playSound("chip");
  }
});
els.voiceBtn.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  els.voiceBtn.textContent = voiceEnabled ? "言" : "话";
  if (voiceEnabled) speakLine("thinking", 0);
  if (!voiceEnabled && typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    if (voiceStopTimer) clearTimeout(voiceStopTimer);
    voiceStopTimer = null;
  }
});
els.texasModeBtn.addEventListener("click", () => startMode("texas"));
els.zjhModeBtn.addEventListener("click", () => startMode("zjh"));
els.turtleModeBtn.addEventListener("click", () => {
  window.location.href = "turtle.html";
});
els.homeBtn.addEventListener("click", () => showModeMenu());
els.lockLandscapeBtn?.addEventListener("click", async () => {
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
    if (screen.orientation?.lock) {
      await screen.orientation.lock("landscape");
    }
  } catch (error) {
    addLog("当前浏览器不支持自动锁定横屏，请手动旋转手机。");
    render();
  }
});

showModeMenu();
