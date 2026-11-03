# Plano inicial — app pessoal de prática de piano

> **Instrução ao Claude Code:** leia este plano inteiro antes de qualquer ação. Comece pelas **perguntas da seção 9**, depois proponha a estrutura do repositório e só então execute o **Marco 0**. Converse comigo em português do Brasil. Código, identificadores e mensagens de commit podem ficar em inglês.

---

## 1. Contexto

- **Usuário:** eu (Robert). Retomei o piano e leio partituras simples, mas preciso relembrar quase do zero. Tenho técnica de escalas razoável (Dó a Si pelo círculo de quintas, mãos juntas, 2 oitavas). Sou matemático e não sou programador profissional, então explique as decisões técnicas em poucas linhas.
- **Hardware:** teclado **Casio CTK-3500** (USB-MIDI class compliant, sensível ao toque, pedal sustain), ligado por cabo USB OTG a um **tablet Android**.
- **Plataforma-alvo:** **Chrome no Android**, como PWA instalável. Também deve rodar no Chrome/Edge do computador, para desenvolvimento e testes.
- **Inspiração:** Skoove (cursor que espera a nota certa, feedback imediato), **mas não a apresentação dele**: lá a partitura corre pela tela, e eu quero a experiência de ler no papel (ver seção 5.1).
- **Convivência:** já tenho um artefato no Claude ("Trilha do Teclado") com meu plano de estudos. O app **não o substitui** e não há integração na v1. No futuro talvez eu exporte um resumo do progresso para lá.
- **Uso:** pessoal. Não há contas, servidor nem multiusuário.

## 2. Objetivo da v1

1. **Leitor de partitura interativo (MusicXML) com modo "espera" via MIDI:** o cursor só avança quando eu toco a nota ou o acorde correto, com feedback visual de acerto e erro.
2. **Treino de leitura gerado:** o app mostra notas na pauta, eu toco no teclado, e o app mede acerto e tempo de reação, priorizando as notas em que mais erro.

### Fora do escopo da v1 (já previstos para v2+)
- Modo "tempo" (tocar junto com metrônomo e avaliação rítmica).
- Playback de áudio da partitura e acompanhamento da outra mão.
- Treino de ouvido (intervalos, acordes, ditado melódico respondido no teclado).
- Importação de PDF via OMR (Audiveris → MusicXML).
- Integração com o artefato "Trilha do Teclado".

A arquitetura da v1 não deve impedir esses itens. Em particular, o motor de comparação precisa ser desacoplado do modo de prática.

## 3. Stack proposta (confirme ou conteste antes de começar)

| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem/build | TypeScript + Vite | tipagem ajuda a manter o projeto; Vite é simples e rápido |
| UI | Svelte (ou React, se houver bom motivo) | leve, pouco boilerplate, bom em tablet |
| Partitura completa | **OpenSheetMusicDisplay (OSMD)** | renderiza MusicXML e tem API de cursor que itera as notas sob o cursor, que é exatamente o que o modo espera precisa |
| Notas isoladas (treino de leitura) | **VexFlow** direto | mais leve e controlável que o OSMD para 1 nota ou poucas notas |
| MIDI | **Web MIDI API** nativa | suportada no Chrome Android via USB OTG; dispensa app nativo |
| Persistência | IndexedDB (via `idb` ou Dexie) | local, offline |
| PWA | `vite-plugin-pwa` | instalável e offline |
| Testes | Vitest (unidade) + Playwright (smoke) | o motor de comparação e o gerador de exercícios precisam de testes |
| Deploy | GitHub Actions → hospedagem estática com HTTPS | Web MIDI exige contexto seguro (HTTPS) |

Se você achar que o Verovio é melhor que o OSMD para o leitor, argumente antes de trocar. Os trade-offs que conheço: o Verovio grava melhor e tem timemap, mas o WASM é mais pesado e não traz cursor pronto.

## 4. Arquitetura (módulos)

