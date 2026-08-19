# UI/UX — Plataforma de Comunicação Self-Hosted

## Objetivo

Criar a interface visual completa de uma plataforma privada de comunicação em tempo real, inspirada conceitualmente em Discord, Slack e outras plataformas modernas de comunicação, porém com **identidade visual própria**.

Neste momento, o objetivo é desenvolver **somente a UI/UX e a experiência de navegação**.

Não implementar backend, banco de dados, WebSocket ou WebRTC nesta etapa.

A interface deve funcionar utilizando **dados mockados**, mas a arquitetura dos componentes deve estar preparada para posteriormente receber dados reais da API.

---

# 1. Stack

Utilizar obrigatoriamente:

* React
* TypeScript
* Vite
* Tailwind CSS
* React Router
* Lucide React para ícones
* Zustand somente quando necessário para estado visual/global

Evitar bibliotecas de UI prontas que façam a aplicação parecer genérica.

Priorizar componentes próprios utilizando Tailwind.

---

# 2. Direção visual

Criar uma interface:

* Moderna
* Minimalista
* Premium
* Escura
* Elegante
* Tecnológica
* Fluida
* Responsiva
* Com boa hierarquia visual
* Com bastante atenção a espaçamento e tipografia

A interface deve transmitir a sensação de:

> "Uma plataforma privada e moderna para conversar, jogar e compartilhar tela com amigos."

Não fazer uma cópia visual do Discord.

Usar apenas conceitos de UX semelhantes quando forem úteis.

A identidade visual deve ser própria.

---

# 3. Design System

Antes de criar as telas, definir um pequeno Design System.

Criar tokens para:

### Background

Utilizar diferentes níveis de superfície:

```text
Background principal
Background secundário
Surface
Surface elevada
Surface hover
Surface ativa
```

Exemplo conceitual:

```text
bg-primary
bg-secondary
bg-surface
bg-elevated
bg-hover
bg-active
```

Não espalhar valores arbitrários de cores pelo código.

Centralizar as decisões visuais.

---

# 4. Cores

Criar uma paleta escura sofisticada.

Evitar preto absoluto em toda a interface.

Utilizar:

* Fundo quase preto
* Cinzas escuros
* Cinzas intermediários
* Branco suave para texto principal
* Cinza para texto secundário

Utilizar uma cor de destaque para:

* Botões primários
* Estados ativos
* Links
* Elementos selecionados
* Indicadores importantes

A cor de destaque deve ser usada com moderação.

Evitar aparência excessivamente colorida.

---

# 5. Tipografia

Escolher uma fonte moderna e legível.

A tipografia deve possuir:

* Excelente legibilidade
* Boa aparência em interfaces
* Diferenciação clara entre títulos e textos

Criar hierarquia:

```text
Display
Heading
Subheading
Body
Small
Caption
```

Mensagens de chat devem ser confortáveis de ler.

---

# 6. Layout principal

A aplicação deverá possuir uma estrutura semelhante a:

```text
┌──────┬─────────────────┬─────────────────────────────┐
│      │                 │                             │
│      │                 │                             │
│ SERV │     CANAIS      │            CHAT             │
│ ERS  │                 │                             │
│      │                 │                             │
│  ●   │  GERAL          │                             │
│  ●   │                 │                             │
│  ●   │  # chat         │                             │
│  ●   │  # links        │                             │
│      │                 │                             │
│      │  VOZ            │                             │
│      │                 │                             │
│      │  🔊 Geral       │                             │
│      │                 │                             │
└──────┴─────────────────┴─────────────────────────────┘
```

Estrutura:

```text
App
├── ServerSidebar
├── ChannelSidebar
└── MainContent
```

A interface deve ocupar toda a viewport.

Evitar scroll da página inteira.

Cada área deverá controlar seu próprio overflow.

---

# 7. Server Sidebar

Criar uma barra lateral vertical para os servidores.

Exemplo:

```text
┌─────┐
│  ✦  │
├─────┤
│ 🟣 │
│ 🔵 │
│ 🟢 │
│ 🟠 │
├─────┤
│  +  │
└─────┘
```

