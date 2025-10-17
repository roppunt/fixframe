const { spawn } = require('child_process');
const fs = require('fs');
const util = require('util');
const { pipeline } = require('stream');
const pipelineAsync = util.promisify(pipeline);

/**
 * Probeert een beschadigde video te repareren door ffmpeg te gebruiken.
 * @param {string} sourcePath - Pad naar het bronbestand.
 * @param {string} destinationPath - Pad voor het resultaat.
 * @returns {Promise<{status: string, message: string}>}
 */
async function repairVideo(sourcePath, destinationPath) {
  try {
    await runFfmpeg(['-i', sourcePath, '-c', 'copy', destinationPath]);
    return { status: 'success', message: 'Video succesvol opnieuw verpakt met ffmpeg.' };
  } catch (error) {
    await pipelineAsync(fs.createReadStream(sourcePath), fs.createWriteStream(destinationPath));
    return { status: 'manual_review', message: 'Automatische videoreparatie mislukt, handmatige controle nodig.' };
  }
}

/**
 * Voert ffmpeg uit met de opgegeven argumenten.
 * @param {string[]} args - Argumenten voor ffmpeg.
 * @returns {Promise<void>}
 */
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const tool = spawn('ffmpeg', args);
    tool.on('error', (err) => {
      reject(err);
    });
    tool.stderr.on('data', () => {});
    tool.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg eindigde met code ${code}`));
      }
    });
  });
}

module.exports = { repairVideo };
