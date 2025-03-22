// twilioService.js
const twilio = require('twilio');

// Make sure these values are loaded from your .env file
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Check if they exist
if (!accountSid || !authToken) {
  console.error('Missing Twilio credentials. Check your .env file.');
}

const client = twilio(accountSid, authToken);

async function makeCall(phoneNumber) {
  try {
    // Check for required values
    if (!process.env.TWILIO_PHONE_NUMBER) {
      throw new Error('Twilio phone number missing in .env file');
    }
    
    // Make the call using the example from documentation
    const call = await client.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio number
      to: phoneNumber, // The number to call
      url: `${process.env.SERVER_URL}/twilio/voice-response` // Your TwiML webhook URL
    });
    
    console.log(`Call SID: ${call.sid}, Status: ${call.status}`);
    return call;
  } catch (error) {
    console.error('Error making call:', error);
    throw error;
  }
}

module.exports = {
  makeCall
};