import axios from "axios";
import { env } from "../../config/env.js";
import { logger } from "../../common/logger.js";

class SMSService {
  private log = logger.child("SMSService");
  private baseURL = "https://api.msg91.com/api/v5/flow";

  async send(phone: string, message: string): Promise<void> {
    // Normalize phone to Indian format (remove spaces, +91, etc)
    let mobile = String(phone).replace(/[^\d]/g, "");
    
    // If starts with 91, use as-is; else prepend 91
    if (!mobile.startsWith("91")) {
      mobile = "91" + mobile;
    }

    try {
      const payload: any = {
        authkey: env.MSG91_AUTH_KEY,
        mobiles: mobile,
        sender: env.MSG91_SENDER_ID,
        route: env.MSG91_ROUTE,
        country: "91",
        message: message,
      };

      // Add DLT template ID if configured (required for Indian regulations)
      if (env.MSG91_DLT_TEMPLATE_ID) {
        payload.DLT_TE_ID = env.MSG91_DLT_TEMPLATE_ID;
      }

      const response = await axios.post(this.baseURL, payload, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10_000,
      });

      this.log.info("MSG91 SMS sent successfully", {
        mobile,
        messageId: response.data?.request_id,
      });
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      this.log.error("MSG91 SMS delivery failed", { mobile, status, error: data });
      throw new Error("SMS_DELIVERY_FAILED");
    }
  }
}

export const smsService = new SMSService();
