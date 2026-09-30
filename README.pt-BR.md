# SUPERFRAME — Reel de Motion

Uma peça de motion graphics de 15 segundos que roda inteiramente dentro de
um único arquivo HTML. Sem arquivos de vídeo, sem build, sem dependências,
sem requisições de rede em tempo de execução.

Clique para tocar. `Space` repete, `F` vai para tela cheia.

## O que é

Quinze cenas de um segundo cada, cortadas numa timeline rígida, cada uma
com uma ideia visual diferente:

| # | Cena | Técnica |
|---|------|---------|
| 01 | PULSE | anéis de choque expandindo, bloom aditivo |
| 02 | TITLE CARD | wordmark em SDF raymarched, entrada e dolly-out |
| 03 | EXPLODE | núcleo de partículas, cor e tamanho por partícula |
| 04 | NOISE FIELD | domain warping com fbm |
| 05 | MODULAR GRID | campo modular com hierarquia por célula |
| 06 | LIQUID CHROME | metaballs raymarched, light probe de estúdio |
| 07 | ORBITAL RIG | câmera em órbita, metal escuro, especular fechado |
| 08 | TUNNEL DIVE | SDF de corredor, câmera dentro da geometria |
| 09 | TYPE / SLICE | três camadas de slices deslocadas |
| 10 | RGB SPLIT | flow field separado por canal |
| 11 | WARP STREAKS | linhas de velocidade com pontas quentes |
| 12 | PARTICLE VORTEX | 2400 sprites em espiral na GPU |
| 13 | APERTURE | íris de oito lâminas |
| 14 | LOGO LOCKUP | marca com canto cortado, montada em três tempos |
| 15 | END / TAG | card e contato |

## Como foi construído

- **Renderização** — WebGL, um programa de fragment shader por cena. Cada
  shader é uma descrição de cena autossuficiente; não existe um
  uber-shader com dispatch por índice, porque esse caminho renderiza preto
  em alguns drivers.
- **Tipografia em 3D** — o wordmark SUPERFRAME é um signed distance field
  montados a partir de esqueletos de polilinhas com espessura, extrudado
  no eixo z e raymarched. Não há arquivo de fonte nem atlas de textura.
- **Áudio** — um `AudioContext`, sintetizado do zero. Kick, snare, hi-hat e
  risers a partir de ruído filtrado; baixo de saw e square desafinados
  passando por lowpass ressonante; um motivo pentatônico com uma nota por
  cena; compressor no master; todo o envelope roda no mesmo relógio de 15
  segundos dos visuais. Nenhum arquivo de áudio.
- **Camadas** — um canvas WebGL embaixo, um canvas 2D por cima para tipografia,
  slate e timecode, e um terceiro para granulação realtime em blend `overlay`.
- **Frame pacing** — a escala de resolução se adapta ao tempo de frame
  medido, então o reel segura 60fps em hardware modesto e sobe de escala
  quando consegue.

## Como rodar

Abra `index.html` no Chrome. Esse é o procedimento inteiro.

Para publicar:

```
git clone https://github.com/felipebossolani/space-bunny-animation
cd space-bunny-animation
# servir localmente
python3 -m http.server
```

O GitHub Pages funciona sem alteração: o arquivo é autossuficiente e não
faz requisições de rede, então pode ficar na raiz de um repositório sem
nenhum ajuste.

## Origem

Isto foi construído a partir de um brief de uma frase, em um único disparo,
sem correções subsequentes à instrução original. O prompt está guardado
literalmente em [`PROMPT.md`](PROMPT.md).

Felipe Bossolani — [felipe@bossolani.com](mailto:felipe@bossolani.com)

## Compatibilidade

Construído e verificado no Chrome. WebGL e Web Audio são obrigatórios; um
`AudioContext` ausente degrada para reprodução silenciosa em vez de falhar.
Ainda não verificado no Firefox ou no Safari.