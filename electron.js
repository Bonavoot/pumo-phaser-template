const { app, BrowserWindow } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    // In development, load from Vite dev server
    if (process.env.NODE_ENV === "development") {
        mainWindow.loadURL("http://localhost:8080/");
        mainWindow.webContents.openDevTools();
    } else {
        // In production, load from built files
        mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
    }

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});

