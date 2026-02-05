// SUBLYM Backend - Brevo Email Service

import { prisma } from '../db';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3';
const IS_DEV = process.env.ENVIRONMENT !== 'production';

function getFrontendUrl(origin?: string): string {
  return origin || process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
}
// Sender must be verified in Brevo dashboard (https://app.brevo.com/senders)
// Important: freemail domains (gmail, yahoo) are rejected by Brevo for transactional emails
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@sublym.org';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'SUBLYM';

interface SendEmailParams {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

async function sendEmail(params: SendEmailParams): Promise<boolean> {
  // En mode dev sans clé Brevo, on log seulement
  if (!BREVO_API_KEY || BREVO_API_KEY === 'your-brevo-api-key') {
    console.log('\n' + '='.repeat(60));
    console.log('📧 EMAIL (DEV MODE - Non envoyé)');
    console.log('='.repeat(60));
    console.log(`To: ${params.to}`);
    console.log(`Subject: ${params.subject}`);
    console.log('-'.repeat(60));
    console.log(params.textContent || params.htmlContent);
    console.log('='.repeat(60) + '\n');
    return true;
  }

  try {
    const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL,
        },
        to: [{ email: params.to }],
        subject: params.subject,
        htmlContent: params.htmlContent,
        textContent: params.textContent,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Brevo email error:', JSON.stringify(error, null, 2));
      console.error(`  Sender: ${SENDER_EMAIL}`);
      console.error(`  To: ${params.to}`);
      console.error(`  Subject: ${params.subject}`);
      if (error.code === 'unauthorized' || error.message?.includes('not validated') || error.message?.includes('not found')) {
        console.error('  → Le domaine expéditeur doit être vérifié dans Brevo.');
        console.error('  → Vérifiez les enregistrements DNS (TXT/DKIM) pour sublym.org');
        console.error('  → Dashboard: https://app.brevo.com/senders/domain/list');
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export async function sendMagicLink(email: string, token: string, lang: string = 'fr', origin?: string): Promise<boolean> {
  const loginUrl = `${getFrontendUrl(origin)}/login?token=${token}`;
  
  // TOUJOURS afficher le lien en mode dev
  if (IS_DEV) {
    console.log('\n' + '🔗'.repeat(30));
    console.log('🔐 MAGIC LINK - Cliquez pour vous connecter:');
    console.log('🔗'.repeat(30));
    console.log(`\n   👉 ${loginUrl}\n`);
    console.log(`   Email: ${email}`);
    console.log(`   Token: ${token}`);
    console.log('🔗'.repeat(30) + '\n');
  }

  const translations: Record<string, { subject: string; title: string; button: string; expire: string; ignore: string }> = {
    fr: {
      subject: 'Votre lien de connexion SUBLYM',
      title: 'Connectez-vous à SUBLYM',
      button: 'Me connecter',
      expire: 'Ce lien expire dans 30 minutes.',
      ignore: 'Si vous n\'avez pas demandé ce lien, ignorez cet email.',
    },
    en: {
      subject: 'Your SUBLYM login link',
      title: 'Log in to SUBLYM',
      button: 'Log in',
      expire: 'This link expires in 30 minutes.',
      ignore: 'If you did not request this link, please ignore this email.',
    },
    it: {
      subject: 'Il tuo link di accesso SUBLYM',
      title: 'Accedi a SUBLYM',
      button: 'Accedi',
      expire: 'Questo link scade tra 30 minuti.',
      ignore: 'Se non hai richiesto questo link, ignora questa email.',
    },
  };

  const t = translations[lang] || translations.fr;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fefdfb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fefdfb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(26, 95, 110, 0.08);">
          <!-- Logo -->
          <tr>
            <td style="padding: 40px 40px 10px; text-align: center;">
              <img src="https://preprod.sublym.org/logo.svg" alt="SUBLYM" width="180" style="max-width: 180px; height: auto;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 10px 40px 40px;">
              <h2 style="margin: 0 0 20px; color: #013833; font-size: 24px; text-align: center; font-weight: 600;">${t.title}</h2>

              <p style="margin: 0 0 30px; color: #555555; font-size: 16px; line-height: 1.6; text-align: center;">
                ${t.expire}
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #1a5f6e 0%, #2a7a8c 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 18px; font-weight: 600;">
                      ${t.button}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; color: #999999; font-size: 14px; text-align: center;">
                ${t.ignore}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #e8eeef;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} SUBLYM. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textContent = `
${t.title}

${t.button}: ${loginUrl}

${t.expire}

${t.ignore}

© ${new Date().getFullYear()} SUBLYM
  `;

  return sendEmail({
    to: email,
    subject: t.subject,
    htmlContent,
    textContent,
  });
}

export async function sendWelcomeEmail(email: string, firstName: string, lang: string = 'fr'): Promise<boolean> {
  const translations: Record<string, { subject: string; greeting: string; message: string }> = {
    fr: {
      subject: 'Bienvenue sur SUBLYM !',
      greeting: `Bonjour ${firstName},`,
      message: 'Bienvenue dans l\'univers SUBLYM ! Vous pouvez maintenant créer vos premières vidéos personnalisées.',
    },
    en: {
      subject: 'Welcome to SUBLYM!',
      greeting: `Hello ${firstName},`,
      message: 'Welcome to SUBLYM! You can now create your first personalized videos.',
    },
    it: {
      subject: 'Benvenuto su SUBLYM!',
      greeting: `Ciao ${firstName},`,
      message: 'Benvenuto nell\'universo SUBLYM! Ora puoi creare i tuoi primi video personalizzati.',
    },
  };

  const t = translations[lang] || translations.fr;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${t.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fefdfb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fefdfb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(26, 95, 110, 0.08);">
          <tr>
            <td style="padding: 40px 40px 10px; text-align: center;">
              <img src="https://preprod.sublym.org/logo.svg" alt="SUBLYM" width="180" style="max-width: 180px; height: auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 40px 40px;">
              <h2 style="margin: 0 0 16px; color: #013833; font-size: 22px; font-weight: 600;">${t.greeting}</h2>
              <p style="margin: 0; color: #555555; font-size: 16px; line-height: 1.6;">${t.message}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #e8eeef;">
              <p style="margin: 0; color: #999999; font-size: 12px;">© ${new Date().getFullYear()} SUBLYM. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: t.subject,
    htmlContent,
  });
}

export async function sendVideoReadyEmail(
  email: string,
  firstName: string,
  videoUrl: string,
  lang: string = 'fr',
  gender: string = 'neutral'
): Promise<boolean> {
  // Gender-specific words by language
  const genderWords: Record<string, Record<string, string>> = {
    fr: { male: 'prêt', female: 'prête', neutral: 'prêt(e)' },
    it: { male: 'pronto', female: 'pronta', neutral: 'pronto/a' },
    es: { male: 'listo', female: 'lista', neutral: 'listo/a' },
  };

  const getGenderedWord = (language: string): string => {
    const words = genderWords[language];
    if (!words) return '';  // No gendered words for this language
    return words[gender] || words.neutral;
  };

  const translations: Record<string, { subject: string; title: string; message: string; button: string }> = {
    fr: {
      subject: 'Votre vidéo SUBLYM est prête ! 🎬',
      title: 'Votre rêve prend vie',
      message: `${firstName}, votre vidéo personnalisée est ${getGenderedWord('fr')} à être visionnée.`,
      button: 'Voir ma vidéo',
    },
    en: {
      subject: 'Your SUBLYM video is ready! 🎬',
      title: 'Your dream comes to life',
      message: `${firstName}, your personalized video is ready to watch.`,
      button: 'Watch my video',
    },
    it: {
      subject: `Il tuo video SUBLYM è ${getGenderedWord('it')}! 🎬`,
      title: 'Il tuo sogno prende vita',
      message: `${firstName}, il tuo video personalizzato è ${getGenderedWord('it')} per essere visto.`,
      button: 'Guarda il mio video',
    },
    de: {
      subject: 'Dein SUBLYM-Video ist fertig! 🎬',
      title: 'Dein Traum wird wahr',
      message: `${firstName}, dein personalisiertes Video ist bereit.`,
      button: 'Mein Video ansehen',
    },
    es: {
      subject: `¡Tu vídeo SUBLYM está ${getGenderedWord('es')}! 🎬`,
      title: 'Tu sueño cobra vida',
      message: `${firstName}, tu vídeo personalizado está ${getGenderedWord('es')} para ver.`,
      button: 'Ver mi vídeo',
    },
  };

  const t = translations[lang] || translations.fr;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${t.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fefdfb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fefdfb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(26, 95, 110, 0.08);">
          <tr>
            <td style="padding: 40px 40px 10px; text-align: center;">
              <img src="https://preprod.sublym.org/logo.svg" alt="SUBLYM" width="180" style="max-width: 180px; height: auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 40px 40px; text-align: center;">
              <h2 style="margin: 0 0 16px; color: #013833; font-size: 24px; font-weight: 600;">${t.title}</h2>
              <p style="margin: 0 0 24px; color: #555555; font-size: 16px; line-height: 1.6;">${t.message}</p>
              <a href="${videoUrl}" style="display: inline-block; background: linear-gradient(135deg, #1a5f6e 0%, #2a7a8c 100%); color: #ffffff; padding: 16px 40px; border-radius: 50px; text-decoration: none; font-size: 18px; font-weight: 600;">
                ${t.button}
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #e8eeef;">
              <p style="margin: 0; color: #999999; font-size: 12px;">© ${new Date().getFullYear()} SUBLYM. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject: t.subject,
    htmlContent,
  });
}

// Alias pour compatibilité avec generation.ts
export const sendGenerationReadyEmail = sendVideoReadyEmail;

export async function sendInvitationEmail(
  email: string,
  inviteCode: string,
  freeGenerations: number,
  customMessage: string = '',
  lang: string = 'fr',
  origin?: string
): Promise<boolean> {
  const inviteUrl = `${getFrontendUrl(origin)}/invite/${inviteCode}`;

  const translations: Record<string, {
    subject: string;
    title: string;
    intro: string;
    gift: string;
    button: string;
    footer: string;
  }> = {
    fr: {
      subject: 'Vous êtes invité(e) sur SUBLYM !',
      title: 'Une invitation spéciale pour vous',
      intro: 'Quelqu\'un souhaite partager avec vous une expérience unique : visualiser vos rêves grâce à l\'intelligence artificielle.',
      gift: `${freeGenerations} génération${freeGenerations > 1 ? 's' : ''} offerte${freeGenerations > 1 ? 's' : ''}`,
      button: 'Accepter l\'invitation',
      footer: 'Ce lien est personnel et à usage limité.',
    },
    en: {
      subject: 'You\'re invited to SUBLYM!',
      title: 'A special invitation for you',
      intro: 'Someone wants to share a unique experience with you: visualize your dreams using artificial intelligence.',
      gift: `${freeGenerations} free generation${freeGenerations > 1 ? 's' : ''}`,
      button: 'Accept invitation',
      footer: 'This link is personal and limited use.',
    },
    it: {
      subject: 'Sei invitato/a su SUBLYM!',
      title: 'Un invito speciale per te',
      intro: 'Qualcuno vuole condividere con te un\'esperienza unica: visualizzare i tuoi sogni con l\'intelligenza artificiale.',
      gift: `${freeGenerations} generazion${freeGenerations > 1 ? 'i' : 'e'} gratuit${freeGenerations > 1 ? 'e' : 'a'}`,
      button: 'Accetta l\'invito',
      footer: 'Questo link è personale e ad uso limitato.',
    },
  };

  const t = translations[lang] || translations.fr;
  const escapedMessage = customMessage.replace(/\n/g, '<br>').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&lt;br&gt;/g, '<br>');

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fefdfb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fefdfb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(26, 95, 110, 0.08);">
          <!-- Logo -->
          <tr>
            <td style="padding: 40px 40px 10px; text-align: center;">
              <img src="https://preprod.sublym.org/logo.svg" alt="SUBLYM" width="180" style="max-width: 180px; height: auto;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 10px 40px 40px;">
              <h2 style="margin: 0 0 20px; color: #013833; font-size: 24px; text-align: center; font-weight: 600;">${t.title}</h2>

              <p style="margin: 0 0 20px; color: #555555; font-size: 16px; line-height: 1.6; text-align: center;">
                ${t.intro}
              </p>

              ${escapedMessage ? `
              <div style="background-color: #f0f7f8; border-left: 4px solid #013833; padding: 16px 20px; margin: 0 0 24px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #555555; font-size: 15px; line-height: 1.6; font-style: italic;">
                  ${escapedMessage}
                </p>
              </div>
              ` : ''}

              <div style="background-color: #f0f7f8; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 30px;">
                <p style="margin: 0; color: #013833; font-size: 20px; font-weight: bold;">
                  🎁 ${t.gift}
                </p>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #1a5f6e 0%, #2a7a8c 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 18px; font-weight: 600;">
                      ${t.button}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; color: #999999; font-size: 14px; text-align: center;">
                ${t.footer}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #e8eeef;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} SUBLYM. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textContent = `
${t.title}

${t.intro}

${customMessage ? customMessage + '\n' : ''}
🎁 ${t.gift}

${t.button}: ${inviteUrl}

${t.footer}

© ${new Date().getFullYear()} SUBLYM
  `;

  return sendEmail({
    to: email,
    subject: t.subject,
    htmlContent,
    textContent,
  });
}

// ============================================
// SMS
// ============================================

async function sendSMS(recipient: string, content: string): Promise<boolean> {
  if (!BREVO_API_KEY || BREVO_API_KEY === 'your-brevo-api-key') {
    console.log('\n' + '='.repeat(60));
    console.log('📱 SMS (DEV MODE - Non envoyé)');
    console.log('='.repeat(60));
    console.log(`To: ${recipient}`);
    console.log(`Content: ${content}`);
    console.log('='.repeat(60) + '\n');
    return true;
  }

  try {
    const response = await fetch(`${BREVO_API_URL}/transactionalSMS/send`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: 'SUBLYM',
        recipient,
        content,
        type: 'transactional',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Brevo SMS error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}

export async function sendInvitationSMS(
  phone: string,
  inviteCode: string,
  freeGenerations: number,
  customMessage: string = '',
  lang: string = 'fr',
  origin?: string
): Promise<boolean> {
  const inviteUrl = `${getFrontendUrl(origin)}/invite/${inviteCode}`;

  const templates: Record<string, string> = {
    fr: `SUBLYM - ${freeGenerations} génération${freeGenerations > 1 ? 's' : ''} offerte${freeGenerations > 1 ? 's' : ''} ! ${customMessage ? customMessage + ' ' : ''}Découvrez votre rêve en vidéo : ${inviteUrl}`,
    en: `SUBLYM - ${freeGenerations} free generation${freeGenerations > 1 ? 's' : ''}! ${customMessage ? customMessage + ' ' : ''}Discover your dream as a video: ${inviteUrl}`,
    it: `SUBLYM - ${freeGenerations} generazion${freeGenerations > 1 ? 'i' : 'e'} gratuit${freeGenerations > 1 ? 'e' : 'a'}! ${customMessage ? customMessage + ' ' : ''}Scopri il tuo sogno in video: ${inviteUrl}`,
  };

  const content = templates[lang] || templates.fr;
  return sendSMS(phone, content);
}

// Notification de contact (pour l'admin)
export async function sendContactNotification(
  name: string,
  email: string,
  subject: string,
  message: string
): Promise<boolean> {
  // Fetch webmaster email from Config table, fallback to env var
  let adminEmail = process.env.ADMIN_EMAIL || 'contact@sublym.org';
  try {
    const config = await prisma.config.findUnique({ where: { key: 'sublym_email_webmaster' } });
    if (config?.value) adminEmail = config.value;
  } catch (err) {
    console.error('Failed to fetch webmaster email from config, using fallback:', err);
  }
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nouveau message de contact</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fefdfb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fefdfb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(26, 95, 110, 0.08);">
          <tr>
            <td style="padding: 40px 40px 10px; text-align: center;">
              <img src="https://preprod.sublym.org/logo.svg" alt="SUBLYM" width="180" style="max-width: 180px; height: auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 40px 40px;">
              <h2 style="margin: 0 0 16px; color: #013833; font-size: 22px; font-weight: 600;">Nouveau message de contact</h2>
              <p style="margin: 0 0 8px; color: #555555;"><strong>De:</strong> ${name} (${email})</p>
              <p style="margin: 0 0 16px; color: #555555;"><strong>Sujet:</strong> ${subject}</p>
              <hr style="border: none; border-top: 1px solid #e8eeef; margin: 16px 0;">
              <p style="margin: 0 0 8px; color: #555555;"><strong>Message:</strong></p>
              <p style="margin: 0; color: #555555; white-space: pre-wrap; line-height: 1.6;">${message}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #e8eeef;">
              <p style="margin: 0; color: #999999; font-size: 12px;">© ${new Date().getFullYear()} SUBLYM. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  // En mode dev, log seulement
  if (!BREVO_API_KEY || BREVO_API_KEY === 'your-brevo-api-key') {
    console.log('\n' + '='.repeat(60));
    console.log('📧 CONTACT NOTIFICATION (DEV MODE)');
    console.log('='.repeat(60));
    console.log(`From: ${name} <${email}>`);
    console.log(`Subject: ${subject}`);
    console.log(`Message: ${message}`);
    console.log('='.repeat(60) + '\n');
    return true;
  }

  return sendEmail({
    to: adminEmail,
    subject: `[SUBLYM Contact] ${subject}`,
    htmlContent,
  });
}
