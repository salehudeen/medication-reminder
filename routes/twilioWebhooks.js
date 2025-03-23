// routes/twilioWebhooks.js
const express = require('express');
const router = express.Router();
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const { createClient } = require('@deepgram/sdk');
const { pipeline } = require('stream/promises');

// Create Deepgram client using the v3 approach
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Temporary directory for audio files
const tmpDir = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir);
}

// Function to generate TTS using Deepgram SDK v3
async function generateSpeech(text) {
  try {
    const fileName = `tts-${Date.now()}.mp3`;
    const filePath = path.join(tmpDir, fileName);
    
    // Use the SDK-based approach for TTS
    const response = await deepgram.speak.request(
      { text },
      {
        model: 'aura-asteria-en', // You can use different voices like nova, aura, stella, etc.
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

router.post('/voice-response', async (req, res) => {
    try {
        const twiml = new VoiceResponse();

        // Try to use Deepgram TTS
        try {
            const reminderText = 'Hello, this is a reminder from your healthcare provider to confirm your medications for the day. Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.';
            const speech = await generateSpeech(reminderText);
            const audioUrl = `${process.env.SERVER_URL}/audio/${speech.fileName}`;
            
            twiml.play(audioUrl);
            
            // Delete the file after a delay
            setTimeout(() => {
                unlinkAsync(speech.filePath).catch(err => console.error('Error deleting temp file:', err));
            }, 60000); // 60 seconds
        } catch (error) {
            console.error('Error using Deepgram TTS:', error);
            // Fallback to Twilio's TTS
            twiml.say({
                voice: 'alice'
            }, 'Hello, this is a reminder from your healthcare provider to confirm your medications for the day. Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.');
        }

        twiml.record({
            action: '/twilio/handle-response',
            transcribe: false,  // Disable Twilio's transcription as we'll use Deepgram
            maxLength: 30,
            trim: "trim-silence",
            playBeep: true
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