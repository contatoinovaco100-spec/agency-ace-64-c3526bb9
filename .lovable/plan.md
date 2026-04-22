

## Plano: WhatsApp Cloud API + CRM (defaults aplicados)

### Decisões automáticas que tomei pra você

- **Phone Number ID**: já capturei do print → `1166311709888295`
- **Token**: começo com seu token atual (24h) só pra validar a integração. Crio tela `/whatsapp/config` pra você colar o token permanente quando gerar o System User
- **WABA ID**: deixo campo na tela `/whatsapp/config` — você cola quando achar (te explico onde no final)
- **Número**: assumo que está verificado e pronto

### O que vou construir

**1. Tela de configuração** — `/whatsapp/config` (só admin)
- Campos: Phone Number ID (já preenchido `1166311709888295`), WABA ID, Access Token, Verify Token (gero automático: `inova-wa-verify-2026`)
- Tudo salvo como **secrets criptografados** no backend, nunca exposto no frontend
- Botão **"Testar conexão"** — faz uma chamada real pra Meta API e mostra ✓ Conectado / ✗ Erro com mensagem clara
- Mostra a URL exata do webhook pra você colar no Meta

**2. Inbox de conversas** — `/whatsapp`
- Layout estilo WhatsApp Web: lista de conversas (esquerda) + chat (centro) + painel do lead/cliente vinculado (direita)
- Mensagens em **tempo real** via Supabase Realtime (chega na hora)
- Suporte a: texto, imagem, áudio, vídeo, documento, emoji
- Confirmações ✓ enviado, ✓✓ entregue, ✓✓ azul lido
- Badge de não lidas, busca por nome/telefone

**3. Vínculo automático com CRM**
- Mensagem chega → busca telefone em `leads` e `clients` → vincula sozinho
- Se não achar → botão "Criar lead" no topo da conversa abre modal pré-preenchido
- Card do lead/cliente ganha aba "Conversas WhatsApp" com histórico

**4. Disparo de mensagens**
- Botão **"Enviar WhatsApp"** em todo card do CRM, cliente e tarefa (substitui os links wa.me atuais)
- **Templates HSM** pré-aprovados pelo Meta (necessários pra abrir conversa fora da janela de 24h)
- Modal de **disparo em massa**: seleciona leads do funil + escolhe template + variáveis `{{nome}}`, `{{empresa}}`

**5. Notificações**
- Sino do CRM pisca em mensagem nova
- Badge de não lidas no menu lateral
- `/whatsapp` adicionado ao registry → aparece automático nas permissões

### Arquitetura

```text
SEU CELULAR (WhatsApp Business +55 24 98157-6858)
         │
         ▼
    Meta Cloud API
         │
         ├── envia ◄── Edge Function "wa-send" ◄── CRM (botão "Enviar")
         │
         └── recebe ──► Edge Function "wa-webhook" ──► Supabase
                                                          │
                                                    Realtime
                                                          │
                                                          ▼
                                                       CRM (inbox)
```

### Banco de dados (3 tabelas novas)

- **`wa_conversations`** — id, contact_phone, contact_name, last_message, last_message_at, unread_count, lead_id?, client_id?
- **`wa_messages`** — id, conversation_id, wa_message_id, direction (in/out), type (text/image/audio/video/document/template), content, media_url, status (sent/delivered/read/failed), created_at
- **`wa_templates`** — id, name, language, category, body_text, variables (cache dos templates aprovados)

Realtime habilitado nas duas primeiras. RLS: admin + quem tem `/whatsapp` liberado.

### Edge Functions (4)

- **`wa-config-test`** — valida token+IDs com a Meta API e retorna status
- **`wa-send`** — envia mensagem (texto livre dentro de 24h ou template HSM fora)
- **`wa-webhook`** — endpoint público que o Meta chama; valida `verify_token`, salva mensagem, dispara realtime
- **`wa-templates-sync`** — busca templates aprovados do Meta e cacheia local

### Secrets que vou pedir pra adicionar

- `META_WA_TOKEN` (você cola o token de 24h agora pra testar)
- `META_WA_PHONE_ID` = `1166311709888295` (já tenho)
- `META_WA_BUSINESS_ID` (você cola depois quando achar o WABA ID)
- `META_WA_VERIFY_TOKEN` = `inova-wa-verify-2026` (eu gero)

### O que VOCÊ faz no Meta (te guio passo a passo)

1. **Achar o WABA ID** (3 cliques): Meta Business Suite → Configurações → Contas do WhatsApp → copiar o ID
2. **Configurar webhook** (depois que eu deployar): colar a URL `https://cdzzewovtxotkghzeafr.supabase.co/functions/v1/wa-webhook` + verify token `inova-wa-verify-2026` na aba "Configuração" → "Webhooks" → assinar evento `messages`
3. **Trocar token** (depois, quando quiser produção): Business Settings → System Users → Create → Generate Token (permanente)

### Limitações importantes (transparência)

- **Janela de 24h**: texto livre só se cliente respondeu nas últimas 24h. Fora disso, **só templates aprovados** pelo Meta (aprovação leva ~1h, é grátis)
- **Templates iniciais**: vou deixar 3 templates de exemplo pra você submeter pro Meta aprovar ("primeira abordagem", "follow-up proposta", "lembrete reunião")
- **Custo**: grátis até 1.000 conversas/mês, depois ~R$ 0,40/conversa
- **Sem QR Code**: conexão é via token oficial, mais estável

### Ordem de implementação

1. Migração do banco (3 tabelas + RLS + realtime)
2. Adicionar 4 secrets no Supabase
3. Edge Functions (`wa-config-test`, `wa-send`, `wa-webhook`, `wa-templates-sync`)
4. Página `/whatsapp/config` com teste de conexão
5. Página `/whatsapp` (inbox completo + realtime)
6. Substituir botões wa.me por "Enviar WhatsApp" nativo no CRM/clientes/tarefas
7. Modal de disparo em massa com templates
8. Notificações no sino e menu lateral
9. Adicionar `/whatsapp` no registry `src/config/app-pages.ts`
10. Te passo print do caminho exato pra colar webhook no Meta

