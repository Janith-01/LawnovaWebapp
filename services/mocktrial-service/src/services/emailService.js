import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

/**
 * Email Service - Handles all email operations using Nodemailer
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * Initialize the email transporter
   */
  async init() {
    if (this.initialized) return;

    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Verify connection
      if (process.env.NODE_ENV !== 'test') {
        await this.transporter.verify();
        logger.info('Email service initialized successfully');
      }

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      // Don't throw - allow service to run without email in development
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  /**
   * Send a trial invitation email
   * @param {string} toEmail - Recipient email address
   * @param {Object} trialDetails - Trial information
   * @param {string} joinLink - Unique URL to join the session
   */
  async sendTrialInvitation(toEmail, trialDetails, joinLink) {
    if (!this.initialized || !this.transporter) {
      logger.warn(`Email not sent to ${toEmail} - Email service not initialized`);
      return { success: false, message: 'Email service not initialized' };
    }

    const { topic, description, scheduledDate, scheduledTime, role, ownerName, agenda } = trialDetails;

    // Format date nicely
    const formattedDate = new Date(scheduledDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mock Trial Invitation</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 30px; background: linear-gradient(135deg, #1a365d 0%, #2d4a77 100%); border-radius: 12px 12px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                    ⚖️ LAWNOVA Mock Trial
                  </h1>
                  <p style="margin: 10px 0 0; color: #94a3b8; font-size: 14px;">
                    You've been invited to participate
                  </p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 20px; color: #1a365d; font-size: 22px;">
                    ${topic}
                  </h2>
                  
                  ${description ? `
                  <p style="margin: 0 0 25px; color: #64748b; font-size: 15px; line-height: 1.6;">
                    ${description}
                  </p>
                  ` : ''}
                  
                  <!-- Trial Details Card -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; margin-bottom: 25px;">
                    <tr>
                      <td style="padding: 20px;">
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: #64748b; font-size: 13px;">📅 Date</span><br>
                              <strong style="color: #1e293b; font-size: 15px;">${formattedDate}</strong>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: #64748b; font-size: 13px;">🕐 Time</span><br>
                              <strong style="color: #1e293b; font-size: 15px;">${scheduledTime}</strong>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: #64748b; font-size: 13px;">👤 Your Role</span><br>
                              <strong style="color: #1e293b; font-size: 15px;">${role || 'To be assigned'}</strong>
                            </td>
                          </tr>
                          ${ownerName ? `
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: #64748b; font-size: 13px;">📋 Organized by</span><br>
                              <strong style="color: #1e293b; font-size: 15px;">${ownerName}</strong>
                            </td>
                          </tr>
                          ` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>
                  
                  ${agenda ? `
                  <!-- Agenda Section -->
                  <div style="margin-bottom: 25px;">
                    <h3 style="margin: 0 0 10px; color: #1a365d; font-size: 16px;">📋 Trial Agenda</h3>
                    <div style="color: #64748b; font-size: 14px; line-height: 1.8; white-space: pre-line;">
                      ${agenda}
                    </div>
                  </div>
                  ` : ''}
                  
                  <!-- CTA Button -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${joinLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                          Accept Invitation & Join
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 20px 0 0; color: #94a3b8; font-size: 13px; text-align: center;">
                    Or copy this link: <a href="${joinLink}" style="color: #3b82f6;">${joinLink}</a>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                    This invitation was sent by LAWNOVA Mock Trial Platform.<br>
                    If you did not expect this email, you can safely ignore it.
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
LAWNOVA Mock Trial Invitation

You've been invited to participate in a mock trial session.

TRIAL DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Topic: ${topic}
${description ? `Description: ${description}` : ''}
Date: ${formattedDate}
Time: ${scheduledTime}
Your Role: ${role || 'To be assigned'}
${ownerName ? `Organized by: ${ownerName}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${agenda ? `AGENDA:\n${agenda}\n` : ''}

Join the session: ${joinLink}

---
This invitation was sent by LAWNOVA Mock Trial Platform.
If you did not expect this email, you can safely ignore it.
    `;

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'LAWNOVA Mock Trial <noreply@lawnova.com>',
        to: toEmail,
        subject: `📋 Mock Trial Invitation: ${topic}`,
        text: textContent,
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Trial invitation sent to ${toEmail}`, { messageId: info.messageId });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send invitation to ${toEmail}:`, error);
      throw error;
    }
  }

  /**
   * Send room status update notification
   * @param {string} toEmail - Recipient email
   * @param {Object} roomDetails - Room information
   * @param {string} newStatus - New room status
   */
  async sendStatusUpdate(toEmail, roomDetails, newStatus) {
    if (!this.initialized || !this.transporter) {
      logger.warn(`Status update email not sent to ${toEmail} - Email service not initialized`);
      return { success: false, message: 'Email service not initialized' };
    }

    const { topic, roomCode } = roomDetails;
    const statusMessages = {
      'Live': '🔴 The mock trial session is now LIVE! Join now to participate.',
      'Completed': '✅ The mock trial session has been completed. Thank you for participating!'
    };

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'LAWNOVA Mock Trial <noreply@lawnova.com>',
        to: toEmail,
        subject: `Mock Trial Update: ${topic} is now ${newStatus}`,
        text: `${statusMessages[newStatus] || `The trial status has been updated to ${newStatus}.`}\n\nRoom Code: ${roomCode}`,
        html: `
          <div style="font-family: 'Segoe UI', sans-serif; padding: 20px;">
            <h2 style="color: #1a365d;">Mock Trial Status Update</h2>
            <p style="font-size: 16px; color: #333;">${statusMessages[newStatus] || `The trial status has been updated to ${newStatus}.`}</p>
            <p><strong>Topic:</strong> ${topic}</p>
            <p><strong>Room Code:</strong> ${roomCode}</p>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Status update sent to ${toEmail}`, { messageId: info.messageId });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send status update to ${toEmail}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
const emailService = new EmailService();
export default emailService;
