// index.js
require('dotenv').config();
const express = require('express');
const { twiml } = require('twilio');
const callRoutes = require('./routes/callRoutes');
const incomingCallRoutes = require('./routes/incomingCallRoutes');
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
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
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
app.use('/api', incomingCallRoutes);

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

  callLogModel.addCallLog({
      callSid,
      status: callStatus,
      recordingUrl,
      type: 'response'
  });

  let ttsFileToDelete = null;

  if (recordingUrl) {
      ttsFileToDelete = await transcribeWithDeepgram(recordingUrl, callSid); // Get the TTS file to delete
  }

  const VoiceResponse = twiml.VoiceResponse;
  const response = new VoiceResponse();

  try {
      const goodbyeText = 'Thank you for your response. Goodbye.';
      const speech = await generateSpeech(goodbyeText);
      const audioUrl = `${process.env.SERVER_URL}/audio/${speech.fileName}`;

      response.play(audioUrl);

      // Delete the TTS file after transcription is complete
      if (ttsFileToDelete) {
          await unlinkAsync(ttsFileToDelete).catch(err => console.error('Error deleting temp file:', err));
      }

  } catch (error) {
      console.error('Error with TTS:', error);
      response.say('Thank you for your response. Goodbye.');
  }

  response.hangup();

  res.type('text/xml');
  res.send(response.toString());
});

