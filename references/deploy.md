# Pôr a instalação no ar

Leia quando o NodeCG precisar sair do laptop — servidor, container, domínio. Não é
sobre um gráfico: é sobre a **instalação inteira** (o NodeCG + os bundles + o `cfg/`)
virando um serviço que reinicia sozinho.

O contexto que muda tudo em relação ao `npm start` local: **em produção o painel é
uma URL pública e as browser sources apontam pra ela.** Todo redeploy é a peça saindo
do ar por alguns minutos, e todo dado que não estiver num volume some.

## O formato: um repo com a instalação inteira

Não é o bundle que vai pro deploy, é a **pasta do NodeCG**. Bundle sozinho não sobe:
ele não tem servidor. O repo leva `dist/`, `schemas/`, `src/`, `types/`, `index.js`,
`cfg/` e `bundles/`, mais o `Dockerfile` e o `docker-compose.yaml`.

**Versione o `dist/`.** Ele é o build oficial do pacote `nodecg`, não código seu — e
buildar no container obrigaria a instalar as devDependencies, **inclusive o
puppeteer, que baixa um Chromium**. Sem etapa de build, o Dockerfile é só
`npm ci --omit=dev`.

### O que fica de fora

`node_modules`, `db/`, `logs/`, `assets/` — e os fontes pesados de arte (PSD, `.mov`
de matte). Uma pasta `refs/` com 3 PSDs dá 88 MB: não entra no repo nem no contexto
de build, e não serve pra nada em produção.

## 🚨 O `.gitignore` que o gerador de bundle deixa

O bundle saído do `yo nodecg` vem com um `.gitignore` que tem:

```
/dashboard
/graphics
/extension
```

No template esses três são **saída de build**. Num bundle escrito à mão eles são a
**fonte**. Se você não apagar essas linhas, o `git add` ignora os gráficos e os
painéis inteiros, o push passa, **a imagem builda limpa** e só o servidor no ar
revela que o bundle não tem peça nenhuma. Confira com `git status --short` antes do
primeiro commit — os arquivos do bundle têm que aparecer.

⚠️ **Repos embutidos.** Um `bundles/<nome>/.git` deixado por um `git init` antigo faz
o git de fora tratar a pasta como submódulo, e o clone do deploy vem vazio. Se ele
não tem commit nem remote, apague; se tem (o caso das skills em `bundles/.claude/`),
mande pro `.gitignore` do repo de fora.

## Dockerfile

```dockerfile
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json index.js ./
COPY dist ./dist
COPY schemas ./schemas
COPY src ./src
COPY types ./types
COPY cfg ./cfg
COPY bundles ./bundles
RUN mkdir -p db assets logs && chown -R node:node /app
USER node
EXPOSE 9090
CMD ["node", "index.js"]
```

**Sem toolchain de compilação.** O `better-sqlite3` (que vem pelo adapter de banco do
NodeCG) é módulo nativo, e a tentação é instalar `python3 make g++` "por garantia".
O `apt-get` custa **~7 min em todo deploy** e nunca é usado: a 12.11.1
publica prebuild `node-v127` (Node 22) `linux-x64`. Confira que o prebuild da versão
que você tem existe (release do WiseLibs/better-sqlite3, procure `node-v<ABI>-<os>-<arch>`)
e deixe o toolchain fora. Se sumir um dia, o `npm ci` quebra alto — não em silêncio.

⚠️ **`mkdir` + `chown` antes do primeiro `up` não é higiene, é requisito.** O Docker
copia a permissão do diretório **da imagem** ao criar o volume nomeado. Com o
container rodando como `node` e a pasta nascendo do root, o sqlite não abre pra
escrita.

## docker-compose

```yaml
services:
  nodecg:
    build: { context: ., dockerfile: Dockerfile }
    restart: unless-stopped
    init: true
    volumes:
      - nodecg-db:/app/db          # replicants persistentes
      - nodecg-assets:/app/assets  # uploads do dashboard
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:9090/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 40s

volumes:
  nodecg-db:
  nodecg-assets:
```

