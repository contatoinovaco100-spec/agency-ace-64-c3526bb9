# Servidor WhatsApp INOVA CRM

Servidor Node.js que conecta ao WhatsApp via QR Code (Baileys) e sincroniza mensagens com o Supabase em tempo real.

## 🚀 Deploy no Fly.io (passo a passo)

### 1. Instalar o flyctl

**Mac/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows (PowerShell):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

### 2. Fazer login

```bash
fly auth login
```
(abre o navegador, faça login/cadastro com cartão — não cobra no free tier)

### 3. Entrar na pasta do servidor

```bash
cd whatsapp-server
```

### 4. Criar o app no Fly.io (primeira vez apenas)

```bash
fly launch --no-deploy
```

Quando perguntar:
- **App name**: aceite o sugerido ou escolha `inova-whatsapp-SEUNOME`
- **Region**: escolha `gru` (São Paulo)
- **Postgres/Redis**: NÃO
- **Deploy now**: NÃO

### 5. Criar volume persistente (guarda a sessão do WhatsApp)

```bash
fly volumes create wa_session --size 1 --region gru
```

### 6. Configurar as variáveis de ambiente (secrets)

```bash
fly secrets set \
  SUPABASE_URL="https://coblfehkclfjofrshlwl.supabase.co" \
  SUPABASE_SERVICE_KEY="COLE_AQUI_A_SERVICE_ROLE_KEY"
```

> ⚠️ A `SERVICE_ROLE_KEY` você pega no Lovable: vai em **Backend → Settings → API Keys → service_role**.

### 7. Deploy!

```bash
fly deploy
```

Aguarde uns 2 minutos. Quando terminar, vai mostrar a URL do servidor (algo como `https://inova-whatsapp.fly.dev`).

### 8. Ver os logs e o QR Code

```bash
fly logs
```

Ou acesse no app Lovable: **WhatsApp → Configuração** — o QR Code vai aparecer lá automaticamente. Escaneie com seu WhatsApp e pronto! 🎉

---

## 🛠️ Comandos úteis

- **Ver logs**: `fly logs`
- **Reiniciar**: `fly apps restart inova-whatsapp`
- **Status**: `fly status`
- **Re-deploy** (após mudanças no código): `fly deploy`

## 💰 Custos

Free tier do Fly.io inclui:
- 3 máquinas `shared-cpu-1x` 256MB grátis (usamos 1 com 512MB)
- 3GB de volume grátis (usamos 1GB)
- Bandwidth gratuito generoso

Para 1 conta WhatsApp pessoal/empresa pequena: **R$ 0/mês** se ficar dentro do free tier.