Funcionalidades visuais:

* Avatar do servidor
* Estado ativo
* Hover
* Tooltip
* Separador
* Botão adicionar servidor

O servidor ativo deverá possuir um indicador visual lateral.

Adicionar animações sutis.

---

# 8. Channel Sidebar

Criar sidebar contendo:

### Header

```text
Meu Servidor              ⋯
```

Ao clicar no header, abrir menu visual com:

```text
Configurações
Gerenciar membros
Criar convite
Criar canal
Sair do servidor
```

---

### Categorias

Exemplo:

```text
▾ GERAL

# chat
# links
# memes

▾ JOGOS

# cs2
# valorant

▾ VOZ

🔊 Geral
🔊 Jogatina
```

Categorias podem ser recolhidas.

---

# 9. Usuário atual

Na parte inferior da sidebar:

```text
┌──────────────────────────────┐
│ 🟢  Lucas                    │
│     Online                   │
│                              │
│              🎤  🎧  ⚙      │
└──────────────────────────────┘
```

Criar:

* Avatar
* Nome
* Status
* Botão mute
* Botão headphone/deafen
* Configurações

Ao clicar no usuário, abrir menu:

```text
Definir status
Perfil
Configurações
Sair
```

---

# 10. Chat Header

No topo da área principal:

```text
# chat

Conversa geral da comunidade

                         🔔   👥   🔍   ⋯
```

Elementos:

* Ícone do canal
* Nome
* Descrição
* Notificações
* Lista de membros
* Busca
* Menu

O header deve permanecer fixo enquanto as mensagens rolam.

---

# 11. Área de mensagens

Criar uma experiência moderna de chat.

Exemplo:

```text
                         Hoje

┌───────────────────────────────────────────┐
│ 🟣 Lucas                                   │
│ 00:31                                      │
│                                            │
│ Alguém vai jogar hoje?                     │
│                                            │
│ 🟢 João                                    │
│ 00:32                                      │
│                                            │
│ Eu vou                                     │
└───────────────────────────────────────────┘
```

Não criar balões de chat excessivamente arredondados.

A interface deve parecer uma conversa em comunidade.

Cada mensagem deverá possuir:

* Avatar
* Nome
* Horário
* Conteúdo
* Hover
* Ações

No hover:

```text
😊   ↩   ⋯
```

Ações:

* Reagir
* Responder
* Mais opções

---

# 12. Agrupamento de mensagens

Mensagens consecutivas do mesmo usuário devem ser agrupadas.

Exemplo:

```text
Lucas      00:31
Olá pessoal

           00:31
Alguém vai jogar?

           00:32
Hoje?
```

Em vez de repetir avatar e nome em todas.

Se outro usuário enviar:

```text
João       00:33
Eu vou.
```

Criar novo grupo.

---

# 13. Input de mensagem

Na parte inferior:

```text
┌───────────────────────────────────────────────┐
│ +   Escreva uma mensagem...              😊   │
└───────────────────────────────────────────────┘
```

Nesta primeira versão NÃO implementar upload.

O botão `+` pode existir visualmente, mas deve apresentar opções futuras ou ficar desabilitado.

Implementar visualmente:

* Campo de texto
* Emoji
* Enviar
* Estado focus
* Placeholder
* Enter
* Shift + Enter

---

# 14. Typing Indicator

Quando usuários estiverem digitando:

```text
● ● ●  Lucas está digitando...
```

Criar animação sutil.

---

# 15. Link Preview

Criar mock visual para mensagens contendo links.

Exemplo:

```text
┌─────────────────────────────────────┐
│ YouTube                             │
│                                     │
│ Um vídeo interessante               │
│                                     │
│ youtube.com                         │
└─────────────────────────────────────┘
```

O componente deverá ser reutilizável.

---

# 16. Member Sidebar

Criar uma sidebar opcional à direita.

Exemplo:

```text
MEMBROS — 5

ONLINE

🟢 Lucas
🟢 João
🟢 Pedro

OFFLINE

⚫ Maria
⚫ Carlos
```

