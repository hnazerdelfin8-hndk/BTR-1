import { runAssistant } from '../core/assistant.js';
import { speak, listen } from '../voice/index.js';

const status = document.querySelector('#status');
const button = document.querySelector('#listen');
const output = document.querySelector('#output');

async function handleInput(input) {
  status.textContent = 'Thinking...';
  try {
    const result = await runAssistant(input);
    output.textContent = result.reply;
    status.textContent = `Ready • ${result.intent}`;
    speak(result.reply);
  } catch (error) {
    output.textContent = error.message;
    status.textContent = 'Error';
    speak('Sorry, Master. I could not complete that request.');
  }
}

button?.addEventListener('click', () => {
  try {
    status.textContent = 'Listening...';
    listen(handleInput);
  } catch (error) {
    status.textContent = error.message;
  }
});
