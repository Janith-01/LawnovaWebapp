import nodemailer from 'nodemailer';
import config from '../config/index.js';
import logger from './logger.js';

/**
 * Create reusable transporter using SMTP config from environment
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: config.email.service,
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.auth.user,
      pass: config.email.auth.pass,
    },
  });
};

/**
 * Send an email using the configured transporter
 */
const sendEmail = async (to, subject, html) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"LAWNOVA" <${config.email.from || config.email.auth.user}>`,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent successfully', { to, subject, messageId: info.messageId });
    return info;
  } catch (error) {
    logger.error('Failed to send email', { to, subject, error: error.message });
    throw error;
  }
};

/**
 * Send a 6-digit OTP verification email
 */
export const sendVerificationOTP = async (email, otp) => {
  const subject = 'LAWNOVA — Verify Your Email Address';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 40px; text-align: center;">
                  <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px;">⚖️ LAWNOVA</h1>
                  <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:8px 0 0;">AI-Powered Legal Education Platform</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <h2 style="color:#1e293b;font-size:20px;font-weight:600;margin:0 0 12px;">Verify Your Email</h2>
                  <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 28px;">
                    Welcome to LAWNOVA! Use the verification code below to complete your registration. This code expires in <strong>10 minutes</strong>.
                  </p>
                  
                  <!-- OTP Code -->
                  <div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin:0 0 28px;">
                    <p style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 12px;font-weight:600;">Your Verification Code</p>
                    <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#4f46e5;font-family:'Courier New',monospace;">${otp}</div>
                  </div>

                  <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0;">
                    If you didn't create an account with LAWNOVA, please ignore this email.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
                  <p style="color:#94a3b8;font-size:11px;margin:0;">© ${new Date().getFullYear()} LAWNOVA. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * Send a password reset email with a clickable link
 */
export const sendPasswordResetEmail = async (email, resetLink) => {
  const subject = 'LAWNOVA — Reset Your Password';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 40px; text-align: center;">
                  <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px;">⚖️ LAWNOVA</h1>
                  <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:8px 0 0;">AI-Powered Legal Education Platform</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <h2 style="color:#1e293b;font-size:20px;font-weight:600;margin:0 0 12px;">Reset Your Password</h2>
                  <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 28px;">
                    We received a request to reset the password for your LAWNOVA account. Click the button below to set a new password. This link expires in <strong>15 minutes</strong>.
                  </p>
                  
                  <!-- CTA Button -->
                  <div style="text-align:center;margin:0 0 28px;">
                    <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 40px;border-radius:50px;letter-spacing:0.3px;">
                      Reset Password
                    </a>
                  </div>

                  <p style="color:#64748b;font-size:13px;line-height:1.5;margin:0 0 16px;">
                    Or copy and paste this link into your browser:
                  </p>
                  <p style="color:#4f46e5;font-size:12px;word-break:break-all;background:#f8fafc;padding:12px;border-radius:8px;margin:0 0 28px;">
                    ${resetLink}
                  </p>

                  <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0;">
                    If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
                  <p style="color:#94a3b8;font-size:11px;margin:0;">© ${new Date().getFullYear()} LAWNOVA. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};
