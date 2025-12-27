const $ = (s) => document.querySelector(s);

// UI
const playersList = $("#playersList");
const ladderEl = $("#ladder");
const pillStatus = $("#pillStatus");
const pillRound = $("#pillRound");

const tagPlayer = $("#tagPlayer");
const tagPrize = $("#tagPrize");
const tagQ = $("#tagQ");
const catNow = $("#catNow");
const diffNow = $("#diffNow");

const qMeta = $("#qMeta");
const qText = $("#qText");
const answersEl = $("#answers");
const feedbackEl = $("#feedback");
const btnNextPlayer = $("#btnNextPlayer");
const btnStop = $("#btnStop");
const bar = $("#bar");

const finalArea = $("#finalArea");
const gameArea = $("#gameArea");
const finalText = $("#finalText");
const finalRanking = $("#finalRanking");
const btnPlayAgain = $("#btnPlayAgain");
const btnReconfig = $("#btnReconfig");

const btnConfig = $("#btnConfig");
const btnResetAll = $("#btnResetAll");

// Config modal
const modalConfig = $("#modalConfig");
const playerInputs = $("#playerInputs");
const btnStart = $("#btnStart");
const chkShuffleQ = $("#chkShuffleQ");
const chkShuffleOpt = $("#chkShuffleOpt");

// Help modal
const modalHelp = $("#modalHelp");
const helpTitle = $("#helpTitle");
const helpBody = $("#helpBody");
const btnHelpClose = $("#btnHelpClose");

// Lifelines
const helpCards = $("#helpCards");
const helpUni = $("#helpUni");
const helpAudience = $("#helpAudience");
const helpSkip = $("#helpSkip");

// ---------- ESCADA (até 1 TRILHÃO) ----------
const LADDER = [
  { step: 1,  prize: 1000n,                 diff: "Fácil"  },
  { step: 2,  prize: 2000n,                 diff: "Fácil"  },
  { step: 3,  prize: 5000n,                 diff: "Fácil"  },
  { step: 4,  prize: 10000n,                diff: "Fácil"  },
  { step: 5,  prize: 20000n,                diff: "Fácil"  },

  { step: 6,  prize: 50000n,                diff: "Médio"  },
  { step: 7,  prize: 100000n,               diff: "Médio"  },
  { step: 8,  prize: 200000n,               diff: "Médio"  },
  { step: 9,  prize: 500000n,               diff: "Médio"  },
  { step: 10, prize: 1000000n,              diff: "Médio"  },

  { step: 11, prize: 2000000n,              diff: "Difícil"},
  { step: 12, prize: 5000000n,              diff: "Difícil"},
  { step: 13, prize: 10000000n,             diff: "Difícil"},
  { step: 14, prize: 100000000n,            diff: "Difícil"},
  { step: 15, prize: 1000000000n,           diff: "Difícil"},
  { step: 16, prize: 1000000000000n,        diff: "Difícil"} // 1 trilhão
];

// “Pontos de segurança” (opcional, estilo Show do Milhão)
const SAFE_STEPS = new Set([5, 10, 16]);

// ---------- ESTADO ----------
let ALL_QUESTIONS = []; // carregado do questions.json
let availableByCat = new Map(); // categoria -> lista indices
let availableAny = []; // todos indices

let selectedCategories = new Set(["Variadas"]); // config
let shuffleQuestions = true;
let shuffleOptions = true;

let players = []; // {name, moneyBig, step, status, lifelines:{cards,uni,audience}, skipsLeft, usedQuestions:Set<number>, currentQIndex}
let currentPlayer = 0;
let startedAt = 0;

let locked = false;
let currentQ = null; // objeto da pergunta atual (já com opções talvez embaralhadas)
let currentQOriginal = null; // original do banco (para answer)
let currentPrize = 0n;

// ---------- UTIL ----------
function fmtBRL(big){
  // BigInt to "R$ 1.234.567"
  const s = big.toString();
  const parts = [];
  for(let i = s.length; i > 0; i -= 3){
    parts.push(s.substring(Math.max(0, i-3), i));
  }
  return "R$ " + parts.reverse().join(".");
}

function initials(name){
  return name.split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join("") || "?";
}

function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function openModal(el){
  el.style.display = "grid";
  el.setAttribute("aria-hidden", "false");
}
function closeModal(el){
  el.style.display = "none";
  el.setAttribute("aria-hidden", "true");
}

