module.exports = function(req, res, next) {
  // Check if user role is admin or superAdmin
  if (req.user.role !== 'admin' && req.user.role !== 'superAdmin') {
    return res.status(403).json({ msg: 'Access denied. Admin only.' });
  }
  next();
};
