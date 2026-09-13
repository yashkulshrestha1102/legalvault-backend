const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
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
router.post('/', createFolder);
router.put('/:id/rename', renameFolder);
router.delete('/:id', deleteFolder);

module.exports = router;