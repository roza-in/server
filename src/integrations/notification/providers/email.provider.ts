import sgMail from "@sendgrid/mail";
import { env } from "../../../config/env.js";
import { logger } from "../../../config/logger.js";

/**
 * Email Provider using SendGrid
 * https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */
class EmailProvider {
  private log = logger.child("EmailProvider");
  private initialized = false;

  constructor() {
    if (env.SENDGRID_API_KEY) {
      sgMail.setApiKey(env.SENDGRID_API_KEY);
      this.initialized = true;
      this.log.info("EmailProvider initialized with SendGrid");
    } else {
      this.log.warn("EmailProvider not initialized (SENDGRID_API_KEY missing)");
    }
  }

  /**
   * Send an email via SendGrid
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
    if (!this.initialized || !env.SENDGRID_API_KEY || !env.SENDGRID_EMAIL_FROM) {
      this.log.warn("Email skipped (SendGrid not configured)", { to, subject });
      throw new Error("EMAIL_NOT_CONFIGURED");
    }

    try {
      const msg = {
        to,
        from: {
          email: env.SENDGRID_EMAIL_FROM,
          name: "ROZX Healthcare",
        },
        subject,
        ...(isHtml ? { html: body } : { text: body }),
      };

      await sgMail.send(msg);

      this.log.info("Email sent via SendGrid", { to, subject });
    } catch (error: any) {
      const errorMessage =
        error?.response?.body?.errors?.[0]?.message ||
        error?.message ||
        "Unknown error";

      this.log.error("Email delivery via SendGrid failed", {
        to,
        subject,
        error: errorMessage,
        status: error?.code,
      });

      throw new Error(`EMAIL_SEND_FAILED: ${errorMessage}`);
    }
  }
}

export const emailProvider = new EmailProvider();
