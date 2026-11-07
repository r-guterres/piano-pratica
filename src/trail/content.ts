// Conteúdo da Trilha (fases, tópicos, marcos, músicas, cifras e materiais),
// trazido do artefato "Trilha do Teclado". Os ids são os mesmos do artefato,
// para a migração dos dados. Gerado uma vez por script; pode ser editado à mão.

export type Pillar = 'harmony' | 'reading' | 'ear' | 'technique' | 'repertoire' | 'voice';
export type TopicPillar = Exclude<Pillar, 'repertoire'>;

export const PILLARS: Record<Pillar, string> = {
  harmony: 'Harmonia e acompanhamento',
  reading: 'Leitura e ritmo',
  ear: 'Ouvido',
  technique: 'Técnica',
  repertoire: 'Repertório',
  voice: 'Voz (opcional)',
};
export const PILLAR_ORDER: Pillar[] = [
  'harmony',
  'reading',
  'ear',
  'technique',
  'repertoire',
  'voice',
];
export const TOPIC_PILLARS: TopicPillar[] = ['technique', 'harmony', 'reading', 'ear', 'voice'];

export interface Topic {
  id: string;
  title: string;
  text: string;
}

export interface Milestone {
  id: string;
  title: string;
  pillar: Pillar;
  /** "Chefão": o marco que libera a fase seguinte. */
  boss?: boolean;
}

export interface Phase extends Record<TopicPillar, Topic[]> {
  name: string;
  period: string;
  focus: string;
  milestones: Milestone[];
  songs: string[];
}

export interface Song {
  title: string;
  artist: string;
  kind: 'pop' | 'classical';
  phase: number;
  key: string;
  structure: string;
  tip: string;
}

export interface ChordChart {
  key: string;
  meter: string;
  note: string;
  sections: { name: string; lines: string[][]; note?: string }[];
  form?: string;
}

