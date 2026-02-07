# Plan de Acción — Requerimientos Febrero 2026

## Resumen de Requerimientos

| # | Requerimiento | Tipo | Ubicación |
|---|---------------|------|-----------|
| 1 | Admin puede asignar clases a alumnos existentes | Backend + Frontend | core + Next.js |
| 2 | Asignación de clases mensuales recurrentes (renovable mes a mes) | Backend + Frontend | core + Next.js |
| 3 | "Gestionar alumno/prof/mat" en Dashboard no navega correctamente | Frontend | Next.js |
| 4 | Bug navbar: dropdowns "usuario"/"servicios" se bugean al scrollear | Frontend | Next.js |

---

## Requerimiento 1: Admin asigna clases a alumnos

### Estado actual
- Ya existe `POST /bookings` que recibe `teacherId`, `studentId`, `date`, `startTime`, `endTime`.
- Cualquier usuario autenticado puede crear bookings.
- El endpoint ya acepta `studentId` o `userId` para resolver al alumno.

### ¿Qué falta?

#### Backend (core)
1. **Nuevo endpoint exclusivo para admin**: `POST /bookings/admin-assign`
   - Solo accesible con rol `ADMIN` (guard + decorator).
   - Recibe: `studentId`, `teacherId`, `subjectId` (opcional), `date`, `startTime`, `endTime`.
   - Crea el booking directamente con `status: 'CONFIRMED'` y `confirmed: true` (sin pasar por pending).
   - Opción: aceptar `userId` y resolver `studentId` automáticamente (ya existe esta lógica).

2. **Agregar campo `subjectId` al modelo Booking** (migración Prisma):
   - Actualmente el Booking no registra qué materia es. Esto es útil para saber qué clase se asignó.
   - Relación opcional `Booking -> Subject`.

3. **Endpoint para listar alumnos con búsqueda**: `GET /students?search=nombre`
   - Ya existe el módulo Students. Verificar que tenga búsqueda por nombre/apellido para que el admin pueda encontrar al alumno fácilmente.

#### Frontend (Next.js)
4. **Pantalla "Asignar clase a alumno"** en el panel admin:
   - Selector/buscador de alumno (autocomplete contra `GET /students`).
   - Selector de profesor (contra `GET /teachers`).
   - Selector de materia (contra `GET /subjects`).
   - Date picker para elegir fecha.
   - Time pickers para horario inicio/fin.
   - Botón "Asignar clase" → llama a `POST /bookings/admin-assign`.
   - No requiere confirmación posterior (se crea ya confirmada).

### Tareas Backend

| Tarea | Archivo(s) | Esfuerzo |
|-------|------------|----------|
| Agregar `subjectId` opcional al modelo `Booking` en Prisma | `prisma/schema.prisma` | Bajo |
| Generar y aplicar migración | `prisma/migrations/` | Bajo |
| Crear DTO `AdminAssignBookingDto` | `src/bookings/dto/admin-assign-booking.dto.ts` | Bajo |
| Crear método `adminAssign()` en `BookingsService` | `src/bookings/bookings.service.ts` | Medio |
| Crear endpoint `POST /bookings/admin-assign` en controller | `src/bookings/bookings.controller.ts` | Bajo |
| Agregar búsqueda por nombre en `StudentsService.findAll()` | `src/students/students.service.ts` | Bajo |

---

## Requerimiento 2: Clases mensuales recurrentes

### Concepto
Un alumno viene **todos los martes de 14:00 a 15:00** durante un mes. El admin quiere crear todas esas clases de una vez y poder "renovar" para el mes siguiente.

### Diseño

#### Backend (core)

