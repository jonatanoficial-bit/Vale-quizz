# Auditoria do banco de questões — 2026-10-24

Resultado calculado diretamente de `questions.json` pelo comando `npm run audit:questions`.

| Medida | Resultado |
| --- | ---: |
| Linhas no arquivo | 7.500 |
| Questões literalmente únicas | 4.187 |
| Linhas repetidas | 3.313 |
| Grupos de repetição | 329 |
| Questões estruturalmente inválidas | 1 |
| Questões jogáveis após validação e deduplicação por enunciado | 2.345 |
| Questões sem explicação | 6.500 |

Categorias encontradas: Matemática (2.167), Inglês (1.353), Espanhol (1.094), Bíblia (947), Variedades (598), Português (Gramática) (485), Geografia (467), História (261), Química (125) e Português (Literatura) (3). Níveis: Fácil (4.374), Médio (1.627) e Difícil (1.499).

## Proteções implementadas

- Gabaritos fora de `0..3` são rejeitados — nunca corrigidos por arredondamento ou limite.
- Questões com alternativas vazias ou repetidas são bloqueadas.
- Duplicatas são removidas do pool público por enunciado normalizado.
- Itens `pending` e `rejected` não são jogáveis.
- Toda questão recebe um ID estável legado quando o arquivo ainda não tiver `id`.
- O sorteio registra imediatamente a questão como usada, inclusive quando o jogador pula.

## Limites da auditoria automática

A validação não confirma a veracidade de fatos, fontes, atualidade, plágio ou ambiguidade semântica. Esses pontos precisam de revisão editorial humana. O jogo está preparado para receber bancos novos em chunks, com `id`, `category`, `subcategory`, `difficulty`, `explanation`, `source`, `reviewedAt`, `temporalValidity` e `editorialStatus`; somente itens `approved` entram no jogo.

Não foram adicionadas questões inventadas apenas para inflar a contagem. A meta de 10.000 questões verificadas permanece editorial e requer fontes/revisores confiáveis.
