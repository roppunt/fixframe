const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { encryptFile } = require('../utils/fileSecurity');
const { loadJobs, saveJobs } = require('../utils/jobStore');

const router = express.Router();

const MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024;
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.heic', '.gif', '.mp4', '.mov', '.avi', '.mkv'];

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../storage/tmp'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      cb(new Error('Dit bestandstype wordt niet ondersteund.'));
      return;
    }
    cb(null, true);
  },
});

/**
 * Verwerkt een nieuwe upload en slaat deze versleuteld op.
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Geen bestand ontvangen.' });
      return;
    }
    const email = req.body.email;
    if (!email) {
      res.status(400).json({ error: 'Een e-mailadres is verplicht.' });
      await fs.promises.unlink(req.file.path);
      return;
    }
    const jobs = await loadJobs();
    const id = crypto.randomUUID();
    const encryptedPath = path.join(__dirname, `../storage/encrypted/${id}`);
    const iv = await encryptFile(req.file.path, encryptedPath);
    await fs.promises.unlink(req.file.path);
    const job = {
      id,
      email,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      extension: path.extname(req.file.originalname).toLowerCase(),
      uploadedAt: new Date().toISOString(),
      status: 'wacht op betaling',
      paymentStatus: 'open',
      encryptedPath,
      encryptionIv: iv,
      resultPath: null,
      resultStatus: null,
      downloadToken: null,
      downloadTokenExpiresAt: null,
    };
    jobs.push(job);
    await saveJobs(jobs);
    res.json({
      message: 'Upload gelukt. Rond de betaling af om te starten.',
      job,
      amount: 4.95,
    });
  } catch (error) {
    console.error('Uploadfout', error);
    res.status(500).json({ error: 'Er ging iets mis bij het uploaden.' });
  }
});

router.use((err, req, res, next) => {
  console.error('Upload middleware fout', err);
  res.status(400).json({ error: err.message || 'Upload mislukt.' });
});

module.exports = router;
