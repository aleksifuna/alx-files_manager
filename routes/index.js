/* eslint-disable import/no-import-module-exports */
import express from 'express';
import { getStats, getStatus } from '../controllers/AppController';

const router = express.Router();

router.get('/status', getStatus);
router.get('/stats', getStats);

module.exports = router;
