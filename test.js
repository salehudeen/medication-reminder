const { getCallLogByCallSid } = require('./models/callLogModel');

try {
    const log = getCallLogByCallSid('CAac110d1deeb7b932ef0aace154de596e');
    console.log('Call log:', log);
} catch (error) {
    console.log(error);
}