**Os dois volumes são o estado do programa.** `db/nodecg.sqlite3` guarda todo
replicant `persistent: true` — times, canais, placar, o que o operador configurou. Se
não for volume, cada redeploy devolve o painel em branco.

**O banco de produção nasce vazio.** O `db/` do laptop não vai na imagem (e não
deveria). Depois do primeiro deploy alguém tem que **reconfigurar tudo pelo dashboard
de produção**. Planeje isso antes de uma transmissão, não durante.

Healthcheck com `node -e` porque a imagem `slim` não tem `curl` nem `wget`.

## 🚨 `host: "127.0.0.1"` no cfg = container de pé e domínio em 404

O erro é difícil de achar porque **o healthcheck passa**. Um
`cfg/nodecg.json` com `"host": "127.0.0.1"` é o certo no laptop e o errado dentro
de um container: ligado só ao loopback, o processo não aceita conexão de fora, e
o Traefik não conecta. Mas o healthcheck do compose bate em `127.0.0.1` **de
dentro** do container e responde 200 — então o Coolify mostra `healthy`, o
domínio responde 404, e não há uma linha de log em lugar nenhum.

Use `cfg/nodecg.js` lendo `NODECG_HOST` (ver abaixo) com default `127.0.0.1`, e
passe `NODECG_HOST=0.0.0.0` no `environment` do compose. O mesmo repo serve os
dois sem troca manual.

**Apague o `.json` ao criar o `.js`.** Com os dois na pasta, qual vence depende
da ordem de busca do cosmiconfig.

## `cfg/nodecg.js`: config que lê o ambiente

O loader do NodeCG usa cosmiconfig e aceita `cfg/nodecg.js` (CommonJS) além do
`.json` — é assim que a config vira função do ambiente sem hardcode no repo:

```js
const config = { host: "0.0.0.0", port: Number(process.env.NODECG_PORT ?? 9090) };

if (process.env.NODECG_LOGIN_USER && process.env.NODECG_LOGIN_PASSWORD) {
  config.login = {
    enabled: true,
    sessionSecret: process.env.NODECG_SESSION_SECRET ?? require("node:crypto").randomBytes(32).toString("hex"),
    local: { enabled: true, allowedUsers: [{ username: ..., password: ... }] },
  };
}

module.exports = config;
```

⚠️ **Não escreva `sentry: {}` achando que desliga.** No schema o objeto externo tem
default `{enabled:false}`, mas o `enabled` de dentro tem default **`true`** — então
`{}` liga o Sentry e o refine exige `dsn`, e o servidor **não sobe**. Desligado é
*omitir a chave*.

