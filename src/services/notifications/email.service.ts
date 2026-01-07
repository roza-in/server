import sgMail from "@sendgrid/mail";
import { env } from "../../config/env.js";
import { logger } from "../../common/logger.js";

sgMail.setApiKey(env.SENDGRID_API_KEY);

class EmailService {
  private log = logger.child("EmailService");

  async send(email: string, subject: string, body: string): Promise<void> {
    await sgMail.send({
      to: email,
      from: env.SENDGRID_EMAIL_FROM,
      subject,
      text: body,
    });

    this.log.info(`Email sent to ${email}`);
  }
}

export const emailService = new EmailService();
