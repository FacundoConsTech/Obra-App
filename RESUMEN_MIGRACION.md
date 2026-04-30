# ✅ Resumen de Migración a Firebase

## ✅ COMPLETADO

1. ✅ Instalado Firebase SDK
2. ✅ Creado configuración de Firebase (`src/lib/firebase.ts`)
3. ✅ Creado funciones de acceso a datos (`src/lib/supabaseQueries.ts`)
4. ✅ Actualizado `PlannedPage.tsx` - Usa Firebase
5. ✅ Actualizado `DailyEntriesPage.tsx` - Usa Firebase + función borrar
6. ✅ Actualizado `PayrollPage.tsx` - Usa Firebase
7. ✅ Actualizado `ComprobantePage.tsx` - Usa Firebase

---

## 📋 PRÓXIMOS PASOS PARA TI

### **Paso 1: Crear Proyecto Firebase** (5 minutos)

1. Ve a: https://console.firebase.google.com
2. Click "Add project"
3. Nombre: `obra-app`
4. Desactiva Google Analytics
5. Click "Create project"

### **Paso 2: Habilitar Firestore** (2 minutos)

1. Menú lateral: "Firestore Database"
2. Click "Create database"
3. "Start in test mode"
4. Ubicación: `us-central`
5. Click "Enable"

### **Paso 3: Obtener Credenciales** (2 minutos)

1. "Project Settings" (⚙️)
2. "Your apps" > Click Web (</>)
3. Nickname: `obra-app-web`
4. **Copia estas credenciales:**

```javascript
apiKey: "AIza..."
authDomain: "obra-app.firebaseapp.com"
projectId: "obra-app"
storageBucket: "obra-app.appspot.com"
messagingSenderId: "123456789"
appId: "1:123456789:web:abc123"
```

### **Paso 4: Configurar .env.local** (1 minuto)

Abre `C:\Users\LEGION\obra-app\.env.local` y agrega:

```bash
VITE_FIREBASE_API_KEY=tu_api_key_aqui
VITE_FIREBASE_AUTH_DOMAIN=obra-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=obra-app
VITE_FIREBASE_STORAGE_BUCKET=obra-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

### **Paso 5: Configurar Reglas de Seguridad** (1 minuto)

1. "Firestore Database" > "Rules"
2. Reemplaza por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click "Publish"

⚠️ **TEMPORAL** - Después restringirás el acceso

### **Paso 6: Migrar Datos** (Opcional)

Si tenés datos en Supabase que querés migrar, te ayudo después.

### **Paso 7: Probar Localmente**

```powershell
cd "C:\Users\LEGION\obra-app"
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Abre: http://localhost:5173

---

## 🚀 DESPLIEGUE EN VERCEL

### **Paso 1: Subir a GitHub**

1. Crea cuenta en GitHub si no tenés
2. Crea repositorio: `obra-app`
3. En PowerShell:

```powershell
cd "C:\Users\LEGION\obra-app"
git init
git add .
git commit -m "Migración a Firebase"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/obra-app.git
git push -u origin main
```

### **Paso 2: Conectar Vercel**

1. Ve a: https://vercel.com
2. Crea cuenta con GitHub
3. "Add New Project"
4. Selecciona `obra-app`
5. Configuración:
   - Framework: Vite
   - Build: `npm run build`
   - Output: `dist`
6. **Variables de entorno:**
   - Agrega todas las variables de `.env.local`
7. Click "Deploy"

### **Paso 3: ¡Listo!**

- URL pública: `https://obra-app.vercel.app`
- Cada `git push` despliega automáticamente

---

## ⚠️ IMPORTANTE

### **Cambios en la Estructura:**

- **No más SQL** - Usamos Firestore (NoSQL)
- **IDs automáticos** - Firestore genera IDs
- **No hay JOINs** - Hacemos múltiples queries
- **Subcolecciones** - taskPrices está dentro de tasks

### **Ventajas:**

- ✅ Real-time updates
- ✅ Offline support
- ✅ Escalable automáticamente
- ✅ Gratis hasta 50K lecturas/día

---

## 🆘 SI HAY PROBLEMAS

**Error de conexión:**
- Verifica que las variables de entorno estén correctas
- Verifica que Firestore esté habilitado

**Error de permisos:**
- Verifica las reglas de seguridad en Firestore

**Datos no aparecen:**
- Necesitas crear las colecciones manualmente o migrar datos

---

## 📞 PRÓXIMOS PASOS

1. **Creá el proyecto Firebase** (pasos 1-5 arriba)
2. **Pasame las credenciales** y te ayudo a configurar
3. **Probamos localmente**
4. **Migramos datos** (si tenés)
5. **Desplegamos en Vercel**

**¿Ya creaste el proyecto en Firebase?** Pasame las credenciales y continúo.


