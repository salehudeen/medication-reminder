// services/twilioService.js
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
      url: `${process.env.SERVER_URL}/twilio/voice-response`, // Your TwiML webhook URL
      statusCallback: `${process.env.SERVER_URL}/twilio/call-status`, // Status callback URL
      statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'], // Events to trigger callback
      statusCallbackMethod: 'POST'
    });
    
    console.log(`Call SID: ${call.sid}, Status: ${call.status}`);
    return call;
  } catch (error) {
    console.error('Error making call:', error);
    throw error;
  }
}

async function leaveVoicemail(phoneNumber) {
  try {
    // Make another call but this time with the voicemail message
    const call = await client.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
      url: `${process.env.SERVER_URL}/twilio/voicemail`, // Voicemail TwiML
      statusCallback: `${process.env.SERVER_URL}/twilio/call-status`,
      statusCallbackEvent: ['completed'],
      statusCallbackMethod: 'POST',
      timeout: 15 // Short timeout to increase chance of going to voicemail
    });
    
    return call;
  } catch (error) {
    console.error('Error leaving voicemail:', error);
    throw error;
  }
}

async function sendSms(phoneNumber) {
  try {
    // Send SMS as fallback
    const message = await client.messages.create({
      body: "We called to check on your medication but couldn't reach you. Please call us back or take your medications if you haven't done so.",
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    
    return message;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
}

async function getCallDetails(callSid) {
  try {
    const call = await client.calls(callSid).fetch();
    return call;
  } catch (error) {
    console.error(`Error getting call details for ${callSid}:`, error);
    throw error;
  }
}

async function getRecordingUrl(callSid) {
  try {
    const recordings = await client.recordings.list({callSid: callSid});
    if (recordings.length > 0) {
      return recordings[0].uri;
    }
    return null;
  } catch (error) {
    console.error(`Error getting recording URL for ${callSid}:`, error);
    throw error;
  }
}

module.exports = {
  makeCall,
  leaveVoicemail,
  sendSms,
  getCallDetails,
  getRecordingUrl
};