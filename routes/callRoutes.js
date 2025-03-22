// src/routes/callRoutes.js
const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilioService');

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

module.exports = router;