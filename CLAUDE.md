# CLAUDE.md — piano-pratica

App pessoal de prática de piano (PWA para Chrome no Android, com um Casio CTK-3500 via USB-MIDI OTG).
O plano completo está em `PLANO_INICIAL.md`. Converse em **português do Brasil**. O código, os
identificadores e os commits ficam em inglês. O usuário (Robert) é matemático e não programador
profissional: explique as decisões técnicas em poucas linhas.

## Estado atual

- **M0 (fundação + Monitor MIDI):** implementado e publicado em https://r-guterres.github.io/piano-pratica/ (repo github.com/r-guterres/piano-pratica); **aceito no tablet em 2026-11-03** (Casio reconhecido, notas, velocity e pedal ok).
- **M1 (partitura + entrada + passos):** implementado; meia-virada corrigida (68f924d); **aceito no tablet** (meia-virada reconferida em 2026-11-04).
- **M2 (modo espera):** implementado; **aceito no tablet em 2026-11-03** (após a correção da outra mão chegando atrasada, 9fb630d).
- **M3 (treino de leitura):** implementado; testado no tablet em 2026-11-04, que revelou a lentidão pesando mais que o erro (corrigido em 0a75ac6). Falta reconferir a priorização.
- **M4 (persistência e acabamento):** implementado (IndexedDB, tela de progresso, PWA offline com aviso de versão nova, exportar JSON); aguardando o teste de aceite no tablet.
- Todos os marcos do plano inicial (M0–M4) estão implementados.

## Decisões tomadas

