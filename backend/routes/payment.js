const express = require('express');
const Stripe = require('stripe');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { loadJobs, saveJobs } = require('../utils/jobStore');
const { decryptFile } = require('../utils/fileSecurity');
const { repairImage } = require('../utils/repairImage');
const { repairVideo } = require('../utils/repairVideo');
const { sendStatusMail } = require('../utils/email');

const router = express.Router();

const stripeKey = process.env.STRIPE_API_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

/**
 * Maakt een betaalintent aan voor Stripe.
 */
router.post('/intent', async (req, res) => {
  try {
    const { jobId } = req.body;
    if (!jobId) {
      res.status(400).json({ error: 'jobId ontbreekt.' });
      return;
    }
    const jobs = await loadJobs();
    const job = jobs.find((item) => item.id === jobId);
    if (!job) {
      res.status(404).json({ error: 'Job niet gevonden.' });
      return;
    }
    if (!stripe) {
      const fakeSecret = crypto.randomBytes(16).toString('hex');
      res.json({
        checkoutUrl: null,
        provider: 'dummy',
        sessionId: fakeSecret,
        message: 'Stripe is niet geconfigureerd. Gebruik testmodus.',
      });
      return;
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['ideal', 'card', 'bancontact'],
      metadata: { jobId: job.id },
      customer_email: job.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: 495,
            product_data: {
              name: 'FixFrame bestandsherstel',
              description: job.originalName,
            },
          },
        },
      ],
      success_url: `${process.env.BASE_URL}/betaling.html?jobId=${job.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}?geannuleerd=1`,
    });
    job.paymentStatus = 'checkout gestart';
    job.paymentSessionId = session.id;
    await saveJobs(jobs);
    res.json({ checkoutUrl: session.url, provider: 'stripe' });
  } catch (error) {
    console.error('Betalingsfout', error);
    res.status(500).json({ error: 'Betaling kon niet worden gestart.' });
  }
});

/**
 * Bevestigt handmatig dat de betaling is geslaagd en start de reparatie.
 */
router.post('/confirm', async (req, res) => {
  const { jobId, sessionId } = req.body;
  if (!jobId) {
    res.status(400).json({ error: 'jobId ontbreekt.' });
    return;
  }
  try {
    const jobs = await loadJobs();
    const jobIndex = jobs.findIndex((item) => item.id === jobId);
    if (jobIndex === -1) {
      res.status(404).json({ error: 'Job niet gevonden.' });
      return;
    }
    if (stripe && sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') {
        res.status(400).json({ error: 'Betaling niet bevestigd door Stripe.' });
        return;
      }
    }
    jobs[jobIndex].paymentStatus = 'betaald';
    jobs[jobIndex].status = 'in behandeling';
    jobs[jobIndex].paidAt = new Date().toISOString();
    jobs[jobIndex].paymentSessionId = sessionId || jobs[jobIndex].paymentSessionId;
    await saveJobs(jobs);
    startRepairJob(jobs[jobIndex]).catch((error) => {
      console.error('Reparatie startte niet', error);
    });
    res.json({ message: 'Betaling bevestigd. Reparatie gestart.' });
  } catch (error) {
    console.error('Bevestigingsfout', error);
    res.status(500).json({ error: 'Betaling kon niet worden bevestigd.' });
  }
});

/**
 * Start een reparatieproces op de achtergrond.
 * @param {any} job - De te verwerken job.
 */
async function startRepairJob(job) {
  const jobs = await loadJobs();
  const current = jobs.find((item) => item.id === job.id);
  if (!current) {
    return;
  }
  const tempPath = path.join(__dirname, `../storage/tmp/${job.id}-decrypt${job.extension}`);
  try {
    await decryptFile(job.encryptedPath, tempPath, job.encryptionIv);
    const resultPath = path.join(__dirname, `../storage/results/${job.id}${job.extension}`);
    let repairResult;
    if (['.jpg', '.jpeg', '.png', '.heic', '.gif'].includes(job.extension)) {
      repairResult = await repairImage(tempPath, resultPath);
    } else {
      repairResult = await repairVideo(tempPath, resultPath);
    }
    current.resultPath = resultPath;
    current.resultStatus = repairResult.status;
    current.status = repairResult.status === 'success' ? 'gereed' : 'handmatige review';
    current.completedAt = new Date().toISOString();
    current.downloadToken = crypto.randomBytes(24).toString('hex');
    current.downloadTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await saveJobs(jobs);
    await fs.promises.unlink(tempPath).catch(() => {});
    if (repairResult.status === 'success') {
      await sendStatusMail(job.email, 'Herstel voltooid — download je bestand', successMail(current));
    } else {
      current.paymentStatus = 'refund uitgevoerd';
      await saveJobs(jobs);
      await sendStatusMail(job.email, 'Onherstelbaar — refund uitgevoerd', refundMail(current));
    }
  } catch (error) {
    console.error('Reparatiefout', error);
    current.status = 'handmatige review';
    current.resultStatus = 'manual_review';
    current.paymentStatus = 'refund uitgevoerd';
    await saveJobs(jobs);
    await fs.promises.unlink(tempPath).catch(() => {});
    await sendStatusMail(job.email, 'Onherstelbaar — refund uitgevoerd', refundMail(current));
  }
}

/**
 * Genereert HTML voor een succesvolle reparatie.
 * @param {any} job - De jobinformatie.
 * @returns {string}
 */
function successMail(job) {
  return `<p>Goed nieuws! Je bestand <strong>${job.originalName}</strong> is hersteld.</p>
  <p>Download het binnen 30 dagen via: ${process.env.BASE_URL}/download.html?jobId=${job.id}&token=${job.downloadToken}</p>
  <p>Bedankt voor het vertrouwen in FixFrame.</p>`;
}

/**
 * Genereert HTML voor een refundmelding.
 * @param {any} job - De jobinformatie.
 * @returns {string}
 */
function refundMail(job) {
  return `<p>We hebben geprobeerd je bestand <strong>${job.originalName}</strong> te herstellen, maar dat is helaas niet gelukt.</p>
  <p>Er is direct een terugbetaling van € 4,95 ingezet. We nemen contact op als handmatige hulp nodig is.</p>
  <p>Team FixFrame</p>`;
}

module.exports = router;
