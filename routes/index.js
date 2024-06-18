/* eslint-disable import/no-import-module-exports */
import express from 'express';
import { getStats, getStatus } from '../controllers/AppController';
import { getConnect, getDisconnect } from '../controllers/AuthController';
import { postNew, getMe } from '../controllers/UsersController';
import { getIndex, getShow, postUpload } from '../controllers/FilesController';

const router = express.Router();

router.get('/status', getStatus);
router.get('/stats', getStats);
router.get('/users/me', getMe);
router.post('/users', postNew);
router.get('/connect', getConnect);
router.get('/disconnect', getDisconnect);
router.get('/files/:id', getShow);
router.get('/files', getIndex);
router.post('/files', postUpload);
module.exports = router;
