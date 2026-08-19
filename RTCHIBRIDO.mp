# Arquitetura Híbrida WebRTC — Resumo da Implementação

## Objetivo

Criar um sistema privado de comunicação em tempo real, semelhante ao Discord, onde usuários possam entrar em salas, conversar por voz e compartilhar a tela.

A prioridade é **reduzir o consumo do servidor e da banda**, fazendo com que cada usuário receba somente os streams que realmente está visualizando.

---

## Stack principal

* **Frontend:** React + TypeScript + Vite + Tailwind
* **Backend:** NestJS
* **Banco:** PostgreSQL + Prisma
* **Comunicação:** WebRTC
* **SFU:** mediasoup
* **Signaling:** WebSocket
* **STUN/TURN:** para estabelecer conexões P2P quando necessário

---

## Arquitetura híbrida

O sistema utilizará duas estratégias:

### P2P

Para grupos pequenos e situações em que uma conexão direta seja vantajosa.

```text
João ←────→ Lucas
  ↑           ↑
  └──── Pedro ┘
```

O servidor fica responsável principalmente pelo signaling e controle da sala.

### SFU

Quando uma transmissão tiver vários espectadores, ela poderá ser encaminhada através do mediasoup.

```text
             João
              │
           2 Mbps
              ↓
          ┌───────┐
          │  SFU  │
          └───┬───┘
       ┌──────┼──────┐
       ↓      ↓      ↓
     Lucas   Pedro   Ana
```

João envia apenas uma cópia do vídeo para o SFU.

O SFU encaminha o stream para os espectadores.

---

## Subscription dinâmica

Todos os usuários podem compartilhar a tela, mas cada usuário poderá visualizar **apenas uma tela por vez**.

Exemplo:

```text
João   🟢 compartilhando
Lucas  🟢 compartilhando
Pedro  🟢 compartilhando
Ana    🟢 compartilhando
```

Lucas escolhe assistir João:

```text
Lucas
  │
  └── subscribe → João
```

Pedro escolhe assistir Ana:

```text
Pedro
  │
  └── subscribe → Ana
```

Maria não está assistindo nenhuma tela:

```text
Maria
  │
  └── nenhuma subscription de vídeo
```

O cliente não deve receber streams de vídeo que não estão sendo visualizados.

---

## Otimização por número de espectadores

Cada transmissão deverá manter o número de espectadores:

```text
viewers = 0
```

### Nenhum espectador

Quando:

```text
viewers = 0
```

a transmissão de tela pode ser pausada ou reduzida para um estado mínimo.

Objetivo:

```text
0 espectadores
→ transmissão pausada
→ praticamente 0 Mbps de vídeo
```

### Com espectadores

Quando alguém solicitar a tela:

```text
viewers > 0
→ ativar transmissão
→ 720p / 30 FPS
```

Quando o último espectador sair:

```text
viewers = 0
→ pausar/reduzir transmissão
```

---

## Qualidade adaptativa

A transmissão deverá adaptar resolução, FPS e bitrate conforme a conexão.

Exemplo:

```text
Conexão excelente
→ 1280×720
→ 30 FPS
→ ~2 Mbps

Conexão média
→ 960×540
→ 30 FPS
→ ~1 Mbps

Conexão ruim
→ 640×360
→ 20 FPS
→ ~500 Kbps
```

Os valores são referências e devem ser ajustados durante os testes.

---

## Simulcast / SVC

A transmissão poderá disponibilizar diferentes níveis de qualidade:

```text
                João
                 │
       ┌─────────┼─────────┐
       ↓         ↓         ↓
     360p      540p      720p
    ~500kbps   ~1Mbps     ~2Mbps
```

O SFU pode entregar a camada mais adequada para cada espectador.

Exemplo:

```text
Lucas → conexão excelente → 720p
Pedro → conexão média      → 540p
Ana   → conexão ruim       → 360p
```

Isso evita criar uma transmissão independente para cada usuário.

---

## Fluxo completo

```text
João compartilha a tela
          │
          ▼
     WebRTC Publisher
          │
          ▼
       mediasoup
          │
    ┌─────┼─────┐
    ↓     ↓     ↓
  Lucas Pedro   Ana
  720p   540p  360p
    │     │     │
    ▼     ▼     ▼
  assiste assiste não assiste
                    │
                    ▼
                 sem vídeo
```

Se ninguém estiver assistindo:

```text
João
 │
 └── 0 espectadores
          ↓
    pausar transmissão
```

Quando alguém solicitar:

```text
Lucas
 │
 └── "assistir João"
          ↓
       mediasoup
          ↓
   João → Lucas
   720p / 30 FPS
```

---

## Responsabilidade de cada componente

### NestJS

Responsável por:

* autenticação
* usuários
* salas
* permissões
* mensagens
* presença
* estado dos participantes
* signaling
* controle de quem está transmitindo
* controle de quem está assistindo quem

### WebRTC

Responsável por:

* áudio
* vídeo
* screen share
* conexão em tempo real
* transmissão P2P
* DataChannel quando necessário

### mediasoup

Responsável por:

* SFU
* recebimento de streams
* encaminhamento de streams
* producers
* consumers
* transports
* controle de mídia
* simulcast/SVC

### STUN/TURN

Responsável por permitir que usuários estabeleçam conexões quando NAT/firewall impedir uma conexão P2P direta.

---

## Estratégia final

```text
                    USUÁRIO
                       │
                       ▼
                 ┌───────────┐
                 │ WebRTC    │
                 └─────┬─────┘
                       │
             ┌─────────┴─────────┐
             │                   │
       Grupo pequeno       Muitos espectadores
             │                   │
             ▼                   ▼
           P2P                mediasoup
             │                   │
             └─────────┬─────────┘
                       ▼
                Apenas streams
                 necessários
                       │
                       ▼
              Qualidade adaptativa
                       │
                       ▼
                0 espectadores
                       │
                       ▼
              Pausar transmissão
```

### Princípios fundamentais

1. **Não enviar vídeo para quem não está assistindo.**
2. **Cada usuário visualiza apenas uma tela por vez.**
3. **Pausar transmissão quando não houver espectadores.**
4. **Usar 720p/30 FPS como qualidade padrão inicial.**
5. **Adaptar resolução, FPS e bitrate conforme a conexão.**
6. **Usar Simulcast/SVC quando necessário.**
7. **Usar P2P para situações pequenas e eficientes.**
8. **Usar mediasoup quando uma transmissão tiver vários espectadores.**
9. **Manter o backend separado da camada de mídia.**
10. **Usar TURN apenas quando a conexão P2P direta não for possível.**

O objetivo final é manter o **VPS responsável principalmente por autenticação, salas, chat, signaling e controle**, deixando o tráfego de mídia o mais eficiente possível.
