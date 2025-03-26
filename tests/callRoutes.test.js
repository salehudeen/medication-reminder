// __tests__/callRoutes.test.js
const request = require('supertest');
const express = require('express');
const callRoutes = require('../routes/callRoutes');
const twilioService = require('../services/twilioService');
const callLogModel = require('../models/callLogModel');

// Mock dependencies
jest.mock('../services/twilioService');
jest.mock('../models/callLogModel');

const app = express();
app.use(express.json());
app.use('/api', callRoutes);

describe('Call Routes', () => {
  describe('POST /trigger-call', () => {
    it('should trigger a call successfully', async () => {
      const mockCall = { 
        sid: 'CA123', 
        status: 'queued' 
      };
      twilioService.makeCall.mockResolvedValue(mockCall);

      const response = await request(app)
        .post('/api/trigger-call')
        .send({ phoneNumber: '+1234567890' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Call triggered successfully',
        callSid: mockCall.sid,
        status: mockCall.status
      });
      expect(twilioService.makeCall).toHaveBeenCalledWith('+1234567890');
    });

    it('should return 400 if phone number is missing', async () => {
      const response = await request(app)
        .post('/api/trigger-call')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ 
        error: 'Phone number is required' 
      });
    });

    it('should handle call trigger errors', async () => {
      twilioService.makeCall.mockRejectedValue(new Error('Twilio error'));

      const response = await request(app)
        .post('/api/trigger-call')
        .send({ phoneNumber: '+1234567890' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Failed to trigger call',
        details: 'Twilio error'
      });
    });
  });

  describe('GET /call-log/:callSid', () => {
    it('should retrieve a specific call log', async () => {
      const mockLog = { 
        callSid: 'CA123', 
        status: 'completed' 
      };
      callLogModel.getCallLogByCallSid.mockReturnValue(mockLog);

      const response = await request(app)
        .get('/api/call-log/CA123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockLog);
    });

    it('should return 404 if call log not found', async () => {
      callLogModel.getCallLogByCallSid.mockReturnValue(null);

      const response = await request(app)
        .get('/api/call-log/NONEXISTENT');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ 
        error: 'Call log not found' 
      });
    });
  });
});