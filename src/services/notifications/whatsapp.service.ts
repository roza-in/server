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
    const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    try {
      const params: WhatsAppTemplateParam[] = variables.map((value) => ({
        type: "text",
        text: value,
      }));

      this.log.debug("Sending WhatsApp template", {
        phone,
        templateName,
        paramsCount: params.length,
      });

      await axios.post(
        url,
        {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en" },
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
        phone,
        templateName,
      });
    } catch (error: any) {
      const metaError =
        error?.response?.data?.error || error?.response?.data || error?.message;

      this.log.error("WhatsApp delivery failed", {
        phone,
        templateName,
        metaError,
      });

      throw new Error("WHATSAPP_DELIVERY_FAILED");
    }
  }
}

export const whatsappService = new WhatsAppService();
