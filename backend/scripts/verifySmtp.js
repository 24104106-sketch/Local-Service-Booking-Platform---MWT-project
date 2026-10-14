require('dotenv').config();
const { verifySMTPTransport } = require('../services/emailService');

(async () => {
  console.log('[SMTP Verification] Starting verification of FixIt Local email configuration...');
  const result = await verifySMTPTransport();
  if (result.success) {
    console.log('[SMTP Verification] Result: SUCCESS - Ready to send transactional and password reset emails.');
    process.exit(0);
  } else {
    console.log('[SMTP Verification] Result: FAILED -', result.error);
    console.log('[SMTP Verification] Note: Update SMTP_USER and SMTP_PASSWORD in backend/.env with your valid Brevo credentials.');
    process.exit(1);
  }
})();