export const PHASES: Phase[] = [
  {
    name: 'Fase 0 · Retomada',
    period: 'semanas 1 a 4',
    focus:
      'Vitórias rápidas. Reativar as mãos, os símbolos rítmicos e a leitura, e voltar a tocar música de verdade desde o primeiro dia.',
    technique: [
      {
        id: 'tp0',
        title: 'Pedal sincopado (legato)',
        text: 'Toque o acorde novo, levante o pé no mesmo instante e pise de novo logo depois, com o acorde ainda preso. Alterne C e F contando "1 (acorde) e (pedal)", devagar. Quando ficar automático, aplique em Let It Be.',
      },
      {
        id: 'tb0',
        title: 'Escalas com bemóis: Fá e Si♭ maior',
        text: 'Duas oitavas, mãos juntas, colcheias. Fá, MD: 1-2-3-4-1-2-3-4 (o 4 cai no Si♭). Si♭, MD: 4-1-2-3-1-2-3-4; ME: 3-2-1-4-3-2-1-3. Polegar sempre em tecla branca. Comece a 80 bpm e suba até o andamento das suas escalas com sustenidos.',
      },
      {
        id: 'ta0',
        title: 'Arpejos maiores em 2 oitavas',
        text: 'C, G, F e D. MD: 1-2-3-1-2-3-5; ME: 5-4-2-1-4-2-1. Mãos separadas, depois juntas, com o pulso solto na passagem do polegar.',
      },
    ],
    harmony: [
      {
        id: 'h0a',
        title: 'Tríades maiores e menores',
        text: 'Monte C, F, G, Am, Dm e Em na MD. Toque, solte, monte de novo sem olhar. Faça uma rodada no Treino de acordes.',
      },
      {
        id: 'h0b',
        title: 'Inversões de C, F e G',
        text: 'Cada acorde em fundamental, 1ª e 2ª inversão, subindo e descendo. Identifique qual nota ficou no baixo.',
      },
      {
        id: 'h0c',
        title: 'Condução de vozes I–IV–V–I',
        text: 'C (dó-mi-sol) → F/C (dó-fá-lá) → G/B (si-ré-sol) → C. A mão quase não se move: é assim que pianistas acompanham.',
      },
      {
        id: 'h0d',
        title: 'Baixo na ME, acorde na MD',
        text: 'ME toca a fundamental em semibreve; MD toca o acorde em semínimas. Progressão C–G–Am–F a 70 bpm, depois com as inversões do tópico anterior.',
      },
    ],
    reading: [
      {
        id: 'l0a',
        title: 'Figuras rítmicas e pausas',
        text: 'Semibreve, mínima, semínima e colcheia, com as pausas equivalentes. Bata palmas contando 1-e-2-e-3-e-4-e.',
      },
      {
        id: 'l0b',
        title: 'Ponto de aumento e ligadura',
        text: 'Mínima pontuada (3 tempos), semínima pontuada + colcheia. Leia e bata 4 compassos simples.',
      },
      {
        id: 'l0c',
        title: 'Notas na clave de Sol',
        text: 'Do Dó central ao Sol acima da pauta. Rodadas no Treino de leitura até 90% de acerto.',
      },
      {
        id: 'l0d',
        title: 'Notas na clave de Fá',
        text: 'Do Fá grave ao Dó central. Mesma meta: 90% de acerto no Treino de leitura.',
      },
    ],
    ear: [
      {
        id: 'o0a',
        title: 'Maior ou menor',
        text: 'Treino de ouvido no modo maior/menor. Meta: 9 em 10.',
      },
      {
        id: 'o0b',
        title: 'Intervalos básicos',
        text: '2ª maior, 3ª menor, 3ª maior, 5ª justa e oitava. Associe cada um a um começo de música que você conhece.',
      },
    ],
    voice: [],
    milestones: [
      { id: 'm0a', title: 'Ler notas nas duas claves com 90% de acerto', pillar: 'reading' },
      {
        id: 'm0b',
        title: 'Let It Be (verso e refrão) com metrônomo a 70 bpm',
        pillar: 'repertoire',
      },
      { id: 'm0c', title: 'Minueto em Sol: primeira parte, mãos juntas', pillar: 'reading' },
      {
        id: 'm0x',
        title: 'Chefão: gravar Let It Be inteira, do começo ao fim, sem parar',
        pillar: 'repertoire',
        boss: true,
      },
    ],
    songs: ['letitbe', 'soundsilence', 'minueto'],
  },

  {
    name: 'Fase 1 · Repertório de bolso',
    period: 'meses 2 a 4',
    focus:
      'O "toca alguma coisa aí". Entender o campo harmônico, ganhar levadas de acompanhamento e montar um repertório que você toca de memória.',
    technique: [
      {
        id: 'tb1',
        title: 'Escalas com bemóis: Mi♭, Lá♭, Ré♭ e Sol♭',
        text: 'Duas oitavas, mãos juntas. A regra que resolve quase todos os dedilhados: polegar só nas teclas brancas, 4 da MD sempre no Si♭. Confira cada uma no vídeo antes de acelerar.',
      },
      {
        id: 'tm1',
        title: 'Escalas menores naturais e harmônicas',
        text: 'Lá, Mi e Ré menor, duas oitavas. Toque a natural e logo depois a harmônica (com a 7ª elevada) para ouvir a diferença.',
      },
      {
        id: 't1b',
        title: 'Padrão 1–5–8 na ME',
        text: 'Fundamental, quinta e oitava em colcheias, para C, F, G e Am. É a base das baladas.',
      },
      {
        id: 't1c',
        title: 'Arpejos de 3 notas, mãos alternadas',
        text: 'ME toca fundamental e quinta, MD completa com a terça e a oitava em cima. Devagar e com pedal.',
      },
    ],
    harmony: [
      {
        id: 'h1a',
        title: 'Campo harmônico maior e graus romanos',
        text: 'I ii iii IV V vi vii°. Escreva e toque o campo de C, G e F. Diga "seis menor" em vez de "Lá menor".',
      },
      {
        id: 'h1b',
        title: 'I–V–vi–IV em três tons',
        text: 'A progressão de Let It Be e de centenas de músicas pop. Toque em C, G e F com condução de vozes.',
      },
      {
        id: 'h1c',
        title: 'I–vi–IV–V, a progressão dos anos 50 e 60',
        text: 'C–Am–F–G. Toque com o padrão 1–5–8 na ME e acorde em semínimas na MD.',
      },
      {
        id: 'h1d',
        title: 'Levada de balada arpejada',
        text: 'ME 1–5–8 em colcheias, MD acorde no 1º e no 3º tempo. Aplique em Imagine e Simple Man.',
      },
      {
        id: 'h1e',
        title: 'Levada pop em colcheias',
        text: 'MD repete o acorde em colcheias com acento nos tempos 2 e 4; ME em mínimas. Aplique em Hey Jude.',
      },
      {
        id: 'h1f',
        title: 'Tocar só pela cifra',
        text: 'Escolha uma música do repertório e toque olhando apenas para a sequência de acordes, sem partitura.',
      },
    ],
    reading: [
      {
        id: 'l1a',
        title: 'As duas claves ao mesmo tempo',
        text: 'Peças simples a duas mãos. Leia primeiro só o ritmo, depois só a ME, depois junte.',
      },
      {
        id: 'l1b',
        title: 'Compasso 3/4 e 6/8',
        text: 'Conte em voz alta. O Minueto e a Gymnopédie estão em 3/4.',
      },
      {
        id: 'l1c',
        title: 'Colcheia pontuada e síncope simples',
        text: 'Bata o ritmo antes de tocar. A síncope é o "atraso" que dá balanço ao pop-rock.',
      },
    ],
    ear: [
      {
        id: 'o1a',
        title: 'Graus I, IV, V e vi',
        text: 'Treino de ouvido no modo graus. Depois tente reconhecer esses graus numa música no rádio.',
      },
      {
        id: 'o1b',
        title: 'Cantarolar antes de tocar',
        text: 'Antes de tocar a melodia, cantarole baixinho. Se você consegue cantarolar, consegue achar no teclado.',
      },
    ],
    voice: [
      {
        id: 'v1a',
        title: 'Murmurar a melodia enquanto toca',
        text: 'Só boca fechada, volume baixo, sem palavras. O objetivo é coordenar, não cantar bonito.',
      },
    ],
    milestones: [
      { id: 'm1a', title: 'Campo harmônico de C, G e F de cor', pillar: 'harmony' },
      { id: 'm1b', title: 'Imagine com a levada arpejada', pillar: 'repertoire' },
      { id: 'm1c', title: 'Prelúdio em Dó (BWV 846): primeira página', pillar: 'reading' },
      {
        id: 'm1x',
        title: 'Chefão: 5 músicas de memória, sem cifra, uma atrás da outra',
        pillar: 'repertoire',
        boss: true,
      },
    ],
    songs: ['simpleman', 'imagine', 'sweethome', 'heyjude', 'preludioC'],
  },

  {
    name: 'Fase 2 · Expansão',
    period: 'meses 5 a 8',
    focus:
      'Harmonia mais rica (sétimas, empréstimos, dominantes secundárias), primeiros passos tirando de ouvido e o clássico mais expressivo.',
    technique: [
      {
        id: 'tc2',
        title: 'Escalas em movimento contrário',
        text: 'C, G e D partindo do mesmo Dó (ou tônica) e abrindo para fora, duas oitavas. Treina independência das mãos.',
      },
      {
        id: 'ta2',
        title: 'Arpejos com sétima',
        text: 'Cmaj7, G7, Am7 e Dm7 em 2 oitavas, mãos separadas e depois juntas.',
      },
      {
        id: 'to2',
        title: 'Ornamentos lentos',
        text: 'Trinado e mordente com 2-3 e 3-4, devagar e com som igual. Prepara o Prelúdio de Chopin e o Minueto.',
      },
    ],
    harmony: [
      {
        id: 'h2a',
        title: 'Acordes com sétima: maj7, 7 e m7',
        text: 'Cmaj7, C7, Cm7 e o mesmo em F e G. Ouça a cor de cada um.',
      },
      { id: 'h2b', title: 'sus2 e sus4', text: 'Csus4 → C e Dsus2 → D. Ótimos para introduções.' },
      {
        id: 'h2c',
        title: 'Empréstimo modal: ♭VII e iv',
        text: 'Os Beatles adoram. ♭VII: o E♭ na coda de Hey Jude. iv: o Dm em In My Life (tom de Lá).',
      },
      {
        id: 'h2d',
        title: 'Dominantes secundárias',
        text: 'O A7 de Yesterday é o V do vi (Dm). Encontre outros V/x nas músicas que você toca.',
      },
      {
        id: 'h2e',
        title: 'Introdução e final',
        text: 'Crie uma introdução de 4 compassos e um final com ritardando para duas músicas do repertório.',
      },
      {
        id: 'h2f',
        title: 'Transpor',
        text: 'Toque Let It Be em G e em F, pensando em graus, não em nomes de acordes.',
      },
    ],
    reading: [
      {
        id: 'l2a',
        title: 'Leitura à primeira vista',
        text: '8 compassos novos por dia, devagar e sem parar para corrigir. A regra é não parar.',
      },
      {
        id: 'l2b',
        title: 'Marcações de pedal e dinâmica',
        text: 'p, mf, f, crescendo, e as marcações de pedal. Respeite tudo numa peça inteira.',
      },
    ],
    ear: [
      {
        id: 'o2a',
        title: 'Tirar melodias de ouvido',
        text: 'Comece por melodias que você canta de cabeça. Ache a primeira nota, depois frase por frase.',
      },
      {
        id: 'o2b',
        title: 'Reconhecer ii e ♭VII',
        text: 'Treino de ouvido no modo graus, que nesta fase já inclui ii e ♭VII.',
      },
    ],
    voice: [
      {
        id: 'v2a',
        title: 'Cantar o refrão de Let It Be',
        text: 'Sozinho, volume baixo, tocando só os acordes. Grave e ouça só se quiser.',
      },
    ],
    milestones: [
      { id: 'm2a', title: 'Tirar de ouvido uma música que você nunca estudou', pillar: 'ear' },
      { id: 'm2b', title: 'Gymnopédie nº 1 inteira', pillar: 'reading' },
      {
        id: 'm2c',
        title: 'Prelúdio em Mi menor: trecho do meio limpo a 60% do andamento',
        pillar: 'technique',
      },
      {
        id: 'm2x',
        title: 'Chefão: gravar 3 músicas com introdução e final criados por você',
        pillar: 'repertoire',
        boss: true,
      },
    ],
    songs: ['yesterday', 'herecomes', 'inmylife', 'gymnopedie', 'mrbluesky'],
  },

  {
    name: 'Fase 3 · Músico completo',
    period: 'mês 9 em diante',
    focus:
      'Arranjos próprios, retomada e conclusão do curso, peças clássicas inteiras e tocar e cantar.',
    technique: [
      {
        id: 't3a',
        title: 'Retomar o curso Milo Andreo',
        text: 'Revise o Intermediário 1 inteiro antes de voltar ao ponto onde parou no Intermediário 2.',
      },
      {
        id: 'tm3',
        title: 'Escalas menores melódicas',
        text: 'Lá, Mi e Ré menor melódicas (sobe com 6ª e 7ª elevadas, desce natural), duas oitavas, mãos juntas.',
      },
      {
        id: 't3c',
        title: 'Oitavas na ME',
        text: 'Baixo em oitavas em colcheias, estilo piano rock. Pulso solto.',
      },
    ],
    harmony: [
      {
        id: 'h3a',
        title: 'Arranjo próprio a partir de lead sheet',
        text: 'Melodia na MD e harmonia distribuída entre as mãos. Escolha uma música e faça a sua versão.',
      },
      {
        id: 'h3b',
        title: 'Baixo caminhante simples',
        text: 'Ligue as fundamentais com notas de passagem. Teste em I–vi–IV–V.',
      },
      {
        id: 'h3c',
        title: 'Piano boogie',
        text: 'O riff de Lady Madonna: ME em padrão de boogie, MD em acordes curtos.',
      },
      {
        id: 'h3d',
        title: 'Rearmonizar',
        text: 'Pegue uma melodia simples e troque acordes por substitutos (vi no lugar do I, ii no lugar do IV).',
      },
    ],
    reading: [
      {
        id: 'l3a',
        title: 'Terminar o Intermediário 2 do curso',
        text: 'Incluindo o Prelúdio em Mi menor.',
      },
      {
        id: 'l3b',
        title: 'Peças intermediárias à primeira vista',
        text: 'Uma peça nova por semana, só lida, sem a intenção de aperfeiçoar.',
      },
    ],
    ear: [
      {
        id: 'o3a',
        title: 'Tirar a harmonia de ouvido',
        text: 'Baixo primeiro, depois a qualidade de cada acorde.',
      },
    ],
    voice: [
      {
        id: 'v3a',
        title: 'Tocar e cantar uma música inteira',
        text: 'Escolha a mais confortável para a sua voz. Transponha se precisar.',
      },
    ],
    milestones: [
      { id: 'm3a', title: 'Prelúdio em Mi menor (Chopin) completo', pillar: 'reading' },
      { id: 'm3b', title: 'Concluir o Intermediário 2 do curso', pillar: 'technique' },
      {
        id: 'm3x',
        title: 'Chefão: recital caseiro de 20 minutos, gravado',
        pillar: 'repertoire',
        boss: true,
      },
    ],
    songs: [
      'loveofmylife',
      'ladymadonna',
      'longwinding',
      'valsaLam',
      'furelise',
      'bohemian',
      'bridge',
      'maybeamazed',
    ],
  },
];

