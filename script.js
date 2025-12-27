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
const btnSound = $("#btnSound");
const bar = $("#bar");
const lockOverlay = $("#lockOverlay");

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

// Congrats modal
const modalCongrats = $("#modalCongrats");
const congratsTitle = $("#congratsTitle");
const congratsBody = $("#congratsBody");
const congratsMoney = $("#congratsMoney");
const congratsStep = $("#congratsStep");
const congratsStatus = $("#congratsStatus");
const btnCongratsNext = $("#btnCongratsNext");

// Lifelines
const help5050 = $("#help5050");
const helpUni = $("#helpUni");
const helpAudience = $("#helpAudience");
const helpSkip = $("#helpSkip");

// ---------- ESCADA ----------
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

const SAFE_STEPS = new Set([5, 10, 16]);

// ---------- ESTADO ----------
let ALL_QUESTIONS = [];
let availableByCat = new Map();
let availableAny = [];

let selectedCategories = new Set(["Variadas"]);
let shuffleQuestions = true;
let shuffleOptions = true;

let players = []; // {name, moneyBig, step, status, lifelines, skipsLeft, usedQuestions:Set<number>}
let currentPlayer = 0;
let startedAt = 0;

let locked = false;
let currentQ = null;
let currentQOriginal = null;
let currentPrize = 0n;

let pendingNextAction = null; // "nextPlayer" | "final"
let soundEnabled = true;

// ---------- SOM (WebAudio) ----------
let audioCtx = null;
let tensionTimer = null;
let tensionActive = false;

function ensureAudio(){
  if(!soundEnabled) return null;
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if(audioCtx.state === "suspended"){
    audioCtx.resume().catch(()=>{});
  }
  return audioCtx;
}

function beep({freq=440, dur=0.12, type="sine", gain=0.06, ramp=0.02}){
  const ctx = ensureAudio();
  if(!ctx) return;

  const o = ctx.createOscillator();
  const g = ctx.createGain();

  o.type = type;
  o.frequency.value = freq;

  const now = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + ramp);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  o.connect(g);
  g.connect(ctx.destination);

  o.start(now);
  o.stop(now + dur + 0.02);
}

function soundCorrect(){
  beep({freq:523.25, dur:0.10, type:"triangle", gain:0.07});
  setTimeout(()=>beep({freq:659.25, dur:0.12, type:"triangle", gain:0.07}), 90);
  setTimeout(()=>beep({freq:783.99, dur:0.13, type:"triangle", gain:0.08}), 190);
}

function soundWrong(){
  beep({freq:220, dur:0.16, type:"sawtooth", gain:0.06});
  setTimeout(()=>beep({freq:196, dur:0.18, type:"sawtooth", gain:0.06}), 120);
}

function soundClick(){
  beep({freq:880, dur:0.04, type:"square", gain:0.03});
}

function soundLifeline(){
  beep({freq:740, dur:0.07, type:"sine", gain:0.05});
  setTimeout(()=>beep({freq:988, dur:0.08, type:"sine", gain:0.05}), 80);
}

function startTensionIfNeeded(){
  // tensão a partir da etapa 12 (pode ajustar)
  const p = getCurrentPlayer();
  if(!p) return;

  const nextStep = p.step + 1;
  const should = soundEnabled && nextStep >= 12 && p.status === "Jogando";

  if(should && !tensionActive){
    tensionActive = true;
    let tick = 0;
    tensionTimer = setInterval(() => {
      // pulso grave + agudo sutil
      const step = getCurrentPlayer()?.step + 1;
      const intensity = Math.min(1, Math.max(0, (step - 12) / 4)); // 0..1
      const base = 160 + Math.round(40 * intensity);
      const top = 480 + Math.round(220 * intensity);

      // faz um "dum" a cada ~1.4s e um "tic" leve a cada ~0.7s
      if(tick % 2 === 0) beep({freq:base, dur:0.09, type:"sine", gain:0.035 + 0.02*intensity});
      beep({freq:top, dur:0.03, type:"triangle", gain:0.018 + 0.02*intensity});
      tick++;
    }, 700);
  }

  if(!should && tensionActive){
    stopTension();
  }
}

function stopTension(){
  tensionActive = false;
  if(tensionTimer){
    clearInterval(tensionTimer);
    tensionTimer = null;
  }
}