| Tema                 | Decisão                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Motivo                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Hospedagem           | Repositório **público** `piano-pratica` + **GitHub Pages** (deploy via Actions)                                                                                                                                                                                                                                                                                                                                                                                                                                                     | grátis, HTTPS (o Web MIDI exige contexto seguro)                                                            |
| UI                   | **Svelte 5** (runes) + Vite, **sem SvelteKit**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | pouco código, bundle pequeno; o SvelteKit traria SSR/roteamento inúteis                                     |
| Linguagem            | TypeScript **~6.0** (não 7.x)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | o typescript-eslint e o svelte-check ainda não suportam o TS 7                                              |
| Partitura            | **OSMD** (não Verovio)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | cursor e iterador prontos, JS puro, coloração de notas                                                      |
| Página da partitura  | `pageFormat` custom **com a proporção da tela** (1 página = 1 tela)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | retrato e paisagem com a mesma lógica; ao mudar o zoom ou girar, reposicionar o cursor pelo índice do passo |
| Oitava               | **Configurável**; padrão Dó central = **Dó4** (científica). Opção Dó3 (franco-belga)                                                                                                                                                                                                                                                                                                                                                                                                                                                | `src/core/pitch.ts`                                                                                         |
| Preferências         | `localStorage` (`src/ui/settings.svelte.ts`); o histórico fica no IndexedDB                                                                                                                                                                                                                                                                                                                                                                                                                                                         | pequenas e por dispositivo                                                                                  |
| Leitor de partitura  | Páginas do OSMD empilhadas; mostrar a página = `translateY` sem animação. Cursor `ThinLeft`, afinado por CSS                                                                                                                                                                                                                                                                                                                                                                                                                        | página parada, cursor anda (§5.1)                                                                           |
| Virada de página     | Padrão: vira quando o cursor passa para a página seguinte. **Meia-virada**: quando o cursor entra no 1º sistema da metade de baixo **do conteúdo** da página (`score/halfTurn.ts`; não da altura da página, porque o OSMD agrupa os sistemas no alto), uma camada cobre a metade de cima com os sistemas iniciais da página seguinte (cópia do SVG). Página com um único sistema não tem meia-virada. Toque nas bordas (20%) = virada manual até o cursor se mover                                                                  | ler adiante sem perder a linha atual                                                                        |
| Zoom                 | Separado por orientação (`settings.score.zoom.portrait/landscape`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | em paisagem cabem poucos sistemas e costuma-se querer letra maior                                           |
| Passos               | `score/timeline.ts` percorre o iterador do OSMD com o **mesmo método do cursor** (`moveToNextVisibleVoiceEntry(false)`); posição k da linha do tempo = cursor após k `next()`. `score/steps.ts` (puro) filtra ligaduras/apojaturas/mão                                                                                                                                                                                                                                                                                              | alinhamento passo ↔ cursor sem pixels                                                                       |
| Mão                  | Instrumento com 2+ pautas: de cima = MD, demais = ME. Pauta única: clave de fá = ME, senão MD                                                                                                                                                                                                                                                                                                                                                                                                                                       | simples e cobre peças de piano                                                                              |
| Entrada              | `input/hub.ts` reúne MIDI, teclado na tela (multitoque) e teclado do computador (A S D F… = brancas, W E T Y U = pretas, Z/X = oitava; por `KeyboardEvent.code`, igual em ABNT2)                                                                                                                                                                                                                                                                                                                                                    | `practice/` não sabe de onde vem a nota                                                                     |
| MIDI                 | Uma conexão para o app inteiro (`input/midi.svelte.ts`); conecta sozinho se a permissão já foi dada                                                                                                                                                                                                                                                                                                                                                                                                                                 | Monitor e leitor compartilham                                                                               |
| Carregamento         | O leitor (com o OSMD, ~370 kB gzip) é `import()` dinâmico                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | a tela inicial abre rápido                                                                                  |
| Biblioteca           | Gerada por `scripts/gen-scores.ts` (mini-notação → MusicXML, valida a duração dos compassos). Não editar `public/scores/*.musicxml` à mão: editar o script e rodar `npm run gen:scores`                                                                                                                                                                                                                                                                                                                                             | MusicXML escrito à mão é fácil de errar                                                                     |
| Treino de leitura    | `drills/` (PURO): `notes.ts` (nota escrita = letra + alteração + oitava; item = clave + nota escrita), `priority.ts` (sorteio ponderado), `readingDrill.ts` (rodada). Pauta com **VexFlow 5** (`vexflow/bravura`, esperar a fonte Bravura carregar). A oitava conta. Após N erros mostra a resposta (nome + tecla marcada) e **espera a tecla certa**. Tempo de reação com `performance.now()` na UI (não o `t` do evento)                                                                                                          | mesmo relógio da apresentação da nota                                                                       |
| Priorização          | Contagens com esquecimento por item (×0,85 a cada resposta): `p = (erros+1)/(tentativas+4)`, tempo puxado para a mediana `T = (k·t + 2·mediana)/(k+2)` (k = acertos cronometrados), lentidão `s = clamp(T/mediana − 1, 0, 2)`, peso `0,05 + p·(1 + 0,5·s)` (a lentidão multiplica o erro: nota lenta mas certa nunca passa das erradas; bug do tablet em 2026-11-04); nunca repete a anterior (com 4+ notas, nem as duas últimas). Simulação de 5 min em `readingDrill.test.ts`: notas sempre erradas aparecem ~2,3× mais           | simples de explicar e de ajustar                                                                            |
| Histórico            | IndexedDB nativo (`storage/db.ts`, camada fina; `storage/history.ts`): `scoreSessions` (`WaitModeSummary` + peça, mãos, loop), `drillRounds` (`DrillSummary` + config), `files` (importados, como `ArrayBuffer`; id `file:<nome>`, reimportar substitui), `kv` (`ItemStats` do `Prioritizer`). Sessão/rodada gravada de novo pelo mesmo id ao terminar, recomeçar, sair da tela ou ir para segundo plano (`visibilitychange`). Nunca gravar proxies `$state` (usar `$state.snapshot`). `navigator.storage.persist()` na 1ª abertura | o Android pode matar o app em segundo plano sem aviso                                                       |
| Progresso            | `storage/progress.ts` (PURO): minutos por dia, por peça, por rodada e o JSON exportado (`format: 'piano-pratica/history'`, `version: 1`). Gráficos SVG próprios (`ui/charts/`), paleta validada: `--series-1` azul = partituras, `--series-2` laranja = treino; cada gráfico tem "Ver em tabela"                                                                                                                                                                                                                                    | sem biblioteca de gráficos para 2 gráficos simples                                                          |
| PWA / service worker | `vite-plugin-pwa` (generateSW, **só no build**; nada no `npm run dev`). Pré-cache de tudo (app, leitor, treino, biblioteca, ícones; ~2,3 MB). `registerType: 'prompt'`: versão nova mostra "Atualizar" (`ui/pwa.svelte.ts`), nunca recarrega sozinho no meio da prática; procura versão nova ao voltar para o app. Ícones gerados por `scripts/gen-icons.ts`                                                                                                                                                                        | o cache do SW atrapalha a iteração durante o desenvolvimento                                                |

### Pendências de decisão (para os marcos futuros)

- Decidido no M2: com uma só mão, notas da outra mão são **toleradas** (nem exigidas nem erro); apojaturas e re-ataque de nota ligada também (`Step.tolerated`). As notas toleradas de um passo continuam toleradas no passo seguinte (a outra mão chega alguns ms depois; bug do tablet no c.1 do Minueto). Uníssono entre as mãos = uma exigência.
- Ritornelos: a partitura segue o que o iterador do OSMD seguir; o loop usa a **primeira passagem** do trecho (`loopStepRange`).
- Ainda não há importação do JSON exportado (restaurar o histórico em outro aparelho); se precisar, o formato já tem `version`.
- Mudanças no formato dos registros: subir `DB_VERSION` em `storage/db.ts` e migrar no `onupgradeneeded`, sem apagar dados.
- O Minueto (BWV Anh. 114) foi transcrito de memória: o Robert deve conferir com uma edição impressa.

## Estrutura

```
src/
  core/       # tipos compartilhados, puros: events.ts (NoteEvent/PedalEvent), pitch.ts (nomes de notas)
  midi/       # parse.ts (PURO: bytes → eventos) e access.ts (Web MIDI: permissão, dispositivos, hot-plug)
  input/      # hub.ts (PURO: InputHub, HeldNotes), computerKeyboard.ts, midi.svelte.ts (conexão única), held.svelte.ts
  score/      # types.ts, steps.ts (PURO), timeline.ts (OSMD → linha do tempo), ScoreView.ts (páginas, cursor, viradas)
  ui/         # App: Library, ScoreReader, DrillScreen (+ DrillSummary, drillStaff.ts), ProgressScreen (+ charts/), MidiMonitor, SettingsScreen, PianoKeyboard; settings.svelte.ts, pwa.svelte.ts
  practice/   # matcher.ts (PURO: compara note-ons com UM passo) e waitMode.ts (PURO: modo espera, loop, resumo)
  drills/     # notes.ts (notas escritas, conjunto de itens), priority.ts e readingDrill.ts (PUROS); rng.ts (sorteio com semente p/ testes)
  storage/    # db.ts (IndexedDB), history.ts (registros; testado com fake-indexeddb), progress.ts (PURO: agregações + exportação)
scripts/      # gen-scores.ts + musicxml.ts (gerador da biblioteca), gen-icons.ts (ícones PNG do PWA); rodam com o Node, que remove os tipos sozinho
public/scores/  # biblioteca MusicXML gerada + index.json
public/icons/   # ícones gerados (npm run gen:icons)
.github/workflows/deploy.yml  # lint + check + testes + build → GitHub Pages (somente na main)
```

Princípio central: `core/`, `practice/`, `drills/` e `midi/parse.ts` **não dependem do navegador**.
Eles recebem eventos `{type: 'on'|'off', pitch, velocity, t}` e são testados com sequências MIDI simuladas.
Os testes ficam ao lado do código (`foo.test.ts`). `score/timeline.test.ts` roda o **OSMD de verdade no jsdom**
(`// @vitest-environment jsdom`) sobre os arquivos da biblioteca: carregar e iterar funciona sem renderizar.

`tsconfig.json` cobre o app (sem tipos do Node); `tsconfig.node.json` cobre `scripts/` e `*.test.ts`.
No Windows, não crie arquivos que diferem só em maiúsculas/minúsculas (ex.: `Settings.svelte` × `settings.svelte.ts`).

## Comandos

O Node não estava no PATH do Bash do Claude Code. Se `node` não for encontrado, prefixe
`export PATH="/c/Program Files/nodejs:/c/Program Files/GitHub CLI:$PATH";`.

| Comando                             | O que faz                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run dev`                       | servidor de desenvolvimento (http://localhost:5173)                                                        |
| `npm run dev:lan`                   | idem, exposto na rede local (sem HTTPS → o Web MIDI não funciona no tablet)                                |
| `npm test` / `npm run test:watch`   | Vitest                                                                                                     |
| `npm run lint` / `npm run format`   | ESLint + Prettier (verificar / corrigir)                                                                   |
| `npm run check`                     | svelte-check (tipos)                                                                                       |
| `npm run build` / `npm run preview` | build de produção em `dist/` / servir o build em `/piano-pratica/`                                         |
| `npm run verify`                    | tudo o que o CI roda (lint + check + test + build)                                                         |
| `npm run gen:scores`                | regenera `public/scores/` a partir de `scripts/gen-scores.ts`                                              |
| `npm run gen:icons`                 | regenera `public/icons/` a partir de `scripts/gen-icons.ts`                                                |
| **deploy**                          | `git push` na `main` → GitHub Actions publica em `https://r-guterres.github.io/piano-pratica/` em ~1–2 min |

## Regras de trabalho (resumo do plano, seção 10)

- Perguntar antes de decisões grandes ou difíceis de reverter (biblioteca central, hospedagem, reestruturação).
- Commits pequenos; um marco por vez; ao fim de cada marco, dizer **exatamente o que testar no tablet**.
- Não adicionar dependências sem justificá-las em uma linha (registrar abaixo).
- Testes obrigatórios para `practice/` e `drills/` (e para o `midi/parse.ts`).
- Bug relatado no tablet: **primeiro reproduzir com um teste** (sequência MIDI simulada), depois corrigir.
- Modo espera: `ScoreReader` assina o `inputHub`, passa cada evento ao `WaitMode` e traduz os eventos dele em cores
  (`ScoreView.colorNotes/flash`) e movimentos de cursor. O motor não conhece o OSMD nem o DOM.
- Testes de UI no PC: Edge headless controlado via DevTools Protocol (script descartável no scratchpad; em `npm run dev` o `window.__inputHub` permite injetar notas;
  ainda não há Playwright no repositório).
- Para depurar no tablet: o Monitor MIDI tem um **log de diagnóstico** com o botão "Copiar log". A versão
  (SHA do commit) aparece no topo. Com o service worker, uma versão nova só entra depois de tocar em "Atualizar"
  no aviso (que aparece ao abrir/voltar ao app com internet).
- Testar o PWA no PC: `npm run build` + `vite preview` e Edge headless **numa única sessão do navegador** (matar o
  Edge perde o registro do SW); para simular versão nova, gerar outro build com o preview aberto e chamar `registration.update()`.

## Dependências

De produção:

- `opensheetmusicdisplay`: renderização de MusicXML/.mxl, cursor e iterador (traz VexFlow e JSZip).
- `vexflow` 5: pauta do treino de leitura (o OSMD usa internamente o VexFlow 1.2, empacotado; não conflitam). A entrada `vexflow/bravura` embute as fontes (~390 kB gzip no pedaço do treino, carregado só ao abrir a aba).
  Tem `gl` como dependência opcional (renderização fora do navegador); o script de instalação dela não roda, e tudo bem.

De desenvolvimento:

- `vite`, `@sveltejs/vite-plugin-svelte`, `svelte`: build e framework.
- `typescript`, `svelte-check`, `@tsconfig/svelte`: checagem de tipos.
- `vitest`: testes de unidade.
- `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-svelte`, `globals`: lint.
- `prettier`, `prettier-plugin-svelte`, `eslint-config-prettier`: formatação.
- `jsdom`: DOM para rodar o OSMD nos testes de integração.
- `@types/node`: tipos para `scripts/` e testes.
- `vite-plugin-pwa` (+ `workbox-window`, empacotado no app): service worker e manifesto (cache offline é fácil de errar à mão).
- `fake-indexeddb`: IndexedDB em memória para testar `storage/` no Node.

O `npm audit` acusa vulnerabilidades moderadas só em ferramentas de desenvolvimento;
`npm audit --omit=dev` = 0.
