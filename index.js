// index.js
require('dotenv').config();
const express = require('express');
const { twiml } = require('twilio');
const callRoutes = require('./routes/callRoutes');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use callRoutes for API endpoints
app.use('/api', callRoutes);
app.use('/twilio', require('./routes/twilioWebhooks.js'));

// Twilio webhook endpoint for voice response
app.post('x', (req, res) => {
  const VoiceResponse = twiml.VoiceResponse;
  const response = new VoiceResponse();
  
  response.say({
    voice: 'alice'
  }, 'Hello, this is a reminder from your healthcare provider to confirm your medications for the day. Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.');
  
  response.record({
    action: '/twilio/handle-response',
    transcribe: true,
    transcribeCallback: '/twilio/handle-transcription',
    maxLength: 30
  });
  
  res.type('text/xml');
  res.send(response.toString());
});

// Handle the recording
app.post('/twilio/handle-response', (req, res) => {
  const recordingUrl = req.body.RecordingUrl;
  const callSid = req.body.CallSid;
  
  console.log(`Call SID: ${callSid}, Recording URL: ${recordingUrl}`);
  
  const response = new twiml.VoiceResponse();
  response.say('Thank you for your response. Goodbye.');
  response.hangup();
  
  res.type('text/xml');
  res.send(response.toString());
});

// Handle the transcription
app.post('/twilio/handle-transcription', (req, res) => {
  console.log('Transcription webhook received:');
  console.log(JSON.stringify(req.body, null, 2));
  
  const transcriptionText = req.body.TranscriptionText;
  const callSid = req.body.CallSid;
  
  console.log(`Call SID: ${callSid}, Patient Response: "${transcriptionText}"`);
  
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});