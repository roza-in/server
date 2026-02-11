import nodemailer from "nodemailer";
import { env } from "../../../config/env.js";
import { logger } from "../../../config/logger.js";

/**
 * Email Provider using Nodemailer
 */
class EmailProvider {
  private log = logger.child("EmailProvider");
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_PORT === 465, // true for 465, false for other ports
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
      this.log.info("EmailProvider initialized with Nodemailer");
    } else {
      this.log.warn("EmailProvider not initialized (SMTP credentials missing)");
    }
  }

  /**
   * Send an email via Nodemailer
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param body - Email body (plain text or HTML)
   * @param isHtml - If true, body is treated as HTML
   */
  async send(
    to: string,
    subject: string,
    body: string,
    isHtml = false
  ): Promise<void> {
    if (!this.transporter || !env.SMTP_FROM_EMAIL) {
      this.log.warn("Email skipped (SMTP not configured)", { to, subject });
      throw new Error("EMAIL_NOT_CONFIGURED");
    }

    try {
      const mailOptions = {
        from: `"${env.SMTP_FROM_NAME || 'ROZX Healthcare'}" <${env.SMTP_FROM_EMAIL}>`,
        to,
        subject,
        [isHtml ? 'html' : 'text']: body,
      };

      const info = await this.transporter.sendMail(mailOptions);

      this.log.info("Email sent via Nodemailer", { to, subject, messageId: info.messageId });
    } catch (error: any) {
      this.log.error("Email delivery via Nodemailer failed", {
        to,
        subject,
        error: error.message,
      });

      throw new Error(`EMAIL_SEND_FAILED: ${error.message}`);
    }
  }
}

export const emailProvider = new EmailProvider();
