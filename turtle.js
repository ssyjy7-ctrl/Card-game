const suits = [
  { symbol: "♠", color: "black" },
  { symbol: "♥", color: "red" },
  { symbol: "♣", color: "black" },
  { symbol: "♦", color: "red" },
];

const ranks = [
  { label: "A", value: 14 },
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
];

const baseNames = ["你", "阿强", "小美", "老周", "小林"];

const els = {
  players: document.querySelector("#players"),
  log: document.querySelector("#log"),
  logPanel: document.querySelector(".log-panel"),
  newRoundBtn: document.querySelector("#newRoundBtn"),
  aiCount: document.querySelector("#aiCount"),
  roundText: document.querySelector("#roundText"),
  discardCount: document.querySelector("#discardCount"),
};

let state;

function buildDeck() {
  const cards = suits.flatMap((suit) =>
    ranks.map((rank) => ({
      id: `${suit.symbol}${rank.label}`,
      suit: suit.symbol,
      color: suit.color,
      rank: rank.label,
      value: rank.value,
    }))
  );
  cards.push({
    id: "BJ",
    suit: "★",
    color: "red",
    rank: "大王",
    value: 99,
    joker: true,
  });
  return cards;
}

function shuffle(cards) {
  const list = [...cards];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function addLog(text) {
  state.logs.push(text);
}

function makePlayers() {
  const aiCount = Number(els.aiCount.value);
  return baseNames.slice(0, aiCount + 1).map((name, index) => ({
    id: index,
    name,
    kind: index === 0 ? "human" : "ai",
    hand: [],
    done: false,
    winner: false,
  }));
}

function newRound() {
  const deck = shuffle(buildDeck());
  const players = makePlayers();
  deck.forEach((card, index) => {
    players[index % players.length].hand.push(card);
  });

  state = {
    players,
    turn: 0,
    ended: false,
    logs: [],
    discardedPairs: 0,
  };

  addLog(`开局：去掉小王，只留一张大王，${players.length} 人分牌。`);
  players.forEach((player) => {
    const pairs = discardPairs(player);
    if (pairs) addLog(`${player.name}开局打出 ${pairs} 对。`);
  });
  addLog("轮到你，从下一家背面牌里手动点一张抽走。");
  render();
}

function discardPairs(player) {
  const buckets = new Map();
  player.hand.forEach((card) => {
    if (card.joker) return;
    if (!buckets.has(card.value)) buckets.set(card.value, []);
    buckets.get(card.value).push(card.id);
  });

  const removedIds = new Set();
  let pairs = 0;
  buckets.forEach((ids) => {
    while (ids.length >= 2) {
      removedIds.add(ids.pop());
      removedIds.add(ids.pop());
      pairs += 1;
    }
  });

  if (pairs) {
    state.discardedPairs += pairs;
    player.hand = player.hand.filter((card) => !removedIds.has(card.id));
  }
  player.done = player.hand.length === 0;
  return pairs;
}

function activePlayers() {
  return state.players.filter((player) => player.hand.length > 0);
}

function nextPlayer(fromId) {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const player = state.players[(fromId + offset) % state.players.length];
    if (player.hand.length > 0) return player;
  }
  return null;
}

function currentPlayer() {
  return state.players[state.turn];
}

function canDrawFrom(player) {
  if (state.ended || currentPlayer()?.kind !== "human") return false;
  const target = nextPlayer(state.turn);
  return target?.id === player.id;
}

function drawCard(drawer, target, cardIndex) {
  if (state.ended || !drawer || !target || !target.hand.length) return;
  const index = Math.max(0, Math.min(cardIndex, target.hand.length - 1));
  const [card] = target.hand.splice(index, 1);
  drawer.hand.push(card);
  target.done = target.hand.length === 0;

  addLog(`${drawer.name}从${target.name}手里抽走 1 张牌。`);
  const pairs = discardPairs(drawer);
  if (pairs) addLog(`${drawer.name}打出 ${pairs} 对。`);
  if (card.joker) addLog(`${drawer.name}抽到了大王。`);

  advanceTurn();
}

