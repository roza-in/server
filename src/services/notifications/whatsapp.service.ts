import axios from "axios";
import { env } from "../../config/env.js";
import { logger } from "../../common/logger.js";

type WhatsAppTemplateParam = {
  type: "text";
  text: string;
};

class WhatsAppService {
  private log = logger.child("WhatsAppService");

  /**
   * Send WhatsApp template message via Meta Cloud API
   */
  async sendTemplate(
    phone: string,
    templateName: string,
    variables: string[]
  ): Promise<void> {
    // Normalize phone to E.164 digits only for WhatsApp API (no spaces/plus)
    const to = String(phone).replace(/[^\d]/g, "");
    const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const languageCode = env.WHATSAPP_LANGUAGE_CODE || "en_US";

    try {
      const params: WhatsAppTemplateParam[] = variables.map((value) => ({
        type: "text",
        text: value,
      }));

      this.log.debug("Sending WhatsApp template", {
        phone: to,
        templateName,
        paramsCount: params.length,
        languageCode,
      });

      await axios.post(
        url,
        {
          messaging_product: "whatsapp",
          to: to,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            components: params.length
              ? [
                  {
                    type: "body",
                    parameters: params,
                  },
                ]
              : [],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          timeout: 10_000,
        }
      );

      this.log.info("WhatsApp message sent successfully", {
        phone: to,
        templateName,
      });
    } catch (error: any) {
      const metaError =
        error?.response?.data?.error || error?.response?.data || error?.message;

      this.log.error("WhatsApp delivery failed", {
        phone: to,
        templateName,
        languageCode,
        metaError,
      });

      throw new Error("WHATSAPP_DELIVERY_FAILED");
    }
  }
}

export const whatsappService = new WhatsAppService();
