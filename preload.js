const { contextBridge, ipcRenderer } = require('electron');

let lastPosition = null;
let lastPositionSentAt = 0;
const POSITION_SEND_MS = 34;

function setPosition(position) {
  const now = Date.now();
  const nextPosition = {
    x: Math.round(position.x),
    y: Math.round(position.y)
  };

  if (
    lastPosition &&
    lastPosition.x === nextPosition.x &&
    lastPosition.y === nextPosition.y
  ) {
    return;
  }

  if (now - lastPositionSentAt < POSITION_SEND_MS) {
    return;
  }

  lastPosition = nextPosition;
  lastPositionSentAt = now;
  ipcRenderer.send('pet:set-position', nextPosition);
}

contextBridge.exposeInMainWorld('desktopPet', {
  getConfig: () => ipcRenderer.invoke('pet:get-config'),
  getCursorPosition: () => ipcRenderer.invoke('pet:get-cursor-position'),
  toggleDevTools: () => ipcRenderer.send('pet:toggle-devtools'),
  setPosition
});
