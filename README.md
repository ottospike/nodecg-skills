# nodecg — skill do Claude Code

Convenções para construir e manter **bundles NodeCG de broadcast ao vivo**,
extraídas dos bundles `betano` (Show do Apelão) e `cpn`.

O ponto de partida é [`SKILL.md`](SKILL.md). O resto carrega sob demanda:

| Documento | Quando |
|---|---|
| `assets/grafico-modelo.html` | esqueleto de gráfico novo (GSAP, travas de ar) |
| `assets/painel-modelo.html` | esqueleto de painel de dashboard |
| `references/animacao-gsap.md` | timelines de entrada/saída, replay-safety, catálogo |
| `references/dashboard-ui.md` | classes do design system dos painéis |
| `references/padroes-replicant.md` | 8 padrões de estado com código |
| `references/vmix.md` | ponte HTTP com o vMix, migração CasparCG |
| `references/psd-to-html/` | subskill: PSD → plates + manifesto → HTML |
| `references/spritesheet-mask-reveal.md` | subskill: reveal por matte de vídeo |

## O que ela defende

- **Estado, nunca evento.** Toda comunicação entre dashboard, graphics e extension
  é replicant — inclusive "põe no ar". Mensagem é evento que passa: uma browser
  source que recarrega volta em branco e ninguém percebe até estar no ar.
- **Um arquivo por peça.** Painel e gráfico levam markup, estilo e script juntos.
- **Frame inteiro sempre.** Até um lower third de 421×106 mora num stage 1920×1080,
  ancorado pela coordenada de canvas do PSD.
- **Travas de ar.** Primeiro estado não anima; PLAY com a peça no ar não re-anima;
  timeline de entrada reseta o estado inicial dos filhos.
- **Comentar o porquê**, principalmente onde o código parece errado.

## Instalando

```bash
git clone git@github.com:tavinho3c/nodecg-skill.git ~/.claude/skills/nodecg
```

Ou como skill de projeto, em `.claude/skills/nodecg/`.
