// index.js
require('dotenv').config();
const express = require('express');
const { twiml } = require('twilio');
const callRoutes = require('./routes/callRoutes');
// const incomingCallRoutes = require('./routes/incomingCallRoutes');
const twilioService = require('./services/twilioService');
const callLogModel = require('./models/callLogModel');
const { createClient } = require('@deepgram/sdk');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const { pipeline } = require('stream/promises');
const axios = require('axios');

// Create Deepgram client using the v3 approach
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create directory for temporarily storing audio files
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir);
}

// Use callRoutes for API endpoints
app.use('/api', callRoutes);
// app.use('/api', incomingCallRoutes);

// Function to generate TTS using Deepgram SDK v3
async function generateSpeech(text) {
  try {
    const fileName = `tts-${Date.now()}.mp3`;
    const filePath = path.join(tmpDir, fileName);
    
    // Use the SDK-based approach for TTS
    const response = await deepgram.speak.request(
      { text },
      {
        model: 'aura-asteria-en', 
      }
    );
    
    const stream = await response.getStream();
    if (!stream) {
      throw new Error('Failed to get audio stream from Deepgram');
    }
    
    const file = fs.createWriteStream(filePath);
    await pipeline(stream, file);
    
    return {
      filePath,
      fileName
    };
  } catch (error) {
    console.error('Error generating speech with Deepgram:', error);
    throw error;
  }
}

// Twilio webhook endpoint for voice response using Deepgram TTS
app.post('/twilio/voice-response', async (req, res) => {
  const VoiceResponse = twiml.VoiceResponse;
  const response = new VoiceResponse();
  
  try {
    // Generate speech using Deepgram
    const reminderText = 'Hello, this is a reminder from your healthcare provider to confirm your medications for the day. Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.';
    const speech = await generateSpeech(reminderText);
    
    // Get public URL to the audio file (this would need to be properly implemented)
    // For now, we're assuming the server has a public URL
    const audioUrl = `${process.env.SERVER_URL}/audio/${speech.fileName}`;
    
    // Play the generated audio
    response.play(audioUrl);
    
    // Delete the file after a delay (assuming the audio will be played by then)
    setTimeout(() => {
      unlinkAsync(speech.filePath).catch(err => console.error('Error deleting temp file:', err));
    }, 60000); // 60 seconds
  } catch (error) {
    console.error('Error with TTS:', error);
    // Fallback to Twilio's built-in TTS
    response.say({
      voice: 'alice'
    }, 'Hello, this is a reminder from your healthcare provider to confirm your medications for the day. Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.');
  }
  
  response.record({
    action: '/twilio/handle-response',
    transcribe: false, // Disable Twilio's transcription since we'll use Deepgram
    maxLength: 30,
    trim: "trim-silence",
    playBeep: true
  });
  
  res.type('text/xml');
  res.send(response.toString());
});

// Serve audio files
app.get('/audio/:fileName', (req, res) => {
  const filePath = path.join(tmpDir, req.params.fileName);
  res.sendFile(filePath);
});

// Handle the recording with Deepgram STT
app.post('/twilio/handle-response', async (req, res) => {
  const recordingUrl = req.body.RecordingUrl;
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus || 'unknown';
  
  console.log(`Call SID: ${callSid}, Status: ${callStatus}, Recording URL: ${recordingUrl}`);
  
  // Store initial call log without transcription
  callLogModel.addCallLog({
    callSid,
    status: callStatus,
    recordingUrl,
    type: 'response'
  });

  // Start the process of transcribing with Deepgram in the background
  if (recordingUrl) {
    transcribeWithDeepgram(recordingUrl, callSid);
  }

  const VoiceResponse = twiml.VoiceResponse;
  const response = new VoiceResponse();
  
  try {
    // Generate TTS for goodbye message
    const goodbyeText = 'Thank you for your response. Goodbye.';
    const speech = await generateSpeech(goodbyeText);
    const audioUrl = `${process.env.SERVER_URL}/audio/${speech.fileName}`;
    
    response.play(audioUrl);
    
    // Delete the file after a delay
    setTimeout(() => {
      unlinkAsync(speech.filePath).catch(err => console.error('Error deleting temp file:', err));
    }, 60000); // 60 seconds
  } catch (error) {
    console.error('Error with TTS:', error);
    // Fallback to Twilio's TTS
    response.say('Thank you for your response. Goodbye.');
  }
  
  response.hangup();
  
  res.type('text/xml');
  res.send(response.toString());
});

