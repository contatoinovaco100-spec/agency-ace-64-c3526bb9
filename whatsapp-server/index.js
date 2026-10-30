// Servidor WhatsApp da INOVA (Baileys, conexão por QR Code — API não oficial), com VÁRIOS números.
// Cada número é uma "sessão" (id curto), com a própria pasta de login em AUTH_ROOT/<id>.
// Mensagens recebidas (e as enviadas pelo celular) são repassadas para a plataforma em INBOUND_URL.
// Todas as rotas, menos /status, exigem a chave WA_API_KEY (header x-api-key ou ?key=).
import express from 'express';
import pino from 'pino';
import qrcode from 'qrcode';
import fs from 'node:fs/promises';
import path from 'node:path';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.WA_API_KEY;
const AUTH_ROOT = process.env.AUTH_ROOT || './sessions';
// Sessão "default" reaproveita o login do servidor de número único (AUTH_DIR antigo)
const LEGACY_AUTH_DIR = process.env.AUTH_DIR || './auth';
const INBOUND_URL = process.env.INBOUND_URL || '';
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS || 6);
// Ao conectar um número por QR, importa as mensagens individuais desses últimos dias (até o limite)
// Importar histórico ao conectar por QR: desligado (0). Para ligar, defina HISTORY_DAYS no .env
const HISTORY_DAYS = Number(process.env.HISTORY_DAYS || 0);
const HISTORY_MAX = Number(process.env.HISTORY_MAX || 1500);
const REGISTRY = path.join(AUTH_ROOT, 'sessions.json');

if (!API_KEY || API_KEY.length < 24) {
  console.error('❌ Defina WA_API_KEY (pelo menos 24 caracteres) antes de iniciar.');
  process.exit(1);
}

const logger = pino({ level: 'warn' });
/** @type {Map<string, {id:string,name:string,sock:any,status:string,qr:string|null,number:string|null,stopped:boolean}>} */
const sessions = new Map();
let versionCache = null;

const authDir = (id) => (id === 'default' ? LEGACY_AUTH_DIR : path.join(AUTH_ROOT, id));

// ─── Nomes dos contatos (agenda do celular e nome do perfil), por telefone ───
/** @type {Map<string, Record<string,string>>} */
const contactNames = new Map();
const namesFile = (id) => path.join(AUTH_ROOT, `names-${id}.json`);
const namesSaveTimers = new Map();

async function loadNames(id) {
  if (contactNames.has(id)) return contactNames.get(id);
  let map = {};
  try { map = JSON.parse(await fs.readFile(namesFile(id), 'utf8')); } catch { /* ainda sem nomes */ }
  contactNames.set(id, map);
  return map;
}

/** Guarda o nome de um telefone. Nome da agenda vence o nome do perfil. */
function rememberName(id, phone, name, fromBook = false) {
  const map = contactNames.get(id);
  const clean = String(name || '').trim();
  if (!map || !phone || !clean || /^\+?\d+$/.test(clean)) return;
  if (!fromBook && map[phone] && map[`${phone}#book`]) return;
  if (map[phone] === clean) return;
  map[phone] = clean;
  if (fromBook) map[`${phone}#book`] = '1';
  clearTimeout(namesSaveTimers.get(id));
  namesSaveTimers.set(id, setTimeout(async () => {
    await fs.mkdir(AUTH_ROOT, { recursive: true });
    await fs.writeFile(namesFile(id), JSON.stringify(map));
  }, 2000));
}

const nameOf = (id, phone) => contactNames.get(id)?.[phone] || '';

/** Contato do Baileys → telefone. O id pode ser o telefone ou o id privado (@lid). */
async function phoneOfContact(sessionId, c) {
  for (const j of [c.id, c.phoneNumber, c.jid]) if (j && String(j).endsWith('@s.whatsapp.net')) return String(j).split('@')[0].split(':')[0];
  const lid = [c.id, c.lid].find((j) => j && String(j).endsWith('@lid'));
  if (!lid) return null;
  try { const pn = await sessions.get(sessionId)?.sock?.signalRepository?.lidMapping?.getPNForLID?.(lid);
    if (pn) return String(pn).split('@')[0].split(':')[0]; } catch { /* sem mapa */ }
  return null;
}

