import { think } from '../core/brain/index.js';
import { speak, listen } from '../voice/index.js';

const status = document.querySelector('#status');
const button = document.querySelector('#listen');

button?.addEventListener('click', () => {
  try {
    status.textContent = 'Listening...';
    listen(input => {
      const result = think(input);
      status.textContent = `Intent: ${result.intent}`;
      speak(result.intent === 'conversation' ? 'I am ready, Master.' : `I detected ${result.intent}.`);
    });
  } catch (error) {
    status.textContent = error.message;
  }
});
