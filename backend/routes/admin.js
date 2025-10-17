const express = require('express');
const basicAuth = require('express-basic-auth');
const { loadJobs, saveJobs } = require('../utils/jobStore');
const { sendStatusMail } = require('../utils/email');

const router = express.Router();

const authMiddleware = basicAuth({
  users: { [process.env.ADMIN_EMAIL || 'admin@fixframe.nl']: process.env.ADMIN_PASSWORD || 'beheer' },
  challenge: true,
});

router.use(authMiddleware);

/**
 * Haalt een overzicht van alle jobs op.
 */
router.get('/jobs', async (req, res) => {
  const jobs = await loadJobs();
  res.json(jobs);
});

/**
 * Markeert een job als terugbetaald.
 */
router.post('/jobs/:jobId/refund', async (req, res) => {
  try {
    const jobs = await loadJobs();
    const jobIndex = jobs.findIndex((item) => item.id === req.params.jobId);
    if (jobIndex === -1) {
      res.status(404).json({ error: 'Job niet gevonden.' });
      return;
    }
    jobs[jobIndex].paymentStatus = 'refund uitgevoerd';
    jobs[jobIndex].status = 'handmatige review';
    await saveJobs(jobs);
    await sendStatusMail(jobs[jobIndex].email, 'Onherstelbaar — refund uitgevoerd', `<p>We hebben je herstelverzoek handmatig beoordeeld en een terugbetaling ingezet.</p>`);
    res.json({ message: 'Refund geregistreerd.' });
  } catch (error) {
    res.status(500).json({ error: 'Kon refund niet opslaan.' });
  }
});

/**
 * Laat een beheerder een nieuw resultaat uploaden.
 */
router.post('/jobs/:jobId/manual-upload', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: 'URL ontbreekt.' });
      return;
    }
    const jobs = await loadJobs();
    const jobIndex = jobs.findIndex((item) => item.id === jobId);
    if (jobIndex === -1) {
      res.status(404).json({ error: 'Job niet gevonden.' });
      return;
    }
    jobs[jobIndex].status = 'handmatig resultaat beschikbaar';
    jobs[jobIndex].manualUrl = url;
    await saveJobs(jobs);
    res.json({ message: 'Handmatige link opgeslagen.' });
  } catch (error) {
    res.status(500).json({ error: 'Kon handmatige upload niet opslaan.' });
  }
});

module.exports = router;
