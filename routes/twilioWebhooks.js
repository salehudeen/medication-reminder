const express = require('express');
const router = express.Router();
const VoiceResponse = require('twilio').twiml.VoiceResponse;

router.post('/voice-response', (req, res) => {
    try {
        const twiml = new VoiceResponse();

        // Implement the medication reminder message
        twiml.say({
            voice: 'alice'
        }, 'Hello, this is a reminder from your healthcare provider to confirm your medications for the day. Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.');

       
        twiml.record({
          action: '/twilio/handle-response',
          transcribe: true,
          transcribeCallback: '/twilio/handle-transcription',
          maxLength: 30
      });

        // Send response
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

module.exports = router;
