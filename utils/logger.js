const ActivityLog = require('../models/ActivityLog');

const logActivity = async (req, action, collectionName, details) => {
  try {
    const userId = req.user?.id || null;
    const username = req.user?.username || req.user?.email || 'System Admin';
    
    const log = new ActivityLog({
      user: userId,
      username,
      action,
      collectionName,
      details
    });
    await log.save();
    console.log(`[Logged Action] ${username} did ${action} on ${collectionName}: ${details}`);
  } catch (err) {
    console.error('Error saving activity log:', err);
  }
};

module.exports = { logActivity };
