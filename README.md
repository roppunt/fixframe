# FixFrame — corruptieherstel-platform

FixFrame is een volledig Nederlandse webapplicatie waarmee gebruikers beschadigde foto’s en video’s kunnen laten herstellen voor € 4,95 per bestand. Geen abonnementen, wel veilige opslag, automatische betaling en duidelijke communicatie.

## Inhoud

- [Belangrijkste features](#belangrijkste-features)
- [Architectuur](#architectuur)
- [Installatie](#installatie)
- [Omgevingsvariabelen](#omgevingsvariabelen)
- [Benodigde tools](#benodigde-tools)
- [Project starten](#project-starten)
- [Workflow gebruiker](#workflow-gebruiker)
- [Beheerdersdashboard](#beheerdersdashboard)
- [Beveiliging & privacy](#beveiliging--privacy)
- [Screenshots](#screenshots)
- [Docker & Plesk](#docker--plesk)
- [Toekomstige verbeteringen](#toekomstige-verbeteringen)

## Belangrijkste features

- Upload van één foto of video tot 4 GB met voortgangsbalk.
- Ondersteuning voor JPG, JPEG, PNG, HEIC, GIF, MP4, MOV, AVI en MKV.
- Betalingen via Stripe Checkout (met iDEAL, Bancontact, creditcard, …).
- Automatische reparatiepogingen met ffmpeg en exiftool/jpeginfo.
- Versleutelde opslag en automatische verwijdering na 30 dagen.
- E-mailmeldingen via SMTP zodra herstel klaar is of refund is uitgevoerd.
- Downloadpagina met unieke token en vervaldatum.
- Beheerdersdashboard met basis-authenticatie voor refunds en handmatige uploads.

## Architectuur

```
fixframe/
├── backend/
│   ├── server.js
│   ├── routes/
│   │   ├── upload.js
│   │   ├── payment.js
│   │   ├── download.js
│   │   └── admin.js
│   ├── utils/
│   │   ├── email.js
│   │   ├── fileSecurity.js
│   │   ├── jobStore.js
│   │   ├── repairImage.js
│   │   └── repairVideo.js
│   ├── storage/
│   │   ├── encrypted/
│   │   ├── results/
│   │   └── tmp/
│   └── config/
│       └── env.example
├── frontend/
│   ├── index.html
│   ├── download.html
│   ├── betaling.html
│   ├── styles.css
│   └── app.js
├── data/jobs.json
├── package.json
└── README.md
```

De backend draait op Node.js (Express) en stelt REST-endpoints beschikbaar voor uploads, betalingen, downloads en beheer. De frontend is een lichte statische site met vanilla JavaScript.

## Installatie

1. **Kloon de repository**
   ```bash
   git clone https://github.com/jouw-account/fixframe.git
   cd fixframe
   ```
2. **Installeer Node.js dependencies**
   ```bash
   npm install
   ```
3. **Kopieer het voorbeeldbestand voor omgevingsvariabelen**
   ```bash
   cp backend/config/env.example backend/config/.env
   ```
4. **Vul de variabelen in** (zie [Omgevingsvariabelen](#omgevingsvariabelen)).
5. **Installeer de vereiste systeemtools** (zie [Benodigde tools](#benodigde-tools)).

## Omgevingsvariabelen

| Variabele | Beschrijving |
| --- | --- |
| `PORT` | Poort waarop de server draait (standaard 4000). |
| `BASE_URL` | Publieke URL van de applicatie, gebruikt voor e-mails en Stripe redirect. |
| `STRIPE_API_KEY` | Secret key van Stripe (begint met `sk_`). |
| `STRIPE_PUBLISHABLE_KEY` | Publishable key voor de frontend (begint met `pk_`). |
| `STRIPE_WEBHOOK_SECRET` | (Optioneel) Webhook secret om betalingen automatisch te verifiëren. |
| `PAYMENT_PROVIDER` | Standaard `stripe`. Reserve voor toekomstige aanbieders. |
| `ENCRYPTION_KEY` | Hexadecimale sleutel van 64 tekens (32 bytes) voor AES-256-GCM. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | SMTP-gegevens voor nodemailer. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Inloggegevens voor het beheerdersdashboard. |
| `DOWNLOAD_TOKEN_SECRET` | Gereserveerd voor toekomstige token-signing. |

## Benodigde tools

Installeer lokaal de commandlinetools die het herstel uitvoeren:

- **ffmpeg**
  - macOS (Homebrew): `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt-get install ffmpeg`
  - Windows (Chocolatey): `choco install ffmpeg`
- **exiftool** (voor fotometadata en reparatie)
  - macOS: `brew install exiftool`
  - Ubuntu/Debian: `sudo apt-get install libimage-exiftool-perl`
  - Windows: download van <https://exiftool.org/>
- **jpeginfo** (optioneel als fallback voor JPEG-controle)
  - macOS: `brew install jpeginfo`
  - Ubuntu/Debian: `sudo apt-get install jpeginfo`

Zorg ervoor dat de tools via het pad (`$PATH`) beschikbaar zijn voor Node.js.

## Project starten

```bash
npm run start
```

De server draait vervolgens op <http://localhost:4000>. De statische frontend wordt direct door Express geserveerd.

### Nodemon voor ontwikkeling

```bash
npm run dev
```

## Workflow gebruiker

1. Bezoek <http://localhost:4000> en klik op “Upload & herstel nu”.
2. Vul je e-mailadres in en kies een bestand. Tijdens het uploaden zie je een voortgangsbalk.
3. Na de upload verschijnt een samenvatting met de prijs van € 4,95. Klik op de betaalknop.
4. Stripe opent een Checkout-scherm met iDEAL, Bancontact en creditcard. Na afronding keer je terug naar `betaling.html`.
5. De backend start automatisch de herstel-engine. Je ontvangt een e-mail zodra het klaar is.
6. Gebruik de link uit de e-mail of `download.html` met de token om je bestand binnen 30 dagen te downloaden.

## Beheerdersdashboard

- Endpoint: `GET /api/admin/jobs`
- Authenticatie: Basic Auth met `ADMIN_EMAIL` en `ADMIN_PASSWORD`.
- Mogelijkheden:
  - Overzicht van alle jobs (status, betaling, e-mailadres).
  - `POST /api/admin/jobs/:jobId/refund` om een refund vast te leggen en een mail te sturen.
  - `POST /api/admin/jobs/:jobId/manual-upload` om een alternatieve download-URL te registreren.

Gebruik bijvoorbeeld [Hoppscotch](https://hoppscotch.io/) of [Postman](https://www.postman.com/) om de beheer-API te benaderen.

## Beveiliging & privacy

- **Versleuteling:** uploads worden direct versleuteld met AES-256-GCM voordat ze op schijf belanden.
- **Automatische verwijdering:** een cleanup-job controleert elke 12 uur of bestanden ouder dan 30 dagen zijn en verwijdert deze.
- **Toegang:** downloadlinks zijn voorzien van een unieke token en vervallen automatisch.
- **Communicatie:** alle gebruikersmailtjes worden via `nodemailer` verstuurd met jouw SMTP-gegevens.
- **Aanbevolen extra’s:**
  - Draai achter een reverse proxy met HTTPS (bijv. Nginx of Plesk).
  - Zet Stripe-webhooks aan voor automatische verificatie van betalingen.
  - Voeg rate-limiting en audit logging toe voor extra bescherming.

## Screenshots

- Startpagina: `docs/screenshots/home.png` *(placeholder — voeg eigen screenshot toe na deployment)*
- Uploadstatus: `docs/screenshots/upload.png`
- Downloadpagina: `docs/screenshots/download.png`

Voeg tijdens productie screenshots toe aan `docs/screenshots/` en werk deze sectie bij.

## Docker & Plesk

### Docker-compose (optioneel)

Maak een bestand `docker-compose.yml` aan met onderstaand voorbeeld:

```yaml
version: '3.8'
services:
  fixframe:
    build: .
    ports:
      - "4000:4000"
    env_file:
      - ./backend/config/.env
    volumes:
      - ./data:/app/data
      - ./backend/storage:/app/backend/storage
```

### Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 4000
CMD ["npm", "run", "start"]
```

### Plesk

- Upload de broncode via Git of FTP naar een Node.js-app in Plesk.
- Stel het startscript in op `npm run start` met Node 18 of hoger.
- Gebruik de Plesk “Scheduled Tasks” om dagelijks een curl naar `/api/health` uit te voeren als keep-alive.
- Configureer omgevingsvariabelen via de Plesk-interface.

## Toekomstige verbeteringen

- Integratie van Stripe-webhooks voor automatische betalingssynchronisatie.
- UI voor het beheerdersdashboard met React of Vue.
- Automatische kwaliteitsrapportage na herstel (metadata & logbestanden).
- Integratie met Mollie als alternatief voor Stripe.

Veel succes met FixFrame! Vragen of feedback? Mail naar [support@fixframe.nl](mailto:support@fixframe.nl).
