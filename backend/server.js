require('dotenv').config({ path: require('path').join(__dirname, 'config/.env') });
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const uploadRoute = require('./routes/upload');
const paymentRoute = require('./routes/payment');
const downloadRoute = require('./routes/download');
const adminRoute = require('./routes/admin');
const { loadJobs, saveJobs } = require('./utils/jobStore');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/upload', uploadRoute);
app.use('/api/payment', paymentRoute);
app.use('/api/download', downloadRoute);
app.use('/api/admin', adminRoute);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/config', (req, res) => {
  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    paymentProvider: process.env.PAYMENT_PROVIDER || 'stripe',
    price: 4.95,
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`FixFrame server luistert op poort ${PORT}`);
});

/**
 * Controleert regelmatig op verlopen bestanden en verwijdert deze veilig.
 */
async function cleanupExpiredFiles() {
  try {
    const jobs = await loadJobs();
    let changed = false;
    const now = new Date();
    for (const job of jobs) {
      const expiry = job.downloadTokenExpiresAt ? new Date(job.downloadTokenExpiresAt) : null;
      if (expiry && expiry < now) {
        if (job.encryptedPath) {
          await fs.promises.unlink(job.encryptedPath).catch(() => {});
          await fs.promises.unlink(`${job.encryptedPath}.tag`).catch(() => {});
        }
        if (job.resultPath) {
          await fs.promises.unlink(job.resultPath).catch(() => {});
        }
        job.status = 'verwijderd';
        job.encryptedPath = null;
        job.resultPath = null;
        job.downloadToken = null;
        job.downloadTokenExpiresAt = null;
        changed = true;
      }
    }
    if (changed) {
      await saveJobs(jobs);
    }
  } catch (error) {
    console.error('Opschoning mislukt', error);
  }
}

setInterval(() => {
  cleanupExpiredFiles();
}, 12 * 60 * 60 * 1000);

cleanupExpiredFiles();
