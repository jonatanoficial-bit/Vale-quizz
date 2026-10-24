# Auditoria do banco de questões — 2026-10-24

Resultado calculado a partir de `questions.json` e de `questions-procedurais.js` pelo comando `npm run audit:questions`.

| Medida | Resultado |
| --- | ---: |
| Linhas no banco combinado | 9.341 |
| Questões literalmente únicas | 6.026 |
| Linhas repetidas | 3.315 |
| Grupos de repetição | 330 |
| Questões estruturalmente inválidas | 1 |
| Questões jogáveis após validação e deduplicação por enunciado | 4.047 |
| Questões sem explicação | 6.500 |

Categorias encontradas: Matemática (4.008), Inglês (1.353), Espanhol (1.094), Bíblia (947), Variedades (598), Português (Gramática) (485), Geografia (467), História (261), Química (125) e Português (Literatura) (3). Níveis: Muito Fácil (740), Fácil (4.752), Médio (2.086) e Difícil (1.763).

## Proteções implementadas

- Gabaritos fora de `0..3` são rejeitados — nunca corrigidos por arredondamento ou limite.
- Questões com alternativas vazias ou repetidas são bloqueadas.
- Duplicatas são removidas do pool público por enunciado normalizado.
- Itens `pending` e `rejected` não são jogáveis.
- Toda questão recebe um ID estável legado quando o arquivo ainda não tiver `id`.
- O sorteio registra imediatamente a questão como usada, inclusive quando o jogador pula.

## Limites da auditoria automática

A validação não confirma a veracidade de fatos, fontes, atualidade, plágio ou ambiguidade semântica. Esses pontos precisam de revisão editorial humana. O jogo está preparado para receber bancos novos em chunks, com `id`, `category`, `subcategory`, `difficulty`, `explanation`, `source`, `reviewedAt`, `temporalValidity` e `editorialStatus`; somente itens `approved` entram no jogo.

O complemento procedural não usa fatos externos: ele gera operações matemáticas determinísticas, com gabarito e explicação calculados pelo próprio código. Questões factuais novas continuam exigindo revisão editorial, fonte e data de revisão antes de entrarem como conteúdo aprovado.
