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

## Setup

1. Clone this repository:
```
git clone https://github.com/yourusername/medication-reminder.git
cd medication-reminder
```

2. Install dependencies:
```
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
SERVER_URL=your_ngrok_url
PORT=3000
```

## Running the Application

1. Start the server:
```
node index.js
```

2. In a separate terminal, start ngrok to create a public URL:
```
ngrok http 3000
```

3. Update your `.env` file with the ngrok URL:
```
SERVER_URL=https://your-ngrok-url.ngrok-free.app
```

4. Configure your Twilio phone number to use the ngrok URL for incoming calls:
   - Go to the Twilio Console
   - Navigate to Phone Numbers > Manage > Active Numbers
   - Click on your Twilio number
   - Under "Voice & Fax", set the webhook for incoming calls to:
     `https://your-ngrok-url.ngrok-free.app/twilio/incoming-call`

## Usage

### Triggering a Call

To trigger a medication reminder call, send a POST request to the `/api/trigger-call` endpoint:

```
curl -X POST https://your-ngrok-url.ngrok-free.app/api/trigger-call \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890"}'
```

### Understanding Call Logs

After each call, the system logs information to the console:

- For successful calls:
  ```
  Call SID: CA123abc..., Status: completed, Recording URL: https://api.twilio.com/...
  Call SID: CA123abc..., Status: completed, Patient Response: "I have taken my medications today"
  ```

- For unanswered calls:
  ```
  Call SID: CA123abc..., Final Status: no-answer
  Call to +1234567890 was not answered (no-answer). Attempting voicemail or SMS...
  Call SID: CA456def..., Status: voicemail-attempt, To: +1234567890
  ```

- For SMS fallbacks:
  ```
  SMS SID: SM789ghi..., Status: sms-sent, To: +1234567890
  ```

## Future Improvements

- Implement a persistent database (MongoDB/PostgreSQL) for call logs
- Add authentication for API endpoints
- Create a web dashboard for viewing call logs
- Implement more sophisticated error handling
- Add unit and integration tests

## License

MIT