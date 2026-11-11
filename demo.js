/**
 * DEMO sin WhatsApp — simula cómo responde el bot a los comandos.
 * No se conecta a internet ni a WhatsApp; solo muestra la lógica.
 * Correr:  node demo.js   (o  npm run demo )
 */

const fs = require('fs');
const PREFIJO = '.';

// --- "WhatsApp" simulado ---
let fotoPerfilActual = '(ninguna)';
const bot = {
  enviar: (texto) => console.log('🤖 BOT responde: ' + texto),
  cambiarFoto: (nombreImagen) => {
    fotoPerfilActual = nombreImagen;
    console.log('🖼️  Foto de perfil del bot -> ' + nombreImagen);
  },
};

// --- Router de comandos (misma lógica que src/index.js) ---
function manejar(msg) {
  const cmd = (msg.texto || '').trim().toLowerCase();
  console.log('\n📥 Entra mensaje: "' + msg.texto + '"' + (msg.imagen ? ' [con imagen: ' + msg.imagen + ']' : ''));

  if (cmd === PREFIJO + 'ping') {
    bot.enviar('pong 🏓');
    return;
  }

  if (cmd === PREFIJO + 'foto') {
    if (!msg.imagen) {
      bot.enviar('Mándame o cita una imagen con el comando .foto 📸');
      return;
    }
    bot.cambiarFoto(msg.imagen);
    bot.enviar('✅ Foto de perfil actualizada.');
    return;
  }
}

// --- Guion de la demo ---
console.log('=== DEMO BOT-FOTO ===');
console.log('Foto inicial del bot: ' + fotoPerfilActual);

manejar({ texto: '.ping' });
manejar({ texto: '.foto' });                           // sin imagen -> pide imagen
manejar({ texto: '.foto', imagen: 'mi_logo.png' });    // con imagen -> la pone
manejar({ texto: 'hola' });                            // no es comando -> ignora

console.log('\n=== FIN ===');
console.log('Foto final del bot: ' + fotoPerfilActual);
