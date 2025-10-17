const express = require('express');
const fs = require('fs');
const { findJob } = require('../utils/jobStore');

const router = express.Router();

/**
 * Biedt het herstelde bestand beveiligd aan.
 */
router.get('/:jobId', async (req, res) => {
  const validation = await validateDownload(req.params.jobId, req.query.token);
  if (!validation.valid) {
    res.status(validation.status).json({ error: validation.message });
    return;
  }
  res.download(validation.job.resultPath, validation.job.originalName);
});

router.head('/:jobId', async (req, res) => {
  const validation = await validateDownload(req.params.jobId, req.query.token);
  if (!validation.valid) {
    res.status(validation.status).end();
    return;
  }
  res.status(200).end();
});

async function validateDownload(jobId, token) {
  if (!token) {
    return { valid: false, status: 400, message: 'Token ontbreekt.' };
  }
  try {
    const job = await findJob(jobId);
    if (!job) {
      return { valid: false, status: 404, message: 'Job niet gevonden.' };
    }
    if (job.downloadToken !== token) {
      return { valid: false, status: 401, message: 'Token ongeldig.' };
    }
    if (!job.resultPath || !fs.existsSync(job.resultPath)) {
      return { valid: false, status: 404, message: 'Geen resultaat beschikbaar.' };
    }
    if (new Date(job.downloadTokenExpiresAt) < new Date()) {
      return { valid: false, status: 410, message: 'Downloadlink verlopen.' };
    }
    return { valid: true, status: 200, job };
  } catch (error) {
    console.error('Downloadfout', error);
    return { valid: false, status: 500, message: 'Download mislukt.' };
  }
}

module.exports = router;
