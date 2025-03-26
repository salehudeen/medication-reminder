// test.js
const { createClient } = require('@deepgram/sdk');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

// Function to list all audio files in the tmp directory
function listAudioFiles(directoryPath) {
  try {
    const files = fs.readdirSync(directoryPath);
    const audioFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.wav', '.mp3', '.m4a', '.ogg', '.flac'].includes(ext);
    });
    
    if (audioFiles.length === 0) {
      console.log('No audio files found in the directory.');
      return null;
    }
    
    console.log('Available audio files:');
    audioFiles.forEach((file, index) => {
      console.log(`[${index + 1}] ${file}`);
    });
    
    return audioFiles;
  } catch (err) {
    console.error('Error listing files:', err);
    return null;
  }
}

async function transcribeLocalFile(filePath) {
  try {
    console.log(`Testing transcription of file: ${filePath}`);
    
    // Verify the file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File does not exist at path: ${filePath}`);
      return null;
    }
    
    // Get file size
    const stats = fs.statSync(filePath);
    console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    // Determine mimetype based on file extension
    const fileExt = path.extname(filePath).toLowerCase();
    let mimetype = 'audio/wav'; // Default
    
    if (fileExt === '.mp3') {
      mimetype = 'audio/mpeg';
    } else if (fileExt === '.m4a') {
      mimetype = 'audio/mp4';
    } else if (fileExt === '.ogg') {
      mimetype = 'audio/ogg';
    } else if (fileExt === '.flac') {
      mimetype = 'audio/flac';
    }
    
    console.log(`Using mimetype: ${mimetype} based on extension: ${fileExt}`);
    
    // Initialize Deepgram client
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    console.log('Deepgram client initialized');
    
    // Read file into buffer
    console.log('Reading file into buffer...');
    const buffer = fs.readFileSync(filePath);
    
    const source = {
      buffer,
      mimetype,
    };
    
    console.log('Sending file to Deepgram for transcription...');
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      source,
      {
        model: 'nova-3',
        language: 'en',
        smart_format: true,
        punctuate: true,
        utterances: true
      }
    );
    
    if (error) {
      console.error('Deepgram Transcription Error:', error);
      return null;
    }
    
    // Extract and display detailed results
    const transcript = result.results?.channels[0]?.alternatives[0]?.transcript || '';
    const confidence = result.results?.channels[0]?.alternatives[0]?.confidence || 0;
    
    console.log('\n=== TRANSCRIPTION RESULTS ===');
    console.log(`Transcript: "${transcript}"`);
    console.log(`Confidence: ${(confidence * 100).toFixed(2)}%`);
    
    // If there are utterances, show them
    if (result.results?.utterances && result.results.utterances.length > 0) {
      console.log('\n=== UTTERANCES ===');
      result.results.utterances.forEach((utterance, index) => {
        console.log(`[${index + 1}] ${utterance.transcript} (${utterance.start.toFixed(2)}s - ${utterance.end.toFixed(2)}s)`);
      });
    }
    
    return transcript;
  } catch (err) {
    console.error('Error during transcription:', err);
    if (err.toString().includes('authentication')) {
      console.error('API Key may be invalid or expired. Check your DEEPGRAM_API_KEY in .env file.');
    }
    return null;
  }
}

// Main function
async function main() {
  // Define the directory path
  const tmpDir = path.join(__dirname, 'tmp');
  
  // Check if the directory exists
  if (!fs.existsSync(tmpDir)) {
    console.error(`Error: Directory does not exist: ${tmpDir}`);
    return;
  }
  
  // List audio files
  const audioFiles = listAudioFiles(tmpDir);
  if (!audioFiles || audioFiles.length === 0) return;
  
  // If a specific file is provided as a command line argument, use that
  if (process.argv.length > 2) {
    const specifiedFile = process.argv[2];
    const filePath = path.join(tmpDir, specifiedFile);
    
    if (fs.existsSync(filePath)) {
      await transcribeLocalFile(filePath);
    } else {
      console.error(`Error: Specified file does not exist: ${filePath}`);
      console.log('Available files are:');
      audioFiles.forEach(file => console.log(` - ${file}`));
    }
    return;
  }
  
  // Otherwise, allow the user to select a file
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('Enter the number of the file to transcribe (or press Enter to cancel): ', async (answer) => {
    rl.close();
    
    const fileIndex = parseInt(answer) - 1;
    if (isNaN(fileIndex) || fileIndex < 0 || fileIndex >= audioFiles.length) {
      console.log('No valid file selected. Exiting.');
      return;
    }
    
    const selectedFile = audioFiles[fileIndex];
    const filePath = path.join(tmpDir, selectedFile);
    
    await transcribeLocalFile(filePath);
  });
}

// Run the main function
main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});