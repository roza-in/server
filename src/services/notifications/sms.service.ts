import twilio from "twilio";
import { env } from "../../config/env.js";
import { logger } from "../../common/logger.js";

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

class SMSService {
  private log = logger.child("SMSService");

  async send(phone: string, message: string): Promise<void> {
    await client.messages.create({
      to: phone,
      from: env.TWILIO_PHONE_NUMBER,
      body: message,
    });

    this.log.info(`SMS sent to ${phone}`);
  }
}

export const smsService = new SMSService();