```
src/
  midi/        # acesso Web MIDI, seleção de dispositivo, normalização de eventos
  input/       # interface comum de entrada: MIDI real, teclado virtual na tela, teclado do computador (dev)
  score/       # carregar MusicXML/.mxl, renderizar com OSMD, extrair a sequência de "passos" esperados
  practice/    # motor de comparação PURO (sem DOM), modos de prática, estatísticas da sessão
  drills/      # gerador do treino de leitura + algoritmo de priorização
  storage/     # IndexedDB: sessões, erros por compasso, estatísticas do treino
  ui/          # telas e componentes
public/scores/ # biblioteca: arquivos .musicxml + index.json
```

Princípio central: **`practice/` e `drills/` não dependem de navegador.** Eles recebem eventos `{type: 'on'|'off', pitch, velocity, t}` e devolvem estado. Assim tudo fica testável com sequências MIDI simuladas.

## 5. Especificação do modo espera (núcleo da v1)

### 5.1 Apresentação da partitura: página fixa, cursor que anda

- A partitura é exibida como **página de papel**: vários sistemas empilhados ocupando a tela inteira, com quebras de linha e de página normais de partitura impressa. **Nada de rolagem horizontal contínua** nem de partitura correndo sob um marcador fixo.
- **A página fica parada e o marcador se move:** uma linha vertical fina (cor discreta) avança nota a nota pelo sistema e desce para o sistema seguinte ao fim da linha, como o olho faz no papel. No OSMD, use o layout paginado (`pageFormat`) e customize o tipo e a cor do cursor.
- **Virada de página automática**, sem animação de rolagem. O padrão é virar quando o cursor chega ao último sistema da página. Ofereça também a **meia-virada** como opção: a metade de baixo da página atual continua visível enquanto a metade de cima já mostra o início da próxima, para eu poder ler adiante. Também permita virar manualmente com um toque na borda da tela.
- **Ajuste à tela:** em retrato, uma página inteira cabe na tela; em paisagem, mostrar menos sistemas por vez, com fonte legível, mantendo a mesma lógica de "página". O tamanho da partitura deve ser configurável (zoom), e o layout deve ser recalculado sem perder a posição do cursor.
- O feedback de acerto e erro aparece **sobre as próprias notas** (cabeça de nota colorida), não em uma faixa separada.
- O loop de trecho também funciona nessa visão: ao voltar ao compasso inicial, a página correspondente é exibida.

### 5.2 Lógica de avaliação

- A partitura vira uma sequência de **passos**. Cada passo é o conjunto de alturas MIDI **iniciadas** naquele instante, filtrado pela(s) mão(s) escolhida(s) (pauta superior = MD, inferior = ME).
  - Notas ligadas (tie) que continuam não entram como nova exigência.
  - Pausas e passos vazios (após o filtro de mão) são pulados automaticamente.
  - Na v1, apojaturas/grace notes são opcionais (não bloqueiam o avanço).
- **Avanço:** acumular os note-on desde o início do passo. Quando o conjunto esperado estiver contido no acumulado, o passo é marcado como correto e o cursor avança.
- **Erro:** um note-on fora do conjunto esperado marca erro (nota vermelha ou indicação visual) e **não** avança. Registrar a nota tocada e a esperada.
- Note-on com velocity 0 = note-off. O pedal (CC64) só é registrado e não afeta a avaliação.
- **Seleção de mão:** MD, ME ou ambas.
- **Loop de trecho:** escolher compasso inicial e final e repetir. Quero isso para trechos difíceis, como o meio do Prelúdio em Mi menor de Chopin (op. 28 nº 4).
- **Ao fim:** resumo com acertos, erros, erros por compasso e tempo total. Salvar no IndexedDB.

Casos de teste obrigatórios para o motor: nota simples, acorde tocado em ordem qualquer, nota errada no meio de um acorde, nota ligada atravessando passos, filtro por mão, loop retornando ao início, note-on com velocity 0.

## 6. Especificação do treino de leitura

- **Configuração:** clave (sol, fá ou pauta dupla), extensão (ex.: Dó3–Dó6, incluindo linhas suplementares), com ou sem acidentes, armadura opcional.
- **Rodada:** o app mostra uma nota, eu toco, e o app registra acerto, nota tocada e tempo de reação. Avança após o acerto (ou após N erros, mostrando a resposta).
- **Priorização:** cada item é um par (clave, altura escrita). Na v1, sortear com peso maior para itens com alta taxa de erro ou reação lenta e manter um mínimo de variedade. Não usar FSRS na v1: ele é feito para intervalos de dias, e aqui a repetição acontece dentro da sessão. Pode entrar depois, para agendar quais conjuntos de notas revisar a cada dia.
- **Estatísticas persistentes:** mapa de calor por nota (taxa de erro e tempo médio), evolução por sessão.
- **Opção v1.1:** sequências curtas de 3–5 notas em vez de nota isolada.