function advanceTurn() {
  const active = activePlayers();
  if (active.length <= 1) {
    endRound(active[0] || state.players.find((player) => player.hand.some((card) => card.joker)));
    return;
  }

  do {
    state.turn = (state.turn + 1) % state.players.length;
  } while (state.players[state.turn].hand.length === 0);

  render();

  if (currentPlayer().kind === "ai") {
    const delay = 650 + Math.random() * 500;
    window.setTimeout(aiAction, delay);
  }
}

function aiAction() {
  if (state.ended || currentPlayer().kind !== "ai") return;
  const drawer = currentPlayer();
  const target = nextPlayer(drawer.id);
  const index = Math.floor(Math.random() * target.hand.length);
  drawCard(drawer, target, index);
}

function endRound(loser) {
  const finalLoser = loser || state.players.find((player) => player.hand.some((card) => card.joker));
  state.ended = true;
  state.players.forEach((player) => {
    player.winner = player.id !== finalLoser?.id;
  });
  addLog(`${finalLoser?.name || "没人"}最后剩下大王，输了。`);
  addLog("本局结束，可以重新开局。");
  render();
}

function makeCard(card, hidden = false) {
  if (hidden) return `<div class="card back" aria-hidden="true"></div>`;
  const red = card.color === "red" ? "red" : "";
  const joker = card.joker ? "joker-card" : "";
  const center = card.joker ? "王" : card.suit;
  const rank = card.rank;
  return `
    <div class="card ${red} ${joker}">
      <span class="rank">${rank}</span>
      <span class="suit">${center}</span>
      <span class="rank bottom">${rank}</span>
    </div>
  `;
}

function renderPlayers() {
  els.players.innerHTML = state.players
    .map((player) => {
      const canDraw = canDrawFrom(player);
      const isHuman = player.kind === "human";
      const showFaces = isHuman || state.ended;
      const status = player.done
        ? "已出完"
        : state.turn === player.id && !state.ended
          ? "行动中"
          : canDraw
            ? "请抽这里"
            : "等待";
      const note = isHuman
        ? "你的手牌"
        : canDraw
          ? "点一张背面牌抽走"
          : `${player.hand.length} 张手牌`;

      return `
        <article class="player seat-${player.id} ${state.turn === player.id && !state.ended ? "active" : ""} ${player.done ? "done" : ""}">
          <header class="player-head">
            <div>
              <div class="name">${player.name}</div>
              <div>${player.kind === "human" ? "玩家" : "人机"}</div>
            </div>
            <div class="status">${status}</div>
          </header>
          <div class="cards">
            ${player.hand.map((card, index) => {
              const html = makeCard(card, !showFaces);
              return canDraw
                ? `<button class="card-button" data-player-id="${player.id}" data-card-index="${index}" aria-label="抽${player.name}第${index + 1}张牌">${html}</button>`
                : html;
            }).join("")}
          </div>
          <div class="player-note">${note}</div>
        </article>
      `;
    })
    .join("");
}

function render() {
  renderPlayers();
  els.discardCount.textContent = `${state.discardedPairs} 对`;
  const actor = state.ended ? "本局结束" : `${currentPlayer().name}行动`;
  els.roundText.textContent = state.ended
    ? "本局结束，可以重新开局。"
    : `${actor}：只能从下一家抽一张牌。`;
  els.log.innerHTML = state.logs.map((entry) => `<li>${entry}</li>`).join("");
  els.logPanel.scrollTop = els.logPanel.scrollHeight;
}

els.players.addEventListener("click", (event) => {
  const button = event.target.closest(".card-button");
  if (!button || state.ended || currentPlayer().kind !== "human") return;
  const target = state.players[Number(button.dataset.playerId)];
  if (!canDrawFrom(target)) return;
  drawCard(currentPlayer(), target, Number(button.dataset.cardIndex));
});

els.newRoundBtn.addEventListener("click", newRound);
els.aiCount.addEventListener("change", newRound);

newRound();
