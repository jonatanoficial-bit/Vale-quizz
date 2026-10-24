const fs = require("node:fs");
const Core = require("../game-core.js");

const questions = JSON.parse(fs.readFileSync("questions.json", "utf8"));
const repository = new Core.QuestionRepository(questions);
const count = (items, key) => Object.fromEntries([...items.reduce((map, item) => {
  const value = key(item) || "Não informado";
  map.set(value, (map.get(value) || 0) + 1);
  return map;
}, new Map()).entries()].sort((a, b) => b[1] - a[1]));
const key = (item) => `${Core.comparable(item.question || item.pergunta)}|${(item.options || item.alternativas || []).map(Core.comparable).sort().join("|")}`;
const appearances = new Map();
questions.forEach((item) => appearances.set(key(item), (appearances.get(key(item)) || 0) + 1));
const report = {
  generatedAt: new Date().toISOString(),
  totalRows: questions.length,
  literalUniqueQuestions: appearances.size,
  duplicateRows: questions.length - appearances.size,
  duplicateGroups: [...appearances.values()].filter((value) => value > 1).length,
  structurallyInvalid: repository.invalid.length,
  pendingOrRejected: repository.pendingOrRejected.length,
  playableAfterValidationAndDedupe: repository.questions.length,
  missingExplanation: questions.filter((item) => !String(item.explanation || item.explicacao || "").trim()).length,
  categories: count(questions, (item) => item.category || item.categoria),
  difficulties: count(questions, (item) => item.level || item.difficulty || item.nivel),
  humanReviewRequired: "Veracidade factual, ambiguidade semântica, atualidade e fontes não são comprovadas por validação estrutural."
};
console.log(JSON.stringify(report, null, 2));
