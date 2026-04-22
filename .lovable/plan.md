

## Finalizar integração WhatsApp via Fly.io

Servidor já está no ar em `https://inova-whatsapp.fly.dev`. Faltam 4 ajustes pra tudo funcionar.

### 1. Corrigir erro de build (bloqueia deploy do app)
O arquivo `supabase/functions/wa-webhook/index.ts` tem erro de TypeScript na linha 108 (`'existing' is possibly 'null'`). Adicionar verificação de null antes de acessar `existing.unread_count`.

### 2. Apontar painel WhatsApp para o servidor Fly.io
O `src/components/crm/WhatsAppPanel.tsx` chama `http://localhost:3001` (só funciona no seu Mac). Trocar por `https://inova-whatsapp.fly.dev` para funcionar em produção, no celular, em qualquer lugar.

### 3. Exibir QR Code direto no painel
Adicionar endpoint `/qr` no servidor (`whatsapp-service-standalone/index.ts`) que retorna o QR em formato data-URL, e atualizar o `WhatsAppPanel.tsx` para fazer polling desse endpoint quando o status for `DISCONNECTED` — assim você escaneia direto na interface, sem precisar de `fly logs`.

### 4. Cadastrar `WA_SERVER_URL` nos secrets
Adicionar o secret `WA_SERVER_URL = https://inova-whatsapp.fly.dev` para a edge function `wa-baileys-send` poder enviar mensagens via servidor Fly.

### Comandos que VOCÊ precisa rodar no terminal (depois das correções)

```bash
cd "/Users/lucassoares/Desktop/Inova/Inova Lab/whatsapp-service-standalone"

# Cria volume persistente (sessão sobrevive a reinícios)
fly volume create whatsapp_data --size 1 --region gru

# Re-deploy com as correções do servidor
fly deploy
```

Depois disso, abra o painel WhatsApp no CRM — o QR Code aparece na tela, você escaneia, e tá conectado 24/7.

### Observações técnicas

- A URL correta é `https://inova-whatsapp.fly.dev` (sem `:3001` — o Fly faz o proxy automático da porta interna 3001 pra 443/HTTPS).
- Sem o volume, **toda vez que a máquina reiniciar** (deploy, restart) você perde a sessão e precisa escanear o QR de novo. Por isso o passo do volume é importante.
- O painel vai mostrar status em tempo real: Conectado / Aguardando QR / Desconectado.

