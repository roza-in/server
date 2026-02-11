
import { whatsappService } from '../src/integrations/notification/providers/whatsapp.provider.js';
import { env } from '../src/config/env.js';

async function main() {
    console.log('--- WhatsApp Real Delivery Verification ---');

    // Check if API key is present (masked)
    const hasKey = !!env.INTERAKT_API_KEY;
    console.log(`Interakt API Key Configured: ${hasKey}`);

    if (!hasKey) {
        console.error('❌ Missing INTERAKT_API_KEY in environment variables');
        process.exit(1);
    }

    // User details from verified test case
    const phone = '919648904558';
    const templateName = 'rozx_appointment_confirmation'; // Known good template
    // [Patient Name, Doctor Name, Date, Type]
    const variables = ['Ram Ji Maurya', 'Dr. Mohit Mann', '15 Jan at 10:30 AM', 'online'];

    console.log(`Target: ${phone}`);
    console.log(`Template: ${templateName}`);
    console.log(`Variables: ${JSON.stringify(variables)}`);

    try {
        console.log('Sending...');
        await whatsappService.sendTemplate(phone, templateName, variables);
        console.log('✅ Message sent successfully!');
        console.log('Please check the WhatsApp number for delivery.');
    } catch (error: any) {
        console.error('❌ Failed to send message:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}

main();
