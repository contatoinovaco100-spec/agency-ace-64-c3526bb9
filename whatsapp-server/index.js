// Servidor WhatsApp usando Baileys
// Conecta via QR Code, sincroniza com Supabase em tempo real
import express from 'express';
import pino from 'pino';
import qrcode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';

// ===== Configuração =====
const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SESSION_ID = process.env.SESSION_ID || 'default';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltando SUPABASE_URL ou SUPABASE_SERVICE_KEY nas envs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const logger = pino({ level: 'warn' });

let sock = null;
let currentQR = null;
let currentStatus = 'DISCONNECTED';

// ===== Atualiza status no Supabase =====
async function updateSession(status, qrDataUrl = null) {
  currentStatus = status;
  currentQR = qrDataUrl;
  try {
    await supabase.from('wa_sync_v1').upsert({
      id: SESSION_ID,
      status,
      qr_code: qrDataUrl,
      updated_at: new Date().toISOString(),
    });
    console.log(`📡 Status: ${status}`);
  } catch (err) {
    console.error('Erro ao salvar sessão:', err.message);
  }
}

// ===== Salvar mensagem recebida no Supabase =====
async function saveIncomingMessage(msg) {
  try {
    const from = msg.key.remoteJid;
    if (!from || from.endsWith('@g.us')) return; // ignora grupos por enquanto

    const phone = from.replace('@s.whatsapp.net', '');
    const contactName = msg.pushName || phone;

    let content = '';
    let type = 'text';
    if (msg.message?.conversation) content = msg.message.conversation;
    else if (msg.message?.extendedTextMessage?.text) content = msg.message.extendedTextMessage.text;
    else if (msg.message?.imageMessage) { content = msg.message.imageMessage.caption || '[imagem]'; type = 'image'; }
    else if (msg.message?.videoMessage) { content = msg.message.videoMessage.caption || '[vídeo]'; type = 'video'; }
    else if (msg.message?.audioMessage) { content = '[áudio]'; type = 'audio'; }
    else if (msg.message?.documentMessage) { content = msg.message.documentMessage.fileName || '[documento]'; type = 'document'; }
    else content = '[mensagem]';

    // Busca ou cria conversa
    const { data: existing } = await supabase
      .from('wa_conversations')
      .select('id, unread_count')
      .eq('contact_phone', phone)
      .maybeSingle();

    let convId = existing?.id;
    if (!convId) {
      const { data: leadMatch } = await supabase
        .from('leads').select('id').ilike('phone', `%${phone.slice(-8)}%`).maybeSingle();
      const { data: clientMatch } = await supabase
        .from('clients').select('id').ilike('phone', `%${phone.slice(-8)}%`).maybeSingle();

      const { data: newConv } = await supabase
        .from('wa_conversations')
        .insert({
          contact_phone: phone,
          contact_name: contactName,
          last_message: content,
          last_message_at: new Date().toISOString(),
          unread_count: msg.key.fromMe ? 0 : 1,
          lead_id: leadMatch?.id || null,
          client_id: clientMatch?.id || null,
        })
        .select('id').single();
      convId = newConv?.id;
    } else {
      await supabase.from('wa_conversations').update({
        contact_name: contactName,
        last_message: content,
        last_message_at: new Date().toISOString(),
        unread_count: msg.key.fromMe ? (existing.unread_count || 0) : (existing.unread_count || 0) + 1,
      }).eq('id', convId);
    }

    await supabase.from('wa_messages').insert({
      conversation_id: convId,
      wa_message_id: msg.key.id,
      direction: msg.key.fromMe ? 'out' : 'in',
      type,
      content,
      status: msg.key.fromMe ? 'sent' : 'received',
    });
  } catch (err) {
    console.error('Erro ao salvar mensagem:', err.message);
  }
}

// ===== Conectar ao WhatsApp =====
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('/app/auth');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    browser: ['INOVA CRM', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrDataUrl = await qrcode.toDataURL(qr);
      await updateSession('QR_CODE', qrDataUrl);
    }

    if (connection === 'open') {
      await updateSession('CONNECTED', null);
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      await updateSession('DISCONNECTED', null);
      console.log('⚠️ Conexão fechada. Reconectar?', shouldReconnect);
      if (shouldReconnect) setTimeout(connectToWhatsApp, 3000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      await saveIncomingMessage(msg);
    }
  });
}

// ===== API HTTP =====
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: currentStatus, hasQR: !!currentQR });
});

app.get('/qr', (req, res) => {
  res.json({ status: currentStatus, qr: currentQR });
});

// Endpoint chamado pela edge function quando o user envia mensagem pelo painel
app.post('/send', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone e message obrigatórios' });
    if (!sock || currentStatus !== 'CONNECTED') return res.status(503).json({ error: 'WhatsApp não conectado' });

    const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    const result = await sock.sendMessage(jid, { text: message });
    res.json({ ok: true, messageId: result?.key?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Forçar reset (escanear QR de novo)
app.post('/logout', async (req, res) => {
  try {
    if (sock) await sock.logout();
    await updateSession('DISCONNECTED', null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor WhatsApp rodando na porta ${PORT}`);
  connectToWhatsApp().catch(err => {
    console.error('Erro ao iniciar WA:', err);
    process.exit(1);
  });
});
