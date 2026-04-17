# 🔥 Pasos para Completar la Migración a Firebase

## ✅ COMPLETADO

1. ✅ Instalado Firebase SDK
2. ✅ Creado `src/lib/firebase.ts` (configuración)
3. ✅ Creado `src/lib/firebaseQueries.ts` (funciones de acceso a datos)
4. ✅ Actualizado `PlannedPage.tsx` para usar Firebase
5. ✅ Actualizado `DailyEntriesPage.tsx` para usar Firebase
6. ✅ Agregada función de borrar Daily Entries

## ⏳ PENDIENTE

1. ⏳ Actualizar `PayrollPage.tsx` para usar Firebase
2. ⏳ Actualizar `ComprobantePage.tsx` para usar Firebase
3. ⏳ Crear proyecto en Firebase Console
4. ⏳ Configurar variables de entorno (.env.local)
5. ⏳ Migrar datos existentes desde Supabase
6. ⏳ Probar la aplicación
7. ⏳ Desplegar en Vercel

---

## 📋 PASOS INMEDIATOS PARA TI

### **Paso 1: Crear Proyecto en Firebase**

1. Ve a: https://console.firebase.google.com
2. Click "Add project" o "Crear proyecto"
3. Nombre: `obra-app` (o el que prefieras)
4. Desactiva Google Analytics (opcional)
5. Click "Create project"

### **Paso 2: Habilitar Firestore**

1. En el menú lateral: "Firestore Database"
2. Click "Create database"
3. Selecciona "Start in test mode"
4. Elige ubicación: `us-central` (o la más cercana)
5. Click "Enable"

### **Paso 3: Obtener Credenciales**

1. Ve a "Project Settings" (⚙️)
2. Scroll hasta "Your apps"
3. Click en el ícono Web (</>)
4. Registra la app:
   - Nickname: `obra-app-web`
   - No marques "Firebase Hosting"
5. **Copia estas credenciales** (las necesitarás):

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "obra-app.firebaseapp.com",
  projectId: "obra-app",
  storageBucket: "obra-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### **Paso 4: Configurar Variables de Entorno**

1. Abre `.env.local` en tu proyecto
2. Agrega estas variables (reemplaza con tus valores):

```bash
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

### **Paso 5: Configurar Reglas de Seguridad (Temporal)**

1. Ve a "Firestore Database" > "Rules"
2. Reemplaza por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // TEMPORAL - cambiar después
    }
  }
}
```

3. Click "Publish"

⚠️ **IMPORTANTE:** Estas reglas permiten acceso total. Después de probar, deberás restringirlas.

---

## 📊 ESTRUCTURA DE DATOS EN FIRESTORE

### **Colecciones que necesitas crear:**

1. **crews** - Documentos con ID = CREW-A, CREW-B, etc.
2. **tasks** - Documentos con ID auto-generado
3. **dailyEntries** - Documentos con ID auto-generado
4. **payrollPeriods** - Documentos con ID auto-generado
5. **paymentReceipts** - Documentos con ID auto-generado

### **Subcolecciones:**

- **tasks/{taskId}/taskPrices** - Precios por tarea

---

## 🔄 MIGRAR DATOS DESDE SUPABASE

Si tenés datos en Supabase que querés migrar:

1. Exporta los datos desde Supabase (CSV o JSON)
2. Usa el script de migración que te voy a crear
3. O carga manualmente desde Firebase Console

---

## ⚠️ CAMBIOS IMPORTANTES

### **Diferencias con Supabase:**

- ✅ **No más SQL** - Usamos métodos de Firestore
- ✅ **IDs automáticos** - Firestore genera IDs
- ✅ **No hay JOINs** - Hacemos múltiples queries
- ✅ **Estructura diferente** - NoSQL en vez de SQL

### **Ventajas:**

- ✅ Real-time updates automáticos
- ✅ Offline support
- ✅ Escalable automáticamente
- ✅ Gratis hasta 50K lecturas/día

---

## 🚀 PRÓXIMOS PASOS

1. **Completar PayrollPage y ComprobantePage** (lo hago yo)
2. **Crear proyecto Firebase** (lo hacés vos)
3. **Configurar variables de entorno** (lo hacés vos)
4. **Migrar datos** (te ayudo)
5. **Probar localmente** (juntos)
6. **Desplegar en Vercel** (te guío)

---

**¿Ya creaste el proyecto en Firebase?** Si sí, pasame las credenciales y continúo con PayrollPage y ComprobantePage.


