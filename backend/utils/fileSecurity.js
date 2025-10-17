const fs = require('fs');
const crypto = require('crypto');
const util = require('util');
const { pipeline } = require('stream');
const pipelineAsync = util.promisify(pipeline);

const rawKey = process.env.ENCRYPTION_KEY || '';
if (!rawKey || rawKey.length !== 64) {
  console.warn('Let op: stel ENCRYPTION_KEY in op 64 hex-tekens voor productiegebruik.');
}
const ENCRYPTION_KEY = (rawKey || crypto.randomBytes(32).toString('hex')).slice(0, 64);

/**
 * Maakt een iv aan voor encryptie.
 * @returns {Buffer}
 */
function createIv() {
  return crypto.randomBytes(16);
}

/**
 * Versleutelt een bronbestand en schrijft het naar het bestemmingspad.
 * @param {string} sourcePath - Pad naar het bronbestand.
 * @param {string} destinationPath - Pad voor de versleutelde output.
 * @returns {Promise<string>} - Teruggegeven iv in hex.
 */
async function encryptFile(sourcePath, destinationPath) {
  const iv = createIv();
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  const writeStream = fs.createWriteStream(destinationPath);
  await pipelineAsync(fs.createReadStream(sourcePath), cipher, writeStream);
  const authTag = cipher.getAuthTag();
  await fs.promises.writeFile(`${destinationPath}.tag`, authTag);
  return iv.toString('hex');
}

/**
 * Ontsleutelt een versleuteld bestand naar een tijdelijk pad.
 * @param {string} sourcePath - Pad naar het versleutelde bestand.
 * @param {string} destinationPath - Doelpad voor ontsleutelde data.
 * @param {string} ivHex - Opslag van de initialisatievector.
 * @returns {Promise<void>}
 */
async function decryptFile(sourcePath, destinationPath, ivHex) {
  const iv = Buffer.from(ivHex, 'hex');
  const tag = await fs.promises.readFile(`${sourcePath}.tag`);
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(tag);
  await pipelineAsync(fs.createReadStream(sourcePath), decipher, fs.createWriteStream(destinationPath));
}

module.exports = { encryptFile, decryptFile };