function setScreen(final){
  finalArea.style.display = final ? "grid" : "none";
  gameArea.style.display = final ? "none" : "grid";
}

function getStepInfo(step){
  return LADDER.find(x => x.step === step) || null;
}

function getCurrentPlayer(){
  return players[currentPlayer] || null;
}

// ---------- CONFIG UI ----------
function buildPlayerInputs(){
  playerInputs.innerHTML = "";
  for(let i=0;i<8;i++){
    const box = document.createElement("div");
    box.className = "input";
    box.innerHTML = `
      <label>Jogador ${i+1}</label>
      <input type="text" maxlength="18" placeholder="Nome"/>
    `;
    playerInputs.appendChild(box);
  }
}

function readNames(){
  const inputs = [...playerInputs.querySelectorAll("input")];
  return inputs.map(i => (i.value||"").trim()).filter(Boolean).slice(0,8);
}

function readCategories(){
  const checks = [...modalConfig.querySelectorAll(".cats input[type=checkbox]")];
  const marked = new Set(checks.filter(c => c.checked).map(c => c.value));
  if(marked.size === 0) marked.add("Variadas");
  // Se Variadas marcado, a gente ignora o resto na seleção (mistura)
  if(marked.has("Variadas")) return new Set(["Variadas"]);
  return marked;
}

function bindCategoryRules(){
  // se marcar Variadas, desmarca as outras e vice-versa
  const all = [...modalConfig.querySelectorAll(".cats input[type=checkbox]")];
  const vari = all.find(x => x.value === "Variadas");
  vari.addEventListener("change", () => {
    if(vari.checked){
      all.forEach(c => { if(c.value !== "Variadas") c.checked = false; });
    }
  });
  all.forEach(c => {
    if(c.value === "Variadas") return;
    c.addEventListener("change", () => {
      if(c.checked) vari.checked = false;
      if(all.every(x => x.value==="Variadas" ? true : !x.checked)){
        vari.checked = true;
      }
    });
  });
}

// ---------- PREPARAR BANCO ----------
function normalizeQuestion(q){
  // Garante campos mínimos
  const category = (q.category || q.categoria || "Variedades").toString().trim();
  const level = (q.level || q.difficulty || q.nivel || "").toString().trim();
  const question = (q.question || q.pergunta || "").toString().trim();
  const options = (q.options || q.alternativas || []);
  const answer = Number(q.answer ?? q.resposta);
  const explanation = (q.explanation || q.explicacao || "").toString();

  return { category, level, question, options, answer, explanation };
}

function buildIndexes(){
  availableByCat = new Map();
  availableAny = [];

  for(let i=0;i<ALL_QUESTIONS.length;i++){
    const c = ALL_QUESTIONS[i].category || "Variedades";
    if(!availableByCat.has(c)) availableByCat.set(c, []);
    availableByCat.get(c).push(i);
    availableAny.push(i);
  }
}

function categoriesAvailable(){
  return new Set([...availableByCat.keys()]);
}

// ---------- ESCOLHER PERGUNTA ----------
function desiredLevelForStep(step){
  const info = getStepInfo(step);
  return info ? info.diff : "Médio";
}

