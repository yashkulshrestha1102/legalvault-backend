const AuditLog = require('../models/AuditLog');

/**
 * Audit Log Middleware
 * 
 * ✅ OPTIMIZED: Only attached to specific routes (not global)
 * ✅ SKIPS: GET requests, uploads, and unauthenticated requests early
 * ✅ SAFE: Never breaks the response flow
 */
const auditLog = (req, res, next) => {
  // ═══════════════════════════════════════════
  // ✅ EARLY EXITS — Performance Optimization
  // ═══════════════════════════════════════════

  // 1. Skip all GET/HEAD/OPTIONS requests (no mutation happening)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // 2. Skip if no authenticated user (login/register)
  if (!req.user?.id) {
    return next();
  }

  // 3. Skip uploads (they break res.send wrapping)
  if (req.path?.includes('upload')) {
    return next();
  }

  // ═══════════════════════════════════════════
  // ✅ HIJACK res.send to capture response
  // ═══════════════════════════════════════════
  const originalSend = res.send;

  res.send = function (data) {
    // Restore original immediately to avoid any edge cases
    res.send = originalSend;

    try {
      // Parse response body (string or object)
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch {
          parsedData = null;
        }
      }

      // Only log successful mutations (2xx status)
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return originalSend.call(this, data);
      }

      // Determine entity type from URL
      const { entity, entityName, clientId } = extractEntityInfo(req, parsedData);

      // Map HTTP method to action
      const actionMap = {
        POST: 'CREATE',
        PUT: 'UPDATE',
        PATCH: 'UPDATE',
        DELETE: 'DELETE',
      };
      const action = actionMap[req.method] || 'VIEW';

      // Prepare changes for UPDATE/DELETE
      let changes = {};
      if (action === 'UPDATE' || action === 'DELETE') {
        changes = {
          before: req.body || {},
          after: parsedData || {},
          fields: Object.keys(req.body || {}),
        };
      }

      const logEntry = {
        user: {
          id: req.user.id,
          name: req.user.name || req.user.email,
          email: req.user.email,
          role: req.user.role || 'user',
        },
        action,
        entity,
        entityId: parsedData?._id || req.params?.id || null,
        entityName:
          typeof entityName === 'string'
            ? entityName.substring(0, 200)
            : 'N/A',
        clientId,
        clientName: entity === 'CLIENT' ? entityName : null,
        changes,
        documentInfo: extractDocumentInfo(req, parsedData),
        ipAddress: (req.ip || req.connection?.remoteAddress || '').replace(/^::ffff:/, ''),
        userAgent: req.headers['user-agent'] || 'Unknown',
      };

      // Fire-and-forget — don't await (avoid blocking response)
      AuditLog.create(logEntry)
        .then(() =>
          console.log(
            `✅ Audit: ${action} ${entity} by ${logEntry.user.name}`
          )
        )
        .catch((err) =>
          console.error('❌ Audit save failed:', err.message)
        );
    } catch (error) {
      // Never let audit errors break the response
      console.error('❌ Audit middleware error:', error.message);
    }

    return originalSend.call(this, data);
  };

  next();
};

// ═══════════════════════════════════════════
// ✅ HELPER: Extract entity info from route
// ═══════════════════════════════════════════
function extractEntityInfo(req, parsedData) {
  const baseUrl = req.baseUrl || '';

  // Map of route patterns → entity type
  const entityMap = [
    { pattern: '/clients', entity: 'CLIENT', nameField: 'name' },
    { pattern: '/registrations', entity: 'REGISTRATION', nameField: 'registrationName' },
    { pattern: '/contracts', entity: 'CONTRACT', nameField: 'contractName' },
    { pattern: '/policies', entity: 'POLICY', nameField: 'policyName' },
    { pattern: '/gst', entity: 'GST', nameField: 'gstName' },
    { pattern: '/income-tax', entity: 'INCOME_TAX', nameField: 'taxName' },
    { pattern: '/hr', entity: 'HR', nameField: 'hrName' },
    { pattern: '/corporate-secretariat', entity: 'CORPORATE_SECRETARIAT', nameField: 'csName' },
    { pattern: '/financials', entity: 'FINANCIAL', nameField: 'financeName' },
    { pattern: '/users', entity: 'USER', nameField: 'name' },
    { pattern: '/documents', entity: 'DOCUMENT', nameField: 'filename' },
    { pattern: '/pdfs', entity: 'DOCUMENT', nameField: 'filename' },
    { pattern: '/custom-files', entity: 'DOCUMENT', nameField: 'filename' },
    { pattern: '/custom-folders', entity: 'FOLDER', nameField: 'name' },
  ];

  for (const { pattern, entity, nameField } of entityMap) {
    if (baseUrl.includes(pattern)) {
      const entityName =
        req.body?.[nameField] ||
        parsedData?.[nameField] ||
        req.file?.originalname ||
        'N/A';

      const clientId =
        req.body?.clientId ||
        parsedData?.clientId ||
        req.params?.clientId ||
        null;

      return { entity, entityName, clientId };
    }
  }

  return { entity: 'OTHER', entityName: 'N/A', clientId: null };
}

// ═══════════════════════════════════════════
// ✅ HELPER: Extract document info (for file uploads)
// ═══════════════════════════════════════════
function extractDocumentInfo(req, parsedData) {
  if (!req.file && !req.files && !parsedData?.filename) {
    return null;
  }

  return {
    filename:
      req.file?.originalname ||
      req.files?.[0]?.originalname ||
      parsedData?.filename ||
      'N/A',
    fileType:
      req.file?.mimetype ||
      req.files?.[0]?.mimetype ||
      parsedData?.mimeType ||
      'N/A',
    fileSize:
      req.file?.size ||
      req.files?.[0]?.size ||
      parsedData?.fileSize ||
      0,
    fileId: parsedData?.fileId || null,
  };
}

module.exports = auditLog;