export const SONGS: Record<string, Song> = {
  letitbe: {
    title: 'Let It Be',
    artist: 'The Beatles',
    kind: 'pop',
    phase: 0,
    key: 'Dó maior',
    structure: 'Verso: C G Am F | C G F C · Refrão: Am C/G F C | C G F C',
    tip: 'Progressão I–V–vi–IV. Forma: intro, verso, verso, refrão, verso, refrão, solo, verso, refrão. ME na fundamental em mínimas, MD no acorde em semínimas.',
  },
  soundsilence: {
    title: 'The Sound of Silence',
    artist: 'Simon & Garfunkel',
    kind: 'pop',
    phase: 0,
    key: 'Lá menor (simplificado)',
    structure: 'Am G Am | C F C | F C Am | C G Am',
    tip: 'O original soa em Mi♭ menor; em Lá menor fica só com teclas brancas. Melodia curta e ótima para murmurar. Arpeje os acordes devagar.',
  },
  minueto: {
    title: 'Minueto em Sol maior',
    artist: 'Atrib. C. Petzold (Caderno de Anna Magdalena Bach)',
    kind: 'classical',
    phase: 0,
    key: 'Sol maior · 3/4',
    structure: 'Forma binária: A (16 compassos) e B (16 compassos)',
    tip: 'Peça clássica de leitura a duas mãos. Estude a parte A de 4 em 4 compassos, mãos separadas antes de juntar.',
  },
  simpleman: {
    title: 'Simple Man',
    artist: 'Lynyrd Skynyrd',
    kind: 'pop',
    phase: 1,
    key: 'Lá menor / Dó',
    structure: 'C G Am (repetido em toda a música)',
    tip: 'Três acordes só, perfeita para treinar a levada arpejada 1–5–8 na ME sem se preocupar com a harmonia.',
  },
  imagine: {
    title: 'Imagine',
    artist: 'John Lennon',
    kind: 'pop',
    phase: 1,
    key: 'Dó maior',
    structure: 'Verso: C Cmaj7 F (2x) · Pré: F Am Dm F G G7 · Refrão: F G C E7 F G C',
    tip: 'O padrão do piano é a música. Repare no E7 do refrão, uma dominante secundária que puxa para F.',
  },
  sweethome: {
    title: 'Sweet Home Alabama',
    artist: 'Lynyrd Skynyrd',
    kind: 'pop',
    phase: 1,
    key: 'Ré',
    structure: 'D C G (o riff gira a música inteira)',
    tip: 'Levada em colcheias com balanço. Ótima para ritmo: a harmonia é fixa e você foca no groove.',
  },
  heyjude: {
    title: 'Hey Jude',
    artist: 'The Beatles',
    kind: 'pop',
    phase: 1,
    key: 'Fá maior',
    structure: 'Verso: F C C7 F | B♭ F C7 F · Ponte: F7 B♭ Dm Gm C7 F · Coda: F E♭ B♭ F',
    tip: 'A coda usa o ♭VII (E♭), um empréstimo modal. Toque a coda em loop: é uma ótima música para o "toca alguma coisa aí".',
  },
  preludioC: {
    title: 'Prelúdio em Dó, BWV 846',
    artist: 'J. S. Bach (Cravo Bem Temperado I)',
    kind: 'classical',
    phase: 1,
    key: 'Dó maior',
    structure: 'Um padrão de arpejo por compasso',
    tip: 'Antes de tocar um compasso, toque a harmonia dele como acorde em bloco. Você vai ler acordes, não notas soltas.',
  },
  yesterday: {
    title: 'Yesterday',
    artist: 'The Beatles',
    kind: 'pop',
    phase: 2,
    key: 'Fá maior',
    structure: 'F Em7 A7 Dm Dm/C | B♭ C7 F',
    tip: 'O A7 é o V do vi (Dm): dominante secundária. Melodia linda e simples, ótima para tocar só com a MD primeiro.',
  },
  herecomes: {
    title: 'Here Comes the Sun',
    artist: 'The Beatles',
    kind: 'pop',
    phase: 2,
    key: 'Ré maior',
    structure: 'Verso: D G A7 · Seção "sun, sun, sun": F C G D A7',
    tip: 'A seção do meio usa acordes emprestados (♭III e ♭VII) e uma métrica irregular. Conte em voz alta.',
  },
  inmylife: {
    title: 'In My Life',
    artist: 'The Beatles',
    kind: 'pop',
    phase: 2,
    key: 'Lá maior',
    structure: 'Verso: A E F♯m A7 D Dm A',
    tip: 'O Dm é o iv emprestado do modo menor. O solo de piano (gravado como cravo acelerado) é um bom desafio de leitura para depois.',
  },
  gymnopedie: {
    title: 'Gymnopédie nº 1',
    artist: 'Erik Satie',
    kind: 'classical',
    phase: 2,
    key: 'Ré maior · 3/4',
    structure: 'ME: baixo no 1º tempo e acorde no 2º · base Gmaj7 Dmaj7',
    tip: 'Lenta e bonita. Treina pedal, dinâmica e o equilíbrio entre melodia e acompanhamento.',
  },
  mrbluesky: {
    title: 'Mr. Blue Sky',
    artist: 'Electric Light Orchestra',
    kind: 'pop',
    phase: 2,
    key: 'Fá maior',
    structure: 'Piano em colcheias repetidas no verso',
    tip: 'Energia alta. Estude o verso com acordes em colcheias firmes e metrônomo.',
  },
  loveofmylife: {
    title: 'Love of My Life',
    artist: 'Queen',
    kind: 'pop',
    phase: 3,
    key: 'a definir pela partitura',
    structure: 'Balada com arpejos e condução de vozes',
    tip: 'Harmonia rica. Estude por partitura e anote aqui a progressão de cada seção quando chegar nela.',
  },
  ladymadonna: {
    title: 'Lady Madonna',
    artist: 'The Beatles',
    kind: 'pop',
    phase: 3,
    key: 'Lá',
    structure: 'Riff de boogie na ME',
    tip: 'Piano rock puro. Comece pelo riff da ME sozinho até sair automático.',
  },
  longwinding: {
    title: 'The Long and Winding Road',
    artist: 'The Beatles',
    kind: 'pop',
    phase: 3,
    key: 'Mi♭ maior',
    structure: 'Balada com acordes de sétima',
    tip: 'Boa para aplicar sétimas e condução de vozes da Fase 2.',
  },
  valsaLam: {
    title: 'Valsa em Lá menor, B. 150',
    artist: 'F. Chopin (póstuma)',
    kind: 'classical',
    phase: 3,
    key: 'Lá menor · 3/4',
    structure: 'ME: baixo, acorde, acorde · MD lírica',
    tip: 'A valsa de Chopin mais acessível. Uma boa ponte para o Prelúdio em Mi menor.',
  },
  furelise: {
    title: 'Für Elise (seção A)',
    artist: 'L. van Beethoven',
    kind: 'classical',
    phase: 3,
    key: 'Lá menor · 3/8',
    structure: 'Rondó: A B A C A. Comece só pela seção A',
    tip: 'Alternância rápida entre as mãos e pedal. Bonita e muito gratificante.',
  },
  bohemian: {
    title: 'Bohemian Rhapsody (balada)',
    artist: 'Queen',
    kind: 'pop',
    phase: 3,
    key: 'Si♭',
    structure: 'Seção de piano do "Mama…"',
    tip: 'Estude a parte de piano da balada por partitura; ótima para independência das mãos.',
  },
  bridge: {
    title: 'Bridge Over Troubled Water',
    artist: 'Simon & Garfunkel',
    kind: 'pop',
    phase: 3,
    key: 'Mi♭',
    structure: 'Piano de estilo gospel',
    tip: 'Arranjo original exigente. Comece por uma versão simplificada.',
  },
  maybeamazed: {
    title: "Maybe I'm Amazed",
    artist: 'Paul McCartney',
    kind: 'pop',
    phase: 3,
    key: 'Mi♭',
    structure: 'Acordes fortes em bloco',
    tip: 'Um desafio de Fase 3 para piano rock com expressão.',
  },
  chopinEm: {
    title: 'Prelúdio em Mi menor, Op. 28 nº 4',
    artist: 'F. Chopin',
    kind: 'classical',
    phase: 0,
    key: 'Mi menor · lento',
    structure: 'MD canta a melodia · ME em acordes repetidos que descem cromaticamente',
    tip: 'Projeto longo, sem pressa. O trecho difícil é o clímax no meio. Estude só ele, mãos separadas, a 50% do andamento, e anote aqui os compassos exatos.',
  },
};

