import express from 'express';
import {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeInMemoryStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import pino from 'pino';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = pino({ level: 'silent' });
const store = makeInMemoryStore({ logger });

const STORE_FILE = './baileys_store.json';

if (existsSync(STORE_FILE)) {
    try {
        store.readFromFile(STORE_FILE);
    } catch (e) {
        console.log('Erro ao ler store, criando novo...');
    }
}

setInterval(() => {
    try {
        store.writeToFile(STORE_FILE);
    } catch (e) {
        console.log('Erro ao salvar store');
    }
}, 10000);

let sock: any = null;
let qrCodeValue: string | null = null;
let connectionStatus: string = 'DISCONNECTED';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    
    sock = makeWASocket({
        version,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
    });

    store.bind(sock.ev);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            qrCodeValue = qr;
            console.log('--- SCANNEIE O QR CODE ---');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            qrCodeValue = null;
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            connectionStatus = 'DISCONNECTED';
            console.log('Conexão fechada. Reconectando...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            qrCodeValue = null;
            connectionStatus = 'CONNECTED';
            console.log('✅ WHATSAPP CONECTADO!');
        }
    });
}

const app = express();
app.use(express.json());

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

app.options('*', (req, res) => {
    res.set(corsHeaders).send();
});

app.get('/status', (req, res) => {
    res.set(corsHeaders).json({ 
        connected: connectionStatus === 'CONNECTED', 
        status: connectionStatus, 
        qr: qrCodeValue 
    });
});

app.get('/qr', async (req, res) => {
    try {
        if (!qrCodeValue) {
            res.set(corsHeaders).json({ qr: null, status: connectionStatus });
            return;
        }
        const dataUrl = await QRCode.toDataURL(qrCodeValue, { width: 320, margin: 1 });
        res.set(corsHeaders).json({ qr: dataUrl, raw: qrCodeValue, status: connectionStatus });
    } catch (err: any) {
        res.set(corsHeaders).status(500).json({ error: err.message });
    }
});

app.get('/chats', (req, res) => {
    const chats = store.chats.all().map((c: any) => ({
        id: c.id,
        name: c.name || c.id.split('@')[0],
        unreadCount: c.unreadCount || 0,
        lastMessage: ""
    }));
    res.set(corsHeaders).json(chats);
});

app.get('/messages', (req, res) => {
    const phone = req.query.phone as string;
    if (!phone) {
        res.set(corsHeaders).status(400).json({ error: "Phone required" });
        return;
    }
    const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    const messages = store.messages[jid]?.all() || [];
    res.set(corsHeaders).json(messages);
});

app.post('/send-text', async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) {
            res.set(corsHeaders).status(400).json({ error: "Phone and message required" });
            return;
        }
        const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });
        res.set(corsHeaders).json({ success: true });
    } catch (err: any) {
        res.set(corsHeaders).status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => {
    res.set(corsHeaders).json({ 
        service: 'WhatsApp Baileys Service', 
        status: connectionStatus,
        endpoints: ['/status', '/chats', '/messages', '/send-text']
    });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`📡 Servidor rodando na porta ${PORT}`);
    connectToWhatsApp();
});