async function rememberContacts(sessionId, contacts) {
  for (const c of contacts || []) {
    const phone = await phoneOfContact(sessionId, c);
    if (!phone) continue;
    if (c.name) rememberName(sessionId, phone, c.name, true);
    else rememberName(sessionId, phone, c.notify || c.verifiedName || c.verifiedBizName);
  }
}

async function saveRegistry() {
  await fs.mkdir(AUTH_ROOT, { recursive: true });
  const list = [...sessions.values()].map(({ id, name }) => ({ id, name }));
  await fs.writeFile(REGISTRY, JSON.stringify(list, null, 2));
}

async function loadRegistry() {
  try { return JSON.parse(await fs.readFile(REGISTRY, 'utf8')); }
  catch { return [{ id: 'default', name: 'Principal' }]; }
}

// ─── Repasse das mensagens para a plataforma ─────────────────────────────────
function textOf(m) {
  const msg = m.message || {};
  if (msg.conversation) return { text: msg.conversation, type: 'text' };
  if (msg.extendedTextMessage?.text) return { text: msg.extendedTextMessage.text, type: 'text' };
  if (msg.imageMessage) return { text: msg.imageMessage.caption || '[imagem]', type: 'image' };
  if (msg.videoMessage) return { text: msg.videoMessage.caption || '[vídeo]', type: 'video' };
  if (msg.audioMessage) return { text: '[áudio]', type: 'audio' };
  if (msg.documentMessage) return { text: msg.documentMessage.fileName || '[documento]', type: 'document' };
  if (msg.stickerMessage) return { text: '[figurinha]', type: 'sticker' };
  return null;
}

/** Telefone (JID @s.whatsapp.net) da conversa individual. O WhatsApp pode identificar o contato por um id
 *  privado (@lid); aí usa o número alternativo da mensagem ou o mapa lid→telefone da sessão. */
async function phoneJidOf(sessionId, m) {
  const jid = m.key?.remoteJid || '';
  if (jid.endsWith('@s.whatsapp.net')) return jid;
  if (!jid.endsWith('@lid')) return null; // grupos, status, canais
  const alt = m.key?.remoteJidAlt || m.key?.senderPn;
  if (alt && String(alt).endsWith('@s.whatsapp.net')) return String(alt);
  try {
    const pn = await sessions.get(sessionId)?.sock?.signalRepository?.lidMapping?.getPNForLID?.(jid);
    if (pn) return String(pn).replace(/:\d+@/, '@');
  } catch { /* sem mapa */ }
  return null;
}

async function forward(sessionId, m) {
  if (!INBOUND_URL) return;
  const phoneJid = await phoneJidOf(sessionId, m);
  // Só conversas individuais com telefone conhecido (grupos e status ficam de fora do CRM)
  if (!phoneJid) {
    if ((m.key?.remoteJid || '').endsWith('@lid')) console.warn(`⚠️ [${sessionId}] contato @lid sem telefone conhecido`);
    return;
  }
  const content = textOf(m);
  if (!content) return;
  const phone = phoneJid.split('@')[0].split(':')[0];
  if (!m.key.fromMe && m.pushName) rememberName(sessionId, phone, m.pushName);
  const contactName = nameOf(sessionId, phone);
  const body = JSON.stringify({
    session: sessionId, phone, name: (!m.key.fromMe && m.pushName) || contactName, contactName,
    fromMe: !!m.key.fromMe, id: m.key.id, timestamp: Number(m.messageTimestamp || Date.now() / 1000), ...content,
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(INBOUND_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY }, body });
      if (res.ok) return;
    } catch { /* tenta de novo */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.warn(`⚠️ Não consegui repassar mensagem de ${sessionId}`);
}

