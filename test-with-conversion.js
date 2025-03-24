// test-with-conversion.js
require('dotenv').config();
const { createClient } = require("@deepgram/sdk");
const fs = require("fs");

const transcribeFile = async () => {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    fs.readFileSync("C:/Users/silahudeen.ibrahim/Documents/1projects/medication-reminder/medication-reminder/tmp/recording-CAcadc5c54fe8f48ec2a245f2c5b1287b6.mp3"),
    {
      model: "nova-3",
      smart_format: true,
    }
  );

  if (error) throw error;
  // STEP 4: Print the results
  if (!error) console.dir(result, { depth: null });
};

transcribeFile();