// ---------- UTIL ----------
function fmtBRL(big){
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

function showLock(isOn){
  lockOverlay.classList.toggle("show", isOn);
  lockOverlay.setAttribute("aria-hidden", isOn ? "false" : "true");
}

function escapeHtml(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
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
  if(marked.has("Variadas")) return new Set(["Variadas"]);
  return marked;
}

function bindCategoryRules(){
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
      const anyOtherChecked = all.some(x => x.value !== "Variadas" && x.checked);
      if(!anyOtherChecked) vari.checked = true;
    });
  });
}

// ---------- BANCO ----------
function normalizeQuestion(q){
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

  if(shuffleQuestions){
    shuffle(availableAny);
    for(const [k,v] of availableByCat.entries()){
      shuffle(v);
      availableByCat.set(k, v);
    }
  }
}

function categoriesAvailable(){
  return new Set([...availableByCat.keys()]);
}

// ---------- SELEÇÃO DE QUESTÃO ----------
function desiredLevelForStep(step){
  const info = getStepInfo(step);
  return info ? info.diff : "Médio";
}

function levelMatches(desired, levelStr){
  const lv = (levelStr || "").toLowerCase();
  if(!lv) return false;
  if(desired === "Fácil") return lv.includes("fá") || lv.includes("fac");
  if(desired === "Médio") return lv.includes("mé") || lv.includes("med");
  if(desired === "Difícil") return lv.includes("dif");
  return false;
}