1. **Nuevo endpoint**: `POST /bookings/monthly`
   - Solo `ADMIN`.
   - Recibe:
     ```typescript
     {
       studentId: string;
       teacherId: string;
       subjectId?: string;       // opcional
       dayOfWeek: number;        // 0-6 (Sunday-Saturday)
       startTime: string;        // "14:00"
       endTime: string;          // "15:00"
       month: number;            // 1-12
       year: number;             // 2026
     }
     ```
   - **Lógica**: Calcula todas las fechas del mes que caigan en `dayOfWeek`, crea un booking para cada una.
   - Valida disponibilidad y capacidad para cada fecha.
   - Si alguna fecha falla (overlap, sin disponibilidad), retorna un resumen parcial indicando qué fechas se crearon y cuáles fallaron — **no hace rollback total**, permite creación parcial con reporte.
   - Todas las bookings se crean con `status: 'CONFIRMED'`, `confirmed: true`.

2. **Modelo `RecurringGroup`** (opcional pero recomendado):
   - Nueva tabla para agrupar bookings que pertenecen a la misma asignación recurrente.
   - Permite renovar: al "renovar", se crean los bookings del mes siguiente usando la misma configuración.
   - Campos: `id`, `studentId`, `teacherId`, `subjectId`, `dayOfWeek`, `startTime`, `endTime`, `month`, `year`, `createdAt`.
   - Relación: `Booking` tiene `recurringGroupId` opcional.

3. **Endpoint renovar**: `POST /bookings/monthly/:groupId/renew`
   - Toma un `RecurringGroup`, calcula el mes siguiente, y crea los bookings.
   - Retorna el nuevo grupo + bookings creados.

#### Frontend (Next.js)
4. **Pantalla "Asignar clases mensuales"**:
   - Selector de alumno, profesor, materia.
   - Selector de día de la semana.
   - Time pickers.
   - Selector de mes/año.
   - Preview: muestra las fechas que se van a crear antes de confirmar.
   - Botón "Crear clases del mes".
   - Resultado: lista de clases creadas con indicador de éxito/fallo por fecha.

5. **Vista de grupos recurrentes**:
   - Lista de asignaciones mensuales activas.
   - Botón "Renovar próximo mes" por cada grupo.

### Tareas Backend

| Tarea | Archivo(s) | Esfuerzo |
|-------|------------|----------|
| Crear modelo `RecurringGroup` en Prisma | `prisma/schema.prisma` | Bajo |
| Agregar `recurringGroupId` opcional a `Booking` | `prisma/schema.prisma` | Bajo |
| Generar y aplicar migración | `prisma/migrations/` | Bajo |
| Crear DTO `MonthlyBookingDto` | `src/bookings/dto/monthly-booking.dto.ts` | Bajo |
| Crear helper `getDatesForDayInMonth(dayOfWeek, month, year)` | `src/bookings/bookings.service.ts` | Bajo |
| Crear método `createMonthly()` en `BookingsService` | `src/bookings/bookings.service.ts` | Alto |
| Crear método `renewMonthly()` en `BookingsService` | `src/bookings/bookings.service.ts` | Medio |
| Crear endpoints en controller | `src/bookings/bookings.controller.ts` | Bajo |
| Crear endpoint `GET /bookings/recurring-groups` | `src/bookings/bookings.controller.ts` | Bajo |

---

## Requerimiento 3: Links "Gestionar" en Dashboard no navegan

### Problema
En el Dashboard del admin, los botones "Gestionar alumno", "Gestionar profesores", "Gestionar materias" no llevan a la página correspondiente.

### Diagnóstico probable
- Los links tienen `href` incorrecto o vacío.
- O usan `onClick` sin `router.push()`.
- O las rutas destino no existen en el frontend.

### Tareas Frontend

| Tarea | Detalle | Esfuerzo |
|-------|---------|----------|
| Identificar componente Dashboard | Buscar en `/admin/dashboard` o similar | Bajo |
| Verificar rutas destino existen | `/admin/students`, `/admin/teachers`, `/admin/subjects` | Bajo |
| Corregir `href` o `router.push()` en botones | Apuntar a las rutas correctas | Bajo |
| Testear navegación | Verificar que cada botón lleva a la pantalla correcta | Bajo |

