const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const auditLog = require('../middleware/audit');

const {
  getFoldersByClient,
  getFolderById,
  createFolder,
  renameFolder,
  deleteFolder
} = require('../controllers/customFolderController');

router.use(auth);

router.get('/client/:clientId', getFoldersByClient);
router.get('/:id', getFolderById);
router.post('/',auditLog, createFolder);
router.put('/:id/rename',auditLog, renameFolder);
router.delete('/:id',auditLog, deleteFolder);

module.exports = router;