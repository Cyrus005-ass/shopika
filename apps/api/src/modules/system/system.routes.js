const express = require('express');
const path = require('node:path');
const prisma = require('../lib/prisma');
const { versionHandler, createReadyHandler } = require('../../lib/systemHandlers');

const router = express.Router();
const packageJson = require(path.resolve(__dirname, '..', '..', 'package.json'));

router.get('/version', (req, res) => {
  res.json({ name: packageJson.name, version: packageJson.version });
});

router.get('/health/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (error) {
    console.error('[health] database readiness check failed:', error.message);
    res.status(503).json({ ok: false });
  }
});

module.exports = router;
