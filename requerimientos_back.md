# Requerimientos de Sistema: Backend & Panel de Administración

Este documento define la arquitectura y requerimientos para el sistema de backend (Microservicio/Monolito) que gestionará la autenticación, profesores, materias y disponibilidad.

## 1. Arquitectura Propuesta

*   **Tipo**: API RESTful (Microservicio "Core").
*   **Stack Sugerido**:
    *   **Runtime**: Node.js con TypeScript.
    *   **Framework**: NestJS (por su estructura modular y robustez) o Express.
    *   **Base de Datos**: PostgreSQL (Relacional, ideal para agendas y relaciones).
    *   **ORM**: Prisma.
*   **Ubicación**: Carpeta `/servicios/core-api` (o similar).

## 2. Módulos del Sistema

### A. Autenticación (Auth)
*   **Objetivo**: Proteger el panel de administración y validar reservas.
*   **Roles**:
    *   `ADMIN`: Acceso total (CRUD profesores, materias, ver todas las reservas).
    *   `PROFESOR`: Puede editar su propia disponibilidad y ver sus reservas y generar reservas (indicando un identificador valido del alumno).
    *   `ALUMNO`: Puede crear reservas (con validaciones).
*   **Mecanismo**: JWT (JSON Web Tokens).

### B. Gestión de Profesores (Teachers CRUD)
*   **Datos**:
    *   Nombre, Apellido.
    *   Bio/Descripción.
    *   **Capacidad Máxima**: Cantidad de alumnos simultáneos (Concurrency).
    *   **Materias**: Relación con el módulo de materias.
*   **Funcionalidad**:
    *   Admin crea/edita/elimina profesores.
    *   Asignación de materias a profesores.

### C. Gestión de Materias (Subjects CRUD)
*   **Datos**:
    *   Nombre (ej: "Matemática", "Física").
    *   Nivel (ej: "Primaria", "Secundaria", "Terciario", "Universitario").
*   **Funcionalidad**:
    *   ABM simple de materias.

### D. Disponibilidad y Agenda (Availability)
*   **Modelo de Datos**:
    *   Días de la semana (Lunes a Viernes).
    *   Bloques horarios (ej: 14:00 - 18:00).
    *   Excepciones (días feriados o bloqueados).
*   **Lógica de Negocio**:
    *   Un profesor define sus "Bloques Disponibles".
    *   Al reservar, el sistema debe chequear:
        1.  Que el profesor dé esa materia.
        2.  Que el horario esté dentro de su bloque disponible.
        3.  Que la cantidad de reservas actuales en ese slot < Capacidad Máxima.

### E. Reservas (Booking)
*   **Endpoint Público**: `POST /bookings`
*   **Seguridad**:
    *   Rate Limiting (para evitar spam).
    *   (Opcional) Validación por Email/WhatsApp antes de confirmar.
*   **Flujo**:
    1.  Cliente selecciona Materia -> Backend devuelve Profesores disponibles.
    2.  Cliente selecciona Profesor -> Backend devuelve Horarios (calculados según disponibilidad - ocupación).
    3.  Cliente confirma -> Se guarda reserva y se notifica.

## 3. Panel de Administración (Frontend)
*   **Ruta**: `/admin` (en el proyecto Next.js actual).
*   **Protección**: Middleware que verifica JWT.
*   **Vistas**:
    *   **Dashboard**: Resumen de reservas del día.
    *   **Profesores**: Tabla con acciones (Editar, Borrar, Ver Agenda).
    *   **Materias**: Lista simple editable.
    *   **Configuración**: Creación de usuarios admin.

## 4. Pasos de Implementación
1.  **Setup Backend**: Inicializar proyecto NestJS/Express + Docker para DB.
2.  **Modelado DB**: Definir esquemas Prisma.
3.  **API Auth**: Login y Guards.
4.  **API Core**: CRUDs y Lógica de Disponibilidad.
5.  **Frontend Admin**: Crear páginas en `/admin` y conectar con API.
