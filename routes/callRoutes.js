// src/routes/callRoutes.js
const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilioService');
const callLogModel = require('../models/callLogModel'); 

router.post('/trigger-call', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        error: 'Phone number is required' 
      });
    }
    
    const call = await twilioService.makeCall(phoneNumber);
    
    return res.status(200).json({
      message: 'Call triggered successfully',
      callSid: call.sid,
      status: call.status
    });
  } catch (error) {
    console.error('Error triggering call:', error);
    return res.status(500).json({ 
      error: 'Failed to trigger call',
      details: error.message
    });
  }
});


router.get('/call-log/:callSid', (req, res) => {
  try {
    const callSid = req.params.callSid;
    const log = callLogModel.getCallLogByCallSid(callSid);
    
    if (!log) {
      return res.status(404).json({ error: 'Call log not found' });
    }
    
    return res.status(200).json(log);
  } catch (error) {
    console.error('Error retrieving call log:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve call log',
      details: error.message
    });
  }
});

router.get('/call-logs', (req, res) => {
  try {
    const logs = callLogModel.getCallLogs();
    return res.status(200).json(logs);
  } catch (error) {
    console.error('Error retrieving call logs:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve call logs',
      details: error.message
    });
  }
});

module.exports = router;