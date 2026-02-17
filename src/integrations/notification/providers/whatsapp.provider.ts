import axios from "axios";
import { env } from "../../../config/env.js";
import { logger } from "../../../config/logger.js";

/**
 * WhatsApp Provider — Interakt API
 *
 * Sends approved template messages via https://api.interakt.ai
 * Templates must be pre-approved in the Interakt dashboard.
 *
 * Env: INTERAKT_API_KEY
 */
class WhatsAppProvider {
  private log = logger.child("WhatsAppProvider");
  private readonly API_URL = "https://api.interakt.ai/v1/public/message/";

  /**
   * Send a WhatsApp template message via Interakt.
   *
   * @param phone         Recipient phone (10-digit Indian or with country code)
   * @param templateName  Approved Interakt template name (e.g. "rozx_appointment_confirmation")
   * @param bodyValues    Positional variable values matching {{1}}, {{2}}, … in template body
   */
  async sendTemplate(
    phone: string,
    templateName: string,
    bodyValues: string[],
  ): Promise<void> {
    if (!env.INTERAKT_API_KEY) {
      this.log.warn("WhatsApp skipped — INTERAKT_API_KEY not configured", { phone, templateName });
      throw new Error("WHATSAPP_NOT_CONFIGURED");
    }

    // ── Format phone number (Indian default) ──────────────────────────────
    let phoneNumber = phone.replace(/[^\d]/g, "");
    let countryCode = "+91";

    if (phoneNumber.length === 10) {
      // Standard Indian 10-digit — keep as-is
    } else if (phoneNumber.length === 11 && phoneNumber.startsWith("0")) {
      phoneNumber = phoneNumber.substring(1);
    } else if (phoneNumber.length === 12 && phoneNumber.startsWith("91")) {
      phoneNumber = phoneNumber.substring(2);
    } else if (phoneNumber.length > 10) {
      countryCode = `+${phoneNumber.slice(0, -10)}`;
      phoneNumber = phoneNumber.slice(-10);
    }

    try {
      const payload = {
        countryCode,
        phoneNumber,
        callbackData: `rozx_${templateName}`,
        type: "Template",
        template: {
          name: templateName,
          languageCode: "en",
          bodyValues,
        },
      };

      const response = await axios.post(this.API_URL, payload, {
        headers: {
          Authorization: `Basic ${env.INTERAKT_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15_000,
      });

      this.log.info("WhatsApp sent via Interakt", {
        phone: phoneNumber,
        templateName,
        status: response.status,
        result: response.data?.result,
      });
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message;

      this.log.error("WhatsApp delivery failed", {
        phone: phoneNumber,
        templateName,
        error: errorMessage,
        status: error?.response?.status,
        data: error?.response?.data,
      });

      throw new Error(`WHATSAPP_DELIVERY_FAILED: ${errorMessage}`);
    }
  }
}

export const whatsappService = new WhatsAppProvider();
