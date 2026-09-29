# nodecg — skill do Claude Code

Um **builder de esqueleto** para grafismo em **bundles NodeCG de broadcast ao
vivo**: onde o estado mora, como o arquivo se organiza, como a peça entra e sai do
ar, como o operador controla. Agnóstico de temática — cor, fonte e tipo de peça
vêm do projeto; a estrutura é a mesma em todos.

O ponto de partida é [`SKILL.md`](SKILL.md). O resto carrega sob demanda:

| Documento | Quando |
|---|---|
| `assets/grafico-modelo.html` | esqueleto de gráfico novo (GSAP, travas de ar) |
| `assets/painel-modelo.html` | esqueleto de painel de dashboard |
| `references/animacao-gsap.md` | timelines de entrada/saída, replay-safety, catálogo |
| `references/dashboard-ui.md` | classes do design system dos painéis |
| `references/padroes-replicant.md` | 8 padrões de estado com código |
| `references/vmix.md` | ponte HTTP com o vMix, migração CasparCG |
| `references/casparcg.md` | playout em CasparCG: camadas, AMCP, mídia/fontes, template CG, OSC, teste no servidor (+ `assets/caspar-*.js`, `scripts/caspar.js`) |
| `references/drive-to-graphics.md` | subskill: as demandas do projeto no Google Drive → pastas do bundle |
| `references/psd-to-html/tipos-de-peca.md` | o que é lower third, fullscreen, in-game e bug; área de interesse; layerização |
| `references/psd-to-html/` | subskill: PSD → plates + manifesto → HTML |
| `references/psd-to-html/png-analysis.md` | quando só existe o PNG achatado: medir, olhar, descrever |
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

O repo é seu próprio marketplace de plugin do Claude Code:

```bash
claude plugin marketplace add tavinho3c/nodecg-skills
```

```bash
claude plugin install nodecg@nodecg-skills
```

Sem flag, a instalação é por máquina. Para que quem clonar um projeto NodeCG já
receba a skill, rode o `install` com `-s project` a partir da raiz do projeto — fica
registrado no `.claude/settings.json` dele.

Para atualizar depois de um push: `claude plugin update nodecg`, e reinicie a sessão.

O repo é privado, então quem for instalar precisa de acesso a ele.

<details>
<summary>Sem plugin, por clone manual</summary>

```bash
git clone git@github.com:tavinho3c/nodecg-skills.git ~/.claude/skills/nodecg
```

Funciona, mas não tem update, versão nem escopo de projeto. E não misture as duas
formas: o plugin vive em `~/.claude/plugins/cache/`, então uma cópia em
`~/.claude/skills/` faz a skill carregar duas vezes.
</details>
