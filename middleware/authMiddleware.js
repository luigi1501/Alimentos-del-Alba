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
        return res.redirect('/login');
    }
};

module.exports = {
    isAuthenticated: isAuthenticated,
    isAdmin: isAdmin
};