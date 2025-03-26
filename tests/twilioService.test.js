const twilio = require('twilio');
const twilioService = require('../services/twilioService');

// Mock the Twilio client
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    calls: {
      create: jest.fn(),
      list: jest.fn()
    },
    messages: {
      create: jest.fn()
    },
    recordings: {
      list: jest.fn()
    }
  }));
});

describe('Twilio Service', () => {
  let mockTwilioClient;

  beforeEach(() => {
    // Reset env variables for testing
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    process.env.SERVER_URL = 'http://test.com';

    // Setup mock client
    mockTwilioClient = twilio();
  });

  describe('makeCall', () => {
    it('should make a call with correct parameters', async () => {
      const mockCall = { 
        sid: 'CA123', 
        status: 'queued' 
      };
      mockTwilioClient.calls.create.mockResolvedValue(mockCall);

      const phoneNumber = '+9876543210';
      const result = await twilioService.makeCall(phoneNumber);

      expect(mockTwilioClient.calls.create).toHaveBeenCalledWith({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
        url: `${process.env.SERVER_URL}/twilio/voice-response`,
        statusCallback: `${process.env.SERVER_URL}/twilio/call-status`,
        statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'],
        statusCallbackMethod: 'POST'
      });
      expect(result).toEqual(mockCall);
    });

    it('should throw an error if Twilio phone number is missing', async () => {
      delete process.env.TWILIO_PHONE_NUMBER;
      
      await expect(twilioService.makeCall('+9876543210'))
        .rejects
        .toThrow('Twilio phone number missing in .env file');
    });
  });

  describe('sendSms', () => {
    it('should send an SMS with correct parameters', async () => {
      const mockMessage = { 
        sid: 'SM123', 
        status: 'sent' 
      };
      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      const phoneNumber = '+9876543210';
      const result = await twilioService.sendSms(phoneNumber);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: expect.any(String),
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      expect(result).toEqual(mockMessage);
    });
  });
});