Ao clicar no usuário:

Abrir User Popover:

```text
┌─────────────────────────┐
│       Avatar            │
│                         │
│ Lucas                   │
│ @lucas                  │
│                         │
│ 🟢 Online               │
│                         │
│ [Mensagem]              │
│ [Adicionar amigo]       │
└─────────────────────────┘
```

---

# 17. Tela de servidor vazio

Criar estado quando não houver canais/mensagens.

Exemplo:

```text
             ✦

        Bem-vindo ao servidor

   Comece criando seu primeiro canal.

           [+ Criar canal]
```

---

# 18. Tela de amigos

Criar uma área independente:

```text
Amigos

┌────────────────────────────────────┐
│ 🟢 João          Online    [Chat]  │
│ 🟢 Pedro         Online    [Chat]  │
│ ⚫ Maria         Offline           │
└────────────────────────────────────┘
```

Tabs:

```text
Online
Todos
Pendentes
Bloqueados
Adicionar amigo
```

---

# 19. Sistema de convites

Criar modal:

```text
Convidar para o servidor

Envie este link para seus amigos:

┌────────────────────────────────────┐
│ myapp.com/invite/ABC123     [📋]  │
└────────────────────────────────────┘

O convite expira em 7 dias.

                 [Cancelar] [Copiar]
```

---

# 20. Tela de voz

Quando entrar em uma sala:

```text
┌────────────────────────────────────────────┐
│ 🔊 Geral                                  │
│                                            │
│        🟣 Lucas       🔵 João              │
│                                            │
│        🟢 Pedro       🟠 Maria             │
│                                            │
│                                            │
│              🎤   📹   🖥                  │
│              🎧   ☎                           │
└────────────────────────────────────────────┘
```

Criar estados:

### Microfone ligado

```text
🎤
```

### Microfone desligado

```text
🔇
```

### Câmera ligada

Mostrar vídeo.

### Câmera desligada

Mostrar avatar.

---

# 21. Tela de chamada

Criar layout para chamada de vídeo.

Exemplo:

```text
┌─────────────────────────────────────────────┐
│                                             │
│                  João                       │
│                                             │
│                                             │
├──────────────────────┬──────────────────────┤
│ Lucas                │ Pedro                │
│                      │                      │
│                      │                      │
└──────────────────────┴──────────────────────┘

        🎤    📹    🖥    🎧    ☎
```

O layout deve se adaptar automaticamente à quantidade de participantes.

---

# 22. Compartilhamento de tela

Criar interface visual para quando alguém compartilhar a tela.

Exemplo:

```text
┌─────────────────────────────────────────────┐
│ Lucas está compartilhando a tela            │
│                                             │
│                                             │
│              SCREEN PREVIEW                 │
│                                             │
│                                             │
└─────────────────────────────────────────────┘

[Voltar para chamada] [Tela cheia]
```

Criar também estado de seleção:

```text
Compartilhar tela

┌──────────────┐ ┌──────────────┐
│ 🖥 Desktop   │ │ 🪟 Chrome    │
│              │ │              │
└──────────────┘ └──────────────┘

             [Cancelar]
```

Neste momento é apenas UI.

Não implementar WebRTC.

---

# 23. Configurações

Criar página de configurações.

Sidebar:

```text
Configurações

Minha conta
Perfil
Privacidade
Notificações
Voz e vídeo
Aparência
Atalhos
Sobre
```

---

# 24. Configurações de aparência

Criar:

```text
Aparência

Tema

● Escuro
○ Claro
○ Sistema

Densidade

○ Compacta
● Normal
○ Confortável
```

Mesmo que o tema claro não seja implementado agora, estruturar o código para permitir posteriormente.

---

# 25. Configurações de voz e vídeo

Criar UI para:

```text
Microfone

[ Default Microphone        ▼ ]

Entrada
████████████░░

Câmera

[ Default Camera            ▼ ]

Teste de microfone
[ Testar ]
```

Tudo pode utilizar dados mockados nesta etapa.

---

# 26. Modais

