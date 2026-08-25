# 🏢 Alimentos del Alba C.A. — Sistema Inteligente de Asistencia & Gestión de Personal (2026)

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=nodedotjs)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-4.x-000000?style=flat&logo=express)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat&logo=sqlite)](https://www.sqlite.org/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=flat&logo=bootstrap)](https://getbootstrap.com/)
[![License](https://img.shields.io/badge/Estado-Producción-emerald)](https://github.com/)

Sistema web integral desarrollado para **Alimentos del Alba C.A.** enfocado en el control inteligente de asistencia del personal mediante **Códigos QR**, asignación de jornadas personalizadas, gestión de estatus (vacaciones, reposos, permisos), ranking de puntualidad y generación de reportes avanzados en **Excel (.xlsx)**.

---

## 🌟 Funcionalidades Principales

- 📱 **Escáner QR de Planta con Feedback Audible**:
  - Lectura en tiempo real con cámara WebCam y biblioteca `jsQR`.
  - Efectos de sonido nativos (**Web Audio API**): Chime agudo en marcajes exitosos y tono de alerta en bloqueos.
  - Reconocimiento de tarjeta inteligente con foto, cargo, departamento, cédula y turno.

- 🛡️ **Control Riguroso de Estatus de Empleados**:
  - Estados soportados: `Activo`, `De Vacaciones`, `En Reposo Médico`, `Permiso Especial`, `Suspendido`, `Baja Temporal`, `Inactivo`.
  - Bloqueo automático de acceso al QR cuando un empleado no figura como `Activo`.
  - Registro de fechas de inicio, retorno estimado y observaciones médicas o administrativas.

- ⏰ **Justificación de Marcaje Fuera de Horario & Cierre Manual**:
  - Detección automática de marcajes fuera del turno asignado (retrasos o salidas anticipadas) con despliegue de modal interactivo para justificación.
  - Módulo administrativo de **Salida Manual** para registrar salidas omitidas y desbloquear el QR del empleado.

- 🏆 **Cuadro de Honor — Empleado Más Responsable**:
  - Algoritmo de ranking de puntualidad y marcajes perfectos.
  - Tarjeta destacada en el Panel Admin y Mención de Honor en el perfil del empleado galardonado.

- 📊 **Exportación Profesional a Excel (`.xlsx`)**:
  - Reportes estilizados con encabezados ejecutivos, diagnósticos de turno, totalización estadística e impresión lista.

- 🎨 **Diseño Moderno, Fluid & Responsive**:
  - Tema oscuro/claro con Glassmorphism, tipografía `Outfit` & `Inter`, botones responsivos y vista adaptada a dispositivos móviles.

---

## ⚙️ Requisitos e Instalación

### Requisitos Previos
- **Node.js** (v18.0.0 o superior)
- **pnpm** (o `npm`)

### Pasos de Instalación

1. **Clonar o abrir la carpeta del proyecto**:
   ```bash
   cd Alimentos-del-Alba
   ```

2. **Instalar dependencias**:
   ```bash
   pnpm install
   ```

3. **Iniciar en entorno de desarrollo**:
   ```bash
   pnpm dev
   ```

4. **Acceder en el navegador**:
   - **Inicio / Landing**: `http://localhost:3000`
   - **Acceso Administrativo**: `http://localhost:3000/login`
   - **Portal de Empleados**: `http://localhost:3000/auth/login-empleado`
   - **Escáner de Asistencia**: `http://localhost:3000/escanear-asistencia`

---

## 📁 Estructura del Proyecto

```text
Alimentos-del-Alba/
├── config/
│   ├── multer.js             # Configuración para subida de fotos de perfil (jpg, png)
│   └── rateLimit.js          # Protección contra ataques de fuerza bruta (Rate Limiter)
├── controllers/
│   ├── adminController.js    # Vistas y lógica de administración y CRUD de empleados
│   ├── attendanceController.js # Procesamiento de escaneos QR, justificaciones y exportación Excel
│   ├── authController.js     # Autenticación, gestión de sesiones y paneles de usuario
│   └── employeeActions.js    # Acciones del empleado (descarga de QR PDF, subida de foto)
├── db/
│   ├── connection.js         # Conexión SQLite y migraciones automáticas de esquema
│   ├── database.sqlite       # Base de datos SQLite ligera
│   └── models.js             # Consultas SQL, lógica de bloqueo QR y ranking de puntualidad
├── middleware/
│   └── authMiddleware.js     # Protección de rutas por rol (isAuthenticated, isAdmin)
├── public/
│   ├── images/               # Logos e imágenes estáticas del sistema
│   ├── stylesheets/
│   │   └── main-theme.css    # Sistema de diseño, variables CSS, glassmorphism y responsive
│   └── uploads/              # Almacenamiento de fotografías de perfil de empleados
├── routes/
│   ├── auth.js               # Rutas de autenticación y portal de empleados
│   └── index.js              # Rutas de administración, escáner e historial de asistencia
├── utils/
│   └── dateUtils.js          # Formateadores de fecha, hora y cálculo de duración de turnos
├── views/
│   ├── admin.ejs             # Dashboard de administración con Cuadro de Honor
│   ├── editarempleado.ejs    # Formulario de edición con entrada libre de jornada y estatus
│   ├── escanear-asistencia.ejs # Escáner vivo con WebCam, efectos de sonido y modal de justificación
│   ├── historial-asistencia.ejs # Historial completo con ajuste manual y exportación a Excel
│   ├── historial-empleado.ejs # Historial individual de marcajes del empleado
│   ├── login.ejs             # Login del administrador
│   ├── login-empleado.ejs    # Login del personal
│   ├── panel-empleado.ejs    # Perfil y carnet QR interactivo del empleado
│   ├── registro-empleado.ejs # Formulario de registro de personal
│   └── tabGeneral.ejs        # Directorio y gestión general de empleados
├── app.js                    # Servidor principal Express.js
└── README.md                 # Documentación técnica del proyecto
```

---

## 🛣️ Documentación de Rutas Principales

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| `GET` | `/` | Página principal / Landing | Público |
| `GET` | `/login` | Formulario de login de Administrador | Público |
| `POST` | `/login` | Iniciar sesión administrativa | Público |
| `GET` | `/admin` | Panel de Control Administrativo | Admin |
| `GET` | `/tabGeneral` | Directorio General de Empleados | Admin |
| `POST` | `/guardarEmpleado` | Registrar un nuevo empleado con jornada libre | Admin |
| `GET` | `/editarempleado/:id` | Formulario para editar empleado y estatus | Admin |
| `POST` | `/updateEmpleado/:id` | Actualizar empleado, jornada y estatus | Admin |
| `GET` | `/eliminarempleado/:id` | Eliminar registro de empleado | Admin |
| `GET` | `/escanear-asistencia` | Pantalla de escáner vivo con cámara y sonido | Admin |
| `POST` | `/consultar-estado-scan` | Consultar estado inteligente del QR escaneado | API / Admin |
| `POST` | `/registrar-asistencia` | Registrar entrada o salida con observacion | API / Admin |
| `GET` | `/historial-asistencia` | Historial general de marcajes de planta | Admin |
| `POST` | `/cerrar-salida-manual` | Cierre manual de salida y desbloqueo de QR | Admin |
| `GET` | `/exportar-excel-historial` | Generar y descargar reporte en Excel (.xlsx) | Admin |
| `GET` | `/auth/login-empleado` | Login del Portal de Empleados | Público |
| `POST` | `/auth/login-empleado` | Iniciar sesión de empleado | Público |
| `GET` | `/auth/panel-empleado` | Dashboard personal del empleado y carnet QR | Empleado |
| `GET` | `/auth/historial-asistencia` | Historial personal de marcajes | Empleado |
| `GET` | `/auth/descargar-qr-pdf` | Descargar carnet con Código QR en PDF | Empleado |
| `GET` | `/auth/logout` | Cierre de sesión inteligente por rol | Autenticado |

---

## 🛡️ Seguridad y Buenas Prácticas

1. **Sesiones Seguras**: Expiración automática y regeneración de ID de sesión al autenticar para evitar *Session Fixation*.
2. **Protección de Datos**: Hash de contraseñas con algoritmos seguros.
3. **Rate Limiting**: Limitación de intentos de login mediante `express-rate-limit` para prevenir ataques por fuerza bruta.
4. **Respuesta Adaptativa**: Control estricto de mensajes de error en español y sin exposición de trazas internas al usuario final.

---

## 📝 Licencia

Desarrollado para **Alimentos del Alba C.A.** — Todos los derechos reservados (2026).