export const METHOD: string[] = [
  'Seção por seção. Escolha só um trecho (4 a 8 compassos) e toque mãos separadas até sair sem pausa.',
  'Devagar com metrônomo, a 60–70% do andamento. Suba 5 bpm só depois de 3 vezes limpas seguidas.',
  'Estrutura primeiro. Antes de tocar, diga em voz alta o tom, a progressão e a forma. Anote na ficha da música.',
  'Junte as mãos. Comece pelo trecho mais fácil e emende com o próximo. Errou? Volte só 2 compassos.',
  'Do começo ao fim, sem parar. Erros não param a música; isso treina tocar para alguém.',
];

export const CHORD_CHARTS: Record<string, ChordChart> = {
  letitbe: {
    key: 'Dó maior',
    meter: '4/4',
    note: 'Cada caixa é um compasso. Dois acordes na mesma caixa = 2 tempos cada. Confira ouvindo a gravação.',
    sections: [
      {
        name: 'Introdução e verso',
        lines: [['C  G', 'Am  F', 'C  G', 'F  C']],
        note: 'O verso usa esta linha duas vezes.',
      },
      {
        name: 'Refrão',
        lines: [['Am  C/G', 'F  C', 'C  G', 'F  C']],
        note: 'C/G: acorde de Dó com Sol no baixo. O baixo desce Lá, Sol, Fá.',
      },
      {
        name: 'Virada (depois do refrão)',
        lines: [['F  C/E  Dm  C', 'B♭  F/A  G  F', 'C']],
        note: 'Um acorde por tempo; o baixo desce pela escala.',
      },
    ],
    form: 'Verso e refrão se alternam; a virada liga as seções e o solo usa a harmonia do verso.',
  },
  soundsilence: {
    key: 'Lá menor (simplificado)',
    meter: '4/4',
    note: 'Organizada por frase, não por meter: cada linha é uma frase da melodia. O original soa em Mi♭ menor.',
    sections: [
      {
        name: 'Estrofe (todas as estrofes usam a mesma harmonia)',
        lines: [
          ['Am', 'G', 'Am'],
          ['C', 'F', 'C'],
          ['F', 'C', 'Am'],
          ['C', 'G', 'Am'],
        ],
      },
    ],
    form: 'Estrofes repetidas, crescendo de intensidade até a última.',
  },
};

