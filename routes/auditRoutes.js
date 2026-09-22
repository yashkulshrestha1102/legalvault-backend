const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const AuditLog = require('../models/AuditLog');
const Client = require('../models/Client');
const Registration = require('../models/Registration');
const Contract = require('../models/Contract');
const User = require('../models/User');

// ═══════════════════════════════════════════
// ✅ HELPER: Get safe user info from req.user
// ═══════════════════════════════════════════
const getSafeUserInfo = (user) => ({
  id: user.id,
  name: user.name || user.email || 'Unknown User',
  email: user.email || 'unknown@system',
  role: user.role || 'user',
});

// ═══════════════════════════════════════════
// ✅ HELPER: Get Client IP (IPv6-safe)
// ═══════════════════════════════════════════
const getClientIp = (req) => {
  const ip = req.ip || req.connection?.remoteAddress || 'Unknown';
  return ip.replace(/^::ffff:/, '');
};

// ═══════════════════════════════════════════
// ✅ HELPER: Delete entity by type
// ═══════════════════════════════════════════
const deleteEntity = async (entity, entityId) => {
  const models = {
    CLIENT: Client,
    REGISTRATION: Registration,
    CONTRACT: Contract,
    USER: User,
  };

  const Model = models[entity];
  if (!Model) {
    throw new Error(`Rollback delete not supported for entity: ${entity}`);
  }

  const doc = await Model.findByIdAndDelete(entityId);
  return !!doc;
};

// ═══════════════════════════════════════════
// ✅ HELPER: Update entity by type
// ═══════════════════════════════════════════
const updateEntity = async (entity, entityId, updateData) => {
  const models = {
    CLIENT: Client,
    REGISTRATION: Registration,
    CONTRACT: Contract,
    USER: User,
  };

  const Model = models[entity];
  if (!Model) {
    throw new Error(`Rollback update not supported for entity: ${entity}`);
  }

  // ✅ Filter out unsafe fields
  const safeUpdate = { ...updateData };
  delete safeUpdate._id;
  delete safeUpdate.__v;
  delete safeUpdate.createdAt;
  delete safeUpdate.updatedAt;

  const doc = await Model.findByIdAndUpdate(entityId, safeUpdate, { new: true });
  return !!doc;
};

// ═══════════════════════════════════════════
// ✅ GET /api/audit — List logs (Admin only)
// ═══════════════════════════════════════════
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
        { 'user.name': { $regex: search, $options: 'i' } },
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
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════
// ✅ GET /api/audit/stats — Stats (Admin only)
// ═══════════════════════════════════════════
router.get('/stats', [auth, admin], async (req, res) => {
  try {
    const totalActions = await AuditLog.countDocuments();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayActions = await AuditLog.countDocuments({ timestamp: { $gte: today } });

    const actionsByType = await AuditLog.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } },
    ]);

    const actionsByEntity = await AuditLog.aggregate([
      { $group: { _id: '$entity', count: { $sum: 1 } } },
    ]);

    const topClients = await AuditLog.aggregate([
      { $match: { clientId: { $ne: null } } },
      {
        $group: {
          _id: '$clientId',
          name: { $first: '$clientName' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      totalActions,
      todayActions,
      actionsByType,
      actionsByEntity,
      topClients,
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// ═══════════════════════════════════════════
// ✅ POST /api/audit/:id/rollback — Rollback (Admin only)
// ═══════════════════════════════════════════
router.post('/:id/rollback', [auth, admin], async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ message: 'Audit log not found' });
    }

    if (log.rollbacked) {
      return res.status(400).json({ message: 'This action has already been rolled back' });
    }

    // ✅ Validate entityId exists
    if (!log.entityId) {
      return res.status(400).json({
        message: 'Cannot rollback: original entity ID is missing in log',
      });
    }

    const userInfo = getSafeUserInfo(req.user);
    let result = { message: 'Rollback successful' };

    // ═══════════════════════════════════════════
    // ✅ Rollback logic based on action
    // ═══════════════════════════════════════════
    switch (log.action) {
      case 'CREATE': {
        const deleted = await deleteEntity(log.entity, log.entityId);
        if (!deleted) {
          return res.status(404).json({
            message: `Cannot rollback: ${log.entity} not found (may already be deleted)`,
          });
        }
        result.message = `${log.entity} created by ${log.user?.name || 'user'} has been deleted`;
        break;
      }

      case 'UPDATE': {
        const before = log.changes?.before;
        if (!before || Object.keys(before).length === 0) {
          return res.status(400).json({
            message: 'Cannot rollback: no previous values stored in log',
          });
        }
        const updated = await updateEntity(log.entity, log.entityId, before);
        if (!updated) {
          return res.status(404).json({
            message: `Cannot rollback: ${log.entity} not found`,
          });
        }
        result.message = `Changes made by ${log.user?.name || 'user'} have been reverted`;
        break;
      }

      case 'DELETE': {
        const restored = await updateEntity(log.entity, log.entityId, {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        });
        if (!restored) {
          return res.status(404).json({
            message: `Cannot rollback: ${log.entity} not found`,
          });
        }
        result.message = `${log.entity} deleted by ${log.user?.name || 'user'} has been restored`;
        break;
      }

      default:
        return res.status(400).json({
          message: `Rollback not supported for action: ${log.action}`,
        });
    }

    // ═══════════════════════════════════════════
    // ✅ Mark original log as rolled back
    // ═══════════════════════════════════════════
    log.rollbacked = true;
    log.rollbackedBy = req.user.id;
    log.rollbackedAt = new Date();
    log.rollbackReason = `Rollback requested by ${userInfo.name}`;
    await log.save();

    // ═══════════════════════════════════════════
    // ✅ Create rollback audit log (non-blocking)
    // ═══════════════════════════════════════════
    try {
      const rollbackLog = new AuditLog({
        user: userInfo,
        action: 'ROLLBACK',
        entity: log.entity,
        entityId: log.entityId,
        entityName: log.entityName || 'N/A',
        clientId: log.clientId || null,
        clientName: log.clientName || null,
        changes: {
          before: {},
          after: { rollbackedLogId: log._id },
        },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || 'Unknown',
      });
      await rollbackLog.save();
      console.log(`✅ Rollback logged: ${log.entity} by ${userInfo.name}`);
    } catch (rollbackLogErr) {
      // Non-critical — main rollback succeeded
      console.error('⚠️ Rollback audit log save failed:', rollbackLogErr.message);
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Rollback error:', error);
    res.status(500).json({
      message: 'Rollback failed: ' + (error.message || 'Unknown error'),
    });
  }
});

module.exports = router;