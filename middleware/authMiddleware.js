const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.loggedIn && !req.session.isAdmin) {
        return next();
    } else {
        return res.redirect('/auth/login-empleado');
    }

function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
         return next();
    } else {
        return res.redirect('/auth/login-empleado');
    }
}

};

module.exports = isAuthenticated;