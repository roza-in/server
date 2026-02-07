import axios from "axios";
import { env } from "../../../config/env.js";
import { logger } from "../../../config/logger.js";

/**
 * WhatsApp Provider using Interakt API
 * https://www.interakt.shop/product/api-integration
 */
class WhatsAppProvider {
  private log = logger.child("WhatsAppProvider");
  private readonly API_URL = "https://api.interakt.ai/v1/public/message/";

  /**
   * Send a WhatsApp template message via Interakt
   * @param phone - Phone number (10 digits or with country code)
   * @param templateName - Interakt template name (e.g., "rozx_appointment_confirmation")
   * @param variables - Array of variable values to substitute in template
   */
  async sendTemplate(
    phone: string,
    templateName: string,
    variables: string[]
  ): Promise<void> {
    // Check for Interakt configuration
    if (!env.INTERAKT_API_KEY) {
      this.log.warn("WhatsApp skipped (Interakt not configured)", { phone, templateName });
      return;
    }

    // Format phone number
    // 1. Remove all non-digits
    let phoneNumber = phone.replace(/[^\d]/g, "");

    // 2. Handle 10-digit numbers (Indian standard)
    let countryCode = "+91";

    if (phoneNumber.length === 10) {
      // Keep as-is, use default country code
    } else if (phoneNumber.length === 11 && phoneNumber.startsWith("0")) {
      // Remove leading 0
      phoneNumber = phoneNumber.substring(1);
    } else if (phoneNumber.length === 12 && phoneNumber.startsWith("91")) {
      // Already has country code
      phoneNumber = phoneNumber.substring(2);
    } else if (phoneNumber.length > 10) {
      // Assume country code is prefix, extract last 10 digits
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
          bodyValues: variables,
        },
      };

      const response = await axios.post(this.API_URL, payload, {
        headers: {
          Authorization: `Basic ${env.INTERAKT_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000, // 15 seconds
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

      this.log.error("WhatsApp delivery via Interakt failed", {
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
