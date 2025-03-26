require('dotenv').config();

// Mock environment variables
process.env.TWILIO_ACCOUNT_SID = 'ACtest_account_sid';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
process.env.TWILIO_PHONE_NUMBER = '+1234567890';
process.env.DEEPGRAM_API_KEY = 'test_deepgram_key';
process.env.SERVER_URL = 'http://test.com';