function pickFromPool(pool, usedSet){
  // tenta escolher um índice que ainda não foi usado por este jogador
  const candidates = pool.filter(i => !usedSet.has(i));
  if(candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function pickQuestionForPlayer(p){
  const stepNext = p.step + 1;
  const desiredLevel = desiredLevelForStep(stepNext);

  // categoria escolhida
  let pool = [];
  const availCats = categoriesAvailable();

  if(selectedCategories.has("Variadas")){
    pool = availableAny.slice();
  } else {
    // filtra apenas categorias existentes no json
    const chosen = [...selectedCategories].filter(c => availCats.has(c));
    if(chosen.length === 0){
      pool = availableAny.slice(); // fallback
    } else {
      for(const c of chosen){
        pool.push(...(availableByCat.get(c) || []));
      }
    }
  }

  // prioriza perguntas cujo level bate com o desejado, mas se não tiver, fallback geral
  const poolExact = pool.filter(i => {
    const lv = (ALL_QUESTIONS[i].level || "").toLowerCase();
    if(!lv) return false;
    if(desiredLevel === "Fácil") return lv.includes("fá") || lv.includes("fac");
    if(desiredLevel === "Médio") return lv.includes("mé") || lv.includes("med");
    if(desiredLevel === "Difícil") return lv.includes("dif");
    return false;
  });

  let idx = pickFromPool(poolExact, p.usedQuestions);
  if(idx == null) idx = pickFromPool(pool, p.usedQuestions);
  return idx;
}

function buildRenderedQuestion(original){
  // Pode embaralhar opções, mas precisa recalcular answer
  const opts = original.options.map((text, idx) => ({ text, idx }));
  if(shuffleOptions) shuffle(opts);

  const renderedOptions = opts.map(o => o.text);
  const newAnswerIndex = opts.findIndex(o => o.idx === original.answer);

  return {
    ...original,
    options: renderedOptions,
    answer: newAnswerIndex
  };
}

// ---------- RENDER ----------
function renderPlayers(){
  playersList.innerHTML = "";
  players.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "pRow" + (i === currentPlayer && p.status === "Jogando" ? " active" : "");
    row.innerHTML = `
      <div class="pLeft">
        <div class="avatar">${initials(p.name)}</div>
        <div>
          <div class="pName">${p.name}</div>
          <div class="pSub">${p.status} • etapa ${p.step}/${LADDER.length}</div>
        </div>
      </div>
      <div class="pMoney">${fmtBRL(p.moneyBig)}</div>
    `;
    playersList.appendChild(row);
  });

  const p = getCurrentPlayer();
  pillStatus.textContent = p ? `Vez de: ${p.name}` : "—";
}

function renderLadder(){
  ladderEl.innerHTML = "";
  const p = getCurrentPlayer();
  const step = p ? p.step : 0;

  // Escada invertida (maior em cima), estilo show
  const reversed = [...LADDER].reverse();
  reversed.forEach(s => {
    const div = document.createElement("div");
    div.className = "lStep";
    const isCurrentTarget = (s.step === step + 1) && p?.status === "Jogando";
    if(isCurrentTarget) div.classList.add("current");
    if(SAFE_STEPS.has(s.step)) div.classList.add("safe");

    div.innerHTML = `
      <span><b>${s.step}</b> • ${s.diff}</span>
      <span><b>${fmtBRL(s.prize)}</b></span>
    `;
    ladderEl.appendChild(div);
  });

  pillRound.textContent = p ? `Etapa ${p.step+1}/${LADDER.length}` : "—";
}

function renderTopTags(){
  const p = getCurrentPlayer();
  if(!p){
    tagPlayer.textContent = "—";
    tagPrize.textContent = "—";
    tagQ.textContent = "—";
    return;
  }
  const next = getStepInfo(p.step+1);
  const prize = next ? next.prize : p.moneyBig;

  tagPlayer.textContent = `Jogador: ${p.name}`;
  tagPrize.textContent = `Valendo: ${fmtBRL(prize)}`;
  tagQ.textContent = `Etapa: ${p.step+1}/${LADDER.length}`;

  catNow.textContent = currentQOriginal?.category || "—";
  diffNow.textContent = desiredLevelForStep(p.step+1);

  const pct = Math.round((p.step / LADDER.length) * 100);
  bar.style.width = `${pct}%`;
}

// ---------- AJUDAS ----------
function setHelpButtonsState(p){
  helpCards.classList.toggle("used", !p.lifelines.cards);
  helpUni.classList.toggle("used", !p.lifelines.uni);
  helpAudience.classList.toggle("used", !p.lifelines.audience);

  helpCards.disabled = !p.lifelines.cards || locked || p.status !== "Jogando";
  helpUni.disabled = !p.lifelines.uni || locked || p.status !== "Jogando";
  helpAudience.disabled = !p.lifelines.audience || locked || p.status !== "Jogando";

  helpSkip.textContent = `Pular (${p.skipsLeft})`;
  helpSkip.disabled = (p.skipsLeft <= 0) || locked || p.status !== "Jogando";
}

// Cartas: “sugestão” com 60% de chance de ser a correta
function doHelpCards(){
  const p = getCurrentPlayer();
  if(!p || !p.lifelines.cards || !currentQ) return;

  p.lifelines.cards = false;
  setHelpButtonsState(p);

  const correct = currentQ.answer;
  const chanceCorrect = 0.60;
  let suggestion;
  if(Math.random() < chanceCorrect){
    suggestion = correct;
  } else {
    const wrong = [0,1,2,3].filter(i => i !== correct);
    suggestion = wrong[Math.floor(Math.random() * wrong.length)];
  }

  const letter = String.fromCharCode(65 + suggestion);
  const txt = currentQ.options[suggestion];

  showHelp("Ajuda das Cartas", `Uma carta “chutada” indica a alternativa <b>${letter}</b>: “${escapeHtml(txt)}”.`);
}

