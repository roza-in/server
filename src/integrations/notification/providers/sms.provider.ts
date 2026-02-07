import axios from "axios";
import { env } from "../../../config/env.js";
import { logger } from "../../../config/logger.js";

/**
 * SMS Provider using Exotel API
 * https://developer.exotel.com/api/sms-api
 */
class SMSProvider {
  private log = logger.child("SMSProvider");

  /**
   * Send SMS via Exotel
   * @param phone - Phone number (10 digits or with country code)
   * @param message - SMS message content
   */
  async send(phone: string, message: string): Promise<void> {
    // Check for Exotel configuration
    if (!env.EXOTEL_SID || !env.EXOTEL_API_KEY || !env.EXOTEL_API_TOKEN) {
      this.log.warn("SMS skipped (Exotel not configured)", { phone });
      throw new Error("SMS_NOT_CONFIGURED");
    }

    // Format phone number - ensure it has country code for Exotel
    let destination = phone.replace(/[^\d]/g, "");

    // Handle 10-digit Indian numbers
    if (destination.length === 10) {
      destination = `+91${destination}`;
    } else if (destination.length === 11 && destination.startsWith("0")) {
      destination = `+91${destination.substring(1)}`;
    } else if (destination.length === 12 && destination.startsWith("91")) {
      destination = `+${destination}`;
    } else if (!destination.startsWith("+")) {
      destination = `+${destination}`;
    }

    const subdomain = env.EXOTEL_SUBDOMAIN || "api.exotel.com";
    const url = `https://${subdomain}/v1/Accounts/${env.EXOTEL_SID}/Sms/send`;

    try {
      // Create form data for Exotel
      const formData = new URLSearchParams();
      formData.append("From", env.EXOTEL_SENDER_ID || "ROZX");
      formData.append("To", destination);
      formData.append("Body", message);

      const response = await axios.post(url, formData, {
        auth: {
          username: env.EXOTEL_API_KEY!,
          password: env.EXOTEL_API_TOKEN!,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 15000, // 15 seconds
      });

      this.log.info("SMS sent via Exotel", {
        phone: destination,
        sid: response.data?.SMSMessage?.Sid,
        status: response.data?.SMSMessage?.Status,
      });
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.RestException?.Message ||
        error?.response?.data?.message ||
        error?.message;

      this.log.error("SMS delivery via Exotel failed", {
        phone: destination,
        error: errorMessage,
        status: error?.response?.status,
      });

      throw new Error(`SMS_SEND_FAILED: ${errorMessage}`);
    }
  }
}

export const smsProvider = new SMSProvider();