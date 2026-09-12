const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const AuditLog = require('../models/AuditLog');
const Client = require('../models/Client');
const Registration = require('../models/Registration');
const Contract = require('../models/Contract');
const User = require('../models/User');

// ✅ Get all audit logs (Admin only)
router.get('/', [auth, admin], async (req, res) => {
  try {
    const { limit = 50, skip = 0, action, entity, clientId, search } = req.query;
    
    const filter = {};
    if (action) filter.action = action;
    if (entity) filter.entity = entity;
    if (clientId) filter.clientId = clientId;
    if (search) {
      filter.$or = [
        { entityName: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } }
      ];
    }

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await AuditLog.countDocuments(filter);

    res.json({
      logs,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Get audit log stats (Admin only)
router.get('/stats', [auth, admin], async (req, res) => {
  try {
    const totalActions = await AuditLog.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayActions = await AuditLog.countDocuments({ timestamp: { $gte: today } });

    const actionsByType = await AuditLog.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } }
    ]);

    const actionsByEntity = await AuditLog.aggregate([
      { $group: { _id: '$entity', count: { $sum: 1 } } }
    ]);

    const topClients = await AuditLog.aggregate([
      { $match: { clientId: { $ne: null } } },
      { $group: { _id: '$clientId', name: { $first: '$clientName' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      totalActions,
      todayActions,
      actionsByType,
      actionsByEntity,
      topClients
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Rollback an action (Admin only)
router.post('/:id/rollback', [auth, admin], async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ message: 'Audit log not found' });
    }

    if (log.rollbacked) {
      return res.status(400).json({ message: 'This action has already been rolled back' });
    }

    let result = { message: 'Rollback successful' };

    // ✅ Different rollback logic based on action and entity
    switch (log.action) {
      case 'CREATE':
        // Delete the created entity
        if (log.entity === 'CLIENT') {
          await Client.findByIdAndDelete(log.entityId);
        } else if (log.entity === 'REGISTRATION') {
          await Registration.findByIdAndDelete(log.entityId);
        } else if (log.entity === 'CONTRACT') {
          await Contract.findByIdAndDelete(log.entityId);
        } else if (log.entity === 'USER') {
          await User.findByIdAndDelete(log.entityId);
        }
        result.message = `${log.entity} created by ${log.user.name} has been deleted`;
        break;

      case 'UPDATE':
        // Revert to previous values
        if (log.entity === 'CLIENT') {
          await Client.findByIdAndUpdate(log.entityId, log.changes.before);
        } else if (log.entity === 'REGISTRATION') {
          await Registration.findByIdAndUpdate(log.entityId, log.changes.before);
        } else if (log.entity === 'CONTRACT') {
          await Contract.findByIdAndUpdate(log.entityId, log.changes.before);
        } else if (log.entity === 'USER') {
          await User.findByIdAndUpdate(log.entityId, log.changes.before);
        }
        result.message = `Changes made by ${log.user.name} have been reverted`;
        break;

      case 'DELETE':
        // Restore the deleted entity (soft delete)
        if (log.entity === 'CLIENT') {
          await Client.findByIdAndUpdate(log.entityId, { isDeleted: false });
        } else if (log.entity === 'REGISTRATION') {
          await Registration.findByIdAndUpdate(log.entityId, { isDeleted: false });
        } else if (log.entity === 'CONTRACT') {
          await Contract.findByIdAndUpdate(log.entityId, { isDeleted: false });
        }
        result.message = `${log.entity} deleted by ${log.user.name} has been restored`;
        break;

      default:
        return res.status(400).json({ message: 'Rollback not supported for this action' });
    }

    // ✅ Mark as rolled back
    log.rollbacked = true;
    log.rollbackedBy = req.user.id;
    log.rollbackedAt = new Date();
    log.rollbackReason = `Rollback requested by ${req.user.name}`;
    await log.save();

    // ✅ Log the rollback action
    const rollbackLog = new AuditLog({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      },
      action: 'ROLLBACK',
      entity: log.entity,
      entityId: log.entityId,
      entityName: log.entityName,
      clientId: log.clientId,
      clientName: log.clientName,
      changes: {
        before: {},
        after: { rollbackedLogId: log._id }
      },
      ipAddress: req.ip || 'Unknown',
      userAgent: req.headers['user-agent'] || 'Unknown'
    });
    await rollbackLog.save();

    res.json(result);

  } catch (error) {
    console.error('❌ Rollback error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;