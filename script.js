const $ = (sel) => document.querySelector(sel);

const scoreList = $("#scoreList");
const pillRound = $("#pillRound");
const turnPlayer = $("#turnPlayer");
const hitsInfo = $("#hitsInfo");

const qText = $("#qText");
const qIndex = $("#qIndex");
const answersEl = $("#answers");
const feedbackEl = $("#feedback");
const btnNext = $("#btnNext");
const btnRestart = $("#btnRestart");
const btnNewGame = $("#btnNewGame");
const bar = $("#bar");

const gameArea = $("#gameArea");
const finalArea = $("#finalArea");
const finalText = $("#finalText");
const rankingEl = $("#ranking");
const btnPlayAgain = $("#btnPlayAgain");
const btnEditPlayers = $("#btnEditPlayers");

const setupModal = $("#setupModal");
const playerInputs = $("#playerInputs");
const btnStart = $("#btnStart");
const chkShuffle = $("#chkShuffle");
const chkShuffleOptions = $("#chkShuffleOptions");

let QUESTIONS = [];
let players = []; // {name, score, hits, attempts}
let qOrder = [];
let idxQ = 0;
let idxP = 0;
let locked = false;
let startedAt = 0;

const POINTS_PER_HIT = 10;

function letter(i){ return String.fromCharCode(65 + i); }

function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function openSetup(){
  setupModal.style.display = "grid";
  setupModal.setAttribute("aria-hidden", "false");
}

function closeSetup(){
  setupModal.style.display = "none";
  setupModal.setAttribute("aria-hidden", "true");
}

function buildPlayerInputs(){
  playerInputs.innerHTML = "";
  for(let i=0;i<8;i++){
    const wrap = document.createElement("div");
    wrap.className = "input";
    wrap.innerHTML = `
      <label>Jogador ${i+1}</label>
      <input type="text" maxlength="18" placeholder="Nome (opcional)" />
    `;
    playerInputs.appendChild(wrap);
  }
}

function getNamesFromInputs(){
  const inputs = [...playerInputs.querySelectorAll("input")];
  return inputs
    .map(i => (i.value || "").trim())
    .filter(Boolean)
    .slice(0,8);
}

function renderScoreboard(){
  scoreList.innerHTML = "";
  players.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "playerRow" + (i === idxP ? " active" : "");
    const initials = p.name.split(/\s+/).slice(0,2).map(s => s[0]?.toUpperCase()).join("");
    row.innerHTML = `
      <div class="playerLeft">
        <div class="avatar">${initials || "?"}</div>
        <div>
          <div class="pName">${p.name}</div>
          <div class="pSub">${p.hits} acerto(s) • ${p.attempts} turno(s)</div>
        </div>
      </div>
      <div class="pScore">${p.score}</div>
    `;
    scoreList.appendChild(row);
  });

  const totalQ = qOrder.length;
  pillRound.textContent = totalQ ? `Pergunta ${idxQ + 1}/${totalQ}` : "—";
  turnPlayer.textContent = players[idxP]?.name || "—";

  const totalHits = players.reduce((s,p)=>s+p.hits,0);
  hitsInfo.textContent = `${totalHits}/${Math.min(idxQ, qOrder.length)} (geral)`;
}

function updateProgress(){
  const total = qOrder.length || 0;
  const pct = total ? (idxQ / total) * 100 : 0;
  bar.style.width = `${pct}%`;
}

function setFinalVisible(isFinal){
  finalArea.style.display = isFinal ? "grid" : "none";
  gameArea.style.display = isFinal ? "none" : "grid";
}

function showQuestion(){
  locked = false;
  btnNext.disabled = true;
  feedbackEl.textContent = "";

  renderScoreboard();
  updateProgress();

  const q = QUESTIONS[qOrder[idxQ]];
  qIndex.textContent = `Turno de: ${players[idxP].name}`;
  qText.textContent = q.question;

  // opções (podemos embaralhar)
  let opts = q.options.map((text, index) => ({ text, index }));
  if (chkShuffleOptions.checked) opts = shuffle(opts);

  answersEl.innerHTML = "";
  opts.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    btn.innerHTML = `
      <span class="badge">${letter(i)}</span>
      <span class="txt">${opt.text}</span>
    `;
    btn.addEventListener("click", () => choose(opt.index, btn, q, opts));
    answersEl.appendChild(btn);
  });
}

