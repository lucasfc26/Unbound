# Plataforma de Comunicação Self-Hosted — Especificação para Desenvolvimento

## 1. Objetivo

Construir uma plataforma privada de comunicação em tempo real, inspirada no Discord, destinada inicialmente a um grupo pequeno de amigos.

A aplicação deverá ser **self-hosted**, executada em um servidor próprio/VPS, e possuir:

* Servidores/comunidades privadas
* Canais de texto
* Salas de voz
* Chamadas de vídeo
* Compartilhamento de tela
* Mensagens em tempo real
* Presença online/offline
* Status de usuário
* Compartilhamento de links com preview
* Sistema de amizades
* Convites para servidores
* Aplicativo desktop local
* Comunicação em tempo real utilizando WebSocket
* Comunicação de áudio/vídeo/tela utilizando WebRTC

### Importante

Nesta primeira versão **NÃO implementar**:

* Upload de imagens
* Upload de vídeos
* Upload de arquivos
* Armazenamento de anexos
* Sistema de CDN/storage

Essas funcionalidades poderão ser adicionadas posteriormente.

---

# 2. Stack obrigatória

## Frontend

Utilizar:

* React
* TypeScript
* Vite
* Tailwind CSS
* Zustand para gerenciamento de estado quando necessário
* React Router
* TanStack Query quando fizer sentido
* WebSocket/Socket.IO para comunicação em tempo real
* WebRTC para áudio, vídeo e compartilhamento de tela

Evitar adicionar bibliotecas desnecessárias.

---

# 3. Backend

Utilizar:

* NestJS
* TypeScript
* Prisma ORM
* PostgreSQL
* Redis
* WebSocket/Socket.IO
* JWT para autenticação

O backend deverá ser organizado em módulos independentes e escaláveis.

Estrutura conceitual:

```text
backend/
├── auth/
├── users/
├── friends/
├── servers/
├── channels/
├── messages/
├── invitations/
├── presence/
├── websocket/
├── webrtc/
└── common/
```

---

# 4. Desktop Application

Criar posteriormente uma aplicação desktop utilizando:

* Tauri
* React
* TypeScript

O aplicativo desktop deverá reutilizar a maior parte possível da aplicação React existente.

A arquitetura deve permitir:

```text
Web Browser
      │
      ▼
React Application

Desktop
      │
      ▼
Tauri
      │
      ▼
React Application
```

Não criar uma segunda interface completamente independente.

---

# 5. Arquitetura geral

A arquitetura deverá seguir:

```text
                    ┌──────────────────────┐
                    │      PostgreSQL      │
                    │                      │
                    │ Users                │
                    │ Servers              │
                    │ Channels             │
                    │ Messages             │
                    │ Friends              │
                    │ Invitations          │
                    └──────────▲───────────┘
                               │
                               │ Prisma
                               │
┌───────────────┐       ┌──────┴───────────┐
│               │       │                  │
│ React Web     │◄─────►│     NestJS       │
│               │       │                  │
└───────────────┘       │ REST API         │
                        │ WebSocket        │
┌───────────────┐       │ Authentication   │
│               │◄─────►│                  │
│ Tauri Desktop │       └────────┬─────────┘
│               │                │
└───────────────┘                │
                                 ▼
                           ┌───────────┐
                           │   Redis   │
                           │           │
                           │ Presence  │
                           │ Pub/Sub   │
                           └───────────┘
```

---

# 6. Autenticação

Implementar:

* Cadastro
* Login
* Logout
* JWT
* Refresh token
* Hash seguro de senha
* Proteção de rotas
* Sessões
* Recuperação de sessão ao atualizar a página

O usuário deverá possuir:

```text
User
├── id
├── username
├── displayName
├── email
├── passwordHash
├── avatarUrl
├── status
├── createdAt
└── updatedAt
```

Não implementar autenticação social nesta primeira versão.

---

# 7. Usuários

Cada usuário deverá possuir:

* Username único
* Nome de exibição
* Avatar
* Status
* Data de criação

Status inicialmente:

```text
ONLINE
IDLE
DO_NOT_DISTURB
INVISIBLE
OFFLINE
```

O sistema deverá detectar presença utilizando WebSocket.

Exemplo:

```text
Lucas
🟢 Online
```

Quando o usuário desconectar:

```text
Lucas
⚫ Offline
```

Utilizar Redis para armazenar informações temporárias de presença.

---

# 8. Sistema de amizades

Implementar:

* Enviar solicitação
* Aceitar solicitação
* Recusar solicitação
* Cancelar solicitação
* Remover amigo
* Listar amigos
* Ver status do amigo

Estados:

```text
PENDING
ACCEPTED
REJECTED
BLOCKED
```

O sistema deverá impedir:

* Amizade duplicada
* Solicitação para si mesmo
* Solicitação duplicada

