const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Not authorized to access this route' });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `User role '${req.user.role}' is not authorized to access this route` 
      });
    }
    next();
  };
};

// Check permissions
exports.checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ 
        error: `You do not have permission to perform this action` 
      });
    }
    next();
  };
};

// Check if user is locked out
exports.checkLockout = async (req, res, next) => {
  if (req.user.lockUntil && req.user.lockUntil > Date.now()) {
    return res.status(403).json({ 
      error: 'Account is locked. Please try again later.' 
    });
  }
  next();
};