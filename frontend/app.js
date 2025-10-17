const uploadForm = document.getElementById('uploadForm');
const progressBar = document.getElementById('progressBar');
const statusMessage = document.getElementById('statusMessage');
const summaryCard = document.getElementById('summary');
const summaryFile = document.getElementById('summaryFile');
const summaryPrice = document.getElementById('summaryPrice');
const payButton = document.getElementById('payButton');
const paymentMessage = document.getElementById('paymentMessage');
const cta = document.getElementById('cta');

let currentJob = null;
let config = { price: 4.95 };

document.getElementById('year').textContent = new Date().getFullYear();

if (cta) {
  cta.addEventListener('click', () => {
    document.getElementById('upload').scrollIntoView({ behavior: 'smooth' });
  });
}

fetch('/api/config')
  .then((res) => res.json())
  .then((data) => {
    config = data;
    if (data && data.price) {
      summaryPrice.textContent = data.price.toFixed(2).replace('.', ',');
    }
  })
  .catch(() => {});

uploadForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value;
  const fileInput = document.getElementById('file');
  if (!fileInput.files.length) {
    statusMessage.textContent = 'Kies eerst een bestand om te uploaden.';
    return;
  }
  const formData = new FormData();
  formData.append('email', email);
  formData.append('file', fileInput.files[0]);

  statusMessage.textContent = 'Bestand wordt geüpload… even geduld.';
  progressBar.style.width = '0%';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload');

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = `${percent}%`;
    }
  });

  xhr.addEventListener('load', () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      const response = JSON.parse(xhr.responseText);
      currentJob = response.job;
      summaryFile.textContent = currentJob.originalName;
      summaryCard.classList.remove('hidden');
      statusMessage.textContent = 'Upload gelukt. Klik op betaal om door te gaan.';
    } else {
      statusMessage.textContent = 'Upload mislukt. Probeer het opnieuw of neem contact op.';
      progressBar.style.width = '0%';
    }
  });

  xhr.addEventListener('error', () => {
    statusMessage.textContent = 'Er ging iets mis tijdens het uploaden.';
    progressBar.style.width = '0%';
  });

  xhr.send(formData);
});

payButton.addEventListener('click', async () => {
  if (!currentJob) {
    paymentMessage.textContent = 'Upload eerst een bestand.';
    return;
  }
  paymentMessage.textContent = 'Betaling wordt klaargezet…';
  try {
    const response = await fetch('/api/payment/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: currentJob.id }),
    });
    if (!response.ok) {
      paymentMessage.textContent = 'Kon de betaling niet starten. Probeer opnieuw.';
      return;
    }
    const data = await response.json();
    if (data.provider === 'stripe' && data.checkoutUrl) {
      paymentMessage.textContent = 'We openen nu de beveiligde betaalpagina.';
      window.location.href = data.checkoutUrl;
    } else {
      paymentMessage.textContent = 'Testbetaling bevestigd. Reparatie start direct.';
      await confirmPayment(currentJob.id, data.sessionId || 'dummy');
    }
  } catch (error) {
    paymentMessage.textContent = 'Er trad een fout op bij het starten van de betaling.';
  }
});

/**
 * Meldt aan de backend dat de betaling is verwerkt zodat de reparatie kan starten.
 * @param {string} jobId - Het id van de upload.
 * @param {string} sessionId - Stripe checkout session of dummy id.
 */
async function confirmPayment(jobId, sessionId) {
  await fetch('/api/payment/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, sessionId }),
  });
}
