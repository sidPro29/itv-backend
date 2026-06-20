module.exports = function(req, res, next) {
  if (req.user.role !== 'superAdmin') {
    return res.status(403).json({ msg: 'Access denied. Super Admin only.' });
  }
  next();
};
