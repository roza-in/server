import { env } from './env.js';
import twilio from 'twilio';

const sid = env.TWILIO_ACCOUNT_SID;
const token = env.TWILIO_AUTH_TOKEN;

export const smsClient = sid && token ? twilio(sid, token) : null;
