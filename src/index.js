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
const fs = require('fs');

// === CONFIG ===
const PREFIJO = '.';
// Owners autorizados. Pueden ser:
//  - un LID de WhatsApp (lo que da el comando .id, ej: 27828066234368)
//  - o un número normal (ej: 528132546576) -> se compara por los últimos 10 dígitos
// Para agregar más owners, añade su ID/numero a esta lista.
const OWNERS = [
  '27828066234368', // LID del owner (+52 81 3254 6576), obtenido con .id
];
// ==============

// Pregunta por consola
function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(texto, (r) => { rl.close(); res(r); }));
}

// Deja solo dígitos
const soloDigitos = (s) => (s || '').replace(/\D/g, '');

// ¿El remitente es owner? Acepta LID exacto o número por últimos 10 dígitos.
function esOwner(jid) {
  const num = soloDigitos(jid.split('@')[0].split(':')[0]);
  return OWNERS.some((o) => num === o || (o.length >= 10 && num.slice(-10) === o.slice(-10)));
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
      if (code === DisconnectReason.loggedOut) {
        console.log('🔒 Sesión cerrada por WhatsApp (logout). Borro la sesión y pido vincular de nuevo...');
        try { fs.rmSync('sesion', { recursive: true, force: true }); } catch (e) {}
        return iniciar(); // volverá a pedir número + código nuevo
      }
      console.log('⚠️ Conexión cerrada. Reintentando conectar...');
      setTimeout(iniciar, 2000);
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

    // Log en consola de QUIÉN manda cada mensaje (para depurar el owner)
    console.log('📨 mensaje de:', remitente, '| jid:', jid, '| texto:', texto);

    // .ping (abierto a todos)
    if (cmd === PREFIJO + 'ping') {
      await sock.sendMessage(jid, { text: 'pong 🏓' }, { quoted: m });
      return;
    }

    // .id (abierto a todos) -> dice el ID exacto que ve el bot
    if (cmd === PREFIJO + 'id') {
      const num = soloDigitos(remitente.split('@')[0].split(':')[0]);
      await sock.sendMessage(
        jid,
        { text: '🆔 Tu ID: ' + remitente + '\n🔢 Dígitos: ' + num + '\n👑 ¿Eres owner?: ' + (esOwner(remitente) ? 'Sí' : 'No') },
        { quoted: m }
      );
      return;
    }

    // .nombre <nuevo nombre> (SOLO owner) -> cambia el nombre del bot
    if (cmd === PREFIJO + 'nombre' || cmd.startsWith(PREFIJO + 'nombre ')) {
      if (!esOwner(remitente)) {
        await sock.sendMessage(jid, { text: '🚫 Solo el owner puede usar este comando.' }, { quoted: m });
        return;
      }
      const nuevoNombre = texto.trim().slice((PREFIJO + 'nombre').length).trim();
      if (!nuevoNombre) {
        await sock.sendMessage(jid, { text: 'Escribe el nombre así: *' + PREFIJO + 'nombre TuNuevoNombre* ✏️' }, { quoted: m });
        return;
      }
      try {
        await sock.updateProfileName(nuevoNombre);
        await sock.sendMessage(jid, { text: '✅ Nombre cambiado a: ' + nuevoNombre }, { quoted: m });
      } catch (e) {
        console.error(e);
        await sock.sendMessage(jid, { text: '❌ No pude cambiar el nombre: ' + (e?.message || 'error') }, { quoted: m });
      }
      return;
    }

    // .msj <numero> <texto> (SOLO owner) -> manda un mensaje a ese número
    if (cmd === PREFIJO + 'msj' || cmd.startsWith(PREFIJO + 'msj ')) {
      if (!esOwner(remitente)) {
        await sock.sendMessage(jid, { text: '🚫 Solo el owner puede usar este comando.' }, { quoted: m });
        return;
      }
      const resto = texto.trim().slice((PREFIJO + 'msj').length).trim();
      const espacio = resto.indexOf(' ');
      if (espacio === -1) {
        await sock.sendMessage(jid, { text: 'Formato: *' + PREFIJO + 'msj 52XXXXXXXXXX tu mensaje* 📩' }, { quoted: m });
        return;
      }
      const numeroDestino = soloDigitos(resto.slice(0, espacio));
      const mensaje = resto.slice(espacio + 1).trim();
      if (!numeroDestino || !mensaje) {
        await sock.sendMessage(jid, { text: 'Formato: *' + PREFIJO + 'msj 52XXXXXXXXXX tu mensaje* 📩' }, { quoted: m });
        return;
      }
      try {
        // Verificar el número en WhatsApp para usar el JID correcto (arregla el "1" de México)
        const resultado = await sock.onWhatsApp(numeroDestino);
        console.log('🔎 onWhatsApp(' + numeroDestino + ') ->', JSON.stringify(resultado));
        const info = resultado && resultado[0];
        if (!info || !info.exists) {
          await sock.sendMessage(jid, { text: '❌ Ese número no está en WhatsApp o el formato es incorrecto: ' + numeroDestino }, { quoted: m });
          return;
        }
        console.log('📤 Enviando a JID:', info.jid);
        await sock.sendMessage(info.jid, { text: mensaje });
        await sock.sendMessage(jid, { text: '✅ Mensaje enviado a ' + numeroDestino }, { quoted: m });
      } catch (e) {
        console.error(e);
        await sock.sendMessage(jid, { text: '❌ No pude enviar el mensaje: ' + (e?.message || 'error') }, { quoted: m });
      }
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
