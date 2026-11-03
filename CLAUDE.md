# CLAUDE.md — piano-pratica

App pessoal de prática de piano (PWA para Chrome no Android, com um Casio CTK-3500 via USB-MIDI OTG).
O plano completo está em `PLANO_INICIAL.md`. Converse em **português do Brasil**. O código, os
identificadores e os commits ficam em inglês. O usuário (Robert) é matemático e não programador
profissional: explique as decisões técnicas em poucas linhas.

## Estado atual

- **M0 (fundação + Monitor MIDI):** implementado; aguardando o teste de aceite no tablet.
- Próximo: **M1** (partitura com OSMD em layout de página, `input/` com 3 fontes, extração de passos).

## Decisões tomadas

| Tema                 | Decisão                                                                              | Motivo                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Hospedagem           | Repositório **público** `piano-pratica` + **GitHub Pages** (deploy via Actions)      | grátis, HTTPS (o Web MIDI exige contexto seguro)                                                            |
| UI                   | **Svelte 5** (runes) + Vite, **sem SvelteKit**                                       | pouco código, bundle pequeno; o SvelteKit traria SSR/roteamento inúteis                                     |
| Linguagem            | TypeScript **~6.0** (não 7.x)                                                        | o typescript-eslint e o svelte-check ainda não suportam o TS 7                                              |
| Partitura            | **OSMD** (não Verovio)                                                               | cursor e iterador prontos, JS puro, coloração de notas                                                      |
| Página da partitura  | `pageFormat` custom **com a proporção da tela** (1 página = 1 tela)                  | retrato e paisagem com a mesma lógica; ao mudar o zoom ou girar, reposicionar o cursor pelo índice do passo |
| Oitava               | **Configurável**; padrão Dó central = **Dó4** (científica). Opção Dó3 (franco-belga) | `src/core/pitch.ts`                                                                                         |
| Preferências         | `localStorage` (`src/ui/settings.svelte.ts`); o histórico irá para IndexedDB (M4)    | pequenas e por dispositivo                                                                                  |
| PWA / service worker | Só no M4                                                                             | o cache do SW atrapalha a iteração durante o desenvolvimento                                                |

### Pendências de decisão (para os marcos futuros)

- M2: no modo de uma só mão, ignorar as notas da outra mão (proposta) em vez de contá-las como erro.
- M2: apojaturas tocadas são ignoradas (não contam como erro nem bloqueiam).
- M1: a meia-virada de página fica por último, depois da virada simples e da manual.

## Estrutura

```
src/
  core/       # tipos compartilhados, puros: events.ts (NoteEvent/PedalEvent), pitch.ts (nomes de notas)
  midi/       # parse.ts (PURO: bytes → eventos) e access.ts (Web MIDI: permissão, dispositivos, hot-plug)
  ui/         # telas Svelte: MidiMonitor, PianoKeyboard, settings
  input/ score/ practice/ drills/ storage/   # criados nos marcos M1–M4
public/scores/  # (M1) biblioteca MusicXML + index.json
.github/workflows/deploy.yml  # lint + check + testes + build → GitHub Pages (somente na main)
```

Princípio central: `core/`, `practice/`, `drills/` e `midi/parse.ts` **não dependem do navegador**.
Eles recebem eventos `{type: 'on'|'off', pitch, velocity, t}` e são testados com sequências MIDI simuladas.
Os testes ficam ao lado do código (`foo.test.ts`).

## Comandos

O Node não estava no PATH do Bash do Claude Code. Se `node` não for encontrado, prefixe
`export PATH="/c/Program Files/nodejs:/c/Program Files/GitHub CLI:$PATH";`.

| Comando                             | O que faz                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm run dev`                       | servidor de desenvolvimento (http://localhost:5173)                                                       |
| `npm run dev:lan`                   | idem, exposto na rede local (sem HTTPS → o Web MIDI não funciona no tablet)                               |
| `npm test` / `npm run test:watch`   | Vitest                                                                                                    |
| `npm run lint` / `npm run format`   | ESLint + Prettier (verificar / corrigir)                                                                  |
| `npm run check`                     | svelte-check (tipos)                                                                                      |
| `npm run build` / `npm run preview` | build de produção em `dist/` / servir o build em `/piano-pratica/`                                        |
| `npm run verify`                    | tudo o que o CI roda (lint + check + test + build)                                                        |
| **deploy**                          | `git push` na `main` → GitHub Actions publica em `https://<usuario>.github.io/piano-pratica/` em ~1–2 min |

## Regras de trabalho (resumo do plano, seção 10)

- Perguntar antes de decisões grandes ou difíceis de reverter (biblioteca central, hospedagem, reestruturação).
- Commits pequenos; um marco por vez; ao fim de cada marco, dizer **exatamente o que testar no tablet**.
- Não adicionar dependências sem justificá-las em uma linha (registrar abaixo).
- Testes obrigatórios para `practice/` e `drills/` (e para o `midi/parse.ts`).
- Bug relatado no tablet: **primeiro reproduzir com um teste** (sequência MIDI simulada), depois corrigir.
- Para depurar no tablet: o Monitor MIDI tem um **log de diagnóstico** com o botão "Copiar log". A versão
  (SHA do commit) aparece no topo; confira se o tablet não está com uma versão antiga em cache.

## Dependências (todas de desenvolvimento no M0)

- `vite`, `@sveltejs/vite-plugin-svelte`, `svelte`: build e framework.
- `typescript`, `svelte-check`, `@tsconfig/svelte`: checagem de tipos.
- `vitest`: testes de unidade.
- `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-svelte`, `globals`: lint.
- `prettier`, `prettier-plugin-svelte`, `eslint-config-prettier`: formatação.

O `npm audit` acusa vulnerabilidades moderadas só em ferramentas de desenvolvimento;
`npm audit --omit=dev` = 0.