Criar sistema reutilizável de modal.

Utilizar para:

* Criar servidor
* Criar canal
* Convidar usuário
* Perfil
* Configurações
* Confirmação
* Compartilhar tela

Todos devem possuir:

* Overlay
* Animação
* Fechar com ESC
* Fechar clicando fora quando apropriado
* Focus management

---

# 27. Toasts

Criar sistema de notificações.

Exemplos:

```text
✓ Servidor criado

✓ Convite copiado

✓ Configurações salvas

⚠ Não foi possível conectar

✕ Erro ao enviar mensagem
```

---

# 28. Estados de loading

Criar skeletons.

Exemplo:

```text
██████████
██████
██████████████
```

Não utilizar apenas spinners.

Criar skeletons para:

* Lista de servidores
* Lista de canais
* Mensagens
* Usuários
* Perfil

---

# 29. Estados de erro

Criar componentes reutilizáveis para:

```text
Algo deu errado.

Não foi possível carregar este conteúdo.

[Tentar novamente]
```

---

# 30. Responsividade

A interface deverá funcionar em:

* Desktop
* Notebook
* Tablet
* Mobile

Desktop:

```text
Servers + Channels + Chat + Members
```

Tablet:

```text
Servers + Channels + Chat
```

Mobile:

```text
Chat
```

Criar navegação adequada para abrir servidores/canais através de drawers.

Não simplesmente diminuir todas as colunas.

---

# 31. Animações

Utilizar animações pequenas e rápidas.

Exemplos:

* Hover
* Modal
* Sidebar
* Tooltip
* Toast
* User popover
* Entrada de mensagens
* Indicador de digitação
* Status

Evitar animações exageradas.

A interface deve parecer rápida.

---

# 32. Acessibilidade

Implementar:

* Navegação por teclado
* Focus states
* ARIA labels quando necessário
* Contraste adequado
* Botões semanticamente corretos
* Tooltips para ícones sem texto
* ESC para fechar modais

---

# 33. Componentização

Criar componentes reutilizáveis.

Estrutura sugerida:

```text
src/
├── components/
│   ├── layout/
│   ├── server/
│   ├── channel/
│   ├── chat/
│   ├── voice/
│   ├── user/
│   ├── settings/
│   ├── modal/
│   ├── toast/
│   └── ui/
│
├── pages/
│   ├── Login
│   ├── Register
│   ├── Home
│   ├── Friends
│   ├── Server
│   ├── Settings
│   └── Voice
│
├── hooks/
├── stores/
├── mocks/
├── types/
└── lib/
```

Criar componentes pequenos e reutilizáveis.

Evitar componentes gigantes como:

```text
Discord.tsx
```

com milhares de linhas.

---

# 34. Dados mockados

Criar dados fake realistas.

Exemplo:

```typescript
const mockUsers = [...]
const mockServers = [...]
const mockChannels = [...]
const mockMessages = [...]
const mockFriends = [...]
```

A interface deve parecer uma aplicação real.

Não utilizar apenas "User 1", "User 2", "Test Server".

Criar conteúdo realista em português.

---

# 35. Navegação

Criar rotas:

```text
/login
/register

/app

/app/friends

/app/server/:serverId/channel/:channelId

/app/server/:serverId/voice/:channelId

/app/settings
```

Utilizar React Router.

---

# 36. Tela inicial

Após login:

```text
/app
```

mostrar a interface principal.

Se nenhum servidor estiver selecionado:

```text
Selecione um servidor

ou

Crie seu primeiro servidor.
```

---

# 37. Criar servidor

Modal:

```text
Criar um servidor

Nome do servidor

[ Meu servidor              ]

Descrição opcional

[                         ]

        [Cancelar] [Criar]
```

---

# 38. Criar canal

Modal:

```text
Criar canal

Tipo

● Texto
○ Voz

Nome

[ chat                    ]

[Cancelar] [Criar canal]
```

---

# 39. Perfil

Criar perfil visual completo.

