#!/usr/bin/env bash
# Instala o servidor WhatsApp numa máquina Ubuntu (Oracle Cloud Always Free).
# Uso: WA_API_KEY=... bash setup-oracle.sh
# Fica em /opt/inova-whatsapp, roda como serviço (reinicia sozinho) e atende em HTTPS via Caddy
# no endereço <IP>.sslip.io (certificado gratuito, sem precisar de domínio).
set -euo pipefail
: "${WA_API_KEY:?Defina WA_API_KEY}"

sudo apt-get update -y
sudo apt-get install -y curl ca-certificates debian-keyring debian-archive-keyring apt-transport-https gnupg

# Node 20
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Caddy (HTTPS automático)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -y && sudo apt-get install -y caddy
fi

sudo mkdir -p /opt/inova-whatsapp
sudo cp index.js package.json /opt/inova-whatsapp/
sudo chown -R "$USER" /opt/inova-whatsapp
cd /opt/inova-whatsapp && npm install --omit=dev

sudo tee /etc/systemd/system/inova-whatsapp.service >/dev/null <<UNIT
[Unit]
Description=Servidor WhatsApp INOVA
After=network-online.target
[Service]
User=$USER
WorkingDirectory=/opt/inova-whatsapp
Environment=PORT=8080
Environment=WA_API_KEY=$WA_API_KEY
Environment=AUTH_DIR=/opt/inova-whatsapp/auth
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT

IP=$(curl -fsS https://api.ipify.org)
sudo tee /etc/caddy/Caddyfile >/dev/null <<CADDY
${IP//./-}.sslip.io {
  reverse_proxy localhost:8080
}
CADDY

# Libera 80/443 no firewall do Ubuntu da Oracle (a lista de segurança da VCN também precisa liberar)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
sudo sh -c 'command -v netfilter-persistent >/dev/null && netfilter-persistent save' || true

sudo systemctl daemon-reload
sudo systemctl enable --now inova-whatsapp
sudo systemctl restart caddy

echo
echo "✅ Pronto. Endereço do servidor: https://${IP//./-}.sslip.io"
echo "   QR Code: https://${IP//./-}.sslip.io/qr?key=<WA_API_KEY>"