function choose(chosenOriginalIndex, btnEl, q){
  if (locked) return;
  locked = true;

  players[idxP].attempts++;

  const buttons = [...answersEl.querySelectorAll(".option")];

  // marcar correto
  const correctOriginal = q.answer;

  // achar o botão que corresponde ao correto (por texto/posição original)
  // aqui dá pra descobrir comparando o texto do botão com q.options[correctOriginal]
  const correctText = q.options[correctOriginal];
  const correctBtn = buttons.find(b => b.querySelector(".txt")?.textContent === correctText);
  if (correctBtn) correctBtn.classList.add("correct");

  if (chosenOriginalIndex === correctOriginal){
    players[idxP].hits++;
    players[idxP].score += POINTS_PER_HIT;
    feedbackEl.textContent = `✅ Correto! +${POINTS_PER_HIT} pontos. ${q.explanation ? q.explanation : ""}`;
  } else {
    btnEl.classList.add("wrong");
    feedbackEl.textContent = `❌ Errado. ${q.explanation ? q.explanation : ""}`;
  }

  renderScoreboard();
  btnNext.disabled = false;
  bar.style.width = `${((idxQ + 1) / qOrder.length) * 100}%`;
}

function nextTurn(){
  // avançar pergunta
  if (idxQ < qOrder.length - 1){
    idxQ++;
    // avançar jogador
    idxP = (idxP + 1) % players.length;
    showQuestion();
  } else {
    finish();
  }
}

function finish(){
  setFinalVisible(true);
  bar.style.width = "100%";

  const totalQuestions = qOrder.length;
  const totalTurns = players.reduce((s,p)=>s+p.attempts,0);
  const secs = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  const sorted = [...players].sort((a,b)=>b.score - a.score);

  finalText.textContent =
    `Foram ${totalQuestions} perguntas • ${totalTurns} turnos • tempo ${mm}:${ss}.`;

  rankingEl.innerHTML = "";
  sorted.forEach((p, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}º`;
    const row = document.createElement("div");
    row.className = "rankRow";
    row.innerHTML = `
      <div class="rankLeft">
        <div class="medal">${medal}</div>
        <div>
          <div style="font-weight:900">${p.name}</div>
          <div style="color:rgba(234,240,255,.72);font-size:12px">${p.hits} acerto(s) • ${p.attempts} turno(s)</div>
        </div>
      </div>
      <div style="font-weight:950">${p.score}</div>
    `;
    rankingEl.appendChild(row);
  });
}

function resetState(keepPlayers=false){
  idxQ = 0;
  idxP = 0;
  locked = false;
  startedAt = Date.now();

  if (!keepPlayers){
    players = [];
  } else {
    players = players.map(p => ({...p, score:0, hits:0, attempts:0}));
  }

  setFinalVisible(false);
  feedbackEl.textContent = "";
  btnNext.disabled = true;
  bar.style.width = "0%";
}

function startGame(names){
  players = names.map(n => ({ name:n, score:0, hits:0, attempts:0 }));

  qOrder = QUESTIONS.map((_, i) => i);
  if (chkShuffle.checked) shuffle(qOrder);

  resetState(true);
  closeSetup();
  showQuestion();
}

async function loadQuestions(){
  try{
    const res = await fetch("questions.json", { cache: "no-store" });
    if(!res.ok) throw new Error("Não consegui ler questions.json");
    const data = await res.json();

    if(!Array.isArray(data) || data.length === 0){
      throw new Error("questions.json está vazio ou inválido.");
    }

    // validação mínima
    data.forEach((q, i) => {
      if(!q.question || !Array.isArray(q.options) || typeof q.answer !== "number"){
        throw new Error(`Pergunta inválida no índice ${i}.`);
      }
      if(q.answer < 0 || q.answer >= q.options.length){
        throw new Error(`"answer" fora do intervalo na pergunta ${i}.`);
      }
    });

    QUESTIONS = data;
    qText.textContent = "Pronto! Configure os jogadores para começar.";
    openSetup();
  } catch (err){
    qText.textContent = "Erro ao carregar perguntas.";
    feedbackEl.textContent = String(err.message || err);
  }
}

/* Eventos */
btnNext.addEventListener("click", nextTurn);

btnRestart.addEventListener("click", () => {
  if (!players.length) return openSetup();
  resetState(true);
  showQuestion();
});

btnNewGame.addEventListener("click", () => openSetup());

btnPlayAgain.addEventListener("click", () => {
  resetState(true);
  setFinalVisible(false);
  showQuestion();
});

btnEditPlayers.addEventListener("click", () => openSetup());

btnStart.addEventListener("click", () => {
  const names = getNamesFromInputs();
  if(names.length < 1){
    alert("Digite pelo menos 1 nome para jogar.");
    return;
  }
  if(QUESTIONS.length < 1){
    alert("Sem perguntas. Verifique questions.json.");
    return;
  }
  startGame(names);
});

/* init */
buildPlayerInputs();
setFinalVisible(false);
loadQuestions();