---

# 9. Servidores

O conceito principal da plataforma será o "Server".

Um usuário poderá:

* Criar servidor
* Editar servidor
* Excluir servidor
* Entrar em servidor
* Sair de servidor
* Convidar usuários
* Gerenciar membros

Exemplo:

```text
Meu servidor
│
├── Geral
├── Jogos
└── Conversa
```

Cada servidor deverá possuir:

```text
Server
├── id
├── name
├── description
├── ownerId
├── iconUrl
├── createdAt
└── updatedAt
```

---

# 10. Membros e permissões

Implementar sistema básico de membros.

Cada membro deverá possuir:

```text
ServerMember
├── id
├── userId
├── serverId
├── role
└── joinedAt
```

Roles iniciais:

```text
OWNER
ADMIN
MODERATOR
MEMBER
```

Criar sistema de permissões extensível.

Permissões iniciais:

```text
MANAGE_SERVER
MANAGE_CHANNELS
MANAGE_MEMBERS
SEND_MESSAGES
READ_MESSAGES
CONNECT_VOICE
SPEAK
SHARE_SCREEN
```

O OWNER possui todas as permissões.

---

# 11. Canais de texto

Cada servidor poderá possuir vários canais.

Exemplo:

```text
📢 GERAL

# chat
# memes
# links

🎮 JOGOS

# cs2
# valorant
# outros
```

Modelo:

```text
Channel
├── id
├── serverId
├── name
├── type
├── position
├── createdAt
└── updatedAt
```

Tipos:

```text
TEXT
VOICE
```

Permitir:

* Criar canal
* Editar canal
* Excluir canal
* Reordenar canais
* Definir permissões

---

# 12. Mensagens

Implementar chat em tempo real.

Modelo:

```text
Message
├── id
├── channelId
├── authorId
├── content
├── createdAt
├── updatedAt
└── deletedAt
```

Funcionalidades:

* Enviar mensagem
* Editar mensagem
* Excluir mensagem
* Responder mensagem
* Mostrar autor
* Mostrar horário
* Indicador de mensagem editada
* Paginação
* Carregamento incremental
* Histórico de mensagens

Mensagens devem aparecer instantaneamente para os demais usuários através de WebSocket.

---

# 13. WebSocket

Utilizar Socket.IO ou WebSocket integrado ao NestJS.

Criar eventos bem definidos.

Exemplo:

```text
message:create
message:update
message:delete

user:online
user:offline
user:status

server:member_join
server:member_leave

typing:start
typing:stop

voice:join
voice:leave

screen:start
screen:stop
```

Não colocar regras de negócio complexas diretamente nos handlers WebSocket.

Manter a lógica nos services/use cases.

---

# 14. Indicador "digitando"

Implementar:

```text
Lucas está digitando...
```

Utilizando WebSocket.

O evento deve ser temporário e não deve ser salvo no banco.

---

# 15. Preview de links

Quando um usuário enviar uma URL no chat, detectar automaticamente links.

Exemplo:

```text
https://www.youtube.com/watch?v=123
```

Exibir uma prévia:

```text
┌─────────────────────────────┐
│ YouTube                     │
│                             │
│ Título do vídeo             │
│ Descrição                   │
│ youtube.com                 │
└─────────────────────────────┘
```

O preview poderá ser obtido através do backend.

Não permitir que o frontend faça requisições arbitrárias para URLs fornecidas pelos usuários.

Implementar proteção contra SSRF.

---

# 16. Convites

Implementar sistema de convite.

Um servidor poderá gerar:

```text
/invite/ABC123
```

O convite deverá possuir:

* Código
* ServerId
* Criador
* Data de criação
* Data de expiração opcional
* Número máximo de usos opcional

Fluxo:

```text
Usuário recebe convite
        │
        ▼
Abre convite
        │
        ▼
Backend valida
        │
        ▼
Usuário entra no servidor
```

---

# 17. Salas de voz

Implementar salas de voz utilizando WebRTC.

O servidor deverá ser responsável pelo signaling.

Exemplo:

```text
Sala Geral

🟢 Lucas
🟢 João
🔇 Pedro
🟢 Maria
```

Funcionalidades:

* Entrar na sala
* Sair da sala
* Mutar microfone
* Desmutar microfone
* Desativar câmera
* Ativar câmera
* Mostrar participantes
* Detectar quem está falando
* Ajustar volume individual
* Compartilhar tela

---

# 18. WebRTC

Utilizar WebRTC para:

* Áudio
* Vídeo
* Compartilhamento de tela

O backend NÃO deverá transmitir diretamente os streams de mídia na primeira versão.

O NestJS deverá atuar principalmente como servidor de signaling.

Fluxo:

