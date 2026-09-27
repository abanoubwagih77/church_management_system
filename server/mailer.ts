import nodemailer from 'nodemailer';
import { getDb } from './db.js';

interface SendResetEmailOptions {
  toEmail: string;
  recipientName: string;
  resetCode: string;
}

export async function sendPasswordResetEmail({
  toEmail,
  recipientName,
  resetCode,
}: SendResetEmailOptions): Promise<{ success: boolean; simulated?: boolean; error?: string }> {
  let dbSmtp: any = {};
  try {
    const db = getDb();
    dbSmtp = (db as any)?.smtp_settings || {};
  } catch {}

  const host = dbSmtp.host || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(dbSmtp.port || process.env.SMTP_PORT || '465', 10);
  const secure = (dbSmtp.secure ?? process.env.SMTP_SECURE) !== 'false';
  const user = dbSmtp.user || process.env.SMTP_USER;
  const pass = dbSmtp.pass || process.env.SMTP_PASS;
  const from = dbSmtp.from || process.env.SMTP_FROM || `"نظام إدارة خدمة الكنائس" <${user || 'noreply@churchservants.com'}>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>رمز استعادة كلمة المرور</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0a09; color: #f5f5f4; margin: 0; padding: 20px; }
        .container { max-width: 540px; margin: 0 auto; background-color: #1c1917; border: 1px solid #78350f; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, #b45309, #d97706); padding: 28px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; color: #ffffff; font-weight: bold; }
        .header p { margin: 6px 0 0 0; font-size: 13px; color: #fef3c7; }
        .content { padding: 32px 24px; text-align: right; }
        .greeting { font-size: 16px; font-weight: bold; color: #fbbf24; margin-bottom: 12px; }
        .text { font-size: 14px; line-height: 1.7; color: #d6d3d1; margin-bottom: 24px; }
        .code-box { background-color: #0c0a09; border: 2px dashed #d97706; border-radius: 14px; padding: 18px; text-align: center; margin: 24px 0; }
        .code-label { font-size: 12px; color: #a8a29e; margin-bottom: 8px; }
        .code { font-family: monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #f59e0b; margin: 0; }
        .warning-box { background-color: rgba(239, 68, 68, 0.1); border-right: 4px solid #ef4444; border-radius: 8px; padding: 12px 16px; margin-top: 24px; font-size: 12px; color: #fca5a5; line-height: 1.6; }
        .footer { background-color: #0c0a09; padding: 18px 24px; text-align: center; font-size: 11px; color: #78716c; border-top: 1px solid #292524; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>نظام إدارة خدمة الكنائس والخدام</h1>
          <p>لوحة التحكم والإدارة المركزية (Super Admin)</p>
        </div>
        <div class="content">
          <div class="greeting">أهلاً بك ${recipientName || 'المدير العام'}،</div>
          <div class="text">
            تلقينا طلباً لإعادة تعيين كلمة المرور لحساب المدير العام الخاص بك. استخدم كود التحقق السري التالي لإتمام عملية إعادة التعيين:
          </div>
          <div class="code-box">
            <div class="code-label">رمز التحقق السري (صالِح لمدة 15 دقيقة فقط)</div>
            <div class="code">${resetCode}</div>
          </div>
          <div class="text">
            قم بإدخال هذا الرمز في صفحة استعادة كلمة المرور في الموقع لتعيين كلمة مرورك الجديدة فوراً.
          </div>
          <div class="warning-box">
            ⚠️ <strong>تنبيه أمان صارم:</strong> لا تشارك هذا الرمز مع أي شخص. مسؤولو النظام لن يطلبوا منك هذا الكود أبداً. إذا لم تكن أنت من طلب استعادة كلمة المرور، يرجى تجاهل هذه الرسالة، فحسابك في أمان تام.
          </div>
        </div>
        <div class="footer">
          هذه رسالة آلية مشفرة تم إرسالها من منصة إدارة خدمة الكنائس.
        </div>
      </div>
    </body>
    </html>
  `;

  // Always log secure event on server
  console.log(`📧 [EMAIL NOTIFICATION] Password Reset Code generated for: ${toEmail}`);

  // If SMTP credentials are configured, send real email via nodemailer
  if (user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from,
        to: toEmail,
        subject: 'رمز التحقق لإعادة تعيين كلمة المرور - نظام إدارة خدمة الكنائس',
        text: `أهلاً بك ${recipientName}، رمز التحقق الخاص بك لإعادة تعيين كلمة المرور هو: ${resetCode} (صالح لمدة 15 دقيقة).`,
        html: htmlContent,
      });

      console.log(`✅ [EMAIL SENT] Successfully delivered to ${toEmail} via SMTP`);
      return { success: true, simulated: false };
    } catch (error: any) {
      console.error(`❌ [EMAIL ERROR] Failed to send email via SMTP:`, error.message);
      // Fallback gracefully so user is never locked out
      return {
        success: true,
        simulated: true,
        error: `تعذر تسليم البريد عبر خادم SMTP (${error.message}). تم تفعيل كود الأمان المباشر.`,
      };
    }
  } else {
    // Development or SMTP not configured in environment
    console.warn(`⚠️ [SMTP NOT CONFIGURED] To deliver real emails, configure SMTP settings.`);
    console.log(`🔑 [DEV VERIFICATION CODE] Code for ${toEmail} is: ${resetCode}`);
    return { success: true, simulated: true };
  }
}