export const CURATED_VIDEO: Record<string, string> = {
  letitbe: 'https://www.youtube.com/watch?v=-OKoQWWSFvE',
  soundsilence: 'https://www.youtube.com/watch?v=f-a_XdDXxzw',
  minueto: 'https://www.youtube.com/watch?v=JfR5mSvCTzM',
  chopinEm: 'https://www.youtube.com/watch?v=9mawRGC2yrI',
  t0b: 'https://www.youtube.com/watch?v=sMZiNaBe7xA',
  l0a: 'https://www.youtube.com/watch?v=gLzCgurdl5E',
  h0b: 'https://www.youtube.com/watch?v=NyClftNGmPA',
  h0c: 'https://www.youtube.com/watch?v=ZKM8FtLgvRk',
};

export const IMSLP: Record<string, string> = {
  minueto: 'https://imslp.org/wiki/Minuet_in_G_major,_BWV_Anh.114_(Pezold,_Christian)',
  chopinEm: 'https://imslp.org/wiki/Preludes,_Op.28_(Chopin,_Fr%C3%A9d%C3%A9ric)',
};

export const VIDEO_SEARCH: Record<string, string> = {
  tp0: 'syncopated legato pedaling piano tutorial',
  tb0: 'F major B flat major scale two octaves fingering piano',
  ta0: 'major arpeggios two octaves piano fingering',
  tb1: 'flat key scales fingering piano E flat A flat D flat',
  tm1: 'natural and harmonic minor scales piano fingering',
  tc2: 'contrary motion scales piano',
  ta2: 'seventh chord arpeggios piano',
  to2: 'trill and mordent piano technique slow practice',
  tm3: 'melodic minor scale piano fingering',
  h0a: 'major and minor triads piano beginner lesson',
  h0b: 'piano chord inversions C F G beginner',
  h0c: 'voice leading I IV V I piano inversions',
  h0d: 'left hand root right hand chords piano accompaniment beginner',
  l0a: 'rhythm reading whole half quarter eighth notes lesson',
  l0b: 'dotted notes and ties rhythm lesson',
  l0c: 'read treble clef notes fast piano',
  l0d: 'read bass clef notes fast piano',
  o0a: 'ear training major vs minor chords',
  o0b: 'ear training intervals song references',
  t1a: 'D major F major A minor scale piano fingering',
  t1b: '1 5 8 left hand pattern piano ballad',
  t1c: 'broken chord arpeggio pattern hands alternating piano',
  h1a: 'chords in a key roman numerals piano lesson',
  h1b: 'I V vi IV progression piano all keys',
  h1c: 'I vi IV V 50s progression piano',
  h1d: 'piano ballad accompaniment pattern arpeggio',
  h1e: 'pop piano eighth note rhythm pattern chords',
  h1f: 'how to play piano from chord charts lead sheet',
  l1a: 'sight reading both hands piano beginner',
  l1b: '3/4 and 6/8 time signature explained piano',
  l1c: 'syncopation rhythm piano beginner',
  o1a: 'ear training hear I IV V vi chords',
  o1b: 'play melody by ear piano singing first',
  v1a: 'humming melody while playing piano chords',
  t2a: 'two octave scales hands together piano',
  t2b: 'four note arpeggios piano two octaves',
  t2c: 'legato syncopated pedaling piano',
  h2a: 'maj7 dominant 7 minor 7 chords piano',
  h2b: 'sus2 sus4 chords piano',
  h2c: 'modal interchange flat VII iv Beatles',
  h2d: 'secondary dominants explained piano',
  h2e: 'how to make piano intro and ending',
  h2f: 'transpose songs piano using numbers',
  l2a: 'sight reading practice method piano',
  l2b: 'piano pedal markings and dynamics',
  o2a: 'how to play songs by ear piano',
  o2b: 'ear training ii chord flat VII',
  v2a: 'singing while playing piano beginner',
  t3a: '',
  t3b: 'harmonic minor scale piano fingering',
  t3c: 'left hand octaves rock piano',
  h3a: 'arrange a lead sheet for solo piano',
  h3b: 'walking bass line piano beginner',
  h3c: 'Lady Madonna piano riff boogie',
  h3d: 'reharmonization basics piano',
  l3a: '',
  l3b: 'intermediate sight reading pieces piano',
  o3a: 'how to figure out chords by ear',
  v3a: 'how to sing and play piano at the same time',
};