// Function to transcribe audio with Deepgram using v3 SDK


// Handle call status updates (completed, no-answer, busy, failed)
app.post('/twilio/call-status', async (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const to = req.body.To;
  
  console.log(`Call SID: ${callSid}, Final Status: ${callStatus}`);
  
  // Handle unanswered calls
  if (['no-answer', 'busy', 'failed', 'canceled'].includes(callStatus)) {
    console.log(`Call to ${to} was not answered (${callStatus}). Attempting voicemail or SMS...`);
    
    try {
      // First try to leave a voicemail by calling again
      const vmCall = await twilioService.leaveVoicemail(to);
      console.log(`Call SID: ${vmCall.sid}, Status: voicemail-attempt, To: ${to}`);
    } catch (vmError) {
      console.error('Error leaving voicemail:', vmError);
      
      // If voicemail fails, send an SMS
      try {
        const message = await twilioService.sendSms(to);
        console.log(`SMS SID: ${message.sid}, Status: sms-sent, To: ${to}`);
      } catch (smsError) {
        console.error('Error sending SMS:', smsError);
      }
    }
  }
  
  res.sendStatus(200);
});

// Handle incoming calls from patients with Deepgram TTS
app.post('/twilio/incoming-call', async (req, res) => {
  const from = req.body.From;
  console.log(`Incoming call from patient: ${from}`);
  
  const VoiceResponse = twiml.VoiceResponse;
  const response = new VoiceResponse();
  
  try {
    // Generate speech using Deepgram
    const incomingText = 'Hello, this is your healthcare provider. We called earlier to remind you about your medications. Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.';
    const speech = await generateSpeech(incomingText);
    const audioUrl = `${process.env.SERVER_URL}/audio/${speech.fileName}`;
    
    response.play(audioUrl);
    
    // Delete the file after a delay
    setTimeout(() => {
      unlinkAsync(speech.filePath).catch(err => console.error('Error deleting temp file:', err));
    }, 60000); // 60 seconds
  } catch (error) {
    console.error('Error with TTS:', error);
    // Fallback to Twilio's TTS
    response.say({
      voice: 'alice'
    }, 'Hello, this is your Deen your healthcare provider. We called earlier to remind you about your medications. Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.');
  }
  
  response.record({
    action: '/twilio/handle-response',
    transcribe: false, // Using Deepgram instead
    maxLength: 30,
    trim: "trim-silence",
    playBeep: true
  });
  
  res.type('text/xml');
  res.send(response.toString());
});

// Endpoint for voicemail response with Deepgram TTS
app.post('/twilio/voicemail', async (req, res) => {
  const VoiceResponse = twiml.VoiceResponse;
  const response = new VoiceResponse();
  
  try {
    // Generate speech using Deepgram
    const voicemailText = "We called to check on your medication but couldn't reach you. Please call us back or take your medications if you haven't done so.";
    const speech = await generateSpeech(voicemailText);
    const audioUrl = `${process.env.SERVER_URL}/audio/${speech.fileName}`;
    
    response.play(audioUrl);
    
    // Delete the file after a delay
    setTimeout(() => {
      unlinkAsync(speech.filePath).catch(err => console.error('Error deleting temp file:', err));
    }, 60000); // 60 seconds
  } catch (error) {
    console.error('Error with TTS:', error);
    // Fallback to Twilio's TTS
    response.say({
      voice: 'alice'
    }, "We called to check on your medication but couldn't reach you. Please call us back or take your medications if you haven't done so.");
  }
  
  res.type('text/xml');
  res.send(response.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});