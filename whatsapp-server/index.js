// Servidor WhatsApp da INOVA (Baileys, conexão por QR Code — API não oficial)
// Roda 24h numa máquina (Oracle Cloud Always Free) e é chamado pela plataforma para mandar mensagens.
// Todas as rotas, menos /status, exigem a chave WA_API_KEY (header x-api-key ou ?key=).
import express from 'express';
import pino from 'pino';
import qrcode from 'qrcode';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.WA_API_KEY;
const AUTH_DIR = process.env.AUTH_DIR || './auth';

if (!API_KEY || API_KEY.length < 24) {
  console.error('❌ Defina WA_API_KEY (pelo menos 24 caracteres) antes de iniciar.');
  process.exit(1);
}

const logger = pino({ level: 'warn' });
let sock = null;
let currentQR = null;
let currentStatus = 'DISCONNECTED';
let me = null;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({ version, logger, printQRInTerminal: false, auth: state, browser: ['INOVA', 'Chrome', '1.0.0'] });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      currentQR = await qrcode.toDataURL(qr);
      currentStatus = 'QR_CODE';
      console.log('📱 QR Code novo disponível em /qr');
    }
    if (connection === 'open') {
      currentQR = null;
      currentStatus = 'CONNECTED';
      me = sock.user?.id?.split(':')[0] ?? null;
      console.log('✅ WhatsApp conectado:', me);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      currentStatus = 'DISCONNECTED';
      // Deslogado pelo celular: precisa escanear de novo (a pasta de sessão fica inválida)
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`⚠️ Conexão fechada (${code}). ${loggedOut ? 'Deslogado: escaneie o QR de novo.' : 'Reconectando…'}`);
      if (loggedOut) {
        const fs = await import('node:fs/promises');
        await fs.rm(AUTH_DIR, { recursive: true, force: true });
      }
      setTimeout(connectToWhatsApp, loggedOut ? 1000 : 3000);
    }
  });
}

const app = express();
app.use(express.json({ limit: '100kb' }));

const auth = (req, res, next) => {
  const key = req.get('x-api-key') || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: 'Chave inválida' });
  next();
};

/** Número de telefone (com DDI) ou id de grupo (…@g.us) → JID do WhatsApp */
function toJid(to) {
  const s = String(to || '').trim();
  if (s.endsWith('@g.us')) return s;
  if (/^\d{10,}-\d+$/.test(s)) return `${s}@g.us`; // formato antigo de grupo
  const digits = s.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `${digits.length <= 11 ? `55${digits}` : digits}@s.whatsapp.net`;
}

app.get('/status', (_req, res) => res.json({ status: currentStatus, number: currentStatus === 'CONNECTED' ? me : null }));

// Página para escanear o QR Code (WhatsApp → Aparelhos conectados → Conectar um aparelho)
app.get('/qr', auth, (_req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  const body = currentStatus === 'CONNECTED'
    ? `<h1>✅ Conectado</h1><p>Número: ${me ?? ''}</p>`
    : currentQR
      ? `<h1>Escaneie com o WhatsApp</h1><p>WhatsApp → Aparelhos conectados → Conectar um aparelho</p><img src="${currentQR}" width="300" height="300"/><p>A página atualiza sozinha.</p>`
      : '<h1>Gerando QR Code…</h1>';
  res.send(`<!doctype html><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="5"><body style="font-family:system-ui;text-align:center;padding:40px">${body}</body>`);
});

// Grupos em que o número está (para escolher o grupo de cada cliente na plataforma)
app.get('/groups', auth, async (_req, res) => {
  try {
    if (currentStatus !== 'CONNECTED') return res.status(503).json({ error: 'WhatsApp não conectado' });
    const groups = await sock.groupFetchAllParticipating();
    res.json({ groups: Object.values(groups).map((g) => ({ id: g.id, name: g.subject })).sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Envia texto para um telefone ou grupo: { to, message } (aceita também { phone, message })
app.post('/send', auth, async (req, res) => {
  try {
    const jid = toJid(req.body?.to ?? req.body?.phone);
    const message = String(req.body?.message || '').slice(0, 4000);
    if (!jid || !message) return res.status(400).json({ error: 'Informe "to" (telefone ou grupo) e "message"' });
    if (currentStatus !== 'CONNECTED') return res.status(503).json({ error: 'WhatsApp não conectado' });
    const result = await sock.sendMessage(jid, { text: message });
    res.json({ ok: true, messageId: result?.key?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/logout', auth, async (_req, res) => {
  try {
    if (sock) await sock.logout();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp na porta ${PORT}`);
  connectToWhatsApp();
});