// Universitários: 3 palpites, geralmente acertam (70%) e podem divergir
function doHelpUni(){
  const p = getCurrentPlayer();
  if(!p || !p.lifelines.uni || !currentQ) return;

  p.lifelines.uni = false;
  setHelpButtonsState(p);

  const correct = currentQ.answer;
  const names = ["Ana", "Bruno", "Camila"];
  const answers = names.map(() => {
    const isCorrect = Math.random() < 0.70;
    if(isCorrect) return correct;
    const wrong = [0,1,2,3].filter(i => i !== correct);
    return wrong[Math.floor(Math.random() * wrong.length)];
  });

  const lines = answers.map((a, i) => {
    const L = String.fromCharCode(65 + a);
    return `<b>${names[i]}</b>: ${L}`;
  }).join("<br/>");

  showHelp("Ajuda dos Universitários", `Palpites:<br/>${lines}`);
}

// Plateia: percentuais, com maior peso na correta (mas pode errar)
function doHelpAudience(){
  const p = getCurrentPlayer();
  if(!p || !p.lifelines.audience || !currentQ) return;

  p.lifelines.audience = false;
  setHelpButtonsState(p);

  const correct = currentQ.answer;

  // gera distribuição com viés na correta
  let base = [10,10,10,10];
  base[correct] = 55 + Math.floor(Math.random()*16); // 55..70
  let remaining = 100 - base[correct];

  const others = [0,1,2,3].filter(i => i !== correct);
  // divide restante
  const a = Math.floor(remaining * (0.3 + Math.random()*0.2));
  const b = Math.floor((remaining - a) * (0.4 + Math.random()*0.2));
  const c = remaining - a - b;

  const dist = [0,0,0,0];
  dist[correct] = base[correct];
  dist[others[0]] = a;
  dist[others[1]] = b;
  dist[others[2]] = c;

  const rows = dist.map((pct, i) => {
    const L = String.fromCharCode(65 + i);
    return `<div style="display:flex;justify-content:space-between;gap:12px;">
      <span><b>${L}</b> — ${escapeHtml(currentQ.options[i])}</span>
      <b>${pct}%</b>
    </div>`;
  }).join("<div style='height:8px'></div>");

  showHelp("Ajuda da Plateia", rows);
}

// 50:50 clássico seria “cartas”, mas você pediu cartas+uni+plateia.
// Então vamos deixar o 50:50 como parte das Cartas? Não. Melhor: Cartas = sugestão.
// Se você quiser 50:50 também, eu adiciono como 4ª ajuda depois.
function doSkip(){
  const p = getCurrentPlayer();
  if(!p || p.skipsLeft <= 0) return;
  // troca a pergunta, mesma etapa
  p.skipsLeft -= 1;
  feedbackEl.textContent = `⏭️ Pergunta pulada! (${p.skipsLeft} pulos restantes)`;
  setHelpButtonsState(p);
  loadQuestionForCurrentPlayer(true); // true = substitui, sem contar como usada
}

function showHelp(title, html){
  helpTitle.textContent = title;
  helpBody.innerHTML = html;
  openModal(modalHelp);
}

function escapeHtml(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

// ---------- JOGO ----------
function resetAllState(){
  players = [];
  currentPlayer = 0;
  locked = false;
  currentQ = null;
  currentQOriginal = null;
  currentPrize = 0n;
  startedAt = Date.now();

  feedbackEl.textContent = "";
  btnNextPlayer.disabled = true;
  setScreen(false);
  bar.style.width = "0%";
}

function createPlayers(names){
  players = names.map(n => ({
    name: n,
    moneyBig: 0n,
    step: 0,
    status: "Jogando",
    lifelines: { cards:true, uni:true, audience:true },
    skipsLeft: 3,
    usedQuestions: new Set(),
  }));
  currentPlayer = 0;
}

function updateHelpUI(){
  const p = getCurrentPlayer();
  if(!p) return;
  setHelpButtonsState(p);
}

function renderQuestion(qRendered){
  locked = false;
  feedbackEl.textContent = "";
  btnNextPlayer.disabled = true;

  qMeta.textContent = `${qRendered.category} • ${desiredLevelForStep(getCurrentPlayer().step+1)}`;
  qText.textContent = qRendered.question;

  answersEl.innerHTML = "";
  qRendered.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    btn.innerHTML = `<span class="badge">${String.fromCharCode(65+i)}</span><span class="txt">${opt}</span>`;
    btn.addEventListener("click", () => chooseAnswer(i, btn));
    answersEl.appendChild(btn);
  });

  updateHelpUI();
  renderPlayers();
  renderLadder();
  renderTopTags();
}