function pickFromPool(pool, usedSet){
  for(let tries=0; tries<1200; tries++){
    const idx = pool[Math.floor(Math.random() * pool.length)];
    if(!usedSet.has(idx)) return idx;
  }
  const candidates = pool.filter(i => !usedSet.has(i));
  if(candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function pickQuestionForPlayer(p){
  const stepNext = p.step + 1;
  const desiredLevel = desiredLevelForStep(stepNext);

  let pool = [];
  const availCats = categoriesAvailable();

  if(selectedCategories.has("Variadas")){
    pool = availableAny.slice();
  } else {
    const chosen = [...selectedCategories].filter(c => availCats.has(c));
    if(chosen.length === 0){
      pool = availableAny.slice();
    } else {
      for(const c of chosen){
        pool.push(...(availableByCat.get(c) || []));
      }
    }
  }

  const poolExact = pool.filter(i => levelMatches(desiredLevel, ALL_QUESTIONS[i].level));
  let idx = null;

  if(poolExact.length > 0) idx = pickFromPool(poolExact, p.usedQuestions);
  if(idx == null) idx = pickFromPool(pool, p.usedQuestions);

  return idx;
}

function buildRenderedQuestion(original){
  const opts = original.options.slice(0,4).map((text, idx) => ({ text, idx }));
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
    catNow.textContent = "—";
    diffNow.textContent = "—";
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
  help5050.classList.toggle("used", !p.lifelines.fifty);
  helpUni.classList.toggle("used", !p.lifelines.uni);
  helpAudience.classList.toggle("used", !p.lifelines.audience);

  help5050.disabled = !p.lifelines.fifty || locked || p.status !== "Jogando";
  helpUni.disabled = !p.lifelines.uni || locked || p.status !== "Jogando";
  helpAudience.disabled = !p.lifelines.audience || locked || p.status !== "Jogando";

  helpSkip.textContent = `Pular (${p.skipsLeft})`;
  helpSkip.disabled = (p.skipsLeft <= 0) || locked || p.status !== "Jogando";
}

function updateHelpUI(){
  const p = getCurrentPlayer();
  if(!p) return;
  setHelpButtonsState(p);
}

function showHelp(title, html){
  helpTitle.textContent = title;
  helpBody.innerHTML = html;
  openModal(modalHelp);
}

function doHelp5050(){
  const p = getCurrentPlayer();
  if(!p || !p.lifelines.fifty || !currentQ) return;

  soundLifeline();
  p.lifelines.fifty = false;
  setHelpButtonsState(p);

  const correct = currentQ.answer;
  const wrong = [0,1,2,3].filter(i => i !== correct);
  const toRemove = shuffle(wrong).slice(0,2);

  const buttons = [...answersEl.querySelectorAll(".option")];
  toRemove.forEach((i, idx) => {
    const btn = buttons[i];
    if(!btn) return;
    setTimeout(() => {
      btn.classList.add("removing");
      btn.classList.add("disabled");
    }, 60 * idx);
  });

  const removedLetters = toRemove
    .sort((a,b)=>a-b)
    .map(i => String.fromCharCode(65+i))
    .join(" e ");

  showHelp("Ajuda 50:50", `Duas alternativas erradas foram eliminadas: <b>${removedLetters}</b>.`);
}

function doHelpUni(){
  const p = getCurrentPlayer();
  if(!p || !p.lifelines.uni || !currentQ) return;

  soundLifeline();
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

function doHelpAudience(){
  const p = getCurrentPlayer();
  if(!p || !p.lifelines.audience || !currentQ) return;

  soundLifeline();
  p.lifelines.audience = false;
  setHelpButtonsState(p);

  const correct = currentQ.answer;

  let correctPct = 55 + Math.floor(Math.random()*16); // 55..70
  let remaining = 100 - correctPct;

  const others = [0,1,2,3].filter(i => i !== correct);
  const a = Math.floor(remaining * (0.3 + Math.random()*0.2));
  const b = Math.floor((remaining - a) * (0.4 + Math.random()*0.2));
  const c = remaining - a - b;

  const dist = [0,0,0,0];
  dist[correct] = correctPct;
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

function doSkip(){
  const p = getCurrentPlayer();
  if(!p || p.skipsLeft <= 0) return;

  soundLifeline();
  p.skipsLeft -= 1;
  feedbackEl.textContent = `⏭️ Pergunta pulada! (${p.skipsLeft} pulos restantes)`;
  setHelpButtonsState(p);
  loadQuestionForCurrentPlayer(true);
}

// ---------- JOGO ----------
function resetAllState(){
  stopTension();
  players = [];
  currentPlayer = 0;
  locked = false;
  currentQ = null;
  currentQOriginal = null;
  currentPrize = 0n;
  startedAt = Date.now();
  pendingNextAction = null;

  feedbackEl.textContent = "";
  btnNextPlayer.disabled = true;
  setScreen(false);
  bar.style.width = "0%";
  showLock(false);
}

function createPlayers(names){
  players = names.map(n => ({
    name: n,
    moneyBig: 0n,
    step: 0,
    status: "Jogando",
    lifelines: { fifty:true, uni:true, audience:true },
    skipsLeft: 3,
    usedQuestions: new Set()
  }));
  currentPlayer = 0;
}

function disableOptions(){
  [...answersEl.querySelectorAll(".option")].forEach(b => b.classList.add("disabled"));
}

function enableOptions(){
  [...answersEl.querySelectorAll(".option")].forEach(b => b.classList.remove("disabled"));
}

function renderQuestion(qRendered){
  locked = false;
  feedbackEl.textContent = "";
  btnNextPlayer.disabled = true;

  const p = getCurrentPlayer();
  qMeta.textContent = `${qRendered.category} • ${desiredLevelForStep(p.step+1)}`;
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
  startTensionIfNeeded();
}

function loadQuestionForCurrentPlayer(isSkipReplacement=false){
  const p = getCurrentPlayer();
  if(!p) return;

  const stepNext = p.step + 1;
  if(stepNext > LADDER.length){
    endPlayerRun({ reason:"Venceu" });
    return;
  }

  const idx = pickQuestionForPlayer(p);
  if(idx == null){
    endPlayerRun({ reason:"Sem perguntas" });
    return;
  }

  if(!isSkipReplacement){
    p.usedQuestions.add(idx);
  }

  currentQOriginal = ALL_QUESTIONS[idx];
  currentQ = buildRenderedQuestion(currentQOriginal);

  const info = getStepInfo(stepNext);
  currentPrize = info ? info.prize : 0n;

  renderQuestion(currentQ);
}

function chooseAnswer(chosen, btnEl){
  if(locked) return;
  locked = true;
  soundClick();

  const p = getCurrentPlayer();
  if(!p) return;

  // trava a UI e cria tensão curta
  showLock(true);
  disableOptions();

  const correct = currentQ.answer;
  const buttons = [...answersEl.querySelectorAll(".option")];

  // revela após delay (efeito programa de TV)
  setTimeout(() => {
    showLock(false);

    buttons[correct]?.classList.add("correct");

    if(chosen === correct){
      soundCorrect();
      p.step += 1;
      p.moneyBig = currentPrize;

      feedbackEl.textContent =
        `✅ Correto! Você avançou para ${fmtBRL(p.moneyBig)}.` +
        (currentQOriginal.explanation ? ` ${currentQOriginal.explanation}` : "");

      renderPlayers();
      renderLadder();
      renderTopTags();
      startTensionIfNeeded();

      if(p.step >= LADDER.length){
        endPlayerRun({ reason:"Venceu" });
        return;
      }

      // próxima pergunta do mesmo jogador (efeito show)
      setTimeout(() => {
        loadQuestionForCurrentPlayer(false);
      }, 750);

    } else {
      soundWrong();
      btnEl.classList.add("wrong");

      let safeMoney = 0n;
      for(const s of LADDER){
        if(SAFE_STEPS.has(s.step) && s.step <= p.step){
          safeMoney = s.prize;
        }
      }
      p.moneyBig = safeMoney;

      feedbackEl.textContent =
        `❌ Errado! Você sai com ${fmtBRL(p.moneyBig)}. ` +
        `A correta era ${String.fromCharCode(65+correct)}.`;

      renderPlayers();
      renderLadder();
      renderTopTags();
      stopTension();

      endPlayerRun({ reason:"Finalizou" });
    }
  }, 900);
}

// Tela por jogador
function showCongrats({ title, body, moneyBig, step, statusChip }){
  congratsTitle.textContent = title;
  congratsBody.textContent = body;
  congratsMoney.textContent = fmtBRL(moneyBig);
  congratsStep.textContent = `Etapa ${step}/${LADDER.length}`;
  congratsStatus.textContent = statusChip;
  openModal(modalCongrats);
}

function endPlayerRun({ reason }){
  const p = getCurrentPlayer();
  if(!p) return;

  // encerra tensão
  stopTension();

  // define status
  if(reason === "Venceu"){
    p.status = "Venceu";
  } else {
    p.status = "Finalizou";
  }

  // trava ajudas
  p.lifelines = { fifty:false, uni:false, audience:false };
  p.skipsLeft = 0;
  updateHelpUI();

  // decide próximo passo
  const nextIndex = findNextPlayableIndex(currentPlayer + 1);
  pendingNextAction = (nextIndex === -1) ? "final" : "nextPlayer";

  // mostra “Parabéns” por jogador
  const title =
    reason === "Venceu" ? "🏆 INCRÍVEL! Você chegou ao TRILHÃO!" :
    reason === "Sem perguntas" ? "⚠️ Banco insuficiente" :
    "🎉 Rodada encerrada!";

  const body =
    reason === "Venceu" ? `Você venceu o Jogo do Trilhão!` :
    reason === "Sem perguntas" ? `Não há perguntas suficientes para continuar nessa categoria/nível.` :
    `Você terminou sua rodada e levou o prêmio acima.`;

  const chip =
    reason === "Venceu" ? "Venceu" :
    reason === "Sem perguntas" ? "Finalizou" :
    "Finalizou";

  showCongrats({
    title,
    body,
    moneyBig: p.moneyBig,
    step: p.step,
    statusChip: chip
  });

  locked = true;
  disableOptions();
  btnNextPlayer.disabled = true; // agora o fluxo é pelo modal
}

function findNextPlayableIndex(start){
  for(let i=start; i<players.length; i++){
    if(players[i].status === "Jogando") return i;
  }
  return -1;
}

function continueAfterCongrats(){
  closeModal(modalCongrats);

  if(pendingNextAction === "final"){
    showFinal();
    return;
  }

  // próximo jogador
  const next = findNextPlayableIndex(currentPlayer + 1);
  if(next === -1){
    showFinal();
    return;
  }

  currentPlayer = next;
  locked = false;
  enableOptions();
  loadQuestionForCurrentPlayer(false);
}

function showFinal(){
  setScreen(true);
  bar.style.width = "100%";

  const secs = Math.max(1, Math.round((Date.now() - startedAt)/1000));
  const mm = String(Math.floor(secs/60)).padStart(2,"0");
  const ss = String(secs%60).padStart(2,"0");

  const sorted = [...players].sort((a,b) => (b.moneyBig > a.moneyBig ? 1 : b.moneyBig < a.moneyBig ? -1 : 0));
  finalText.textContent = `Rodada finalizada. Tempo total: ${mm}:${ss}. Ranking:`;

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

  soundWrong(); // som de “encerrou”
  stopTension();

  p.status = "Finalizou";

  feedbackEl.textContent = `🛑 Você parou e levou ${fmtBRL(p.moneyBig)}.`;
  renderPlayers();
  renderLadder();
  renderTopTags();

  endPlayerRun({ reason:"Finalizou" });
}

// ---------- CARREGAR QUESTÕES ----------
async function loadQuestions(){
  try{
    const res = await fetch("questions.json", { cache: "no-store" });
    if(!res.ok) throw new Error("Não consegui ler questions.json");
    const data = await res.json();
    if(!Array.isArray(data) || data.length === 0) throw new Error("questions.json vazio ou inválido.");

    ALL_QUESTIONS = data
      .map(normalizeQuestion)
      .filter(q => q.question && Array.isArray(q.options) && q.options.length >= 4 && Number.isFinite(q.answer))
      .map(q => ({
        ...q,
        options: q.options.slice(0,4),
        answer: Math.max(0, Math.min(3, q.answer))
      }));

    buildIndexes();
    qText.textContent = "Pronto! Clique em “Configurar” para começar.";
  } catch(err){
    qText.textContent = "Erro ao carregar perguntas.";
    feedbackEl.textContent = String(err.message || err);
  }
}

// ---------- INICIAR / RESET ----------
function startGame(){
  // primeira interação: libera áudio em browsers restritivos
  ensureAudio();

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

  buildIndexes();

  createPlayers(names);
  startedAt = Date.now();

  setScreen(false);
  closeModal(modalConfig);

  locked = false;
  currentPlayer = 0;

  renderPlayers();
  renderLadder();
  renderTopTags();

  loadQuestionForCurrentPlayer(false);
}

function resetGameKeepPlayers(){
  ensureAudio();
  stopTension();

  players = players.map(p => ({
    ...p,
    moneyBig: 0n,
    step: 0,
    status: "Jogando",
    lifelines: { fifty:true, uni:true, audience:true },
    skipsLeft: 3,
    usedQuestions: new Set()
  }));

  currentPlayer = 0;
  locked = false;
  startedAt = Date.now();
  pendingNextAction = null;

  setScreen(false);
  loadQuestionForCurrentPlayer(false);
}

function toggleSound(){
  soundEnabled = !soundEnabled;
  btnSound.textContent = soundEnabled ? "Som: ON" : "Som: OFF";
  if(!soundEnabled) stopTension();
  else startTensionIfNeeded();
}

// ---------- EVENTOS ----------
btnConfig.addEventListener("click", () => openModal(modalConfig));
btnReconfig.addEventListener("click", () => openModal(modalConfig));
btnStart.addEventListener("click", startGame);

btnResetAll.addEventListener("click", () => {
  resetAllState();
  openModal(modalConfig);
});

btnPlayAgain.addEventListener("click", resetGameKeepPlayers);
btnStop.addEventListener("click", stopAndTake);

btnSound.addEventListener("click", toggleSound);

// Ajudas
help5050.addEventListener("click", doHelp5050);
helpUni.addEventListener("click", doHelpUni);
helpAudience.addEventListener("click", doHelpAudience);
helpSkip.addEventListener("click", doSkip);

btnHelpClose.addEventListener("click", () => closeModal(modalHelp));
btnCongratsNext.addEventListener("click", continueAfterCongrats);

// ---------- CONFIG helpers ----------
function readCategories(){
  const checks = [...modalConfig.querySelectorAll(".cats input[type=checkbox]")];
  const marked = new Set(checks.filter(c => c.checked).map(c => c.value));
  if(marked.size === 0) marked.add("Variadas");
  if(marked.has("Variadas")) return new Set(["Variadas"]);
  return marked;
}

// ---------- INIT ----------
buildPlayerInputs();
bindCategoryRules();
resetAllState();
loadQuestions();
openModal(modalConfig);