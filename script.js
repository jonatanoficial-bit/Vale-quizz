(() => {
  "use strict";
  const Core = window.ShowTrilhaoCore;
  const $ = (selector) => document.querySelector(selector);
  const dom = Object.fromEntries([
    "homeScreen", "setupScreen", "gameScreen", "resultScreen", "btnHome", "btnNewGame", "btnContinue", "btnRanking", "btnSettings", "btnFullscreen", "modePicker", "playerName", "btnAddPlayer", "draftPlayers", "playerLimit", "categoryChoices", "btnToggleCategories", "shuffleOptions", "confirmAnswer", "repositoryStatus", "btnStartGame", "gamePlayers", "turnPill", "ladder", "ladderCurrent", "safePrize", "mobilePlayer", "mobileStep", "questionCard", "questionCategory", "questionValue", "questionLevel", "questionText", "answerGrid", "questionExplanation", "btnCards", "btnFifty", "btnUniversity", "btnAudience", "btnSkip", "skipLabel", "btnStop", "gameMessage", "resultTitle", "resultSummary", "resultRanking", "btnRematch", "btnBackHome", "dialogBackdrop", "dialogKicker", "dialogTitle", "dialogBody", "dialogActions", "btnDialogClose", "toast", "importInput"
  ].map((id) => [id, document.getElementById(id)]));

  const SAVE_KEY = "vale-games-show-trilhao-save-v2";
  const PROFILE_KEY = "vale-games-show-trilhao-profiles-v2";
  const SETTINGS_KEY = "vale-games-show-trilhao-settings-v2";
  const RECENT_KEY = "vale-games-show-trilhao-recent-v2";
  const avatars = ["✦", "◆", "●", "▲", "✷", "◈", "✹", "⬟"];
  let repository = null;
  let game = null;
  let draftPlayers = [{ name: "Jogador 1" }];
  let selectedMode = "classic";
  let toastTimer = null;
  let lastFocus = null;
  const settings = readJSON(SETTINGS_KEY, { voice: true, music: true, effects: true, reducedMotion: false, fontScale: 100 });

  const audio = {
    intro: new Audio("assets/abertura-show-do-trilhao.mp3"),
    music: new Audio("assets/trilha-show-do-trilhao.mp3"),
    prepare() { this.intro.preload = "auto"; this.music.preload = "auto"; this.music.loop = true; this.music.volume = 0.34; this.intro.volume = 0.82; },
    startRound() {
      this.stop();
      if (!settings.voice) return this.startMusic();
      this.intro.currentTime = 0;
      this.intro.onended = () => this.startMusic();
      this.intro.play().catch(() => this.startMusic());
    },
    startMusic() { if (settings.music && !this.intro.paused) return; if (settings.music) this.music.play().catch(() => {}); },
    stop() { this.intro.pause(); this.music.pause(); this.intro.currentTime = 0; this.music.currentTime = 0; },
    sync() { if (!settings.voice) this.intro.pause(); if (!settings.music) this.music.pause(); else if (game && !this.intro.paused) this.music.pause(); },
    effect(kind) {
      if (!settings.effects || !window.AudioContext) return;
      const ctx = audio.ctx || (audio.ctx = new AudioContext());
      const osc = ctx.createOscillator(); const gain = ctx.createGain(); const now = ctx.currentTime;
      const spec = kind === "good" ? [660, 0.14, "triangle"] : kind === "bad" ? [180, 0.17, "sawtooth"] : [480, 0.055, "sine"];
      osc.type = spec[2]; osc.frequency.setValueAtTime(spec[0], now); gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.055, now + .015); gain.gain.exponentialRampToValueAtTime(.0001, now + spec[1]); osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + spec[1] + .02);
    }
  };
  audio.prepare();

  function readJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
  function storeJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  function node(tag, className, content) { const el = document.createElement(tag); if (className) el.className = className; if (content != null) el.textContent = content; return el; }
  function button(label, className, handler) { const el = node("button", className, label); el.type = "button"; el.addEventListener("click", handler); return el; }
  function fmt(value) { return `R$ ${BigInt(value || 0).toLocaleString("pt-BR")}`; }
  function delay(ms) { return new Promise((resolve) => setTimeout(resolve, settings.reducedMotion ? 0 : ms)); }
  function isPlaying() { return Boolean(game && ["transition", "question", "resolving", "reveal"].includes(game.phase)); }
  function showToast(message) { dom.toast.textContent = message; dom.toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 3400); }
  function setScreen(name) { ["home", "setup", "game", "result"].forEach((screen) => dom[`${screen}Screen`].classList.toggle("is-hidden", screen !== name)); window.scrollTo({ top: 0, behavior: settings.reducedMotion ? "auto" : "smooth" }); }
  function applySettings() { document.documentElement.style.fontSize = `${Math.max(85, Math.min(120, Number(settings.fontScale) || 100)) / 100 * 16}px`; document.documentElement.classList.toggle("reduced-motion", settings.reducedMotion); storeJSON(SETTINGS_KEY, settings); audio.sync(); }

  function showDialog({ kicker = "", title, body, actions = [] }) {
    lastFocus = document.activeElement;
    dom.dialogKicker.textContent = kicker; dom.dialogTitle.textContent = title; dom.dialogBody.replaceChildren(); dom.dialogActions.replaceChildren();
    if (typeof body === "string") dom.dialogBody.textContent = body; else if (body) dom.dialogBody.append(body);
    actions.forEach(({ label, primary = false, handler }) => dom.dialogActions.append(button(label, primary ? "primary-button" : "secondary-button", handler)));
    dom.dialogBackdrop.hidden = false; dom.btnDialogClose.focus();
  }
  function closeDialog() { dom.dialogBackdrop.hidden = true; dom.dialogBody.replaceChildren(); if (lastFocus?.focus) lastFocus.focus(); }

  function saveGame() {
    if (!game || !repository) return;
    const snapshot = { version: 2, savedAt: Date.now(), game, repository: { used: [...repository.used], recent: repository.recent, categoryUsage: [...repository.categoryUsage] } };
    try { localStorage.setItem(SAVE_KEY, Core.encode(snapshot)); } catch { showToast("Não foi possível salvar a partida neste navegador."); }
    storeJSON(RECENT_KEY, repository.recent);
    refreshContinue();
  }
  function clearSavedGame() { localStorage.removeItem(SAVE_KEY); refreshContinue(); }
  function restoreGame() {
    try {
      const saved = Core.decode(localStorage.getItem(SAVE_KEY) || "");
      if (!saved?.game || !repository) return false;
      const restored = migrateSavedGame(saved);
      if (!restored) return false;
      game = restored.game; if (game.phase === "transition") game.phase = "question"; repository.used = new Set(restored.repository?.used || []); repository.recent = restored.repository?.recent || []; repository.categoryUsage = new Map(restored.repository?.categoryUsage || []);
      setScreen("game"); renderGame(); return true;
    } catch { clearSavedGame(); return false; }
  }
  function migrateSavedGame(saved) {
    if (saved.version === 2) return saved;
    if (saved.version === 1 && saved.game) return { ...saved, version: 2, game: { ...saved.game, mode: saved.game.mode || "classic", phase: saved.game.phase || "question", removed: saved.game.removed || [] } };
    return null;
  }
  function refreshContinue() { dom.btnContinue.classList.toggle("is-hidden", !localStorage.getItem(SAVE_KEY)); }

  function profiles() { const value = readJSON(PROFILE_KEY, []); return Array.isArray(value) ? value : []; }
  function updateProfiles() {
    const current = profiles();
    game.players.forEach((player) => {
      const key = Core.comparable(player.name); let profile = current.find((item) => item.key === key);
      if (!profile) { profile = { key, name: player.name, avatar: player.avatar, xp: 0, games: 0, wins: 0, correct: 0, attempts: 0, bestStreak: 0, biggestPrize: "0", categories: {} }; current.push(profile); }
      profile.name = player.name; profile.avatar = player.avatar; profile.xp += player.xp; profile.games += 1; profile.wins += player.status === "won" ? 1 : 0; profile.correct += player.correct; profile.attempts += player.correct + player.incorrect; profile.bestStreak = Math.max(profile.bestStreak, player.bestStreak); profile.biggestPrize = (BigInt(profile.biggestPrize || 0) > BigInt(player.money || 0) ? BigInt(profile.biggestPrize) : BigInt(player.money || 0)).toString();
      player.categoryHistory.forEach((category) => profile.categories[category] = (profile.categories[category] || 0) + 1);
    });
    storeJSON(PROFILE_KEY, current);
  }
  function levelFor(xp) { return Math.floor(Math.sqrt(xp / 100)) + 1; }

  function renderDraftPlayers() {
    dom.draftPlayers.replaceChildren();
    draftPlayers.forEach((player, index) => { const chip = node("div", "player-chip"); chip.append(node("span", "", avatars[index]), node("span", "", player.name)); if (draftPlayers.length > 1) chip.append(button("×", "", () => { draftPlayers.splice(index, 1); renderDraftPlayers(); })); dom.draftPlayers.append(chip); });
  }
  function renderCategories() {
    dom.categoryChoices.replaceChildren(); if (!repository) return;
    [...new Set(repository.questions.map((question) => question.category))].sort((a, b) => a.localeCompare(b, "pt-BR")).forEach((category) => {
      const label = node("label", "category-choice"); const input = document.createElement("input"); input.type = "checkbox"; input.value = category; input.checked = true; const text = node("span", "", category); label.append(input, text); dom.categoryChoices.append(label);
    });
  }
  function checkedCategories() { return [...dom.categoryChoices.querySelectorAll("input:checked")].map((input) => input.value); }
  function renderRepositoryStatus() { if (!repository) return; const report = repository.report(); dom.repositoryStatus.textContent = `${report.available.toLocaleString("pt-BR")} questões aprovadas e únicas disponíveis nesta versão; ${report.invalid} item(ns) inválido(s) foram bloqueados.`; }

  function newGame() {
    const names = draftPlayers.map((person) => person.name.trim()).filter(Boolean).slice(0, 8);
    if (!repository?.questions.length) return showToast("O banco de perguntas ainda não está disponível.");
    if (selectedMode === "duel" && names.length !== 2) return showToast("O modo Duelo precisa de exatamente dois participantes.");
    if (selectedMode === "party" && names.length < 2) return showToast("O modo Família / Festa precisa de pelo menos dois participantes.");
    if (!names.length) return showToast("Inclua pelo menos um participante.");
    repository.used.clear(); repository.categoryUsage.clear();
    game = { version: 2, mode: selectedMode, phase: "transition", active: 0, startedAt: Date.now(), categories: checkedCategories(), shuffleOptions: dom.shuffleOptions.checked, confirmAnswer: dom.confirmAnswer.checked, turnCap: selectedMode === "classic" ? 16 : selectedMode === "duel" ? 10 : 5, current: null, removed: [], selected: null, players: names.map((name, index) => ({ id: `${Date.now()}-${index}`, name, avatar: avatars[index], money: 0n, step: 0, turns: 0, points: 0, status: "playing", correct: 0, incorrect: 0, streak: 0, bestStreak: 0, xp: 0, categoryHistory: [], lifelines: { cards: true, fifty: true, university: true, audience: true }, skipsLeft: 3 })) };
    setScreen("game"); audio.startRound(); nextQuestion("As luzes se acendem. Boa sorte!");
  }
  function activePlayer() { return game?.players[game.active] || null; }
  function progressFor(player) { return game.mode === "classic" ? player.step : player.turns; }
  function canContinue(player) { return game.mode === "classic" ? player.status === "playing" : player.status === "playing" && player.turns < game.turnCap; }
  function pickNextActive(from) { for (let offset = 1; offset <= game.players.length; offset += 1) { const index = (from + offset) % game.players.length; if (canContinue(game.players[index])) return index; } return -1; }
  function disableDuringLock() { return game?.phase !== "question"; }

  async function nextQuestion(message = "") {
    if (!game) return; const player = activePlayer(); if (!player || !canContinue(player)) return advanceTurn();
    const ladderStep = Math.min(16, progressFor(player) + 1); const difficulty = Core.LADDER[ladderStep - 1].difficulty; const drawn = repository.draw({ difficulty, categories: game.categories });
    if (!drawn) return finishGame("O banco disponível foi concluído sem repetir questões.");
    game.current = game.shuffleOptions ? Core.shuffleOptions(drawn.question) : { ...drawn.question }; game.removed = []; game.selected = null; game.phase = "transition"; game.fallback = drawn.fallback; player.categoryHistory.push(game.current.category); dom.gameMessage.textContent = drawn.fallback ? `A categoria ou dificuldade solicitada foi esgotada; usamos uma questão equivalente disponível.` : message; renderGame(); saveGame();
    const snapshot = game.startedAt; await delay(460); if (!game || game.startedAt !== snapshot) return; game.phase = "question"; renderGame(); saveGame();
  }
  async function advanceTurn() {
    const next = pickNextActive(game.active); if (next === -1) return finishGame(); game.active = next; await nextQuestion(`É a vez de ${activePlayer().name}.`);
  }
  function renderGame() {
    if (!game) return; const player = activePlayer(); const question = game.current; const step = Math.min(16, progressFor(player) + 1); const prize = Core.prizeForStep(step);
    dom.turnPill.textContent = `VEZ DE ${player.name.toUpperCase()}`; dom.mobilePlayer.textContent = `${player.avatar} ${player.name}`; dom.mobileStep.textContent = game.mode === "classic" ? `Etapa ${step}/16` : `Rodada ${Math.min(player.turns + 1, game.turnCap)}/${game.turnCap}`;
    renderGamePlayers(); renderLadder(player, step); dom.questionCard.classList.toggle("entering", game.phase === "transition"); dom.questionCategory.textContent = question?.category || "Estúdio VALE GAMES"; dom.questionValue.textContent = game.mode === "classic" ? `VALE ${fmt(prize)}` : `${player.points} pontos`; dom.questionLevel.textContent = question ? `${question.difficulty} • ${game.mode === "classic" ? `Etapa ${step} de 16` : "rodada equilibrada"}` : "Preparando pergunta"; dom.questionText.textContent = question?.question || "Preparando a próxima pergunta…";
    dom.questionExplanation.hidden = !game.explanation; dom.questionExplanation.textContent = game.explanation || ""; renderAnswers(question); renderLifelines(player); dom.ladderCurrent.textContent = `${step} / 16`; dom.safePrize.textContent = fmt(Core.guaranteedPrize(player.step));
  }
  function renderGamePlayers() {
    dom.gamePlayers.replaceChildren(); game.players.forEach((player, index) => { const row = node("div", `game-player${index === game.active ? " active" : ""}`); const avatar = node("div", "mini-avatar", player.avatar); const identity = node("div"); identity.append(node("b", "", player.name), node("small", "", game.mode === "classic" ? `${player.status === "playing" ? `etapa ${player.step}/16` : player.status}` : `${player.points} pts • ${player.turns}/${game.turnCap}`)); const score = node("span", "money", game.mode === "classic" ? fmt(player.money) : `NV ${levelFor(player.xp)}`); row.append(avatar, identity, score); dom.gamePlayers.append(row); });
  }
  function renderLadder(player, nextStep) {
    dom.ladder.replaceChildren(); [...Core.LADDER].reverse().forEach((item) => { const line = node("div", "ladder-step"); if (item.step === nextStep) line.classList.add("current"); if (Core.SAFE_STEPS.has(item.step)) line.classList.add("safe"); line.append(node("span", "", `${item.step}. ${item.difficulty}`), node("b", "", fmt(item.prize))); dom.ladder.append(line); });
  }
  function renderAnswers(question) {
    dom.answerGrid.replaceChildren(); if (!question) return;
    question.options.forEach((option, index) => { const answer = node("button", "answer"); answer.type = "button"; answer.disabled = disableDuringLock() || game.removed.includes(index); answer.classList.toggle("eliminated", game.removed.includes(index)); if (game.selected === index) answer.classList.add("selected"); if (game.phase === "reveal" && index === question.answer) answer.classList.add("correct"); if (game.phase === "reveal" && game.selected === index && index !== question.answer) answer.classList.add("wrong"); answer.append(node("span", "answer-key", String.fromCharCode(65 + index)), node("span", "answer-text", option)); answer.addEventListener("click", () => chooseAnswer(index)); dom.answerGrid.append(answer); });
  }
  function renderLifelines(player) {
    const definitions = [[dom.btnCards, "cards"], [dom.btnFifty, "fifty"], [dom.btnUniversity, "university"], [dom.btnAudience, "audience"]]; definitions.forEach(([button, key]) => { button.disabled = disableDuringLock() || !player.lifelines[key]; button.classList.toggle("used", !player.lifelines[key]); }); dom.btnSkip.disabled = disableDuringLock() || player.skipsLeft <= 0; dom.skipLabel.textContent = `Pular ${player.skipsLeft}`; dom.btnStop.disabled = disableDuringLock();
  }
  async function chooseAnswer(index) {
    if (!game || game.phase !== "question" || game.removed.includes(index)) return;
    if (game.confirmAnswer) { showDialog({ kicker: "RESPOSTA FINAL", title: `Alternativa ${String.fromCharCode(65 + index)}?`, body: "Depois da confirmação não será possível mudar a escolha.", actions: [{ label: "Voltar", handler: closeDialog }, { label: "Confirmar resposta", primary: true, handler: () => { closeDialog(); resolveAnswer(index); } }] }); return; }
    resolveAnswer(index);
  }
  async function resolveAnswer(index) {
    if (!game || game.phase !== "question") return; const player = activePlayer(); game.selected = index; game.phase = "resolving"; dom.gameMessage.textContent = "Resposta registrada. O estúdio está em silêncio…"; audio.effect("click"); renderGame(); saveGame(); await delay(950); if (!game) return;
    const correct = index === game.current.answer; game.phase = "reveal"; game.explanation = game.current.explanation || (correct ? "Resposta correta! Você segue no jogo." : `A resposta correta é a alternativa ${String.fromCharCode(65 + game.current.answer)}.`);
    if (correct) { player.correct += 1; player.streak += 1; player.bestStreak = Math.max(player.bestStreak, player.streak); player.xp += Core.xpFor({ difficulty: game.current.difficulty, step: progressFor(player) + 1, correct: true, streak: player.streak }); player.step = Math.min(16, player.step + 1); player.money = Core.prizeForStep(player.step); if (game.mode !== "classic") { player.points += game.current.difficulty === "Difícil" ? 3 : game.current.difficulty === "Médio" ? 2 : 1; player.turns += 1; if (player.turns >= game.turnCap) player.status = "finished"; } else if (player.step === 16) player.status = "won"; dom.gameMessage.textContent = player.status === "won" ? "VOCÊ CONQUISTOU O TRILHÃO!" : "Resposta correta. A luz do palco fica dourada."; audio.effect("good"); }
    else { player.incorrect += 1; player.streak = 0; if (game.mode === "classic") { player.money = Core.guaranteedPrize(player.step); player.status = "eliminated"; dom.gameMessage.textContent = `Resposta incorreta. ${player.name} sai com ${fmt(player.money)}.`; } else { player.turns += 1; if (player.turns >= game.turnCap) player.status = "finished"; dom.gameMessage.textContent = "Não foi dessa vez. A rodada continua para todos."; } audio.effect("bad"); }
    renderGame(); saveGame(); await delay(correct && player.status === "won" ? 2200 : 1800); if (!game) return; game.explanation = ""; game.current = null; await advanceTurn();
  }
  function useFifty() { if (!canUse("fifty")) return; const player = activePlayer(); player.lifelines.fifty = false; game.removed = [...new Set([...game.removed, ...Core.chooseWrongIndexes(game.current.answer, 2)])]; audio.effect("click"); dom.gameMessage.textContent = "Duas alternativas erradas foram retiradas do painel."; renderGame(); saveGame(); }
  function useCards() { if (!canUse("cards")) return; const grid = node("div", "card-choice"); ["♠", "♥", "♦", "♣"].forEach((symbol, index) => grid.append(button(symbol, "card-button", () => { const player = activePlayer(); player.lifelines.cards = false; const result = Core.cardElimination(game.current.answer); game.removed = [...new Set([...game.removed, ...result.eliminated])]; closeDialog(); dom.gameMessage.textContent = result.count ? `A carta ${index + 1} eliminou ${result.count} alternativa${result.count > 1 ? "s" : ""} errada${result.count > 1 ? "s" : ""}.` : "A carta não eliminou alternativas desta vez."; audio.effect("click"); renderGame(); saveGame(); })));
    showDialog({ kicker: "AJUDA DAS CARTAS", title: "Escolha uma carta", body: grid, actions: [{ label: "Cancelar", handler: closeDialog }] });
  }
  function useUniversity() { if (!canUse("university")) return; const player = activePlayer(); player.lifelines.university = false; const list = node("div", "help-grid"); Core.universityAdvice(game.current).forEach((advice) => { const row = node("div", "help-person"); row.append(node("span", "", `${advice.icon} ${advice.name}`), node("b", "", `Alternativa ${String.fromCharCode(65 + advice.answer)} • ${advice.confidence}%`)); list.append(row); }); showDialog({ kicker: "UNIVERSITÁRIOS", title: "Três palpites, nenhuma garantia.", body: list, actions: [{ label: "Voltar ao jogo", primary: true, handler: closeDialog }] }); audio.effect("click"); renderGame(); saveGame(); }
  function useAudience() { if (!canUse("audience")) return; const player = activePlayer(); player.lifelines.audience = false; const list = node("div", "help-grid"); Core.audienceVote(game.current).forEach((vote, index) => { const row = node("div", "vote-row"); const bar = node("div", "vote-bar"); const fill = node("b"); fill.style.width = `${vote}%`; bar.append(fill); row.append(node("b", "", String.fromCharCode(65 + index)), bar, node("span", "", `${vote}%`)); list.append(row); }); showDialog({ kicker: "PLATEIA", title: "O público votou", body: list, actions: [{ label: "Voltar ao jogo", primary: true, handler: closeDialog }] }); audio.effect("click"); renderGame(); saveGame(); }
  function canUse(kind) { return Boolean(game && game.phase === "question" && activePlayer().lifelines[kind]); }
  function useSkip() { if (!game || game.phase !== "question" || activePlayer().skipsLeft <= 0) return; activePlayer().skipsLeft -= 1; game.phase = "transition"; dom.gameMessage.textContent = "A pergunta foi descartada para esta sessão."; audio.effect("click"); nextQuestion(); }
  function stopPlaying() { if (!game || game.phase !== "question") return; const player = activePlayer(); player.status = "stopped"; game.phase = "transition"; dom.gameMessage.textContent = `${player.name} decidiu parar e leva ${fmt(player.money)}.`; saveGame(); advanceTurn(); }
  function finishGame(reason = "") { if (!game) return; audio.stop(); game.phase = "ended"; updateProfiles(); storeJSON(RECENT_KEY, repository.recent); clearSavedGame(); const sorted = [...game.players].sort((a, b) => game.mode === "classic" ? (b.money > a.money ? 1 : b.money < a.money ? -1 : b.xp - a.xp) : b.points - a.points || b.xp - a.xp); const winner = sorted[0]; dom.resultTitle.textContent = winner.status === "won" ? "Um trilhão no placar!" : "O estúdio aplaude."; dom.resultSummary.textContent = reason || `${winner.name} terminou em primeiro. XP, recordes e estatísticas foram guardados no ranking local.`; dom.resultRanking.replaceChildren(); sorted.forEach((player, index) => { const row = node("div", "rank-row"); row.append(node("div", "rank-medal", index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}º`)); const label = node("div"); label.append(node("b", "", player.name), node("small", "", `${player.correct} acerto(s) • XP +${player.xp} • sequência ${player.bestStreak}`)); row.append(label, node("div", "rank-score", game.mode === "classic" ? fmt(player.money) : `${player.points} pts`)); dom.resultRanking.append(row); }); setScreen("result"); game = null; }

  function showRanking() { const list = profiles().sort((a, b) => b.xp - a.xp || b.wins - a.wins || (BigInt(b.biggestPrize || 0) > BigInt(a.biggestPrize || 0) ? 1 : BigInt(b.biggestPrize || 0) < BigInt(a.biggestPrize || 0) ? -1 : 0)).slice(0, 20); const body = node("div", "help-grid"); if (!list.length) body.append(node("p", "", "Jogue uma partida para criar o primeiro perfil local.")); list.forEach((profile, index) => { const row = node("div", "help-person"); row.append(node("span", "", `${index + 1}. ${profile.avatar || "✦"} ${profile.name}`), node("b", "", `NV ${levelFor(profile.xp)} • ${profile.xp} XP`)); body.append(row); }); showDialog({ kicker: "RANKING LOCAL", title: "Hall da fama", body, actions: [{ label: "Fechar", primary: true, handler: closeDialog }] }); }
  function showSettings() {
    const box = node("div", "settings-grid"); const audioGroup = node("section", "setting-group"); audioGroup.append(node("h3", "", "Áudio")); [["voice", "Locução de abertura"], ["music", "Música de fundo"], ["effects", "Efeitos do jogo"]].forEach(([key, label]) => { const line = node("label"); const input = document.createElement("input"); input.type = "checkbox"; input.checked = settings[key]; input.addEventListener("change", () => { settings[key] = input.checked; applySettings(); }); line.append(node("span", "", label), input); audioGroup.append(line); }); box.append(audioGroup);
    const access = node("section", "setting-group"); access.append(node("h3", "", "Acessibilidade")); const motion = node("label"); const motionInput = document.createElement("input"); motionInput.type = "checkbox"; motionInput.checked = settings.reducedMotion; motionInput.addEventListener("change", () => { settings.reducedMotion = motionInput.checked; applySettings(); }); motion.append(node("span", "", "Reduzir animações"), motionInput); const font = node("label"); const range = document.createElement("input"); range.type = "range"; range.min = "85"; range.max = "120"; range.value = settings.fontScale; range.addEventListener("input", () => { settings.fontScale = range.value; applySettings(); }); font.append(node("span", "", "Tamanho do texto"), range); access.append(motion, font); box.append(access);
    const data = node("section", "setting-group"); data.append(node("h3", "", "Dados locais"), node("p", "field-hint", "Exporte ou importe perfis e ranking. Partidas ativas são salvas automaticamente neste dispositivo.")); box.append(data);
    showDialog({ kicker: "CONFIGURAÇÕES", title: "Do seu jeito", body: box, actions: [{ label: "Importar ranking", handler: () => dom.importInput.click() }, { label: "Exportar ranking", handler: exportProfiles }, { label: "Fechar", primary: true, handler: closeDialog }] });
  }
  function exportProfiles() { const blob = new Blob([JSON.stringify({ version: 2, profiles: profiles() }, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "vale-games-ranking.json"; link.click(); URL.revokeObjectURL(link.href); }
  function importProfiles(file) { const reader = new FileReader(); reader.onload = () => { try { const incoming = JSON.parse(String(reader.result)); if (!Array.isArray(incoming.profiles)) throw new Error(); storeJSON(PROFILE_KEY, incoming.profiles); showToast("Ranking importado com sucesso."); } catch { showToast("Arquivo de ranking inválido."); } }; reader.readAsText(file); }

  async function loadQuestions() { try { const response = await fetch("questions.json", { cache: "force-cache" }); if (!response.ok) throw new Error("Falha de rede"); repository = new Core.QuestionRepository(await response.json(), readJSON(RECENT_KEY, [])); renderCategories(); renderRepositoryStatus(); refreshContinue(); } catch { dom.repositoryStatus.textContent = "Não foi possível carregar o banco de perguntas. Verifique sua conexão ou os arquivos do jogo."; showToast("Falha ao carregar questions.json."); } }
  function changeMode(mode) { selectedMode = mode; [...dom.modePicker.querySelectorAll("button")].forEach((button) => { const selected = button.dataset.mode === mode; button.classList.toggle("selected", selected); button.setAttribute("aria-checked", String(selected)); }); dom.playerLimit.textContent = mode === "duel" ? "exatamente 2" : mode === "party" ? "2 a 8" : "1 a 8"; }
  function openSetup() { setScreen("setup"); dom.playerName.focus(); }

  dom.btnNewGame.addEventListener("click", openSetup); dom.btnHome.addEventListener("click", () => { if (isPlaying()) saveGame(); audio.stop(); setScreen("home"); }); dom.btnBackHome.addEventListener("click", () => setScreen("home")); dom.btnContinue.addEventListener("click", () => { if (!restoreGame()) showToast("Não foi possível restaurar esta partida."); }); dom.btnRanking.addEventListener("click", showRanking); dom.btnSettings.addEventListener("click", showSettings); dom.btnDialogClose.addEventListener("click", closeDialog); dom.dialogBackdrop.addEventListener("click", (event) => { if (event.target === dom.dialogBackdrop) closeDialog(); }); document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !dom.dialogBackdrop.hidden) closeDialog(); });
  dom.modePicker.addEventListener("click", (event) => { const button = event.target.closest("[data-mode]"); if (button) changeMode(button.dataset.mode); }); dom.btnAddPlayer.addEventListener("click", () => { const name = dom.playerName.value.trim(); if (!name) return dom.playerName.focus(); if (draftPlayers.length >= 8) return showToast("O limite é de oito participantes."); if (draftPlayers.some((player) => Core.comparable(player.name) === Core.comparable(name))) return showToast("Use nomes diferentes para os participantes."); draftPlayers.push({ name }); dom.playerName.value = ""; renderDraftPlayers(); }); dom.playerName.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); dom.btnAddPlayer.click(); } }); dom.btnToggleCategories.addEventListener("click", () => { const inputs = [...dom.categoryChoices.querySelectorAll("input")]; const all = inputs.every((input) => input.checked); inputs.forEach((input) => input.checked = !all); dom.btnToggleCategories.textContent = all ? "Todas" : "Nenhuma"; }); dom.btnStartGame.addEventListener("click", newGame); dom.btnRematch.addEventListener("click", () => { draftPlayers = draftPlayers.length ? draftPlayers : [{ name: "Jogador 1" }]; renderDraftPlayers(); openSetup(); });
  dom.btnFifty.addEventListener("click", useFifty); dom.btnCards.addEventListener("click", useCards); dom.btnUniversity.addEventListener("click", useUniversity); dom.btnAudience.addEventListener("click", useAudience); dom.btnSkip.addEventListener("click", useSkip); dom.btnStop.addEventListener("click", stopPlaying); dom.btnFullscreen.addEventListener("click", () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }); dom.importInput.addEventListener("change", () => { if (dom.importInput.files?.[0]) importProfiles(dom.importInput.files[0]); dom.importInput.value = ""; });
  window.addEventListener("beforeunload", () => { if (isPlaying()) saveGame(); });
  renderDraftPlayers(); applySettings(); loadQuestions();
})();