function loadQuestionForCurrentPlayer(isSkipReplacement=false){
  const p = getCurrentPlayer();
  if(!p) return;

  const stepNext = p.step + 1;
  if(stepNext > LADDER.length){
    // já terminou
    endPlayerRun("Venceu");
    return;
  }

  const idx = pickQuestionForPlayer(p);
  if(idx == null){
    // sem perguntas disponíveis
    endPlayerRun("Sem perguntas");
    return;
  }

  // marca como usada (se não for substituição de pulo)
  if(!isSkipReplacement){
    p.usedQuestions.add(idx);
  }

  currentQOriginal = ALL_QUESTIONS[idx];
  currentQ = buildRenderedQuestion(currentQOriginal);

  // prêmio da etapa
  const info = getStepInfo(stepNext);
  currentPrize = info ? info.prize : 0n;

  renderQuestion(currentQ);
}

function disableOptions(){
  [...answersEl.querySelectorAll(".option")].forEach(b => b.classList.add("disabled"));
}

function chooseAnswer(chosen, btnEl){
  if(locked) return;
  locked = true;

  const p = getCurrentPlayer();
  if(!p) return;

  disableOptions();

  const correct = currentQ.answer;
  const buttons = [...answersEl.querySelectorAll(".option")];
  buttons[correct]?.classList.add("correct");

  if(chosen === correct){
    // avança etapa
    p.step += 1;
    p.moneyBig = currentPrize;

    feedbackEl.textContent = `✅ Correto! Você avançou para ${fmtBRL(p.moneyBig)}. ${currentQOriginal.explanation ? currentQOriginal.explanation : ""}`;

    // terminou?
    if(p.step >= LADDER.length){
      endPlayerRun("Venceu");
    } else {
      // próxima pergunta do mesmo jogador
      setTimeout(() => {
        loadQuestionForCurrentPlayer(false);
      }, 650);
    }

  } else {
    btnEl.classList.add("wrong");

    // “queda” ao último safe step (estilo show)
    let safeMoney = 0n;
    for(const s of LADDER){
      if(SAFE_STEPS.has(s.step) && s.step <= p.step){
        safeMoney = s.prize;
      }
    }
    p.moneyBig = safeMoney;

    feedbackEl.textContent = `❌ Errado! Você sai com ${fmtBRL(p.moneyBig)}. A correta era ${String.fromCharCode(65+correct)}.`;

    endPlayerRun("Eliminado");
  }

  renderPlayers();
  renderLadder();
  renderTopTags();
}

function endPlayerRun(reason){
  const p = getCurrentPlayer();
  if(!p) return;

  if(reason === "Venceu") p.status = "Venceu";
  else if(reason === "Eliminado") p.status = "Finalizou";
  else p.status = "Finalizou";

  // desliga ajudas
  p.lifelines = {cards:false, uni:false, audience:false};
  p.skipsLeft = 0;
  updateHelpUI();

  // vai pro próximo jogador ou fim do jogo
  btnNextPlayer.disabled = false;
  feedbackEl.textContent += `  👉 Clique em “Próximo jogador”.`;

  // trava escolhas
  locked = true;
  disableOptions();
}

function nextPlayer(){
  // achar próximo que ainda está "Jogando"
  let next = currentPlayer + 1;
  while(next < players.length && players[next].status !== "Jogando") next++;

  if(next >= players.length){
    // acabou a rodada de todos
    showFinal();
    return;
  }

  currentPlayer = next;
  locked = false;
  loadQuestionForCurrentPlayer(false);
}

