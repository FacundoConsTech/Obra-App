# 🔥 Migración a Firebase - Guía Paso a Paso

## 📋 PASO 1: Crear Proyecto en Firebase

1. Ve a: https://console.firebase.google.com
2. Click en "Add project" o "Crear proyecto"
3. Nombre del proyecto: `obra-app` (o el que prefieras)
4. Desactiva Google Analytics (opcional, no necesario)
5. Click "Create project"
6. Espera a que se cree (1-2 minutos)

## 📋 PASO 2: Habilitar Firestore Database

1. En el menú lateral, ve a "Firestore Database"
2. Click "Create database"
3. Selecciona "Start in test mode" (por ahora)
4. Elige una ubicación (ej: `us-central`)
5. Click "Enable"

## 📋 PASO 3: Obtener Credenciales

1. Ve a "Project Settings" (⚙️)
2. Scroll hasta "Your apps"
3. Click en el ícono de Web (</>)
4. Registra la app:
   - Nickname: `obra-app-web`
   - No marques "Firebase Hosting"
5. Copia las credenciales que te muestra (las necesitarás después)

## 📋 PASO 4: Configurar Reglas de Seguridad

1. Ve a "Firestore Database" > "Rules"
2. Reemplaza las reglas por estas (temporalmente para desarrollo):

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

## 📋 PASO 5: Instalar Firebase en tu Proyecto

Ejecuta en PowerShell:

```powershell
cd "C:\Users\LEGION\obra-app"
& "C:\Program Files\nodejs\npm.cmd" install firebase
```

## 📋 PASO 6: Crear Archivo de Configuración

Te voy a crear el archivo `src/lib/firebase.ts` con la configuración.

## 📋 PASO 7: Estructura de Datos en Firestore

Firestore es NoSQL, así que la estructura será diferente:

### **Colecciones:**

- `crews` - Documentos con id = CREW-A, CREW-B, etc.
- `tasks` - Documentos con id auto-generado
- `taskPrices` - Subcolección dentro de tasks
- `dailyEntries` - Documentos con id auto-generado
- `payrollPeriods` - Documentos con id auto-generado
- `paymentReceipts` - Documentos con id auto-generado

### **Ejemplo de estructura:**

```
crews/
  CREW-A/
    name: "ALBAÑILERIA"
    foreman_name: "EDGARD"
    member_count: 4
    active: true

tasks/
  {taskId}/
    rubro: "PLOMERÍA"
    task_code: "PLO-AGUA"
    description: "Conexion Agua"
    total_qty: 100
    unit: "u"
    taskPrices/  (subcolección)
      {priceId}/
        unit_price: 3000
        valid_from: "2025-07-15"
        valid_to: null
```

## 📋 PASO 8: Migrar Datos Existentes

Si tenés datos en Supabase, necesitarás exportarlos y convertirlos a formato Firestore.

## 📋 PRÓXIMOS PASOS

Después de completar estos pasos, te ayudo a:
1. Crear las funciones de acceso a datos
2. Actualizar todos los componentes
3. Migrar los datos existentes
4. Desplegar en Vercel

---

## ⚠️ CAMBIOS IMPORTANTES

### **Diferencias entre Supabase y Firebase:**

1. **Queries:** Firebase usa métodos como `.where()`, `.get()`, `.add()` en vez de SQL
2. **IDs:** Firebase genera IDs automáticamente (o usas `.doc('id')`)
3. **Relaciones:** No hay JOINs, necesitas hacer múltiples queries
4. **Transacciones:** Se hacen diferente

### **Ventajas de Firebase:**

- ✅ Real-time updates automáticos
- ✅ Offline support
- ✅ Escalable automáticamente
- ✅ Gratis hasta 50K lecturas/día

---

¿Ya creaste el proyecto en Firebase? Si sí, pasame las credenciales (apiKey, authDomain, projectId, etc.) y continúo con el código.


