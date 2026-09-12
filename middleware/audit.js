const AuditLog = require('../models/AuditLog');

const auditLog = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    try {
      if (req.user && req.method !== 'GET') {
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        
        let entity = 'OTHER';
        let clientId = null;
        let clientName = null;
        let documentInfo = null;
        let entityName = 'N/A';
        
        // ✅ Determine entity and extract client info
        if (req.baseUrl.includes('/clients')) {
          entity = 'CLIENT';
          entityName = req.body?.name || parsedData?.name || 'N/A';
          clientId = req.params?.id || parsedData?._id || null;
          clientName = entityName;
        } 
        else if (req.baseUrl.includes('/registrations')) {
          entity = 'REGISTRATION';
          entityName = req.body?.registrationName || parsedData?.registrationName || 'N/A';
          clientId = req.body?.clientId || parsedData?.clientId || null;
        } 
        else if (req.baseUrl.includes('/contracts')) {
          entity = 'CONTRACT';
          entityName = req.body?.contractName || parsedData?.contractName || 'N/A';
          clientId = req.body?.clientId || parsedData?.clientId || null;
        } 
        else if (req.baseUrl.includes('/users')) {
          entity = 'USER';
          entityName = req.body?.name || parsedData?.name || 'N/A';
        } 
        else if (req.baseUrl.includes('/pdfs')) {
          entity = 'DOCUMENT';
          entityName = req.file?.originalname || req.body?.filename || 'N/A';
          documentInfo = {
            filename: req.file?.originalname || req.body?.filename || 'N/A',
            fileType: req.file?.mimetype || req.body?.fileType || 'N/A',
            fileSize: req.file?.size || req.body?.fileSize || 0,
            fileId: parsedData?.fileId || null
          };
          clientId = req.body?.clientId || null;
        }

        let action = 'VIEW';
        if (req.method === 'POST') action = 'CREATE';
        else if (req.method === 'PUT' || req.method === 'PATCH') action = 'UPDATE';
        else if (req.method === 'DELETE') action = 'DELETE';

        // ✅ Get changes
        let changes = {};
        if (action === 'UPDATE') {
          changes = {
            before: req.body._doc || req.body || {},
            after: parsedData || {},
            fields: Object.keys(req.body || {})
          };
        }

        const logEntry = {
          user: {
            id: req.user.id,
            name: req.user.name || req.user.email,
            email: req.user.email,
            role: req.user.role || 'user'
          },
          action,
          entity,
          entityId: parsedData?._id || req.params?.id || null,
          entityName: typeof entityName === 'string' ? entityName.substring(0, 200) : 'N/A',
          clientId: clientId,
          clientName: clientName || 'N/A',
          changes: changes,
          documentInfo: documentInfo,
          ipAddress: req.ip || req.connection?.remoteAddress || 'Unknown',
          userAgent: req.headers['user-agent'] || 'Unknown'
        };

        AuditLog.create(logEntry)
          .then(() => console.log('✅ Audit log saved:', logEntry.action, logEntry.entity, 'by', logEntry.user.name))
          .catch(err => console.error('❌ Audit log error:', err));
      }
    } catch (error) {
      console.error('❌ Audit log error:', error);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = auditLog;