function showFinal(){
  setScreen(true);
  bar.style.width = "100%";

  const secs = Math.max(1, Math.round((Date.now() - startedAt)/1000));
  const mm = String(Math.floor(secs/60)).padStart(2,"0");
  const ss = String(secs%60).padStart(2,"0");

  const sorted = [...players].sort((a,b) => (b.moneyBig > a.moneyBig ? 1 : b.moneyBig < a.moneyBig ? -1 : 0));
  finalText.textContent = `Rodada finalizada. Tempo total: ${mm}:${ss}. Ranking abaixo:`;

  finalRanking.innerHTML = "";
  sorted.forEach((p, i) => {
    const medal = i===0 ? "🥇" : i===1 ? "🥈" : i===2 ? "🥉" : `${i+1}º`;
    const row = document.createElement("div");
    row.className = "rankRow";
    row.innerHTML = `
      <div class="rankLeft">
        <div class="medal">${medal}</div>
        <div>
          <div style="font-weight:950">${p.name}</div>
          <div style="color:rgba(234,255,248,.72);font-size:12px">${p.status} • etapa ${p.step}/${LADDER.length}</div>
        </div>
      </div>
      <div style="font-weight:950">${fmtBRL(p.moneyBig)}</div>
    `;
    finalRanking.appendChild(row);
  });
}

// Parar e levar
function stopAndTake(){
  const p = getCurrentPlayer();
  if(!p || p.status !== "Jogando") return;

  p.status = "Finalizou";
  feedbackEl.textContent = `🛑 Você parou e levou ${fmtBRL(p.moneyBig)}.`;
  endPlayerRun("Parou");
}

// ---------- CARREGAR QUESTÕES ----------
async function loadQuestions(){
  try{
    const res = await fetch("questions.json", { cache: "no-store" });
    if(!res.ok) throw new Error("Não consegui ler questions.json");
    const data = await res.json();
    if(!Array.isArray(data) || data.length === 0) throw new Error("questions.json vazio ou inválido.");

    ALL_QUESTIONS = data.map(normalizeQuestion).filter(q =>
      q.question && Array.isArray(q.options) && q.options.length >= 4 && Number.isFinite(q.answer)
    ).map(q => ({
      ...q,
      options: q.options.slice(0,4), // garante 4
      answer: Math.max(0, Math.min(3, q.answer))
    }));

    buildIndexes();
    qText.textContent = "Pronto! Clique em “Configurar” para começar.";
  } catch(err){
    qText.textContent = "Erro ao carregar perguntas.";
    feedbackEl.textContent = String(err.message || err);
  }
}

// ---------- BOOT ----------
function openConfig(){
  openModal(modalConfig);
}
function closeConfig(){
  closeModal(modalConfig);
}

function startGame(){
  const names = readNames();
  if(names.length < 1){
    alert("Digite pelo menos 1 jogador.");
    return;
  }
  if(ALL_QUESTIONS.length < 1){
    alert("Sem perguntas. Verifique o questions.json.");
    return;
  }

  selectedCategories = readCategories();
  shuffleQuestions = chkShuffleQ.checked;
  shuffleOptions = chkShuffleOpt.checked;

  createPlayers(names);
  startedAt = Date.now();

  // Começa pelo jogador 1
  setScreen(false);
  closeConfig();

  locked = false;
  currentPlayer = 0;

  // Render inicial
  renderPlayers();
  renderLadder();
  renderTopTags();

  loadQuestionForCurrentPlayer(false);
}

function resetGameKeepPlayers(){
  // reinicia a rodada com mesmos jogadores e config
  players = players.map(p => ({
    ...p,
    moneyBig: 0n,
    step: 0,
    status: "Jogando",
    lifelines: { cards:true, uni:true, audience:true },
    skipsLeft: 3,
    usedQuestions: new Set()
  }));
  currentPlayer = 0;
  locked = false;
  startedAt = Date.now();
  setScreen(false);
  loadQuestionForCurrentPlayer(false);
}

// ---------- EVENTOS ----------
btnConfig.addEventListener("click", openConfig);
btnReconfig.addEventListener("click", () => { openConfig(); });

btnStart.addEventListener("click", startGame);

btnResetAll.addEventListener("click", () => {
  resetAllState();
  openConfig();
});

btnNextPlayer.addEventListener("click", () => {
  btnNextPlayer.disabled = true;
  nextPlayer();
});

btnPlayAgain.addEventListener("click", resetGameKeepPlayers);

btnStop.addEventListener("click", stopAndTake);

// Ajudas
helpCards.addEventListener("click", doHelpCards);
helpUni.addEventListener("click", doHelpUni);
helpAudience.addEventListener("click", doHelpAudience);
helpSkip.addEventListener("click", doSkip);

btnHelpClose.addEventListener("click", () => closeModal(modalHelp));

// init
buildPlayerInputs();
bindCategoryRules();
resetAllState();
loadQuestions();
openConfig();