⚠️ **`baseURL` quase não faz nada.** Apesar do texto do schema ("se você usa reverse
proxy, provavelmente vai precisar"), no código ele só alimenta uma tag do Sentry e as
callback URLs de OAuth (Steam/Twitch/Discord). Atrás de Traefik/nginx, sem OAuth, não
precisa setar — e se setar, é **host sem esquema** (`exemplo.com`), senão o log sai
`http://https://exemplo.com`.

### 🚨 Login liga, e o vMix quebra

Sem `login.enabled`, **dashboard e gráficos ficam abertos na internet** — qualquer um
com a URL muda o placar no ar. Com login ligado, o NodeCG protege **também os
gráficos**, e a browser source do vMix passa a precisar de `?key=<token>` (o token
aparece no dashboard depois do login).

Não é uma decisão de segurança pura, é de operação: ligar login **no meio de uma
transmissão troca todas as URLs de browser source**. Decida antes, com o operador —
e se ligar depois, refaça as sources com o cliente parado.

## Coolify (build pack `dockercompose`)

Armadilhas, todas com o mesmo sintoma — **container de pé e 404 no domínio,
sem nada no log**:

**`SERVICE_FQDN_<SERVICO>_<PORTA>` não funciona em aplicação.** Essa variável mágica
é de recurso do tipo *Service*. Numa aplicação `dockercompose` o parser engole a
variável, grava `SERVICE_NAME_*` no lugar e o serviço sai **sem nenhuma label do
Traefik**. Não erra, não avisa.

**Domínio de app compose é `docker_compose_domains`.** A API recusa o campo `domains`
com mensagem explícita, e o `docker_compose_domains` só aceita **array** no PATCH,
apesar de guardar como objeto:

```bash
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"docker_compose_domains":[{"name":"nodecg","domain":"https://painel.exemplo.com"}]}' \
  "$COOLIFY/api/v1/applications/<uuid>"
```

(`name` é o nome do **serviço** no compose, não o do app.)

**Coolify não move aplicação entre servidores.** Não há campo de destino no
`update_application`: trocar de servidor é **deletar e recriar** o recurso — e refazer
o registro DNS, porque o IP muda.

**`docker_compose_location` tem que bater com o NOME DO ARQUIVO.** O default é
`/docker-compose.yaml`. Um repo com `compose.yml` (o nome moderno) builda e sobe
sem achar serviço nenhum. Passe `"docker_compose_location": "/compose.yml"` no
create ou no PATCH.

**`ports_exposes` nasce `80` e o create IGNORA o que você mandar.** Confira
depois de criar e corrija por PATCH para a porta real (9090), senão o Traefik
roteia para uma porta onde nada escuta. O mesmo sintoma de sempre: container de
pé, 404 no domínio.

**Não existe `/api/v1/sources`.** Para criar app de repo privado você precisa do
`github_app_uuid`, e o endpoint que lista é **`/api/v1/github-apps`** (404 em
`/sources`, `/security/github-apps`, `/private-github-apps`). O campo
`source_id` que vem no GET de uma aplicação existente é o **id numérico**, não o
uuid — case o id na lista para achar o uuid. Jeito rápido de acertar tudo de uma
vez: **leia um app irmão que já funciona** (`GET /api/v1/applications/<uuid>`) e
copie `destination_id`, `environment_id`, `source_id` e o formato do domínio.

**`github_app_uuid` errado devolve 404 "Github App not found"**, não erro de
validação — então um uuid inventado parece problema de permissão.

**Domínio novo precisa de registro DNS próprio se não houver wildcard.** Teste
antes de prometer a URL: resolva um subdomínio que não existe
(`zzz-qualquer.seudominio.com`). Se der `ENODATA`, cada subdomínio tem registro A
manual e você não vai conseguir criar o seu. O `<uuid>.<ip>.sslip.io` que o
Coolify devolve no create funciona na hora, sem DNS — sobe com ele e troque
depois, em vez de entregar um domínio que não resolve.

**`is_auto_deploy_enabled` não volta no GET.** A API aceita no PATCH e não devolve na
leitura, então o estado só se audita pela UI. Cave isso explicitamente em vez de
supor: com auto-deploy ligado, **todo push na branch reconstrói e reinicia** — em
transmissão, é a peça saindo do ar por alguns minutos por causa de um commit de
CSS.

## Checklist do primeiro deploy

1. `git status --short` mostra os arquivos do bundle? (senão, é o `.gitignore` do
   template — veja acima)
2. Nenhum `.git` embutido dentro de `bundles/`?
3. `dist/` versionado e `node_modules`/`db`/`logs`/`assets` ignorados?
4. Volume pro `db/` **e** pro `assets/`, com `chown` no Dockerfile?
5. Depois que subir, bata nos três: `/dashboard/`, **um gráfico real**, e a rota que
   o switcher consome (`/score`, o que for). Container "healthy" não prova que o
   bundle carregou.
6. Confira o log do container: o NodeCG imprime `Mounted <bundle> extension` e o que
   a sua extension logar no boot. Sem essa linha, o bundle não entrou.
7. O banco nasceu vazio — reconfigure o painel de produção antes do ensaio.