// ─── Sessões ─────────────────────────────────────────────────────────────────
async function startSession(id, name) {
  const existing = sessions.get(id);
  const s = existing ?? { id, name, sock: null, status: 'DISCONNECTED', qr: null, number: null, stopped: false };
  s.name = name ?? s.name; s.stopped = false;
  sessions.set(id, s);

  await loadNames(id);
  const { state, saveCreds } = await useMultiFileAuthState(authDir(id));
  versionCache ??= (await fetchLatestBaileysVersion()).version;
  // syncFullHistory: ao conectar por QR o celular manda a agenda (nomes) e o histórico; o histórico só é importado se HISTORY_DAYS > 0
  const sock = makeWASocket({ version: versionCache, logger, auth: state, syncFullHistory: true });
  s.sock = sock;
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) { s.qr = await qrcode.toDataURL(qr); s.status = 'QR_CODE'; }
    if (connection === 'open') {
      s.qr = null; s.status = 'CONNECTED'; s.number = sock.user?.id?.split(':')[0] ?? null;
      console.log(`✅ [${id}] conectado: ${s.number}`);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      s.status = 'DISCONNECTED';
      if (s.stopped) return;
      // Deslogado pelo celular ou sessão corrompida: apaga o login e gera QR novo
      const reset = code === DisconnectReason.loggedOut || code === DisconnectReason.badSession;
      console.log(`⚠️ [${id}] conexão fechada (${code}). ${reset ? 'Gerando QR novo.' : 'Reconectando…'}`);
      if (reset) { await fs.rm(authDir(id), { recursive: true, force: true }); s.number = null; }
      setTimeout(() => startSession(id), reset ? 1000 : 3000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) if (m.message) await forward(id, m);
  });

  // Histórico que o celular manda ao conectar por QR: importa as conversas individuais dos últimos dias
  sock.ev.on('contacts.upsert', (list) => rememberContacts(id, list));
  sock.ev.on('contacts.update', (list) => rememberContacts(id, list));

  sock.ev.on('messaging-history.set', async ({ messages, contacts }) => {
    await rememberContacts(id, contacts);
    if (HISTORY_DAYS <= 0) return;
    const since = Date.now() / 1000 - HISTORY_DAYS * 86400;
    const recent = (messages || [])
      .filter((m) => m.message && Number(m.messageTimestamp || 0) >= since)
      .sort((a, b) => Number(a.messageTimestamp) - Number(b.messageTimestamp))
      .slice(-HISTORY_MAX);
    if (!recent.length) return;
    console.log(`📥 [${id}] importando ${recent.length} mensagens do histórico`);
    for (const m of recent) { await forward(id, m); await new Promise((r) => setTimeout(r, 150)); }
  });
  return s;
}

const publicInfo = (s) => ({ id: s.id, name: s.name, status: s.status, number: s.status === 'CONNECTED' ? s.number : null, hasQR: !!s.qr });
const getSession = (id) => sessions.get(id || 'default') ?? [...sessions.values()].find((s) => s.status === 'CONNECTED');

// ─── API ─────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '100kb' }));
const auth = (req, res, next) => {
  if ((req.get('x-api-key') || req.query.key) !== API_KEY) return res.status(401).json({ error: 'Chave inválida' });
  next();
};

/** Telefone (com DDI) ou id de grupo (…@g.us) → JID */
function toJid(to) {
  const s = String(to || '').trim();
  if (s.endsWith('@g.us')) return s;
  if (/^\d{10,}-\d+$/.test(s)) return `${s}@g.us`;
  const digits = s.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `${digits.length <= 11 ? `55${digits}` : digits}@s.whatsapp.net`;
}

// Compatível com o servidor de número único: status do número principal
app.get('/status', (_req, res) => {
  const s = sessions.get('default') ?? [...sessions.values()][0];
  res.json({ status: s?.status ?? 'DISCONNECTED', number: s?.status === 'CONNECTED' ? s.number : null, paused: process.env.SEND_PAUSED === '1', sessions: sessions.size });
});

app.get('/sessions', auth, (_req, res) => res.json({ sessions: [...sessions.values()].map(publicInfo) }));

