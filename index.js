import makeWASocket, {
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

const logger = pino({
    level: 'silent',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});

async function startBot() {
    console.log("🚀 Iniciando o Bot do Jesus...");

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`📡 Versão Baileys: ${version.join('.')}, Atual: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        markOnlineOnConnect: true,
        syncFullHistory: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("🔥 QR Code gerado! Escaneie com o WhatsApp:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
                : true;

            console.log(`❌ Conexão fechada: ${lastDisconnect?.error?.message || 'Desconhecido'}`);

            if (shouldReconnect) {
                console.log("🔄 Reconectando em 3 segundos...");
                setTimeout(startBot, 3000);
            } else {
                console.log("🚫 Logout detectado. Delete a pasta 'auth_info_baileys' e rode novamente.");
            }
        }

        if (connection === 'open') {
            console.log("✅ BOT CONECTADO COM SUCESSO PORRA! 🎉");
            console.log(`👑 Número: ${sock.user.id.split(':')[0]}`);
        }
    });

    sock.ev.on('connection.update', async (update) => {
        if (!sock.authState.creds.registered && update.connection === 'connecting') {
            try {
                console.log("📲 Modo Pairing Code ativado.");
                const phoneNumber = '5518996931637'; // ← MUDA PRO TEU NÚMERO
                const code = await sock.requestPairingCode(phoneNumber);
                console.log("🔑 SEU CÓDIGO DE PAIRING:");
                console.log(`\x1b[32m${code}\x1b[0m`);
                console.log("Abra o WhatsApp → Dispositivos Vinculados → Vincular um dispositivo → Com código");
            } catch (err) {
                console.error("Erro ao gerar pairing code:", err);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        console.log(`📩 Mensagem de ${from}: ${text}`);

        if (text.toLowerCase() === '!ping') {
            await sock.sendMessage(from, { text: '🏓 Porra, tô vivo caralho!' });
        }

        if (text.toLowerCase() === '!menu') {
            const menu = `╭━━━ *BOT DO JESUS* ━━━╮
📍 !ping
📍 !menu
📍 Em breve mais comandos...
╰━━━━━━━━━━━━━━━╯`;
            await sock.sendMessage(from, { text: menu });
        }
    });

    return sock;
}

startBot().catch(err => {
    console.error("💥 ERRO FATAL:", err);
});
