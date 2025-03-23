// models/callLogModel.js

const callLogs = [];

function addCallLog(log) {
  const newLog = {
    id: Date.now().toString(),
    timestamp: new Date(),
    ...log
  };
  
  callLogs.push(newLog);
  return newLog;
}

function getCallLogs() {
  return [...callLogs]; // Return a copy to prevent direct mutation
}

function getCallLogByCallSid(callSid) {
  return callLogs.find(log => log.callSid === callSid);
}

function updateCallLog(callSid, updates) {
  const logIndex = callLogs.findIndex(log => log.callSid === callSid);
  
  if (logIndex === -1) {
    return null;
  }
  
  const updatedLog = {
    ...callLogs[logIndex],
    ...updates,
    updatedAt: new Date()
  };
  
  callLogs[logIndex] = updatedLog;
  return updatedLog;
}

module.exports = {
  addCallLog,
  getCallLogs,
  getCallLogByCallSid,
  updateCallLog
};