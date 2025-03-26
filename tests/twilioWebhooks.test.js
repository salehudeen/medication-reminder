// __tests__/twilioWebhooks.test.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@deepgram/sdk');
const callLogModel = require('../models/callLogModel');

// Mock dependencies
jest.mock('@deepgram/sdk');
jest.mock('../models/callLogModel');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createWriteStream: jest.fn(),
  readFileSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkAsync: jest.fn()
}));

describe('Transcription Handling', () => {
  let mockDeepgramClient;
  const mockCallSid = 'CA123456';
  const mockRecordingUrl = 'https://example.com/recording.mp3';

  beforeEach(() => {
    // Setup mock Deepgram client
    mockDeepgramClient = {
      listen: {
        prerecorded: {
          transcribeFile: jest.fn()
        }
      }
    };
    createClient.mockReturnValue(mockDeepgramClient);

    // Mock fs methods
    fs.readFileSync.mockReturnValue(Buffer.from('mock audio data'));
  });

  it('should correctly transcribe and parse medication status', async () => {
    // Mock Deepgram transcription result
    const mockTranscriptionResult = {
      result: {
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: 'Yes, I took my aspirin and cardivol, but not metformin'
                }
              ]
            }
          ]
        }
      }
    };

    mockDeepgramClient.listen.prerecorded.transcribeFile.mockResolvedValue(mockTranscriptionResult);

    // Call the transcription function (you'll need to import this from your actual file)
    const transcribeWithDeepgram = require('../index').transcribeWithDeepgram;
    
    await transcribeWithDeepgram(mockRecordingUrl, mockCallSid);

    // Verify Deepgram transcription was called
    expect(mockDeepgramClient.listen.prerecorded.transcribeFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        model: 'nova-3',
        language: 'en',
        smart_format: true,
        diarize: true
      })
    );

    // Verify call log was updated with correct medication status
    expect(callLogModel.updateCallLog).toHaveBeenCalledWith(
      mockCallSid,
      expect.objectContaining({
        medicationStatus: {
          aspirin: 'taken',
          cardivol: 'taken',
          metformin: 'not taken'
        },
        patientResponse: expect.any(String)
      })
    );
  });

  it('should handle transcription errors gracefully', async () => {
    // Simulate Deepgram transcription error
    mockDeepgramClient.listen.prerecorded.transcribeFile.mockRejectedValue(new Error('Transcription failed'));

    const transcribeWithDeepgram = require('../index').transcribeWithDeepgram;
    
    await transcribeWithDeepgram(mockRecordingUrl, mockCallSid);

    // Verify call log was updated with error
    expect(callLogModel.updateCallLog).toHaveBeenCalledWith(
      mockCallSid,
      expect.objectContaining({
        transcriptionError: expect.any(String),
        processingComplete: true
      })
    );
  });
});