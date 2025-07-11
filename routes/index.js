const express = require('express');
const router = express.Router();
const db = require('../db/models');
require('dotenv').config();
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');
const attendanceController = require('../controllers/attendanceController');

router.get('/', (req, res) => {
    res.render('index');
});

router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login', (req, res) => {
    console.log("--- Intento de Login Admin ---");
    console.log("Valores recibidos del formulario:");
    console.log("  req.body.user:", req.body.user);
    console.log("  req.body.password:", req.body.password);
    console.log("Valores de las variables de entorno (Render):");
    console.log("  process.env.USER:", process.env.USER);
    console.log("  process.env.PASS:", process.env.PASS); 

    if (req.body.user === process.env.USER && req.body.password === process.env.PASS) {
        console.log("Admin iniciado sesión - Credenciales MATCH!");
        req.session.loggedIn = true;
        req.session.isAdmin = true;
        console.log("Sesión establecida para Admin. req.session.loggedIn:", req.session.loggedIn, "req.session.isAdmin:", req.session.isAdmin);
        res.redirect('/admin');
    } else {
        console.log("Login admin fallido - Credenciales NO MATCH.");
        res.redirect('/login?error=incorrectCredentials');
    }
});

router.get('/admin', (req, res) => {
    console.log("Accediendo a /admin. Estado de la sesión:");
    console.log("  req.session:", req.session);
    console.log("  req.session.loggedIn:", req.session.loggedIn);
    console.log("  req.session.isAdmin:", req.session.isAdmin);

    if (req.session && req.session.loggedIn && req.session.isAdmin) {
        res.render('admin');
    } else {
        console.log("Acceso a /admin denegado. Sesión no válida.");
        res.redirect('/login');
    }
});

router.get('/tabGeneral', (req, res) => {
    console.log("Accediendo a /tabGeneral. Estado de la sesión:");
    console.log("  req.session:", req.session);
    console.log("  req.session.loggedIn:", req.session.loggedIn);
    console.log("  req.session.isAdmin:", req.session.isAdmin);

    if (req.session && req.session.loggedIn && req.session.isAdmin) {
        db.getempleados()
            .then(empleados => {
                console.log("Empleados cargados para /tabGeneral:", empleados.length, "registros.");
                res.render('tabGeneral', { empleados: empleados });
            })
            .catch(err => {
                console.error("Error al obtener empleados para /tabGeneral:", err);
                res.render('tabGeneral', { empleados: [] });
            });
    } else {
        console.log("Acceso a /tabGeneral denegado. Sesión no válida.");
        res.redirect('/login');
    }
});

router.post('/guardarEmpleado', (req, res) => {
    console.log("Accediendo a /guardarEmpleado. Estado de la sesión:");
    console.log("  req.session:", req.session);
    console.log("  req.session.loggedIn:", req.session.loggedIn);
    console.log("  req.session.isAdmin:", req.session.isAdmin);

    if (!req.session || !req.session.loggedIn || !req.session.isAdmin) {
        console.log("Acceso a /guardarEmpleado denegado. Sesión no válida.");
        return res.redirect('/login');
    }
    const { usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo } = req.body;
    db.registrarEmpleado(usuario, null, nombre, apellido, parseInt(cedula), cargo, departamento, parseInt(telefono), correo)
        .then(() => {
            console.log('Empleado guardado correctamente');
            res.redirect('/tabGeneral');
        })
        .catch(err => {
            console.error('Error al guardar empleado:', err);
            res.redirect('/agregarEmpleado?error=guardarFailed');
        });
});

router.get('/editempleado/:id', (req, res) => {
    console.log("Accediendo a /editempleado/:id. Estado de la sesión:");
    console.log("  req.session:", req.session);
    console.log("  req.session.loggedIn:", req.session.loggedIn);
    console.log("  req.session.isAdmin:", req.session.isAdmin);

    if (req.session && req.session.loggedIn && req.session.isAdmin) {
        const id = req.params.id;
        db.getempleadosID(id)
            .then(empleado => {
                res.render('editempleado', { empleado: empleado });
            })
            .catch(err => {
                console.error("Error al obtener empleado para editar:", err);
                res.redirect('/tabGeneral?error=editFailed');
            });
    } else {
        console.log("Acceso a /editempleado/:id denegado. Sesión no válida.");
        res.redirect('/login');
    }
});

router.post('/updateempleado/:id', async (req, res) => {
    console.log("Accediendo a /updateempleado/:id. Estado de la sesión:");
    console.log("  req.session:", req.session);
    console.log("  req.session.loggedIn:", req.session.loggedIn);
    console.log("  req.session.isAdmin:", req.session.isAdmin);

    if (req.session && req.session.loggedIn && req.session.isAdmin) {
        const id = req.params.id;
        try {
            const empleadoActualizado = req.body;
            await db.updateempleados(
                id,
                empleadoActualizado.usuario,
                empleadoActualizado.nombre,
                empleadoActualizado.apellido,
                parseInt(empleadoActualizado.cedula),
                empleadoActualizado.cargo,
                empleadoActualizado.departamento,
                parseInt(empleadoActualizado.telefono),
                empleadoActualizado.correo,
                empleadoActualizado.qr_code
            );
            console.log("Empleado actualizado correctamente.");
            res.redirect('/tabGeneral');
        } catch (err) {
            console.error("Error al actualizar empleado:", err);
            res.redirect('/tabGeneral?error=updateFailed');
        }
    } else {
        console.log("Acceso a /updateempleado/:id denegado. Sesión no válida.");
        res.redirect('/login');
    }
});

router.get('/deleteempleado/:id', (req, res) => {
    console.log("Accediendo a /deleteempleado/:id. Estado de la sesión:");
    console.log("  req.session:", req.session);
    console.log("  req.session.loggedIn:", req.session.loggedIn);
    console.log("  req.session.isAdmin:", req.session.isAdmin);

    if (req.session && req.session.loggedIn && req.session.isAdmin) {
        const idToDelete = req.params.id;
        console.log("Solicitud para eliminar empleado con ID:", idToDelete);

        db.deleteempleados(idToDelete)
            .then(() => {
                console.log("Empleado eliminado correctamente.");
                return db.getempleados();
            })
            .then(empleadosGeneral => {
                res.json({
                    success: true,
                    empleadosGeneral: empleadosGeneral,
                });
            })
            .catch(err => {
                console.error("Error al eliminar empleado:", err);
                res.status(500).json({ success: false, error: err.message });
            });
    } else {
        console.log("Acceso a /deleteempleado/:id denegado. Sesión no válida.");
        res.redirect('/login');
    }
});

router.get('/escanear-asistencia', function(req, res, next) {
    res.render('escanear-asistencia', { title: 'Escanear Asistencia' });
});

router.post('/registrar-asistencia', attendanceController.registrarAsistenciaQR);
router.get('/historial-asistencia', attendanceController.mostrarHistorialAsistencia);


module.exports = router;