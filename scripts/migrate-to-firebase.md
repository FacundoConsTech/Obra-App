# 📦 Script de Migración de Datos a Firebase

## 📋 PASOS PARA MIGRAR DATOS DESDE SUPABASE

### **Opción 1: Migración Manual (Recomendada para empezar)**

1. **Exportar datos desde Supabase:**
   - Ve a Supabase Dashboard
   - Table Editor > Selecciona cada tabla
   - Exporta como CSV o JSON

2. **Cargar en Firebase:**
   - Ve a Firebase Console > Firestore Database
   - Crea las colecciones manualmente
   - Importa los datos

### **Opción 2: Script Automático**

Te voy a crear un script Node.js que migra automáticamente.

---

## 🔧 ESTRUCTURA DE COLECCIONES EN FIRESTORE

### **1. crews**
- ID del documento = CREW-A, CREW-B, etc.
- Campos: name, foreman_name, member_count, notes, active, created_at, updated_at

### **2. tasks**
- ID auto-generado
- Campos: rubro, task_code, description, total_qty, unit, created_at, updated_at
- Subcolección: `taskPrices`

### **3. taskPrices (subcolección de tasks)**
- Ruta: `tasks/{taskId}/taskPrices/{priceId}`
- Campos: unit_price, currency, valid_from, valid_to, created_at

### **4. dailyEntries**
- ID auto-generado
- Campos: date, task_id, crew_id, qty, unit, photo_url, foreman, notes, created_by, created_at

### **5. payrollPeriods**
- ID auto-generado
- Campos: crew_id, start_date, end_date, total_value_completed, status, receipt_id, created_at, updated_at

### **6. paymentReceipts**
- ID auto-generado
- Campos: payroll_period_id, number, issue_date, amount, currency, payment_method, notes, pdf_url, created_at

---

## 📝 DATOS INICIALES PARA CARGAR

Si no tenés datos, podés cargar estos datos de ejemplo:

### **Crews:**
```
CREW-A: { name: "ALBAÑILERIA", foreman_name: "EDGARD", member_count: 4, active: true }
CREW-B: { name: "ELECTRICIDAD", foreman_name: "JUAN", member_count: 3, active: true }
CREW-C: { name: "PLOMERÍA", foreman_name: "GUSTAVO", member_count: 4, active: true }
CREW-D: { name: "YESERÍA", foreman_name: "ALSIDES", member_count: 2, active: true }
CREW-E: { name: "AIRE ACONDICIONADO", foreman_name: "DANIEL", member_count: 2, active: true }
CREW-F: { name: "H°A°", foreman_name: "EMILIO", member_count: 2, active: true }
```

---

## 🚀 PRÓXIMOS PASOS

1. **Creá el proyecto Firebase** (si aún no lo hiciste)
2. **Configurá las variables de entorno**
3. **Cargá los datos iniciales** (manualmente o con script)
4. **Probá la aplicación localmente**
5. **Desplegá en Vercel**

---

**¿Necesitás ayuda para migrar datos específicos?** Decime qué datos tenés y te ayudo a convertirlos al formato de Firestore.


