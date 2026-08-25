const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    } else {
        return res.redirect('/auth/login-empleado');
    }
};

const isAdmin = (req, res, next) => {
    if (req.session && req.session.loggedIn && req.session.isAdmin) {
        return next();
    } else {
        // Si la persona inició sesión como empleado común pero intenta acceder a área de administración
        if (req.session && req.session.userId) {
            return res.status(403).render('error', {
                statusCode: 403,
                title: 'Acceso no permitido',
                message: 'No tienes permisos de administrador para acceder a esta sección de la empresa. Por favor utiliza las funciones de tu panel de empleado.',
                session: req.session
            });
        }
        return res.redirect('/login');
    }
};

module.exports = {
    isAuthenticated: isAuthenticated,
    isAdmin: isAdmin
};