## 7. Biblioteca de partituras

- `public/scores/index.json` com metadados: `id, title, composer, level, tags, file, source`.
- **Conteúdo inicial**, criado por você em MusicXML válido:
  - 3–4 exercícios curtos originais (ex.: leitura em Dó maior MD, ME, mãos juntas; um com acordes).
  - 1–2 peças simples de **domínio público** (ex.: Minueto em Sol do Caderno de Anna Magdalena; Ode à Alegria simplificada).
- **Importar arquivo local:** botão para abrir um `.musicxml` ou `.mxl` do próprio tablet (ex.: exportado do MuseScore), sem precisar de deploy.
- **Direitos autorais:** não transcrever músicas protegidas (Beatles etc.) de memória. Essas virão de arquivos meus.

## 8. Marcos (cada um termina com teste meu no tablet)

**M0 — Fundação e risco principal**
- Repositório, Vite + TS + framework, lint/format, Vitest, CI com deploy automático em HTTPS.
- Página **"Monitor MIDI"**: lista os dispositivos e mostra em tempo real as notas recebidas (nome, número, velocity) e o pedal.
- ✅ Aceite: abro a URL no Chrome do tablet com o Casio ligado e vejo as notas aparecendo. **Se isso falhar, paramos e reavaliamos antes de seguir.**

**M1 — Partitura e entrada**
- Carregar e renderizar MusicXML com OSMD **em layout de página** (seção 5.1); cursor vertical manual (avançar e voltar), descendo de sistema em sistema; virada de página automática e manual.
- Interface `input/` com 3 fontes: MIDI, teclado virtual na tela e teclado do computador.
- Extração da sequência de passos a partir da partitura, com testes.
- ✅ Aceite: abro uma peça com mais de uma página e ela aparece como página de papel, legível no tablet em retrato e paisagem. O cursor percorre os sistemas e a página vira sozinha no fim, sem rolagem contínua.

**M2 — Modo espera**
- Motor de comparação com os testes da seção 5; feedback visual; seleção de mão; loop de compassos; resumo da sessão.
- ✅ Aceite: toco um exercício inteiro no Casio, e o cursor espera, avança e marca erros corretamente.

**M3 — Treino de leitura**
- Gerador + VexFlow + priorização + estatísticas da sessão.
- ✅ Aceite: faço uma rodada de 5 minutos na clave de fá, e o app passa a mostrar mais as notas que errei.

**M4 — Persistência e acabamento**
- IndexedDB para histórico; tela de progresso; PWA instalável e offline; exportar histórico em JSON (quero analisar no computador).
- ✅ Aceite: instalo o app no tablet, uso offline e o histórico persiste.

## 9. Perguntas para me fazer antes de começar

1. Nome do repositório e se ele será **público ou privado**. GitHub Pages em repositório privado exige plano pago. Se for privado, proponha Cloudflare Pages ou Netlify (gratuitos com HTTPS).
2. Svelte ou React: aceito sua recomendação, mas justifique.
3. Qualquer ponto deste plano que você considere errado ou arriscado. Prefiro discordância argumentada a execução cega.

## 10. Regras de trabalho

- Pergunte antes de decisões grandes ou difíceis de reverter (troca de biblioteca central, reestruturação, mudança de hospedagem).
- Commits pequenos e descritivos; um marco por vez; ao fim de cada marco, me diga **exatamente o que testar no tablet**.
- Não adicione dependências sem justificar em uma linha.
- Mantenha um `CLAUDE.md` na raiz com as decisões tomadas, a estrutura e os comandos (dev, test, build, deploy), para continuarmos entre sessões.
- Testes obrigatórios para `practice/` e `drills/`. A UI pode ter testes mais leves.
- Quando eu relatar um bug testado no tablet, primeiro reproduza com um teste usando sequência MIDI simulada, depois corrija.
