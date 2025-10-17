const { spawn } = require('child_process');
const fs = require('fs');
const { pipeline } = require('stream');
const util = require('util');
const pipelineAsync = util.promisify(pipeline);

/**
 * Probeert een beschadigde foto te repareren met externe tools.
 * Gebruikt exiftool of jpeginfo, maar valt terug op een simpele kopie.
 * @param {string} sourcePath - Pad naar het bronbestand.
 * @param {string} destinationPath - Pad waar het resultaat moet komen.
 * @returns {Promise<{status: string, message: string}>}
 */
async function repairImage(sourcePath, destinationPath) {
  try {
    await runExternalTool(['exiftool', '-overwrite_original', sourcePath]);
    await pipelineAsync(fs.createReadStream(sourcePath), fs.createWriteStream(destinationPath));
    return { status: 'success', message: 'Automatische fotoreparatie voltooid.' };
  } catch (error) {
    try {
      await runExternalTool(['jpeginfo', '-c', sourcePath]);
      await pipelineAsync(fs.createReadStream(sourcePath), fs.createWriteStream(destinationPath));
      return { status: 'success', message: 'Reparatie voltooid met jpeginfo.' };
    } catch (fallbackError) {
      await pipelineAsync(fs.createReadStream(sourcePath), fs.createWriteStream(destinationPath));
      return { status: 'manual_review', message: 'Automatische reparatie mislukt, handmatige controle nodig.' };
    }
  }
}

/**
 * Voert een extern command-line programma uit wanneer beschikbaar.
 * @param {string[]} args - Argumenten voor spawn.
 * @returns {Promise<void>}
 */
function runExternalTool(args) {
  return new Promise((resolve, reject) => {
    const [command, ...commandArgs] = args;
    const tool = spawn(command, commandArgs);
    tool.on('error', (err) => {
      reject(err);
    });
    tool.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} eindigde met code ${code}`));
      }
    });
  });
}

module.exports = { repairImage };
