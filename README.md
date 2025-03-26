# Medication Reminder System

A voice-driven medication reminder system built with Node.js and Twilio. The system calls patients to remind them about their medications, records their responses, and handles unanswered calls with voicemail or SMS fallbacks.

## Features

- Outgoing call API to trigger medication reminders to patients
- Text-to-Speech (TTS) for medication reminder messages
- Speech-to-Text (STT) for capturing patient responses
- Handling unanswered calls with voicemail attempts
- SMS fallback when voicemail is unavailable
- Incoming call handling for patient callbacks
- Call data logging to console
- Simple in-memory storage for call logs

## Prerequisites

- Node.js (v14+)
- npm or yarn
- Twilio account with:
  - Account SID
  - Auth Token
  - Twilio phone number
- ngrok for local testing
- Deepgram API key for TTS and STT

## Current Limitations

### Real-Time Streaming
- Currently, real-time TTS and STT streaming is not fully implemented
- Attempted to use Deepgram WebSocket for live transcription but couldn't complete within the project timeline
- Current implementation uses pre-recorded audio transcription

## Call Log Output Explanation

When a call is processed, you'll see detailed console logs that provide insights into the call's lifecycle:

### Successful Call Log Example
```
Call SID: CA177xyz..., Status: in-progress, Recording URL: https://api.twilio.com/...
Processing recording from URL: https://api.twilio.com/...
Deepgram Transcription: "I've taken myaspirin, and I've taken my metformin also."
Medication status detected: 
{
  aspirin: 'taken', 
  cardivol: 'unknown', 
  metformin: 'taken'
}
Call SID: CA177xyz..., Final Status: completed
```

### Unanswered Call Log Example
```
Call SID: CA177xyz..., Final Status: no-answer
Call to +1234567890 was not answered (no-answer). 
Attempting voicemail or SMS...
Call SID: CA456def..., Status: voicemail-attempt, To: +1234567890
SMS SID: SM789ghi..., Status: sms-sent, To: +1234567890
```

### Key Log Components
- **Call SID**: Unique identifier for the call
- **Status**: Current state of the call (queued, in-progress, completed, no-answer)
- **Recording URL**: Location of the call recording
- **Transcription**: Patient's spoken response
- **Medication Status**: Parsed understanding of medication intake

## Accessing Call Logs via Ngrok

1. When you start ngrok, it provides a public URL (e.g., `https://abc123.ngrok.io`)
2. Use the `/api/call-logs` endpoint to retrieve stored call logs:
   ```
   curl https://abc123.ngrok.io/api/call-logs
   ```
3. This will return an array of call logs stored in memory

## Viewing Detailed Call Information

To get details about a specific call:
```
curl https://abc123.ngrok.io/api/call-log/{callSid}
```

## Future Improvements

- Implement real-time TTS and STT streaming
- Add persistent database storage for call logs
- Enhance medication response parsing
- Improve error handling and logging
- Develop a web dashboard for call log management

## Troubleshooting

- Ensure all environment variables are correctly set
- Check Twilio and Deepgram API key permissions
- Verify ngrok is running and webhook is correctly configured
- Monitor console logs for any error messages

## Next Steps for Development

1. Complete real-time streaming implementation
2. Add more robust error handling
3. Implement database persistence for call logs
4. Create comprehensive test coverage

## License

MIT
