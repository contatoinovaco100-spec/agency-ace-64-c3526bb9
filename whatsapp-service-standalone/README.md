# WhatsApp Service - Fly.io Deploy

## Quick Deploy

```bash
# 1. Install Fly CLI
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"

# 2. Login
fly auth login

# 3. Deploy
cd whatsapp-service-standalone
fly launch --name inova-whatsapp --org personal --region gru

# 4. Create volume
fly volume create whatsapp_data --size 1 --region gru

# 5. Deploy
fly deploy
```

## Endpoints

| Endpoint | Method | Description |
|---------|--------|-------------|
| `/status` | GET | Check connection status |
| `/chats` | GET | List all conversations |
| `/messages?phone=55xxx` | GET | Get messages from contact |
| `/send-text` | POST | Send message (body: `{phone, message}`) |

## After Deploy

1. **Scan QR Code**: Check logs with `fly logs` and scan the QR code with your WhatsApp
2. **Test**: Access `https://inova-whatsapp.fly.dev/status`

## Troubleshooting

```bash
# View logs
fly logs

# Check status
fly status

# SSH into machine
fly ssh shell

# Restart
fly restart
```