const $ = (sel) => document.querySelector(sel);

const qText = $("#qText");
const qIndex = $("#qIndex");
const answersEl = $("#answers");
const feedbackEl = $("#feedback");
const btnNext = $("#btnNext");
const btnRestart = $("#btnRestart");
const bar = $("#bar");
const pillText = $("#pillText");

const quizArea = $("#quizArea");
const resultArea = $("#resultArea");
const resultText = $("#resultText");
const chipScore = $("#chipScore");
const chipTime = $("#chipTime");

let QUESTIONS = [];
let idx = 0;
let score = 0;
let locked = false;
let startedAt = Date.now();

function letter(i){ return String.fromCharCode(65 + i); }

function updateProgress(){
  const total = QUESTIONS.length || 0;
  const current = total ? Math.min(idx + 1, total) : 0;
  pillText.textContent = `${current}/${total}`;
  const pct = total ? (idx / total) * 100 : 0;
  bar.style.width = `${pct}%`;
}

function renderQuestion(){
  locked = false;
  btnNext.disabled = true;
  feedbackEl.textContent = "";

  const q = QUESTIONS[idx];
  qIndex.textContent = `Pergunta ${idx + 1} de ${QUESTIONS.length}`;
  qText.textContent = q.question;

  answersEl.innerHTML = "";
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    btn.setAttribute("aria-label", `Alternativa ${letter(i)}: ${opt}`);
    btn.innerHTML = `
      <span class="badge">${letter(i)}</span>
      <span class="txt">${opt}</span>
    `;
    btn.addEventListener("click", () => choose(i, btn));
    answersEl.appendChild(btn);
  });

  updateProgress();
}

function choose(choiceIndex, btnEl){
  if (locked) return;
  locked = true;

  const q = QUESTIONS[idx];
  const buttons = [...answersEl.querySelectorAll(".option")];

  const correctBtn = buttons[q.answer];
  correctBtn.classList.add("correct");

  if (choiceIndex === q.answer){
    score++;
    feedbackEl.textContent = "✅ Correto! " + (q.explanation || "");
  } else {
    btnEl.classList.add("wrong");
    feedbackEl.textContent = "❌ Incorreto. " + (q.explanation || "");
  }

  btnNext.disabled = false;
  bar.style.width = `${((idx + 1) / QUESTIONS.length) * 100}%`;
}

function finish(){
  quizArea.style.display = "none";
  resultArea.style.display = "grid";

  const total = QUESTIONS.length;
  const pct = Math.round((score / total) * 100);

  const secs = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  resultText.textContent = `Você acertou ${score} de ${total} (${pct}%).`;
  chipScore.textContent = `Pontuação: ${score}/${total}`;
  chipTime.textContent = `Tempo: ${mm}:${ss}`;

  feedbackEl.textContent = "Fim do quiz 🎉";
  btnNext.disabled = true;
  bar.style.width = "100%";
  pillText.textContent = `${total}/${total}`;
}

btnNext.addEventListener("click", () => {
  if (idx < QUESTIONS.length - 1){
    idx++;
    renderQuestion();
  } else {
    finish();
  }
});

btnRestart.addEventListener("click", () => {
  idx = 0;
  score = 0;
  locked = false;
  startedAt = Date.now();

  quizArea.style.display = "grid";
  resultArea.style.display = "none";
  bar.style.width = "0%";

  renderQuestion();
});

async function loadQuestions(){
  try{
    const res = await fetch("questions.json", { cache: "no-store" });
    if(!res.ok) throw new Error("Não consegui ler questions.json");
    const data = await res.json();

    // validação simples
    if(!Array.isArray(data) || data.length === 0) {
      throw new Error("questions.json está vazio ou inválido.");
    }

    QUESTIONS = data;
    pillText.textContent = `1/${QUESTIONS.length}`;
    startedAt = Date.now();
    renderQuestion();
  } catch (err){
    qText.textContent = "Erro ao carregar perguntas.";
    feedbackEl.textContent = String(err.message || err);
    btnNext.disabled = true;
  }
}

loadQuestions();