```text
User A
   │
   │ WebSocket
   ▼
NestJS
   │
   │ WebSocket
   ▼
User B

Após signaling:

User A ◄──────── WebRTC ────────► User B
```

Implementar:

* SDP offer
* SDP answer
* ICE candidates
* Connection state
* Reconnection
* Cleanup de conexões

---

# 19. Compartilhamento de tela

Utilizar:

```typescript
navigator.mediaDevices.getDisplayMedia()
```

Permitir:

```text
Compartilhar:

[ Tela inteira ]
[ Janela ]
[ Aba ]
```

Quando um usuário compartilhar tela:

```text
Lucas está compartilhando a tela

┌─────────────────────────────┐
│                             │
│        SCREEN STREAM        │
│                             │
└─────────────────────────────┘

[Parar compartilhamento]
```

Outros participantes da sala deverão conseguir visualizar o stream.

---

# 20. Arquitetura preparada para SFU

Embora a primeira versão possa utilizar WebRTC diretamente entre usuários, estruturar o código para futuramente suportar um SFU.

Não acoplar toda a implementação a conexões P2P.

No futuro deverá ser possível adicionar:

* LiveKit
* mediasoup
* outro SFU

sem precisar reescrever toda a aplicação.

---

# 21. Interface

Criar uma interface inspirada em aplicações modernas de comunicação, mas NÃO copiar visualmente o Discord.

Layout:

```text
┌──────┬────────────────┬──────────────────────────┐
│      │                │                          │
│ SERV │    CANAIS      │         CHAT             │
│ ERS  │                │                          │
│      │  GERAL         │  Lucas                   │
│  ●   │  # chat        │  Olá pessoal             │
│  ●   │  # links       │                          │
│  ●   │                │  João                    │
│  ●   │  VOZ           │  Vamos jogar?             │
│      │  🔊 Geral       │                          │
│      │                │                          │
└──────┴────────────────┴──────────────────────────┘
```

Criar:

* Dark mode como padrão
* Interface responsiva
* Sidebar de servidores
* Sidebar de canais
* Área de mensagens
* Lista de membros
* Barra de usuário
* Controles de voz
* Tela de chamada

---

# 22. Estado frontend

Não colocar todo o estado global no Zustand.

Separar:

### React Query

Para:

* Servidores
* Canais
* Mensagens históricas
* Amigos
* Usuários

### Zustand

Para:

* Usuário atual
* Estado da conexão
* Sala de voz atual
* Estado global de UI
* Preferências temporárias

### WebSocket

Para:

* Eventos realtime
* Mensagens novas
* Presença
* Typing
* Eventos de voz

---

# 23. Banco de dados

Utilizar PostgreSQL + Prisma.

Criar relacionamentos adequados entre:

```text
User
 │
 ├── Friendships
 │
 ├── ServerMembers
 │
 ├── Messages
 │
 └── Invitations

Server
 │
 ├── Members
 ├── Channels
 └── Invitations

Channel
 │
 └── Messages
```

Utilizar:

* Foreign keys
* Unique constraints
* Indexes
* Timestamps
* Soft delete onde fizer sentido

Criar migrations do Prisma.

---

# 24. Redis

Utilizar Redis inicialmente para:

* Presence
* WebSocket pub/sub
* Sessões temporárias
* Rate limiting
* Estado temporário de WebRTC/signaling

Não armazenar dados permanentes no Redis.

---

# 25. Segurança

Implementar desde o início:

* Hash de senha
* JWT seguro
* Refresh tokens
* Rate limiting
* Validação de input
* DTOs
* Class-validator
* CORS configurado
* Helmet
* Sanitização de mensagens
* Proteção contra XSS
* Proteção contra SSRF no link preview
* Controle de permissões no backend
* Não confiar em permissões enviadas pelo frontend
* Logs de erro sem expor informações sensíveis

Toda autorização deve ser validada no backend.

---

# 26. Docker

Criar ambiente Docker para desenvolvimento.

Serviços:

```text
postgres
redis
backend
frontend
```

Exemplo:

```text
docker-compose.yml
```

O projeto deverá conseguir subir com um comando simples.

---

# 27. Variáveis de ambiente

Criar:

```text
.env.example
```

Com variáveis como:

```text
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
PORT=
FRONTEND_URL=
```

Nunca colocar secrets reais no Git.

---

# 28. Organização do monorepo

Preferencialmente utilizar:

```text
apps/
├── web
├── desktop
└── api

packages/
├── shared
├── types
└── ui
```

Utilizar um gerenciador de workspace adequado, como pnpm.

Compartilhar tipos entre frontend e backend quando fizer sentido.

---

# 29. Qualidade de código

Requisitos:

* TypeScript strict
* ESLint
* Prettier
* Tipagem forte
* Evitar `any`
* Componentes pequenos
* Services desacoplados
* DTOs
* Interfaces
* Repository pattern quando fizer sentido
* Tratamento consistente de erros
* Logs estruturados

