const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('api', {
  call: (name, data) => ipcRenderer.invoke('api', name, data),
  onUpdate: fn => ipcRenderer.on('update', (_, data) => fn(data))
});
