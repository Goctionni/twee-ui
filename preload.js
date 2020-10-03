const { ipcRenderer } = require('electron')

process.once('loaded', () => {
    let watchFolderCallback = null;
    window.readFile = (filepath) => ipcRenderer.invoke('readFile', filepath);
    window.writeFile = (filepath, fileContent) => ipcRenderer.invoke('writeFile', filepath, fileContent);
    window.watchFolder = (filepath, callback) => {
        watchFolderCallback = callback;
        ipcRenderer.invoke('watchFolder', filepath);
    };

    ipcRenderer.on('file-change', (event, eventData) => {
        console.log('preload.js', 'file-change', { event, eventData });
        watchFolderCallback(eventData);
    });

    ipcRenderer.on('selected-dir', (event, folder) => {
        window.dispatchEvent(new CustomEvent('selected-dir', { detail: folder }));
    });

    window.addEventListener('message', evt => {
        if (evt.data.type === 'select-dir') {
            ipcRenderer.send('select-dir');
        }
    });

})