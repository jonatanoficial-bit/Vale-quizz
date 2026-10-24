const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../game-core.js");
const proceduralQuestions = require("../questions-procedurais.js");

const question = (id, category = "Geografia", difficulty = "Fácil") => ({
  id, category, difficulty, question: `Pergunta ${id}`, options: ["A", "B", "C", "D"], answer: 2, explanation: "Explicação aprovada.", editorialStatus: "approved"
});

test("rejeita gabarito fora de 0 a 3 sem corrigi-lo silenciosamente", () => {
  const invalid = Core.normalizeQuestion({ ...question("bad"), answer: 4 }, 0);
  assert.ok(invalid.errors.some((error) => error.includes("gabarito")));
  const repository = new Core.QuestionRepository([{ ...question("bad"), answer: 4 }]);
  assert.equal(repository.questions.length, 0);
  assert.equal(repository.invalid.length, 1);
});

test("não entrega a mesma pergunta a jogadores diferentes na sessão", () => {
  const repository = new Core.QuestionRepository([question("1"), question("2"), question("3")]);
  const first = repository.draw({ difficulty: "Fácil" }).question;
  const second = repository.draw({ difficulty: "Fácil" }).question;
  assert.notEqual(first.id, second.id);
  assert.equal(repository.used.size, 2);
});

test("remove duplicatas literais e mantém a primeira questão aprovada", () => {
  const duplicate = { ...question("2"), question: "Pergunta 1" };
  const repository = new Core.QuestionRepository([question("1"), duplicate]);
  assert.equal(repository.questions.length, 1);
  assert.equal(repository.duplicates.length, 1);
});

test("embaralhar alternativas preserva exatamente a resposta correta", () => {
  const rendered = Core.shuffleOptions(question("1"), () => 0);
  assert.equal(rendered.options[rendered.answer], "C");
  assert.deepEqual([...rendered.options].sort(), ["A", "B", "C", "D"]);
});

test("50:50 e cartas nunca eliminam a resposta correta", () => {
  const correct = 2;
  const fifty = Core.chooseWrongIndexes(correct, 2, () => .2);
  assert.equal(fifty.length, 2);
  assert.equal(fifty.includes(correct), false);
  [0.02, 0.2, 0.6, 0.95].forEach((roll) => {
    const card = Core.cardElimination(correct, () => roll);
    assert.ok(card.count >= 0 && card.count <= 3);
    assert.equal(card.eliminated.includes(correct), false);
    assert.equal(card.eliminated.length, card.count);
  });
});

test("a plateia soma exatamente 100 por cento", () => {
  const votes = Core.audienceVote({ ...question("1"), difficulty: "Difícil" }, () => .3);
  assert.equal(votes.length, 4);
  assert.equal(votes.reduce((sum, value) => sum + value, 0), 100);
});

test("pool encontra uma alternativa quando categoria ou dificuldade acabam", () => {
  const repository = new Core.QuestionRepository([question("1", "Matemática", "Médio")]);
  const draw = repository.draw({ difficulty: "Difícil", categories: ["Bíblia"] });
  assert.equal(draw.question.id, "1");
  assert.equal(draw.fallback, "categoria e dificuldade");
});

test("prêmios BigInt sobrevivem à serialização de save", () => {
  const saved = Core.decode(Core.encode({ prize: 1000000000000n }));
  assert.equal(saved.prize, 1000000000000n);
  assert.equal(Core.guaranteedPrize(14), 1000000n);
});

test("conquistas dependem de resultados mensuráveis da partida", () => {
  const achievements = Core.achievementsFor({ correct: 9, incorrect: 1, bestStreak: 6, status: "won", mode: "duel", champion: true });
  assert.deepEqual(achievements.map((achievement) => achievement.id).sort(), ["duel-champion", "precision-90", "streak-5", "trillion"]);
  assert.equal(Core.achievementsFor({ correct: 1, incorrect: 4, bestStreak: 1 }).length, 0);
});

test("a progressão respeita a dificuldade inicial escolhida", () => {
  assert.equal(Core.difficultyForStep("easy", 1), "Muito Fácil");
  assert.equal(Core.difficultyForStep("easy", 16), "Médio");
  assert.equal(Core.difficultyForStep("intermediate", 1), "Fácil");
  assert.equal(Core.difficultyForStep("intermediate", 9), "Médio");
  assert.equal(Core.difficultyForStep("intermediate", 16), "Difícil");
  assert.equal(Core.difficultyForStep("challenge", 1), "Médio");
  assert.equal(Core.difficultyForStep("challenge", 16), "Difícil");
});

test("o banco procedural amplia o jogo com perguntas válidas em todos os níveis", () => {
  const repository = new Core.QuestionRepository(proceduralQuestions);
  assert.ok(repository.questions.length >= 1800);
  assert.equal(repository.invalid.length, 0);
  assert.deepEqual([...new Set(repository.questions.map((question) => question.difficulty))].sort(), ["Difícil", "Fácil", "Muito Fácil", "Médio"]);
});
