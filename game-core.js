(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ShowTrilhaoCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LADDER = [
    [1, 1000n, "Fácil"], [2, 2000n, "Fácil"], [3, 5000n, "Fácil"], [4, 10000n, "Fácil"], [5, 20000n, "Fácil"],
    [6, 50000n, "Médio"], [7, 100000n, "Médio"], [8, 200000n, "Médio"], [9, 500000n, "Médio"], [10, 1000000n, "Médio"],
    [11, 2000000n, "Difícil"], [12, 5000000n, "Difícil"], [13, 10000000n, "Difícil"], [14, 100000000n, "Difícil"],
    [15, 1000000000n, "Difícil"], [16, 1000000000000n, "Difícil"]
  ].map(([step, prize, difficulty]) => ({ step, prize, difficulty }));

  const SAFE_STEPS = new Set([5, 10, 15]);

  const DIFFICULTY_PRESETS = {
    easy: { label: "Fácil", description: "Muito fácil → intermediário" },
    intermediate: { label: "Intermediário", description: "Fácil → difícil" },
    challenge: { label: "Desafio", description: "Intermediário → difícil" }
  };

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function comparable(value) {
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .replace(/\s+/g, " ");
  }

  function hash(value) {
    let result = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      result ^= value.charCodeAt(i);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  function normalizeDifficulty(value) {
    const normalized = comparable(value);
    if (normalized.includes("muito facil")) return "Muito Fácil";
    if (normalized.includes("fac")) return "Fácil";
    if (normalized.includes("med")) return "Médio";
    if (normalized.includes("dif")) return "Difícil";
    return "Médio";
  }

  function normalizeStatus(value) {
    const normalized = comparable(value || "approved");
    if (normalized === "pendente" || normalized === "pending") return "pending";
    if (normalized === "rejeitada" || normalized === "rejeitado" || normalized === "rejected") return "rejected";
    return "approved";
  }

  function validateQuestion(question) {
    const errors = [];
    if (!text(question.question)) errors.push("enunciado ausente");
    if (!Array.isArray(question.options) || question.options.length !== 4) errors.push("a questão precisa de quatro alternativas");
    if (Array.isArray(question.options)) {
      if (question.options.some((option) => !text(option))) errors.push("há alternativa vazia");
      if (new Set(question.options.map(comparable)).size !== question.options.length) errors.push("há alternativas idênticas");
    }
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) errors.push("gabarito fora do intervalo de 0 a 3");
    return errors;
  }

  function normalizeQuestion(raw, index) {
    const options = Array.isArray(raw.options || raw.alternativas)
      ? (raw.options || raw.alternativas).map(text)
      : [];
    const question = {
      id: text(raw.id),
      category: text(raw.category || raw.categoria || "Variedades") || "Variedades",
      subcategory: text(raw.subcategory || raw.subcategoria),
      difficulty: normalizeDifficulty(raw.difficulty || raw.level || raw.nivel),
      question: text(raw.question || raw.pergunta),
      options,
      answer: Number(raw.answer != null ? raw.answer : raw.resposta),
      explanation: text(raw.explanation || raw.explicacao),
      source: text(raw.source || raw.fonte),
      reviewedAt: text(raw.reviewedAt || raw.dataRevisao || raw.reviewed_at),
      temporalValidity: text(raw.temporalValidity || raw.validadeTemporal || "atemporal"),
      editorialStatus: normalizeStatus(raw.editorialStatus || raw.editorial_status || raw.status),
      legacyIndex: index
    };
    question.id = question.id || `legacy-${hash(`${question.question}|${question.options.join("|")}`)}`;
    question.errors = validateQuestion(question);
    question.semanticKey = comparable(question.question);
    return question;
  }

  function shuffle(values, random = Math.random) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function shuffleOptions(question, random = Math.random) {
    const indexed = question.options.map((option, index) => ({ option, index }));
    const shuffled = shuffle(indexed, random);
    return {
      ...question,
      options: shuffled.map((entry) => entry.option),
      answer: shuffled.findIndex((entry) => entry.index === question.answer)
    };
  }

  function wrongIndexes(answer) {
    return [0, 1, 2, 3].filter((index) => index !== answer);
  }

  function chooseWrongIndexes(answer, count, random = Math.random) {
    return shuffle(wrongIndexes(answer), random).slice(0, Math.max(0, Math.min(3, count)));
  }

  function cardElimination(answer, random = Math.random) {
    const roll = random();
    const count = roll < 0.1 ? 0 : roll < 0.45 ? 1 : roll < 0.85 ? 2 : 3;
    return { count, eliminated: chooseWrongIndexes(answer, count, random) };
  }

  function difficultyAccuracy(difficulty) {
    return difficulty === "Muito Fácil" ? 0.9 : difficulty === "Fácil" ? 0.83 : difficulty === "Médio" ? 0.64 : 0.43;
  }

  function difficultyForStep(preset = "intermediate", step = 1) {
    const boundedStep = Math.max(1, Math.min(16, Number(step) || 1));
    const selected = DIFFICULTY_PRESETS[preset] ? preset : "intermediate";
    if (selected === "easy") return boundedStep <= 5 ? "Muito Fácil" : boundedStep <= 11 ? "Fácil" : "Médio";
    if (selected === "challenge") return boundedStep <= 5 ? "Médio" : "Difícil";
    return boundedStep <= 5 ? "Fácil" : boundedStep <= 11 ? "Médio" : "Difícil";
  }

  function universityAdvice(question, random = Math.random) {
    const specialists = [
      { name: "Lia", area: "humanas", icon: "◈" },
      { name: "Caio", area: "exatas", icon: "◇" },
      { name: "Maya", area: "cultura", icon: "○" }
    ];
    const category = comparable(question.category);
    const fit = {
      humanas: /historia|geografia|literatura|portugues|filosofia|biblia/.test(category),
      exatas: /matematica|fisica|quimica|ciencia|tecnologia/.test(category),
      cultura: /musica|cinema|arte|variedades|esporte/.test(category)
    };
    return specialists.map((person) => {
      const probability = Math.min(0.93, difficultyAccuracy(question.difficulty) + (fit[person.area] ? 0.13 : -0.04));
      const correct = random() < probability;
      const answer = correct ? question.answer : chooseWrongIndexes(question.answer, 1, random)[0];
      return {
        ...person,
        answer,
        confidence: Math.round((correct ? 62 : 40) + random() * 25)
      };
    });
  }

  function audienceVote(question, random = Math.random) {
    const accuracy = difficultyAccuracy(question.difficulty);
    const favoursCorrect = random() < accuracy;
    const favourite = favoursCorrect ? question.answer : chooseWrongIndexes(question.answer, 1, random)[0];
    const base = [5, 5, 5, 5];
    let available = 80;
    base[favourite] += 36 + Math.floor(random() * 15);
    available -= base[favourite] - 5;
    const other = shuffle([0, 1, 2, 3].filter((index) => index !== favourite), random);
    other.forEach((index, position) => {
      const amount = position === other.length - 1 ? available : Math.floor(random() * Math.max(1, available - (other.length - position - 1)));
      base[index] += amount;
      available -= amount;
    });
    const total = base.reduce((sum, value) => sum + value, 0);
    base[base.length - 1] += 100 - total;
    return base;
  }

  class QuestionRepository {
    constructor(rawQuestions = [], recentIds = []) {
      this.raw = rawQuestions.map(normalizeQuestion);
      this.invalid = this.raw.filter((question) => question.errors.length > 0);
      this.pendingOrRejected = this.raw.filter((question) => question.errors.length === 0 && question.editorialStatus !== "approved");
      this.duplicates = [];
      this.used = new Set();
      this.recent = Array.from(new Set(recentIds)).slice(-80);
      this.categoryUsage = new Map();
      const seen = new Set();
      this.questions = this.raw.filter((question) => {
        if (question.errors.length || question.editorialStatus !== "approved") return false;
        if (seen.has(question.semanticKey)) {
          this.duplicates.push(question);
          return false;
        }
        seen.add(question.semanticKey);
        return true;
      });
    }

    report() {
      const countBy = (field) => Object.fromEntries(this.raw.reduce((map, question) => {
        const key = question[field] || "Não informado";
        map.set(key, (map.get(key) || 0) + 1);
        return map;
      }, new Map()));
      return {
        total: this.raw.length,
        available: this.questions.length,
        invalid: this.invalid.length,
        duplicate: this.duplicates.length,
        pendingOrRejected: this.pendingOrRejected.length,
        categories: countBy("category"),
        difficulties: countBy("difficulty")
      };
    }

    draw({ difficulty, categories = [] } = {}) {
      const categorySet = new Set(categories.filter(Boolean));
      const allUnused = this.questions.filter((question) => !this.used.has(question.id));
      if (!allUnused.length) return null;
      const withoutRecent = allUnused.filter((question) => !this.recent.includes(question.id));
      const base = withoutRecent.length ? withoutRecent : allUnused;
      const matchesCategory = (question) => !categorySet.size || categorySet.has(question.category);
      const matchesDifficulty = (question) => !difficulty || question.difficulty === difficulty;
      const groups = [
        { questions: base.filter((q) => matchesCategory(q) && matchesDifficulty(q)), fallback: null },
        { questions: base.filter((q) => matchesDifficulty(q)), fallback: "categoria" },
        { questions: base.filter((q) => matchesCategory(q)), fallback: "dificuldade" },
        { questions: base, fallback: "categoria e dificuldade" }
      ];
      const group = groups.find((candidate) => candidate.questions.length) || null;
      if (!group) return null;
      const lowestUsage = Math.min(...group.questions.map((question) => this.categoryUsage.get(question.category) || 0));
      const balanced = group.questions.filter((question) => (this.categoryUsage.get(question.category) || 0) === lowestUsage);
      const question = balanced[Math.floor(Math.random() * balanced.length)];
      this.used.add(question.id);
      this.recent = [...this.recent, question.id].slice(-80);
      this.categoryUsage.set(question.category, (this.categoryUsage.get(question.category) || 0) + 1);
      return { question, fallback: group.fallback };
    }
  }

  function prizeForStep(step) {
    return LADDER.find((item) => item.step === step)?.prize || 0n;
  }

  function guaranteedPrize(step) {
    const lastSafe = [...SAFE_STEPS].filter((safe) => safe <= step).sort((a, b) => b - a)[0];
    return lastSafe ? prizeForStep(lastSafe) : 0n;
  }

  function xpFor({ difficulty, step, correct, streak = 0 }) {
    if (!correct) return 0;
    const difficultyPoints = difficulty === "Muito Fácil" ? 10 : difficulty === "Fácil" ? 16 : difficulty === "Médio" ? 28 : 45;
    return difficultyPoints + Math.min(50, step * 4) + Math.min(20, streak * 2);
  }

  function achievementsFor({ correct = 0, incorrect = 0, bestStreak = 0, status = "", mode = "", champion = false } = {}) {
    const attempts = Number(correct) + Number(incorrect);
    const achievements = [];
    if (status === "won") achievements.push({ id: "trillion", icon: "✦", label: "Um trilhão", description: "Chegou à última etapa e conquistou o prêmio máximo." });
    if (bestStreak >= 5) achievements.push({ id: "streak-5", icon: "⚡", label: "Sequência de ouro", description: "Acertou cinco ou mais perguntas consecutivas." });
    if (attempts >= 5 && Number(correct) / attempts >= .9) achievements.push({ id: "precision-90", icon: "◈", label: "Precisão máxima", description: "Terminou com pelo menos 90% de acerto em cinco ou mais respostas." });
    if (mode === "duel" && champion) achievements.push({ id: "duel-champion", icon: "◆", label: "Campeão do duelo", description: "Terminou em primeiro no modo Duelo." });
    if (mode === "party" && attempts > 0) achievements.push({ id: "party-player", icon: "✷", label: "Festa no estúdio", description: "Participou de uma partida no modo Família / Festa." });
    return achievements;
  }

  function encode(value) {
    return JSON.stringify(value, (_, item) => typeof item === "bigint" ? { __bigint: item.toString() } : item);
  }

  function decode(serialized) {
    return JSON.parse(serialized, (_, item) => item && item.__bigint != null ? BigInt(item.__bigint) : item);
  }

  return {
    LADDER,
    SAFE_STEPS,
    DIFFICULTY_PRESETS,
    normalizeQuestion,
    validateQuestion,
    shuffle,
    shuffleOptions,
    chooseWrongIndexes,
    cardElimination,
    universityAdvice,
    audienceVote,
    difficultyForStep,
    QuestionRepository,
    prizeForStep,
    guaranteedPrize,
    xpFor,
    achievementsFor,
    encode,
    decode,
    comparable
  };
});