export const CHORDS_BY_PHASE: string[][] = [
  [
    'C',
    'F',
    'G',
    'Am',
    'Dm',
    'Em',
    'D',
    'A',
    'E',
    'Bb',
    'G7',
    'C7',
    'D7',
    'E7',
    'A7',
    'Cmaj7',
    'Fmaj7',
    'Am7',
    'Dm7',
    'Em7',
  ],
  [
    'C',
    'F',
    'G',
    'Am',
    'Dm',
    'Em',
    'D',
    'A',
    'E',
    'Bb',
    'Bm',
    'Gm',
    'Eb',
    'G7',
    'C7',
    'D7',
    'E7',
    'A7',
    'Cmaj7',
    'Fmaj7',
    'Gmaj7',
    'Am7',
    'Dm7',
    'Em7',
    'Bm7',
    'Csus4',
    'Dsus2',
  ],
  [
    'C',
    'F',
    'G',
    'Am',
    'Dm',
    'Em',
    'D',
    'Bb',
    'G7',
    'C7',
    'D7',
    'A7',
    'E7',
    'Cmaj7',
    'Fmaj7',
    'Am7',
    'Dm7',
    'Csus4',
    'Dsus2',
  ],
  [
    'C',
    'F',
    'G',
    'Am',
    'Dm',
    'Em',
    'D',
    'Bb',
    'Eb',
    'A',
    'E',
    'G7',
    'C7',
    'A7',
    'E7',
    'Cmaj7',
    'Fmaj7',
    'Gmaj7',
    'Am7',
    'Dm7',
    'Em7',
    'Csus4',
    'Dsus2',
    'Asus4',
  ],
];

