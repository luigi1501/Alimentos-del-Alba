const express = require('express');
const router = express.Router();
const db = require('../db/models');
require('dotenv').config();
const isAuthenticated = require('../middleware/authMiddleware');

router.get('/', (req, res) => {
    res.render('index');
});

router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login', (req, res) => {
    if (req.body.user === process.env.USER && req.body.password === process.env.PASS) {
        console.log("Admin iniciado sesión");
        req.session.loggedIn = true;
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.redirect('/login?error=incorrectCredentials');
    }
});

router.get('/admin', (req, res) => {
    if (req.session && req.session.loggedIn && req.session.isAdmin) {
        res.render('admin');
    } else {
        res.redirect('/login');
    }
});

router.get('/tabGeneral', (req, res) => {
    if (req.session && req.session.loggedIn && req.session.isAdmin) {
        db.getempleados()
            .then(empleados => {
                console.log("Empleados cargados para /tabGeneral:", empleados);
                res.render('tabGeneral', { empleados: empleados });
            })
            .catch(err => {
                console.error("Error al obtener empleados:", err);
                res.render('tabGeneral', { empleados: [] });
            });
    } else {
        res.redirect('/login');
    }
});

router.post('/guardarEmpleado', (req, res) => {
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
        res.redirect('/login');
    }
});

router.post('/updateempleado/:id', async (req, res) => {
    if (req.session && req.session.loggedIn && req.session.isAdmin) {
        const id = req.params.id;
        try {
            const empleadoActualizado = req.body;
            await db.updateempleados(
                id,
                empleadoActualizado.usuario,
                empleadoActualizado.nombre,
                empleadoActualizado.apellido,
                empleadoActualizado.cedula,
                empleadoActualizado.cargo,
                empleadoActualizado.departamento,
                empleadoActualizado.telefono,
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
        res.redirect('/login');
    }
});

router.get('/deleteempleado/:id', (req, res) => {
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
        res.redirect('/login');
    }
});

module.exports = router;
