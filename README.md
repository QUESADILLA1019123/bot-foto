# bot-foto

Bot de WhatsApp que cambia **su propia** foto de perfil. Login por código de 8 dígitos (sin QR).

## Comandos
- `.foto` — cítale o mándale una imagen y se la pone como foto de perfil.
- `.ping` — responde "pong" (prueba de vida).

## Demo local (sin WhatsApp)
```
npm run demo
```

---

## 1) Subir a GitHub
Desde esta carpeta:
```
git init
git add .
git commit -m "primer commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/bot-foto.git
git push -u origin main
```
> El archivo `.gitignore` ya evita subir `node_modules/` y la carpeta `sesion/`
> (esa carpeta tiene las credenciales de tu WhatsApp: **nunca** la subas).

## 2) Conectar GitHub con Cafirexos (sección "Variables")
| Campo | Qué poner |
|---|---|
| **REPOSITORIO GIT** | `https://github.com/TU_USUARIO/bot-foto.git` |
| **RAMA GIT** | `main` (o vacío) |
| **USUARIO GIT / TOKEN GIT** | solo si el repo es **privado** |
| **ARCHIVO DE INICIO** | `src/index.js` |
| **ACTUALIZACIÓN AUTOMÁTICA** | `True`  ← así cada cambio en GitHub llega solo al reiniciar |
| **SUBIDA MANUAL DE ARCHIVOS** | `False` |
| **INSTALAR PAQUETES ADICIONALES** | vacío (ya están en `package.json`) |
| **COMANDO DE INICIO** | vacío (usa el archivo de inicio) |

## 3) Cada vez que cambies algo
```
git add .
git commit -m "lo que cambié"
git push
```
Con **ACTUALIZACIÓN AUTOMÁTICA = True**, al reiniciar el servidor en Cafirexos hace `git pull` y toma tus cambios.

## 4) Primer arranque
1. Edita `src/index.js` → variable `NUMERO` con tu número (lada, solo dígitos).
2. Inicia el servidor en Cafirexos.
3. En los logs saldrá un **código de 8 dígitos**.
4. WhatsApp → Dispositivos vinculados → Vincular dispositivo → **Vincular con número** → escribe el código.
