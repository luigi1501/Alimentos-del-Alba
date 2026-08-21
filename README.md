import os

markdown_content = """# 🚀 Sistema de Gestión de Asistencia y Empleados — Documentación de API y Rutas

Sistema web para el control de asistencia mediante códigos QR, gestión de perfiles de empleados y administración centralizada. Desarrollado con **Node.js**, **Express**, **EJS** y middleware de seguridad.

---

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#-requisitos-previos)
2. [Estructura del Proyecto](#-estructura-del-proyecto)
3. [Middlewares de Seguridad](#-middlewares-de-seguridad)
4. [Documentación de Rutas](#-documentación-de-rutas)
   - [Autenticación y Empleados (`/routes/auth.js`)](#1-autenticación-y-empleados-routesauthjs)
   - [Administración y Asistencia (`/routes/index.js`)](#2-administración-y-asistencia-routesindexjs)
5. [Consideraciones de Seguridad](#-consideraciones-de-seguridad)

---

## ⚙️ Requisitos Previos

- **Node.js** v18+
- **pnpm** / **npm**
- Servidor de base de datos relacional (MySQL / SQLite)

---

## 📁 Estructura del Proyecto

```text
├── config/
│   ├── multer.js          # Configuración para subida de imágenes de perfil
│   └── rateLimit.js       # Configuración de límite de peticiones (Rate Limiting)
├── controllers/
│   ├── adminController.js # Lógica de vistas y acciones del administrador
│   ├── attendanceController.js # Procesamiento de escaneo y marcas QR
│   ├── authController.js  # Lógica de login, registro y sesiones
│   └── employeeActions.js # Acciones individuales del empleado (Foto, QR PDF)
├── middleware/
│   └── authMiddleware.js  # Verificación de autenticación (isAuthenticated, isAdmin)
├── routes/
│   ├── auth.js            # Endpoints de empleados y autenticación
│   └── index.js           # Endpoints administrativos y marcas de asistencia
└── server.js