app.post('/sessions', auth, async (req, res) => {
  if (sessions.size >= MAX_SESSIONS) return res.status(400).json({ error: `Limite de ${MAX_SESSIONS} números neste servidor` });
  const name = String(req.body?.name || '').trim().slice(0, 60) || 'Novo número';
  const id = String(req.body?.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || `n${Date.now().toString(36)}`;
  if (sessions.has(id)) return res.status(409).json({ error: 'Já existe um número com esse id' });
  const s = await startSession(id, name);
  await saveRegistry();
  res.json(publicInfo(s));
});

app.patch('/sessions/:id', auth, async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Número não encontrado' });
  if (req.body?.name) s.name = String(req.body.name).slice(0, 60);
  await saveRegistry();
  res.json(publicInfo(s));
});

// QR como imagem (data URL), para mostrar dentro da plataforma
app.get('/sessions/:id/contacts', auth, async (req, res) => {
  const map = await loadNames(req.params.id);
  res.json({ contacts: Object.fromEntries(Object.entries(map).filter(([k]) => !k.includes('#'))) });
});

app.get('/sessions/:id/qr', auth, (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Número não encontrado' });
  res.json({ ...publicInfo(s), qr: s.qr });
});

app.post('/sessions/:id/logout', auth, async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Número não encontrado' });
  try { await s.sock?.logout(); } catch { /* já desconectado */ }
  res.json({ ok: true });
});

app.delete('/sessions/:id', auth, async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Número não encontrado' });
  s.stopped = true;
  try { await s.sock?.logout(); } catch { /* ignora */ }
  try { s.sock?.end?.(); } catch { /* ignora */ }
  sessions.delete(s.id);
  await fs.rm(authDir(s.id), { recursive: true, force: true });
  await saveRegistry();
  res.json({ ok: true });
});

app.get('/groups', auth, async (req, res) => {
  const s = getSession(req.query.session);
  if (!s || s.status !== 'CONNECTED') return res.status(503).json({ error: 'WhatsApp não conectado' });
  try {
    const groups = await s.sock.groupFetchAllParticipating();
    res.json({ groups: Object.values(groups).map((g) => ({ id: g.id, name: g.subject })).sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Envia texto: { to, message, session? } (sem session usa o principal)
app.post('/send', auth, async (req, res) => {
  if (process.env.SEND_PAUSED === '1') return res.status(423).json({ error: 'Envios pausados no servidor' });
  const s = getSession(req.body?.session);
  const jid = toJid(req.body?.to ?? req.body?.phone);
  const message = String(req.body?.message || '').slice(0, 4000);
  if (!jid || !message) return res.status(400).json({ error: 'Informe "to" (telefone ou grupo) e "message"' });
  if (!s || s.status !== 'CONNECTED') return res.status(503).json({ error: `Número ${req.body?.session || 'principal'} não conectado` });
  try {
    const result = await s.sock.sendMessage(jid, { text: message });
    res.json({ ok: true, messageId: result?.key?.id, session: s.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Página para escanear (compatível com o link antigo /qr?key=…&session=…)
app.get('/qr', auth, (req, res) => {
  const s = sessions.get(String(req.query.session || 'default'));
  res.set('Content-Type', 'text/html; charset=utf-8');
  const body = !s ? '<h1>Número não encontrado</h1>'
    : s.status === 'CONNECTED' ? `<h1>✅ ${s.name} conectado</h1><p>${s.number ?? ''}</p>`
    : s.qr ? `<h1>Escaneie com o WhatsApp — ${s.name}</h1><p>WhatsApp → Aparelhos conectados → Conectar um aparelho</p><img src="${s.qr}" width="300" height="300"/>`
    : '<h1>Gerando QR Code…</h1>';
  res.send(`<!doctype html><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="5"><body style="font-family:system-ui;text-align:center;padding:40px">${body}</body>`);
});

app.listen(PORT, async () => {
  console.log(`🚀 Servidor WhatsApp na porta ${PORT}`);
  for (const { id, name } of await loadRegistry()) {
    await startSession(id, name);
    await new Promise((r) => setTimeout(r, 1500));
  }
  await saveRegistry();
});
