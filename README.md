# Unbound

Plataforma de comunicação self-hosted (servidores, canais, voz, texto) para grupos pequenos de amigos.

> Renomeado de "MaselView" para "Unbound" após a Etapa 11. Identificadores internos (nome dos pacotes npm, usuário/banco do Postgres, nomes dos containers Docker) continuam como "maselview" — trocar isso implicaria recriar o volume do Postgres e perder os dados de teste, então só o nome/marca voltado pro usuário foi alterado.

Monorepo (pnpm workspaces):

```text
apps/
├── web     — React + Vite + Tailwind
└── api     — NestJS + Prisma + PostgreSQL + Redis + WebSocket
```

## Rodando tudo com Docker (recomendado pra testar)

Sobe Postgres, Redis, backend e frontend com um comando só — bom pra testar interação entre usuários sem precisar de Node instalado localmente. As migrations do Prisma rodam sozinhas toda vez que o backend inicia.

```bash
cp apps/api/.env.example apps/api/.env
docker compose up -d --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000 (`curl http://localhost:3000/health` pra conferir)

Esses containers **não têm hot-reload** — são um build de produção (`vite build` + `vite preview` pro frontend, `nest build` + `node dist/main` pro backend). Depois de alterar código, suba de novo com `docker compose up -d --build backend` (ou `frontend`) pra reconstruir só o que mudou. Pra editar código ativamente com hot-reload, use a Opção 2 abaixo.

`docker compose down` para tudo e mantém os dados (volumes do Postgres/Redis); `docker compose down -v` também apaga os dados.

## Rodando em desenvolvimento local (Opção 2, com hot-reload)

### Pré-requisitos

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Docker Desktop (só para Postgres e Redis nesse modo)

### Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up          # sobe só Postgres e Redis
pnpm db:migrate      # aplica as migrations do Prisma
```

### Rodando

Em terminais separados:

```bash
pnpm dev        # frontend em http://localhost:5173
pnpm dev:api    # backend em http://localhost:3000
```

Verificar se a API está de pé e conectada ao banco/Redis:

```bash
curl http://localhost:3000/health
```

**Atenção**: os containers `backend`/`frontend` do Docker escutam nas mesmas portas (3000/5173) — não rode os dois modos ao mesmo tempo (`docker compose stop backend frontend` antes de usar `pnpm dev`/`pnpm dev:api`, ou vice-versa).

## Scripts úteis

| Comando | Descrição |
|---|---|
| `pnpm dev` | inicia o frontend localmente |
| `pnpm dev:api` | inicia o backend localmente em modo watch |
| `pnpm build` / `pnpm build:api` | build de produção |
| `pnpm lint` / `pnpm lint:api` | lint |
| `pnpm db:up` / `pnpm db:down` | sobe/derruba Postgres e Redis (só esses dois) |
| `pnpm db:migrate` | roda `prisma migrate dev` |
| `docker compose up -d --build` | sobe a stack inteira (Postgres, Redis, backend, frontend) |
| `docker compose logs -f backend` / `frontend` | acompanha os logs de um serviço |
| `docker compose down` | derruba tudo, mantém os dados |
| `pnpm desktop:dev` | abre o aplicativo desktop (Tauri) com hot-reload |
| `pnpm desktop:build` | gera o instalador `.msi`/`.exe` em `apps/web/src-tauri/target/release/bundle/` |

Pra `desktop:dev`/`desktop:build`, também precisa de [Rust](https://rustup.rs/) e, no Windows, das [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (workload "Desenvolvimento para desktop com C++") — só pra quem for empacotar o app nativo, não é necessário pra rodar via navegador ou Docker.

## Autenticação (Etapa 2)

- Registro, login (por usuário ou e-mail), logout, JWT de acesso (15 min) + refresh token (7 dias, cookie httpOnly, rotacionado e revogável via Redis).
- Sessão sobrevive a um refresh de página (`/auth/refresh` é chamado no boot do app).
- Rotas `/app/*` são protegidas de verdade: sem sessão válida, redireciona para `/login`.

## Servidores (Etapa 3)

- `POST /servers` (criar), `GET /servers` (listar os meus), `GET /servers/:id`, `POST /servers/:id/join`, `POST /servers/:id/leave`, `DELETE /servers/:id`, `GET /servers/:id/members`, `PATCH /servers/:id/members/:userId/role`, `DELETE /servers/:id/members/:userId` (kick).
- Sistema de permissões por role (`OWNER`/`ADMIN`/`MODERATOR`/`MEMBER`) em `apps/api/src/common/permissions.ts` — o dono não pode sair (precisa excluir o servidor), só quem tem `MANAGE_MEMBERS` pode promover/expulsar, e ninguém mexe no dono.
- **Importante**: os 3 servidores de demonstração ("Turma do Lucas" etc.) continuam sendo conteúdo local mockado, para mostrar a UI de chat/voz que ainda não tem backend (Etapa 5). Servidores criados pela UI agora são de verdade — persistem no Postgres, sobrevivem a um refresh, têm membros reais. A tela de convite/entrar em servidor por código ainda é só visual (isso é a Etapa 6, quando o sistema de convites for implementado); por enquanto "entrar" é só plumbing testado via API.

## Canais (Etapa 4)

- `GET/POST /servers/:id/categories`, `PATCH .../categories/:categoryId`, `DELETE .../categories/:categoryId`, `PATCH .../categories/reorder`.
- `GET/POST /servers/:id/channels`, `PATCH .../channels/:channelId`, `DELETE .../channels/:channelId`, `PATCH .../channels/reorder`.
- Criar/editar/excluir exige a permissão `MANAGE_CHANNELS` (OWNER/ADMIN/MODERATOR). Canais criados dentro de um servidor **real** agora persistem no Postgres; os 3 servidores de demonstração continuam com canais locais mockados.

## Configurações e moderação de servidor

- Painel de configurações do servidor (visível só para o dono, pelo menu "..." → "Configurações do servidor"): renomear, trocar descrição/cor, gerenciar membros (promover/rebaixar/remover), banir/desbanir, e **excluir o servidor com confirmação de senha** (`DELETE /servers/:id` valida a senha do dono via bcrypt antes de apagar).
- Sistema de banimento (`server_bans` no banco): usuário banido é removido do servidor e barrado de reentrar (`POST /servers/:id/join` checa a lista de banidos).
- Corrigi um bug real no componente `Modal` compartilhado: como o `useEffect` de foco dependia da referência de `onClose` (que os formulários recriam a cada tecla digitada), o foco saía do campo de texto a cada letra digitada em **qualquer** modal do app. Agora o efeito só reage à abertura/fechamento do modal.
- Também corrigi o tamanho do modal de configurações: ele usava `className="max-w-2xl"` competindo com o `max-w-md` embutido no `Modal`, e o resultado dependia da ordem (não confiável) com que o Tailwind gera as classes. Agora o `Modal` tem uma prop `size` (`sm`/`md`/`lg`/`xl`) que aplica só uma classe de largura por vez.

## Chat em tempo real (Etapa 5)

- WebSocket (Socket.IO) autenticado por JWT (`apps/api/src/realtime`): eventos `channel:join`/`leave`, `message:create`/`update`/`delete`, `typing:start`/`stop`. Erros de permissão (ex: editar mensagem de outra pessoa) voltam pro cliente que causou a ação via um `WsExceptionFilter`, sem derrubar a conexão.
- Histórico paginado via REST (`GET /channels/:channelId/messages?before=<id>&limit=`), com "Carregar mensagens anteriores" na UI.
- Editar/excluir mensagem: autor pode editar/excluir a própria; excluir de mensagem alheia exige `MANAGE_CHANNELS`. Exclusão é soft-delete (`deletedAt`).
- Indicador de "digitando" via WebSocket, sem persistir no banco, com debounce de 2.5s no cliente.
- **Bug real encontrado e corrigido**: mensagens tinham só `createdAt` para ordenação; em rajadas muito rápidas (múltiplas criações no mesmo milissegundo) a ordem podia embaralhar, já que o Postgres não garante ordem estável em empates de `ORDER BY` sem uma coluna de desempate. Adicionei `sequence` (auto-incremento) ao modelo `Message` e passei a ordenar/paginar por ela. Sob uso real (uma mensagem por vez, como qualquer humano digitando) a ordem sempre foi correta — o bug só aparecia num teste sintético de estresse.
- Testado com dois usuários reais em abas separadas: mensagem aparece em tempo real sem reload, indicador de digitação, edição e exclusão propagam para o outro usuário, e um usuário sem permissão que tenta apagar mensagem alheia recebe o erro certo.
- Servidores/canais de demonstração continuam com o chat mockado (sem WebSocket) — só canais dentro de servidores **reais** usam o chat de verdade.

## Amizades e convites (Etapa 6)

- `POST /friends/requests` (enviar por username), `GET /friends/requests` (lista `{incoming, outgoing}`), `POST /friends/requests/:id/accept`, `POST /friends/requests/:id/reject`, `DELETE /friends/requests/:id` (cancelar, só quem enviou), `GET /friends`, `DELETE /friends/:userId` (desfazer amizade).
- `POST /servers/:id/invites` (criar, exige `maxUses`/`expiresInDays` opcionais), `GET /servers/:id/invites` e `DELETE /servers/:id/invites/:inviteId` (listar/revogar, exigem `MANAGE_SERVER`), `GET /invites/:code` (preview público, não exige ser membro), `POST /invites/:code/join`.
- Qualquer membro do servidor pode gerar convites (não é uma permissão exclusiva de dono/moderador — o roadmap não lista "convidar" como uma permissão separada). Convite tem código aleatório (`randomBytes` + retry em colisão), pode expirar por data e/ou por número de usos, e usuário banido do servidor não consegue entrar mesmo com o link.
- Tela `/invite/:code`: mostra preview do servidor (nome, cor, descrição, nº de membros) antes de entrar; trata convite inválido/expirado/esgotado com mensagens específicas.
- Sistema de amizades agora é **de verdade** (sem mock): pedido de amizade, aceitar/recusar/cancelar, lista de amigos, remover amigo — tudo persistido no Postgres. A aba "Bloqueados" da tela de amigos continua honestamente vazia (bloquear/desbloquear não foi implementado — fora do escopo desta etapa).
- Testado de ponta a ponta com dois navegadores reais: pedido de amizade enviado por um usuário aparece pro outro, aceitar deixa os dois amigos (nas duas direções, inclusive após reload), criação de convite real para um servidor real, entrada por link de convite em outra conta e código inválido mostrando erro.

## Presença (Etapa 7)

- Estados: `ONLINE`, `IDLE`, `DO_NOT_DISTURB`, `INVISIBLE`, `OFFLINE`. Online/offline são derivados só da conexão WebSocket (não é possível "setar" OFFLINE manualmente); os outros três são escolhidos pelo usuário.
- Redis guarda o estado temporário (`presence:conns:{userId}` — o conjunto de sockets abertos, para suportar múltiplas abas/dispositivos sem marcar o usuário como offline até a **última** desconectar; `presence:status:{userId}` — status escolhido, limpo quando o usuário fica sem nenhuma conexão). O Postgres (`User.status`) guarda o último status conhecido, atualizado a cada conexão/desconexão/troca, e é o que os endpoints REST expõem.
- Eventos WebSocket (nomes literais do roadmap): `user:online`, `user:offline`, `user:status` — todos broadcast global (grupo pequeno de amigos, sem necessidade de escopar por servidor/amizade). Trocar o próprio status usa o evento `presence:set_status`.
- **Invisível** é mascarado como `OFFLINE` para todo mundo — em tempo real (WS) e em toda leitura REST que exponha outro usuário (lista de amigos, membros do servidor, autor de mensagem). Só o próprio usuário vê seu real status `INVISIBLE` (em `/auth/me` e nas respostas de login/registro/refresh). Isso é reforçado no backend (`maskInvisible` em `user.presenter.ts`), não só escondido na UI.
- Detecção de ausência (`IDLE`) é automática no frontend: depois de 5 minutos sem mouse/teclado, o cliente troca pra "Ausente" sozinho; qualquer atividade volta pra "Ativo" — mas só se a mudança tiver sido automática. Se o usuário escolheu manualmente "Não perturbe" ou "Invisível", a detecção de ausência nunca sobrescreve a escolha.
- Seletor de status na barra do usuário (menu "..." em cima do nome): Ativo / Ausente / Não perturbe / Invisível, além de Perfil/Configurações/Sair já existentes.
- Status ao vivo aparece na lista de membros do servidor e na lista de amigos sem precisar recarregar a página (stores escutam os eventos de presença e atualizam os usuários já carregados).
- Testado via script direto no WebSocket (multi-aba não derruba o status até a última conexão fechar, status inválido é rejeitado, invisível nunca vaza o valor real) e via navegador (dois usuários reais, troca de status ao vivo, invisível não aparece na aba "Online" do outro usuário).

## Salas de voz e vídeo (Etapa 8)

- WebRTC em malha (mesh): cada participante se conecta diretamente a todos os outros da mesma sala; o backend nunca vê o áudio/vídeo, só faz o signaling (troca de SDP/ICE). Isso segue a Regra 5 do roadmap (nada de SFU ainda), mas mantém o "quem entrou, quem saiu, quem está em qual sala" isolado no backend (`VoiceService`) — trocar para um SFU depois significaria só mudar como o frontend conecta a mídia, não o contrato de sinalização.
- `VoiceService` (`apps/api/src/voice/`) guarda o roster das salas de voz **em memória** (não Redis): como os sockets já são locais a este processo Node e o app é single-instance, não há necessidade de compartilhar esse estado em Redis — ele nasce e morre com os próprios sockets.
- Eventos WebSocket: `voice:join` (com ack retornando os participantes já presentes na sala, pra quem está entrando saber com quem negociar), `voice:leave`, `voice:signal` (relay de offer/answer/ICE candidate para um `targetUserId` específico) e `voice:mic_state` (indicador de mudo, efêmero, não persiste). Entrar exige a permissão `CONNECT_VOICE` e que o canal seja do tipo `VOICE`. `voice:signal`/`voice:mic_state` validam que quem está mandando realmente está naquela sala, senão rejeita — não dá pra mandar sinal WebRTC pra alguém fora da sala compartilhada.
- Convenção de quem inicia a oferta SDP: sempre quem está **entrando** na sala, para cada participante que já estava lá — evita a ambiguidade de "quem oferece primeiro" (glare) sem precisar de um protocolo de negociação mais complexo.
- Microfone e câmera são reais (`getUserMedia`), com fallback tratado (toast de erro se o navegador negar acesso). A câmera só pega a track de vídeo na primeira vez que é ativada (renegociação via `onnegotiationneeded`); depois disso ligar/desligar é só um `track.enabled`, sem renegociar de novo.
- Detecção de "quem está falando" é real (Web Audio API, `AnalyserNode` no áudio local e de cada remoto), substituindo o simulador aleatório que existia nos canais mockados — que continua existindo, mas só nos 3 servidores de demonstração (nunca mais roda enquanto você estiver numa chamada de verdade).
- Estado de conexão por participante (`RTCPeerConnectionState`) aparece como "conectando..." até a conexão P2P fechar; se falhar, tenta `restartIce()` uma vez. Reconexão do WebSocket (ex: perda de rede) refaz o join da sala de voz automaticamente se você ainda estava conectado nela.
- Compartilhamento de tela ficou de fora de propósito nesta etapa — o botão existia na UI mas desabilitado com "em breve" (isso era a Etapa 9, pela Regra 1: não implementar funcionalidades futuras antes da hora). Já implementado agora, veja abaixo.
- **Bug real encontrado e corrigido durante o teste desta etapa**: depois de um reload completo da página (não só troca de rota), o próprio status de presença do usuário podia ficar preso em "Offline" na barra do usuário, mesmo já reconectado — o app tinha parado de escutar `user:status` pra si mesmo pra evitar um bug diferente (vazar o valor real de "Invisível" pra você mesmo). Corrigido ignorando especificamente broadcasts de status `OFFLINE` nesse listener: todo outro valor (`ONLINE`/`IDLE`/`DO_NOT_DISTURB`) atualiza normalmente, e `OFFLINE` nunca precisa ser aplicado à sua própria aba ativa de qualquer forma.
- Testado via script direto no WebSocket (entrar exige permissão e o canal precisa ser de voz, sinalização só é repassada entre participantes da mesma sala, desconexão limpa a sala automaticamente) e via navegador com dois usuários reais e dispositivos de mídia falsos do Chromium (entrar, ver o outro participante, conexão P2P chegando a "conectado", mutar e o outro ver o indicador, sair e o outro ver o participante sumir do grid e da lista lateral).

## Compartilhamento de tela (Etapa 9)

- Usa `navigator.mediaDevices.getDisplayMedia()` puro — a escolha entre "Tela inteira", "Janela" ou "Aba" é o seletor nativo do próprio navegador, não precisei construir UI nenhuma pra isso (o browser já resolve exatamente o que o roadmap pedia).
- Tecnicamente é só mais uma track de vídeo (e opcionalmente áudio) adicionada às conexões WebRTC de voz já existentes — reaproveita 100% do signaling da Etapa 8 (`voice:signal`, `onnegotiationneeded`), sem nenhum novo tipo de conexão. Um evento leve adicional, `voice:screen_share {sharing}`, avisa a sala (só quem já está na chamada, não é global) quando alguém começa/para de compartilhar, pra UI saber exibir "Fulano está compartilhando a tela" e distinguir esse stream do stream normal de câmera/microfone do mesmo participante.
- No receptor, o primeiro stream que chega de um participante é sempre tratado como o principal (câmera/mic); qualquer stream *adicional* que apareça depois é automaticamente o compartilhamento de tela — a ordem é garantida porque a track de tela só é adicionada depois que a conexão de voz já existe.
- A tela compartilhada aparece em destaque (bem maior que os quadrados de participantes) com um botão "Parar compartilhamento" — só visível pra quem está compartilhando. Parar o compartilhamento pela barra de controles OU pelo próprio painel nativo "Parar compartilhamento" do navegador (que dispara o evento `ended` da track) funcionam igual.
- Testado com dois usuários reais e captura de tela falsa do Chromium: A compartilha e vê a própria tela em destaque, B vê a tela de A aparecer ao vivo (frames reais chegando pela conexão P2P, não um mock), A para e some dos dois lados, e o inverso (B compartilhando, A vendo) também funciona — não é uma via de mão única.

## Preview de links (Etapa 10)

- Detecção automática: a primeira URL `http(s)://` encontrada no texto de uma mensagem dispara a geração de preview — só a primeira, não uma por link (evita spam visual e mantém simples).
- A mensagem é enviada e aparece **instantaneamente**, sem esperar o preview. A busca do preview acontece em segundo plano (fire-and-forget no `RealtimeGateway`, sem bloquear o `message:create`) e, quando pronta, chega via o mesmo evento `message:update` que já existia pra edição — o frontend não precisou de nenhum evento novo, só ganhou dados a mais no mesmo fluxo.
- **A busca é sempre feita pelo backend**, nunca pelo navegador de quem está vendo a mensagem — o frontend só recebe o resultado já processado (título, descrição, nome do site, domínio), nunca faz `fetch` de uma URL enviada por outro usuário.
- **Proteção contra SSRF** (`LinkPreviewService.assertSafeUrl`): bloqueia esquemas que não sejam `http`/`https`, URLs com credenciais embutidas, `localhost`, e resolve o DNS do host pra checar se o IP retornado cai em faixa privada/loopback/link-local (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, equivalentes IPv6 como `::1`/`fc00::/7`/`fe80::/10`, multicast/reservado) — tanto no host inicial quanto em cada redirecionamento seguido manualmente (até 3 saltos, cada um revalidado do zero). Isso cobre a grande maioria dos ataques SSRF reais (painéis internos, metadata de nuvem, serviços em loopback); pinning de IP contra DNS-rebinding não foi implementado — desproporcional pra um app self-hosted de grupo pequeno de amigos, não uma SaaS multi-tenant pública.
- Também rejeita: conteúdo cujo `content-type` não seja `text/html` (não tenta "prévia" de APIs JSON, PDFs, etc.), respostas maiores que 1MB (corta a leitura no meio, ou nem começa se o `Content-Length` já denunciar isso), e tempo de busca acima de 5s.
- **Cache no Redis** por hash da URL: sucesso fica 24h, falha fica só 10min (pra não martelar repetidamente um link quebrado, mas também não travar permanentemente algo que só estava fora do ar por um instante). O link já cacheado por uma mensagem beneficia instantaneamente qualquer outra mensagem (de qualquer canal/usuário) que cole a mesma URL depois.
- O preview vira uma **foto instantânea** guardada na própria mensagem (`Message.linkPreview`, `jsonb`), não uma busca ao vivo toda vez que a mensagem é exibida — histórico recarregado meses depois mostra o mesmo preview de quando foi enviado, sem nova requisição. Editar a mensagem pra remover a URL limpa o preview; editar mudando a URL gera um preview novo.
- Extração de metadata via regex direcionado nas tags `<meta property="og:*">`/`<meta name="description">`/`<title>` — sem adicionar nenhuma dependência de parser HTML (Regra 8), proporcional a precisar ler só um punhado de tags conhecidas, não a árvore DOM inteira.
- Testado com sites reais: página mínima sem tags OG (usa `<title>` + hostname como fallback), página rica em OG tags (título/descrição/nome do site extraídos corretamente), endpoint JSON (corretamente rejeitado), e link apontando pro próprio `127.0.0.1` do servidor (corretamente bloqueado, nenhum preview gerado). Também testado na UI: mensagem aparece na hora, preview "pisca" (pop-in) alguns instantes depois, e sobrevive a um reload da página.

## Remoção dos servidores de demonstração

Desde a Etapa 3, o frontend mantinha 3 servidores mockados ("Turma do Lucas", "Rocket League BR", "Projeto TCC") como conteúdo local fixo, sempre presentes pra toda conta — um resquício da fase inicial (`frontend.mp`), quando ainda não existia backend e a UI precisava de algo pra mostrar. Cada etapa seguinte foi implementando a versão real de cada funcionalidade só para servidores criados pela UI (`source: "api"`), preservando os 3 mockados intocados como vitrine.

Isso virou um problema real de UX: os servidores mockados eram visualmente idênticos aos reais (mesmo ícone, mesma navegação, nada os distinguindo), mas chat, convites e compartilhamento de tela neles nunca tocavam o backend — mensagens digitadas lá somem em qualquer reload, e um código de convite gerado ali (6 caracteres) nunca foi um convite de verdade (convites reais têm 10 caracteres hexadecimais). Um usuário testando a aplicação não tinha como saber que estava em conteúdo de demonstração até esbarrar num desses comportamentos.

Com o backend agora cobrindo tudo (Etapas 2–10), os 3 servidores mockados foram **removidos por completo**, junto com todo o branching `source: "mock" | "api"` espalhado pelo código (chat, convites, controles de voz, membros). O campo `source` saiu do tipo `Server` no frontend — não existe mais distinção entre servidor "de verdade" e "de mentira", porque agora só existe um tipo de servidor. Contas novas começam com a lista de servidores vazia, como um app de verdade.

## Sincronização em tempo real de canais e categorias

Criar/editar/excluir/reordenar um canal ou categoria agora avisa em tempo real todo mundo que já está com o servidor aberto, não só quem fez a ação — antes disso, só chat, presença e voz tinham broadcast via WebSocket. `ChannelsService` ganhou um `RealtimeEmitterService` (um canal de saída pra WS a partir de código REST, sem depender diretamente do `RealtimeGateway` — evita dependência circular entre módulos: o `RealtimeGateway` entrega a instância viva do `Server` do Socket.IO pra esse serviço assim que inicializa, e qualquer serviço REST pode injetá-lo e emitir) e emite `channel:create`/`update`/`delete`/`reorder` e `category:create`/`update`/`delete`/`reorder` — mesmo padrão de nomenclatura já usado em `message:*`.

**Bug real encontrado e corrigido nesse processo**: o cliente que cria um canal já adicionava o canal no estado local a partir da própria resposta REST, sem checar se ele já estava lá. Isso sempre foi seguro — até esse broadcast existir. Agora o broadcast pode chegar antes OU depois da resposta REST (o servidor emite o evento assim que grava no banco, o que pode ser mais rápido que a própria resposta HTTP terminar de voltar pro mesmo cliente que pediu a criação), e sem checagem de duplicata dos dois lados, o canal podia entrar duas vezes na lista — o React acusava `Encountered two children with the same key`. Corrigido fazendo o caminho da resposta REST checar duplicata do mesmo jeito que o listener do WebSocket já fazia.

## Aplicativo desktop (Etapa 11)

- Tauri 2 empacotado dentro de `apps/web` (pasta `src-tauri/`) — reaproveita 100% do frontend React já existente, sem nenhuma segunda interface: a janela desktop é literalmente o mesmo `apps/web/dist` rodando dentro de um WebView2 nativo, falando com a mesma API REST/WebSocket. Nada foi duplicado.
- **Rodar em desenvolvimento**: `pnpm desktop:dev` (ou `pnpm --filter @maselview/web tauri dev`) — abre uma janela nativa com hot-reload (usa o servidor Vite por baixo, igual ao `pnpm dev` do navegador).
- **Gerar o instalador**: `pnpm desktop:build` — produz um `.msi` e um `.exe` (NSIS) em `apps/web/src-tauri/target/release/bundle/`, prontos pra instalar como qualquer programa Windows. O build de produção do frontend (`vite build`) fica embutido no instalador; não precisa do Vite rodando depois de instalado.
- **Persistência de sessão**: funciona pelo mesmo mecanismo já existente (cookie httpOnly de refresh token) — o WebView2 mantém cookies entre execuções como um navegador de verdade, então fechar e abrir o app de novo mantém o login.
- **Notificações nativas**: `tauri-plugin-notification`, com um helper (`lib/desktop.ts`) que vira no-op fora do Tauri (mesmo código funciona no navegador normal). Dispara uma notificação do sistema operacional quando chega uma mensagem nova de outra pessoa e a janela está em segundo plano (`document.hidden`) — não notifica mensagem própria, nem quando você já está olhando a conversa.
- **CORS ajustado pro desktop**: o build de produção do Tauri é servido de uma origem fixa e especial (`tauri://localhost`/`https://tauri.localhost`), diferente do `http://localhost:5173` usado em desenvolvimento. `resolveAllowedOrigins()` (novo, em `apps/api/src/common/cors.ts`) sempre permite essas origens do Tauri além do que estiver configurado em `FRONTEND_URL` — sem isso, o instalador funcionaria em desenvolvimento mas quebraria (CORS) depois de instalado.
- **Bug real encontrado e corrigido**: o watcher de arquivos do Vite tentava vigiar `src-tauri/target` (onde o Rust escreve os binários compilados) e travava com `EBUSY` no Windows quando o `cargo build` tinha um arquivo aberto no mesmo instante. Corrigido excluindo `src-tauri` do watcher (`vite.config.ts`).
- Toolchain necessário (Rust + MSVC Build Tools) instalado e testado do zero nesta máquina — primeira compilação Rust leva alguns minutos (~430 crates), builds seguintes são incrementais e rápidos (~20-45s).
- Testado de ponta a ponta: janela abre, carrega o app de verdade (confirmado via conexão ativa ao servidor Vite, não uma captura de tela — evitando expor a área de trabalho real do usuário), instalador `.msi`/`.exe` gerado e funcional.

## Estado atual

- **Frontend**: UI navegável com autenticação, servidores, canais, chat em tempo real com preview de links, amizades, convites, presença, salas de voz/vídeo e compartilhamento de tela reais (WebRTC), além de um painel completo de configurações/moderação de servidor. Sem conteúdo mockado — tudo que aparece na UI é dado real, persistido no backend. Roda tanto no navegador quanto como aplicativo desktop nativo (Tauri).
- **Backend**: NestJS conectado a PostgreSQL (Prisma) e Redis. Schema migrado (`users`, `servers`, `server_members`, `channel_categories`, `channels`, `messages`, `friendships`, `invitations`, `server_bans`). Módulos completos: autenticação (`/auth/*`), servidores (`/servers/*`), canais (`/servers/:id/channels`, `/servers/:id/categories`), mensagens (`/channels/:id/messages`), amizades (`/friends/*`), convites (`/servers/:id/invites`, `/invites/*`), presença (Redis + `RealtimeGateway`), voz/vídeo/tela via WebRTC (`VoiceService` + `RealtimeGateway`, signaling apenas — mídia nunca passa pelo servidor), preview de links (`LinkPreviewService`, Redis + Postgres, com proteção SSRF) e WebSocket (`RealtimeGateway`).
- **Todas as etapas do `roadmap.mp` estão implementadas** (Etapa 1 a 11). Próximos passos seriam itens fora do roadmap original ou refinamentos (ex: SFU pra voz em grupos maiores, upload de arquivos) — nenhum planejado até serem pedidos.
