const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const { resolve, join } = require('path');
const { format } = require('url');
const fs = require('fs');
const chokidar = require('chokidar');

function createWindow() {
    // Create the browser window.
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            worldSafeExecuteJavaScript: true,
            nodeIntegration: true,
        },
    });

    win.loadURL(format({ pathname: resolve(__dirname, "dist/index.html"), protocol: "file", slashes: true }));

    ipcMain.on('select-dir', async (event, arg) => {
        const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
        event.reply('selected-dir', result.filePaths.pop());
    });

    let folderWatcher = null;
    ipcMain.handle('readFile', async (event, filepath) => (await fs.promises.readFile(filepath)).toString());
    ipcMain.handle('writeFile', async (event, filepath, fileContent) => (await fs.promises.writeFile(filepath, fileContent, { encoding: 'utf-8' })));
    ipcMain.handle('watchFolder', (event, filepath) => {
        if (folderWatcher) folderWatcher.close();

        folderWatcher = chokidar.watch(filepath, { recursive: true, awaitWriteFinish: true, ignoreInitial: true, ignored: path => path.includes('node_modules') });
        folderWatcher.on('all', (eventName, path) => {
            if (path.includes('node_modules')) return; // this shouldn't happen since we ignore it in the watch config
            if (eventName.indexOf('Dir') >= 0) return;
            win.webContents.send('file-change', {eventName, path});
        });
    });

}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    app.quit();
});
