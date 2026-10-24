(function (root, factory) {
  const questions = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = questions;
  else root.ShowTrilhaoProceduralQuestions = questions;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const questions = [];
  const reviewedAt = "2026-10-24";

  function optionsFor(answer, distractors, seed) {
    const correct = String(answer);
    const options = [correct, ...distractors.map(String).filter((value) => value !== correct)];
    let next = Number(answer) + 1;
    while (new Set(options).size < 4) {
      const value = String(next);
      if (!options.includes(value)) options.push(value);
      next += 1;
    }
    const unique = [...new Set(options)].slice(0, 4);
    const offset = Math.abs(seed) % unique.length;
    const rotated = [...unique.slice(offset), ...unique.slice(0, offset)];
    return { options: rotated, answer: rotated.indexOf(correct) };
  }

  function add({ id, difficulty, question, answer, distractors, explanation }) {
    const rendered = optionsFor(answer, distractors, id.length + Number(answer));
    questions.push({
      id: `procedural-${id}`,
      category: "Matemática",
      subcategory: "Cálculo e raciocínio",
      difficulty,
      question,
      options: rendered.options,
      answer: rendered.answer,
      explanation,
      source: "Cálculo determinístico gerado pelo próprio jogo.",
      reviewedAt,
      temporalValidity: "atemporal",
      editorialStatus: "approved"
    });
  }

  for (let first = 1; first <= 25; first += 1) {
    for (let second = 1; second <= 20; second += 1) {
      const answer = first + second;
      add({ id: `mf-soma-${first}-${second}`, difficulty: "Muito Fácil", question: `Quanto é ${first} + ${second}?`, answer, distractors: [answer - 1, answer + 1, answer + 2], explanation: `${first} + ${second} = ${answer}.` });
    }
  }

  for (let first = 12; first <= 35; first += 1) {
    for (let second = 1; second <= 10; second += 1) {
      const answer = first - second;
      add({ id: `mf-subtracao-${first}-${second}`, difficulty: "Muito Fácil", question: `Quanto é ${first} − ${second}?`, answer, distractors: [answer - 1, answer + 1, first + second], explanation: `${first} − ${second} = ${answer}.` });
    }
  }

  for (let first = 3; first <= 20; first += 1) {
    for (let second = 3; second <= 12; second += 1) {
      const answer = first * second;
      add({ id: `fac-multiplicacao-${first}-${second}`, difficulty: "Fácil", question: `Quanto é ${first} × ${second}?`, answer, distractors: [answer - first, answer + first, answer + second], explanation: `${first} × ${second} = ${answer}.` });
    }
  }

  for (let divisor = 2; divisor <= 12; divisor += 1) {
    for (let quotient = 3; quotient <= 20; quotient += 1) {
      const dividend = divisor * quotient;
      add({ id: `fac-divisao-${dividend}-${divisor}`, difficulty: "Fácil", question: `Quanto é ${dividend} ÷ ${divisor}?`, answer: quotient, distractors: [quotient - 1, quotient + 1, quotient + 2], explanation: `${dividend} ÷ ${divisor} = ${quotient}.` });
    }
  }

  [10, 20, 25, 50, 75].forEach((percent) => {
    for (let base = 40; base <= 800; base += 20) {
      const answer = base * percent / 100;
      add({ id: `med-porcentagem-${percent}-${base}`, difficulty: "Médio", question: `Quanto é ${percent}% de ${base}?`, answer, distractors: [answer - base / 20, answer + base / 20, base - answer], explanation: `${percent}% de ${base} corresponde a ${answer}.` });
    }
  });

  for (let denominator = 3; denominator <= 10; denominator += 1) {
    for (let numerator = 1; numerator < denominator; numerator += 1) {
      for (let multiplier = 5; multiplier <= 10; multiplier += 1) {
        const total = denominator * multiplier;
        const answer = numerator * multiplier;
        add({ id: `med-fracao-${numerator}-${denominator}-${total}`, difficulty: "Médio", question: `Quanto é ${numerator}/${denominator} de ${total}?`, answer, distractors: [answer - multiplier, answer + multiplier, denominator * multiplier - answer], explanation: `${total} ÷ ${denominator} = ${multiplier}; ${multiplier} × ${numerator} = ${answer}.` });
      }
    }
  }

  for (let factor = 2; factor <= 12; factor += 1) {
    for (let value = 3; value <= 22; value += 1) {
      const constant = 5 + ((factor * value) % 36);
      const result = factor * value + constant;
      add({ id: `dif-equacao-${factor}-${constant}-${value}`, difficulty: "Difícil", question: `Resolva a equação: ${factor}x + ${constant} = ${result}. Qual é o valor de x?`, answer: value, distractors: [value - 1, value + 1, value + 2], explanation: `Subtraindo ${constant}, temos ${factor}x = ${result - constant}; dividindo por ${factor}, x = ${value}.` });
    }
  }

  for (let base = 2; base <= 12; base += 1) {
    for (let exponent = 2; exponent <= 5; exponent += 1) {
      const answer = base ** exponent;
      add({ id: `dif-potencia-${base}-${exponent}`, difficulty: "Difícil", question: `Qual é o valor de ${base} elevado à potência ${exponent}?`, answer, distractors: [base ** (exponent - 1), answer + base, answer - base], explanation: `${base} elevado a ${exponent} é ${answer}.` });
    }
  }

  return questions;
});