```text
┌──────────────────────────────┐
│        COVER                 │
│                              │
│      [ Avatar ]              │
│                              │
│ Lucas Cunha                  │
│ @lucas                       │
│                              │
│ 🟢 Online                    │
│                              │
│ Sobre mim                    │
│ Desenvolvedor                │
│                              │
│ Desde Agosto de 2026         │
└──────────────────────────────┘
```

---

# 40. UX geral

A experiência deve seguir estas prioridades:

1. Clareza
2. Velocidade
3. Hierarquia visual
4. Feedback imediato
5. Poucos cliques
6. Consistência
7. Acessibilidade

Sempre que uma ação for realizada, o usuário deve receber feedback.

Exemplo:

```text
Clique em copiar
        ↓
Botão muda
        ↓
Toast:
"Convite copiado"
```

---

# 41. Regras de implementação

IMPORTANTE:

Não criar backend.

Não criar Prisma.

Não criar banco de dados.

Não criar WebSocket.

Não criar WebRTC.

Não criar autenticação real.

Não criar upload.

Não criar integração com API.

Utilizar apenas mocks.

Porém, estruturar os componentes para que futuramente possam receber dados reais.

---

# 42. Ordem de desenvolvimento

Não tentar desenvolver todas as telas simultaneamente.

Seguir esta ordem:

### Fase 1

Criar Design System:

* Cores
* Tipografia
* Espaçamento
* Radius
* Shadows
* Buttons
* Inputs
* Icons
* Tooltips
* Modal
* Toast

### Fase 2

Criar layout principal:

* Server Sidebar
* Channel Sidebar
* Main Chat
* User Area

### Fase 3

Criar chat:

* Header
* Messages
* Message groups
* Input
* Typing indicator
* Link preview

### Fase 4

Criar servidores/canais:

* Server selection
* Channel selection
* Create server
* Create channel
* Invite

### Fase 5

Criar usuários:

* Member list
* User popover
* Profile
* Friends

### Fase 6

Criar voz/vídeo:

* Voice channel
* Call UI
* Participant grid
* Screen share UI

### Fase 7

Criar configurações.

### Fase 8

Criar responsividade.

### Fase 9

Criar estados:

* Loading
* Empty
* Error
* Offline
* Connecting

### Fase 10

Polimento visual.

---

# 43. Critérios de qualidade

Antes de considerar a UI pronta, verificar:

* Nenhum layout quebrado
* Nenhum overflow horizontal inesperado
* Sidebar funciona
* Chat possui scroll independente
* Input permanece acessível
* Modais funcionam
* ESC fecha modais
* Tooltips funcionam
* Responsividade funciona
* Estados de loading existem
* Estados vazios existem
* Estados de erro existem
* Interface funciona sem backend
* Componentes não possuem código duplicado
* TypeScript não possui erros
* ESLint não possui erros

---

# 44. Resultado esperado

Ao final desta etapa, quero conseguir executar:

```bash
pnpm dev
```

e visualizar uma aplicação completamente navegável e visualmente consistente.

Deve ser possível:

```text
Login
 ↓
Home
 ↓
Selecionar servidor
 ↓
Selecionar canal
 ↓
Visualizar mensagens
 ↓
Enviar mensagem mock
 ↓
Abrir perfil
 ↓
Abrir amigos
 ↓
Criar servidor
 ↓
Criar canal
 ↓
Abrir sala de voz
 ↓
Visualizar interface de chamada
 ↓
Visualizar interface de compartilhamento de tela
 ↓
Abrir configurações
```

Todas essas interações podem utilizar estado local/mock.

---

# 45. Regra final para o Cursor

Antes de escrever código, analise o projeto atual.

Se já existir uma estrutura React/Vite/Tailwind, **não recrie o projeto do zero**.

Reutilize o que já existe.

Primeiro apresente uma breve análise da estrutura atual e um plano de implementação.

Depois implemente a UI em etapas.

Não altere o backend ou outras partes da aplicação que não sejam necessárias para a UI.

Priorize qualidade visual, UX, responsividade, acessibilidade e componentização.

O resultado deve parecer uma aplicação comercial real, e não um template genérico de dashboard.
