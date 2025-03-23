// routes/incomingCallRoutes.js
const express = require('express');
const router = express.Router();

// This endpoint handles incoming calls and prompts users about their medications
router.post('/incoming-call', async (req, res) => {
  try {
    const responseMessage =
      "Hello, this is a reminder from your healthcare provider. Have you taken your medications today? Please confirm if you have taken your Aspirin, Cardivol, and Metformin.";

    return res.status(200).json({
      message: responseMessage
    });
  } catch (error) {
    console.error('Error handling incoming call:', error);
    return res.status(500).json({
      error: 'Failed to process call',
      details: error.message
    });
  }
});

// This endpoint allows us to check call logs
router.get('/call-logs', async (req, res) => {
  try {
    // In a real implementation, retrieve this from a database
    return res.status(200).json({
      message: 'Call logs endpoint - would retrieve logs from database',
      note: 'This is a placeholder for storing and retrieving call logs'
    });
  } catch (error) {
    console.error('Error retrieving call logs:', error);
    return res.status(500).json({
      error: 'Failed to retrieve call logs',
      details: error.message
    });
  }
});

module.exports = router;
