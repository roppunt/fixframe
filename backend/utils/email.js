const nodemailer = require('nodemailer');

/**
 * Stelt een e-mailtransporteur in op basis van omgeving.
 * @returns {import('nodemailer').Transporter}
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Verstuurt een status e-mail naar de gebruiker.
 * @param {string} to - Ontvanger.
 * @param {string} subject - Onderwerp.
 * @param {string} html - HTML-inhoud.
 * @returns {Promise<void>}
 */
async function sendStatusMail(to, subject, html) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'FixFrame <no-reply@fixframe.nl>',
    to,
    subject,
    html,
  });
}

module.exports = { sendStatusMail };