/** Partitura da biblioteca do app ligada à música, quando existe. */
export const DEFAULT_SCORE: Record<string, string> = { minueto: 'minueto-sol' };

export interface Link {
  url: string;
  text: string;
  /** Escolhido a dedo (os outros são buscas já filtradas, que nunca quebram). */
  recommended: boolean;
}

const youtubeSearch = (q: string) =>
  'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);

/** Vídeo-aula e partitura de uma música. */
export function songLinks(id: string): Link[] {
  const M = SONGS[id];
  if (!M) return [];
  const q =
    M.kind === 'pop' ? `${M.title} ${M.artist} piano tutorial` : `${M.title} piano tutorial`;
  const video = CURATED_VIDEO[id];
  const sheet =
    M.kind === 'classical'
      ? {
          url: IMSLP[id] ?? 'https://imslp.org/index.php?search=' + encodeURIComponent(M.title),
          text: 'Partitura grátis (IMSLP)',
          recommended: false,
        }
      : {
          url:
            'https://musescore.com/sheetmusic?text=' +
            encodeURIComponent(`${M.title} ${M.artist} easy piano`),
          text: 'Partituras (MuseScore)',
          recommended: false,
        };
  return [
    video
      ? { url: video, text: 'Vídeo recomendado', recommended: true }
      : { url: youtubeSearch(q), text: 'Buscar vídeo-aula', recommended: false },
    sheet,
  ];
}

/** Vídeo-aula de um tópico. */
export function topicLinks(id: string): Link[] {
  const video = CURATED_VIDEO[id];
  if (video) return [{ url: video, text: 'Vídeo recomendado', recommended: true }];
  const q = VIDEO_SEARCH[id];
  return q ? [{ url: youtubeSearch(q), text: 'Buscar vídeo-aula', recommended: false }] : [];
}