Não criar abstrações excessivas sem necessidade.

Priorizar código simples e manutenível.

---

# 30. Testes

Implementar testes para partes críticas.

Backend:

* Auth
* Permissions
* Servers
* Channels
* Messages
* Friendships
* Invitations

Frontend:

* Componentes críticos
* Estados de autenticação
* Chat
* Permissões

Realtime:

* Eventos WebSocket críticos

---

# 31. Roadmap de implementação

NÃO tente implementar tudo de uma vez.

Desenvolver em etapas.

## Etapa 1 — Fundação

Criar:

* Monorepo
* Vite
* React
* Tailwind
* NestJS
* Prisma
* PostgreSQL
* Redis
* Docker
* ESLint
* Prettier
* Variáveis de ambiente

Garantir que tudo inicia corretamente.

---

## Etapa 2 — Autenticação

Implementar:

* Registro
* Login
* Logout
* JWT
* Refresh token
* Proteção de rotas
* Usuário atual

Criar frontend funcional para login.

---

## Etapa 3 — Servidores

Implementar:

* Criar servidor
* Listar servidores
* Entrar
* Sair
* Membros
* Permissões

Criar interface inicial.

---

## Etapa 4 — Canais

Implementar:

* Criar canal
* Editar
* Excluir
* Listar
* Permissões
* Ordenação

---

## Etapa 5 — Chat realtime

Implementar:

* WebSocket
* Enviar mensagens
* Receber mensagens
* Histórico
* Editar
* Excluir
* Typing indicator
* Paginação

---

## Etapa 6 — Amizades e convites

Implementar:

* Friend requests
* Aceitar
* Recusar
* Remover
* Convites
* Entrar em servidor por convite

---

## Etapa 7 — Presence

Implementar:

* Online
* Offline
* Idle
* DND
* Invisible
* Redis presence

---

## Etapa 8 — WebRTC

Implementar:

* Voice room
* Microfone
* Câmera
* Signaling
* SDP
* ICE
* Connection state

---

## Etapa 9 — Screen Share

Implementar:

* getDisplayMedia
* Compartilhamento de tela
* Compartilhamento de janela
* Compartilhamento de aba
* Visualização pelos demais usuários
* Parar compartilhamento

---

## Etapa 10 — Link Preview

Implementar:

* Detecção de URLs
* Fetch de metadata pelo backend
* Preview
* Cache
* Proteção SSRF

---

## Etapa 11 — Tauri

Criar:

* Aplicativo Windows
* Integração com frontend
* Persistência de sessão
* Notificações
* Integração com recursos de desktop quando necessário

---

# 32. Regras importantes para o desenvolvimento

### Regra 1

Não implementar funcionalidades futuras antes da hora.

### Regra 2

Não adicionar upload de arquivos nesta versão.

### Regra 3

Não implementar pagamentos, assinatura ou monetização.

### Regra 4

Não implementar autenticação Google/Discord/GitHub inicialmente.

### Regra 5

Não implementar SFU inicialmente.

A arquitetura deve apenas estar preparada para isso.

### Regra 6

Não colocar lógica crítica somente no frontend.

### Regra 7

Toda operação deve possuir autorização no backend.

### Regra 8

Evitar dependências desnecessárias.

### Regra 9

Não duplicar tipos e interfaces entre frontend e backend quando puderem ser compartilhados.

### Regra 10

Antes de implementar uma nova etapa, verificar se a etapa anterior está funcionando corretamente.

---

# 33. Primeiro objetivo

Comece SOMENTE pela Etapa 1.

Não implemente autenticação, chat, WebRTC ou outras funcionalidades ainda.

Primeiro:

1. Criar o monorepo.
2. Configurar pnpm.
3. Configurar React + Vite + TypeScript.
4. Configurar Tailwind.
5. Configurar NestJS.
6. Configurar Prisma.
7. Configurar PostgreSQL.
8. Configurar Redis.
9. Criar Docker Compose.
10. Configurar ESLint.
11. Configurar Prettier.
12. Criar `.env.example`.
13. Criar estrutura inicial de pastas.
14. Criar README.
15. Garantir que frontend e backend iniciam corretamente.
16. Garantir que NestJS consegue conectar ao PostgreSQL.
17. Garantir que NestJS consegue conectar ao Redis.
18. Executar migrations iniciais.
19. Verificar TypeScript e lint.
20. Somente depois disso apresentar a implementação da Etapa 1 concluída.

Ao terminar cada etapa, explique:

* O que foi implementado
* Quais arquivos foram criados
* Quais arquivos foram modificados
* Como executar
* Como testar
* Possíveis problemas
* Próxima etapa

Não avance automaticamente para a próxima etapa sem verificar a etapa atual.
