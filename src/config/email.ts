import { env } from './env.js';

export const emailConfig = {
    sendgrid: {
        apiKey: env.SENDGRID_API_KEY,
        fromEmail: env.SENDGRID_EMAIL_FROM,
    }
};
