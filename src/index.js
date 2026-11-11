/**
 * Bot de WhatsApp — cambia su PROPIA foto de perfil.
 * Login por código de 8 dígitos (pairing code), sin QR.
 *
 * El número del BOT se pide por CONSOLA al arrancar (no va en el código).
 * Solo el SUPER OWNER puede usar .foto.
 *
 * Comandos:
 *   .foto   -> (solo owner) responde/manda una imagen y se la pone como foto de perfil
 *   .ping   -> responde "pong" (para probar que está vivo)
 *
 * Arranque:
 *   1) npm install
 *   2) npm start
 *   3) La consola te pedirá el número del bot -> escríbelo (lada, solo dígitos). Ej: 5218132546576
 *   4) Te mostrará un código de 8 dígitos
 *   5) WhatsApp (del bot) > Dispositivos vinculados > Vincular dispositivo > Vincular con número > mete el código
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');

// === CONFIG ===
const PREFIJO = '.';
// Super owner (quien manda). Se compara por los últimos 10 dígitos para
// ignorar el "1" extra de México (52 vs 521).
const SUPER_OWNER = '528132546576';
// ==============

// Pregunta por consola
function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(texto, (r) => { rl.close(); res(r); }));
}

// Deja solo dígitos
const soloDigitos = (s) => (s || '').replace(/\D/g, '');

// ¿El remitente es el super owner? (compara últimos 10 dígitos)
function esOwner(jid) {
  const num = soloDigitos(jid.split('@')[0].split(':')[0]);
  return num.slice(-10) === SUPER_OWNER.slice(-10);
}

async function iniciar() {
  const { state, saveCreds } = await useMultiFileAuthState('sesion');

  // Usar la versión ACTUAL de WhatsApp Web (clave para que el emparejamiento no falle)
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log('📦 WhatsApp Web version ' + version.join('.') + ' (actual: ' + isLatest + ')');

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '120.0.0'],
  });

  // Si no está registrado, pedir el número POR CONSOLA y generar el código
  if (!sock.authState.creds.registered) {
    let numero = soloDigitos(await preguntar('\n📱 Escribe el NÚMERO DEL BOT (lada, solo dígitos): '));
    if (!numero) {
      console.error('❌ No escribiste número. Reinicia e intenta de nuevo.');
      process.exit(1);
    }
    // Pequeña espera para que el socket esté listo antes de pedir el código
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const codigo = await sock.requestPairingCode(numero);
      console.log('\n==============================');
      console.log('  CÓDIGO DE VINCULACIÓN: ' + codigo);
      console.log('==============================\n');
      console.log('En el WhatsApp del bot: Dispositivos vinculados > Vincular dispositivo > Vincular con número');
    } catch (e) {
      console.error('No se pudo pedir el código:', e?.message || e);
    }
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === 'open') console.log('✅ Bot conectado.');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const reconectar = code !== DisconnectReason.loggedOut;
      console.log('⚠️ Conexión cerrada. Reconectar:', reconectar);
      if (reconectar) iniciar();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m || !m.message || m.key.fromMe) return;

    const jid = m.key.remoteJid;
    // Quién mandó el mensaje (en grupo es participant; en privado es el jid)
    const remitente = m.key.participant || jid;

    const texto =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      '';
    const cmd = texto.trim().toLowerCase();

    // .ping (abierto a todos)
    if (cmd === PREFIJO + 'ping') {
      await sock.sendMessage(jid, { text: 'pong 🏓' }, { quoted: m });
      return;
    }

    // .foto (SOLO super owner)
    if (cmd === PREFIJO + 'foto') {
      if (!esOwner(remitente)) {
        await sock.sendMessage(jid, { text: '🚫 Solo el owner puede usar este comando.' }, { quoted: m });
        return;
      }

      const img =
        m.message.imageMessage ||
        m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

      if (!img) {
        await sock.sendMessage(jid, { text: 'Mándame o cita una *imagen* con el comando .foto 📸' }, { quoted: m });
        return;
      }

      try {
        const msgParaDescargar = m.message.imageMessage
          ? m
          : { key: m.key, message: m.message.extendedTextMessage.contextInfo.quotedMessage };

        const buffer = await downloadMediaMessage(
          msgParaDescargar,
          'buffer',
          {},
          { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
        );

        const miJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        await sock.updateProfilePicture(miJid, buffer);

        await sock.sendMessage(jid, { text: '✅ Foto de perfil actualizada.' }, { quoted: m });
      } catch (e) {
        console.error(e);
        await sock.sendMessage(jid, { text: '❌ No pude cambiar la foto: ' + (e?.message || 'error') }, { quoted: m });
      }
    }
  });
}

iniciar();