async function transcribeWithDeepgram(recordingUrl, callSid) {
  try {
      console.log(`Processing recording for ${callSid} from URL: ${recordingUrl}`);

      const tmpFilePath = path.join(tmpDir, `recording-${callSid}.mp3`);

      const recordingSidMatch = recordingUrl.match(/RE[a-f0-9]{32}/);
      const recordingSid = recordingSidMatch ? recordingSidMatch[0] : recordingUrl.split('/').pop();

      console.log(`Extracted recording SID: ${recordingSid}`);

      console.log('Waiting for recording to be fully available...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
          console.log('Attempting to fetch recording using Twilio SDK...');
          const recording = await client.recordings(recordingSid).fetch();

          const mediaUrl = recording.mediaUrl || `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.mp3`;
          console.log(`Fetching from media URL: ${mediaUrl}`);

          const authOptions = {
              auth: {
                  username: process.env.TWILIO_ACCOUNT_SID,
                  password: process.env.TWILIO_AUTH_TOKEN
              },
              responseType: 'arraybuffer'
          };

          const audioResponse = await axios.get(mediaUrl, authOptions);
          
          // Write file using a stream to ensure complete write
          const fileStream = fs.createWriteStream(tmpFilePath);
          fileStream.write(Buffer.from(audioResponse.data));
          fileStream.end();
          
          // Wait for the stream to finish
          await new Promise((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
          });
          
          console.log(`Recording downloaded to ${tmpFilePath}`);
      } catch (twilioSdkError) {
          console.error('Error fetching with Twilio SDK:', twilioSdkError.message);

          console.log('Falling back to direct HTTP request...');

          const potentialUrls = [
              `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.mp3`,
              `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.wav`,
              `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}`
          ];

          let downloadSuccess = false;

          for (const url of potentialUrls) {
              try {
                  console.log(`Trying URL: ${url}`);

                  const authOptions = {
                      auth: {
                          username: process.env.TWILIO_ACCOUNT_SID,
                          password: process.env.TWILIO_AUTH_TOKEN
                      },
                      responseType: 'arraybuffer'
                  };

                  const audioResponse = await axios.get(url, authOptions);

                  const isXml = audioResponse.headers['content-type']?.includes('xml');
                  if (isXml) {
                      console.log('Received XML instead of audio data, continuing to next URL...');
                      continue;
                  }

                  let fileExt = '.mp3';
                  if (audioResponse.headers['content-type']?.includes('wav')) {
                      fileExt = '.wav';
                  }

                  tmpFilePath = path.join(tmpDir, `recording-${callSid}${fileExt}`);

                  // Use stream here too for consistent approach
                  const fileStream = fs.createWriteStream(tmpFilePath);
                  fileStream.write(Buffer.from(audioResponse.data));
                  fileStream.end();
                  
                  // Wait for the stream to finish
                  await new Promise((resolve, reject) => {
                    fileStream.on('finish', resolve);
                    fileStream.on('error', reject);
                  });
                  
                  console.log(`Recording downloaded to ${tmpFilePath}`);
                  downloadSuccess = true;
                  break;
              } catch (downloadError) {
                  console.error(`Error downloading from ${url}:`, downloadError.message);
              }
          }

          if (!downloadSuccess) {
              throw new Error('Failed to download recording from all potential URLs');
          }
      }

      if (!fs.existsSync(tmpFilePath) || fs.statSync(tmpFilePath).size === 0) {
          throw new Error('Downloaded file is empty or does not exist');
      }

      // Validate file size and header
      const fileStats = fs.statSync(tmpFilePath);
      console.log(`File size: ${fileStats.size} bytes`);
      
      // Deepgram transcription AFTER file download - match the exact approach that works in your test script
      console.log('file path to the recorded user response', tmpFilePath);
      
      // Use direct reading of the file, matching your test script
      const audioBuffer = fs.readFileSync(tmpFilePath);
      console.log(`Sending file to Deepgram for transcription (file size: ${audioBuffer.length} bytes)...`);
      
      // Create a debug copy for later analysis
      const debugFilePath = path.join(tmpDir, `debug-recording-${callSid}.mp3`);
      fs.copyFileSync(tmpFilePath, debugFilePath);
      console.log(`Saved debug copy to ${debugFilePath} for investigation`);
      
      try {
          // Match exactly what worked in your test script
          const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
              audioBuffer,
              {
                  model: 'nova-3',
                  language: 'en',
                  smart_format: true,
                  diarize: true
              }
          );

          if (error) {
              console.error(`Error transcribing with Deepgram for ${callSid}:`, JSON.stringify(error, null, 2));
              return;
          }

          const transcriptionText = result.results?.channels[0]?.alternatives[0]?.transcript || '';
          console.log(`Deepgram Transcription for ${callSid}: "${transcriptionText}"`);

          const medications = ['aspirin', 'cardivol', 'metformin'];
          const medicationStatus = {};

          // Improved medication parsing logic
          for (const med of medications) {
              // Create pattern for different ways of saying medications are taken
              const positivePatterns = [
                  // Direct statements about the medication
                  `(have|took|taken|taking)\\s+.*?\\b${med}\\b`,
                  `\\b${med}\\b.*?(have|took|taken|taking)`,
                  `yes.*?\\b${med}\\b`,
                  `\\b${med}\\b.*?yes`,
                  // General confirmation that might include the medication
                  `taken (my|the|all).*?\\b${med}\\b`,
                  `\\b${med}\\b.*?taken`
              ];
              
              // Create pattern for different ways of saying medications are not taken
              const negativePatterns = [
                  `(have not|haven't|didn't|did not|not)\\s+.*?\\b${med}\\b`,
                  `\\b${med}\\b.*?(have not|haven't|didn't|did not|not taken|not had)`,
                  `no.*?\\b${med}\\b`,
                  `\\b${med}\\b.*?no`
              ];
              
              // Check for negative patterns first (they're more specific)
              let isNegative = false;
              for (const pattern of negativePatterns) {
                  const negRegex = new RegExp(pattern, 'i');
                  if (negRegex.test(transcriptionText)) {
                      medicationStatus[med] = 'not taken';
                      isNegative = true;
                      break;
                  }
              }
              
              // If not negative, check for positive patterns
              if (!isNegative) {
                  let isPositive = false;
                  for (const pattern of positivePatterns) {
                      const posRegex = new RegExp(pattern, 'i');
                      if (posRegex.test(transcriptionText)) {
                          medicationStatus[med] = 'taken';
                          isPositive = true;
                          break;
                      }
                  }
                  
                  // If neither positive nor negative, mark as unknown
                  if (!isPositive) {
                      medicationStatus[med] = 'unknown';
                  }
              }
          }

          // Log the results of medication parsing
          console.log('Medication status detected:', medicationStatus);

          callLogModel.updateCallLog(callSid, {
              patientResponse: transcriptionText,
              transcriptionSource: 'deepgram',
              medicationStatus: medicationStatus,
              processingComplete: true,
              processedAt: new Date()
          });

      } catch (dgError) {
          console.error(`Detailed Deepgram error for ${callSid}:`, JSON.stringify(dgError, null, 2));
          throw dgError;
      }

      await unlinkAsync(tmpFilePath);
      console.log(`Temporary recording file deleted: ${tmpFilePath}`);
      return debugFilePath; // Return the debug file path to delete later if needed

  } catch (error) {
      console.error(`Error in transcribeWithDeepgram for ${callSid}:`, error);

      callLogModel.updateCallLog(callSid, {
          transcriptionError: error.message,
          processingComplete: true,
          processedAt: new Date()
      });

      return null;
  }
}
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