---

## Requerimiento 4: Bug navbar al scrollear

### Problema
Los dropdowns de "usuario" o "servicios" en la navbar se bugean al hacer scroll — no desaparecen o quedan flotando.

### Diagnóstico probable
- El dropdown usa `position: absolute` sin estar contenido en un `position: relative` con overflow control.
- O falta un event listener de `scroll` que cierre el dropdown.
- O el z-index/posicionamiento no se recalcula al scrollear.

### Tareas Frontend

| Tarea | Detalle | Esfuerzo |
|-------|---------|----------|
| Identificar componente Navbar/Dropdown | Buscar en layout o componentes compartidos | Bajo |
| Agregar listener `onScroll` que cierre dropdowns | `window.addEventListener('scroll', closeDropdown)` | Bajo |
| Alternativa: usar `position: fixed` o `sticky` para navbar | Asegura que dropdowns se comporten bien | Bajo |
| Alternativa: usar componente de UI library (Radix, Headless UI) | Manejo automático de cierre al scroll | Medio |
| Testear en distintas resoluciones | Mobile + Desktop | Bajo |

---

## Orden de prioridad sugerido

```
1. 🔴 Req 1 — Admin asigna clases (backend)        ← Core functionality
2. 🔴 Req 2 — Clases mensuales (backend)            ← Core functionality  
3. 🟡 Req 3 — Fix links Dashboard (frontend)        ← Quick fix
4. 🟡 Req 4 — Fix navbar scroll bug (frontend)      ← Quick fix
```

Los requerimientos 3 y 4 son fixes rápidos de frontend que se pueden hacer en paralelo con el backend.

---

## Resumen de cambios en el Schema Prisma

```prisma
// Agregar al modelo Booking
model Booking {
  // ... campos existentes ...
  subjectId        String?
  subject          Subject?         @relation(fields: [subjectId], references: [id])
  recurringGroupId String?
  recurringGroup   RecurringGroup?  @relation(fields: [recurringGroupId], references: [id])
}

// Nuevo modelo
model RecurringGroup {
  id        String   @id @default(uuid())
  studentId String
  teacherId String
  subjectId String?
  dayOfWeek Int
  startTime String
  endTime   String
  month     Int
  year      Int
  createdAt DateTime @default(now())

  bookings  Booking[]
  student   Student  @relation(fields: [studentId], references: [id])
  teacher   Teacher  @relation(fields: [teacherId], references: [id])
  subject   Subject? @relation(fields: [subjectId], references: [id])
}

// Agregar al modelo Subject
model Subject {
  // ... campos existentes ...
  bookings        Booking[]
  recurringGroups RecurringGroup[]
}

// Agregar al modelo Student
model Student {
  // ... campos existentes ...
  recurringGroups RecurringGroup[]
}

// Agregar al modelo Teacher
model Teacher {
  // ... campos existentes ...
  recurringGroups RecurringGroup[]
}
```

---

## Estimación total

| Componente | Esfuerzo estimado |
|------------|-------------------|
| Backend — Req 1 (admin assign) | ~3-4 horas |
| Backend — Req 2 (monthly + renew) | ~5-6 horas |
| Frontend — Req 1 pantalla assign | ~3-4 horas |
| Frontend — Req 2 pantalla monthly | ~4-5 horas |
| Frontend — Req 3 fix links | ~30 min |
| Frontend — Req 4 fix navbar | ~1 hora |
| **Total estimado** | **~17-21 horas** |

---

## Notas técnicas

- Los requerimientos 1 y 2 de backend se pueden implementar en este repo (`core`).
- Los requerimientos 3 y 4 requieren acceso al repo del frontend (Next.js).
- La migración de Prisma se puede hacer de una sola vez incluyendo `subjectId`, `recurringGroupId` en Booking y el nuevo modelo `RecurringGroup`.
- Se recomienda implementar el Req 1 primero ya que el Req 2 extiende la misma lógica.
