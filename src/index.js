/**
 * Bot de WhatsApp — cambia su PROPIA foto de perfil.
 * Login por código de 8 dígitos (pairing code), sin QR.
 *
 * Uso de comandos (escríbele al bot o en un grupo donde esté):
 *   .foto        -> responde a una imagen con este comando, o manda la imagen con ".foto" de texto
 *   .ping        -> responde "pong" (para probar que está vivo)
 *
 * Primer arranque:
 *   1) npm install
 *   2) Edita NUMERO más abajo con tu número (con lada, sin + ni espacios). Ej: 521771xxxxxxx
 *   3) npm start  -> te mostrará un código de 8 dígitos
 *   4) WhatsApp > Dispositivos vinculados > Vincular dispositivo > Vincular con número > escribe el código
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys');
const pino = require('pino');

// === CONFIG ===
const NUMERO = '521771XXXXXXX'; // <-- CAMBIA ESTO por tu número (lada incluida, solo dígitos)
const PREFIJO = '.';
// ==============

async function iniciar() {
  const { state, saveCreds } = await useMultiFileAuthState('sesion');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['BotFoto', 'Chrome', '1.0.0'],
  });

  // Pedir código de 8 dígitos si aún no está registrado
  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const codigo = await sock.requestPairingCode(NUMERO);
        console.log('\n==============================');
        console.log('  CÓDIGO DE VINCULACIÓN: ' + codigo);
        console.log('==============================\n');
        console.log('WhatsApp > Dispositivos vinculados > Vincular dispositivo > Vincular con número');
      } catch (e) {
        console.error('No se pudo pedir el código:', e?.message || e);
      }
    }, 3000);
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
    const texto =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      '';
    const cmd = texto.trim().toLowerCase();

    // .ping
    if (cmd === PREFIJO + 'ping') {
      await sock.sendMessage(jid, { text: 'pong 🏓' }, { quoted: m });
      return;
    }

    // .foto  (cambia la foto del propio bot)
    if (cmd === PREFIJO + 'foto') {
      // Buscar la imagen: en el propio mensaje o en el mensaje citado
      const img =
        m.message.imageMessage ||
        m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

      if (!img) {
        await sock.sendMessage(
          jid,
          { text: 'Mándame o cita una *imagen* con el comando .foto 📸' },
          { quoted: m }
        );
        return;
      }

      try {
        // Reconstruir un mensaje válido para descargar el media
        const msgParaDescargar = m.message.imageMessage
          ? m
          : {
              key: m.key,
              message:
                m.message.extendedTextMessage.contextInfo.quotedMessage,
            };

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
        await sock.sendMessage(
          jid,
          { text: '❌ No pude cambiar la foto: ' + (e?.message || 'error') },
          { quoted: m }
        );
      }
    }
  });
}

iniciar();
