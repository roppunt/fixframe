const fs = require('fs');
const path = require('path');

const JOB_PATH = path.join(__dirname, '../../data/jobs.json');

/**
 * Laadt alle jobs vanuit de JSON opslag.
 * @returns {Promise<any[]>}
 */
async function loadJobs() {
  try {
    const buffer = await fs.promises.readFile(JOB_PATH, 'utf-8');
    return JSON.parse(buffer);
  } catch (error) {
    return [];
  }
}

/**
 * Schrijft de opgegeven lijst van jobs weg.
 * @param {any[]} jobs - Te bewaren jobs.
 * @returns {Promise<void>}
 */
async function saveJobs(jobs) {
  await fs.promises.writeFile(JOB_PATH, JSON.stringify(jobs, null, 2));
}

/**
 * Zoekt een job op basis van id.
 * @param {string} jobId - Te zoeken id.
 * @returns {Promise<any | undefined>}
 */
async function findJob(jobId) {
  const jobs = await loadJobs();
  return jobs.find((job) => job.id === jobId);
}

module.exports = { loadJobs, saveJobs, findJob };
