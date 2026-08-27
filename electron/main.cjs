const { app, BrowserWindow, shell, dialog } = require("electron");

const path = require("path");
const { spawn } = require("child_process");
const net = require("net");

// ============================================================
// ELECTRON CACHE / USER DATA
// ============================================================

const userDataPath = path.join(app.getPath("temp"), "fabrika-yonetim-electron");

app.setPath("userData", userDataPath);

app.setPath("sessionData", path.join(userDataPath, "session"));

let serverProcess = null;
let mainWindow = null;
let isQuittingForUpdate = false;
let appServerUrl = null;
let updater = null;
let updateCheckInProgress = false;
let updateTimer = null;

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function reserveAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close(() => reject(new Error("Uygun yerel port bulunamadı.")));
        return;
      }
      const port = address.port;
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

// ============================================================
// TANSTACK SERVER BAŞLAT
// ============================================================

async function startServer() {
  const serverPath = path.join(app.getAppPath(), ".output", "server", "index.mjs");

  console.log("TanStack server başlatılıyor:", serverPath);

  const port = await reserveAvailablePort();
  appServerUrl = `http://127.0.0.1:${port}`;

  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,

      ELECTRON_RUN_AS_NODE: "1",

      NODE_ENV: "production",

      PORT: String(port),

      HOST: "127.0.0.1",
    },

    stdio: "inherit",
  });

  serverProcess.on("error", (error) => {
    console.error("TanStack server başlatılamadı:", error);
  });

  serverProcess.on("exit", (code, signal) => {
    console.log("TanStack server kapandı:", {
      code,
      signal,
    });

    serverProcess = null;
  });
}

// ============================================================
// TANSTACK SERVER KAPAT
// ============================================================

function stopServer() {
  if (!serverProcess) {
    return;
  }

  try {
    serverProcess.kill();
  } catch (error) {
    console.error("TanStack server kapatılırken hata oluştu:", error);
  }

  serverProcess = null;
}

// ============================================================
// SERVER HAZIR MI?
// ============================================================

async function waitForServer() {
  if (!appServerUrl) throw new Error("Yerel sunucu adresi hazırlanmadı.");

  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(appServerUrl);

      if (response.ok) {
        const body = await response.text();
        if (!body.includes("Fabrika Yönetim Sistemi")) {
          throw new Error("Beklenmeyen yerel sunucu yanıtı alındı.");
        }
        console.log("TanStack server hazır.");

        return;
      }
    } catch {
      // Server henüz hazır değil.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Uygulama sunucusu zamanında başlatılamadı.");
}

// ============================================================
// ANA PENCERE
// ============================================================

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,

    minWidth: 1100,
    minHeight: 700,

    show: false,

    title: "Fabrika Yönetim Sistemi",

    webPreferences: {
      nodeIntegration: false,

      contextIsolation: true,

      sandbox: true,
    },
  });

  try {
    await waitForServer();

    await mainWindow.loadURL(appServerUrl);
  } catch (error) {
    console.error("Uygulama yüklenemedi:", error);

    const message = String(error);

    const errorPage = `
      <!DOCTYPE html>

      <html lang="tr">

        <head>
          <meta charset="UTF-8" />

          <title>
            Fabrika Yönetim Sistemi
          </title>
        </head>

        <body
          style="
            font-family: Arial, sans-serif;
            padding: 40px;
            background: #0f172a;
            color: white;
          "
        >

          <h2>
            Fabrika Yönetim Sistemi
          </h2>

          <p>
            Uygulama sunucusu başlatılamadı.
          </p>

          <p>
            ${message}
          </p>

        </body>

      </html>
    `;

    await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorPage)}`);
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();

    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      void shell.openExternal(url);
    }

    return {
      action: "deny",
    };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ============================================================
// OTOMATİK GÜNCELLEME
// ============================================================

async function setupAutoUpdater() {
  if (!app.isPackaged) {
    console.log("Geliştirme modunda otomatik güncelleme kontrolü yapılmadı.");

    return;
  }

  try {
    const electronUpdater = await import("electron-updater");

    const { autoUpdater } = electronUpdater;
    updater = autoUpdater;

    autoUpdater.autoDownload = true;

    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("checking-for-update", () => {
      updateCheckInProgress = true;
      console.log("Güncelleme kontrol ediliyor...");
    });

    autoUpdater.on("update-available", (info) => {
      console.log("Yeni sürüm bulundu:", info.version);
    });

    autoUpdater.on("update-not-available", (info) => {
      updateCheckInProgress = false;
      console.log("Uygulama güncel:", info.version);
    });

    autoUpdater.on("download-progress", (progress) => {
      console.log(`Güncelleme indiriliyor: %${progress.percent.toFixed(1)}`);
    });

    autoUpdater.on("error", (error) => {
      updateCheckInProgress = false;
      console.error("Otomatik güncelleme hatası:", error);
    });

    autoUpdater.on("update-downloaded", async (info) => {
      updateCheckInProgress = false;
      console.log("Güncelleme indirildi:", info.version);

      const result = await dialog.showMessageBox(mainWindow ?? undefined, {
        type: "info",

        title: "Güncelleme Hazır",

        message: `Fabrika Yönetim Sistemi ${info.version} sürümü indirildi.`,

        detail: "Yeni sürümü şimdi kurmak ister misiniz? Uygulama yeniden başlatılacaktır.",

        buttons: ["Şimdi Güncelle", "Daha Sonra"],

        defaultId: 0,

        cancelId: 1,

        noLink: true,
      });

      if (result.response === 0) {
        isQuittingForUpdate = true;

        stopServer();

        autoUpdater.quitAndInstall(false, true);
      }
    });

    await checkForUpdates();

    updateTimer = setInterval(() => {
      void checkForUpdates();
    }, UPDATE_CHECK_INTERVAL_MS);

    updateTimer.unref();
  } catch (error) {
    console.error("Güncelleme sistemi başlatılamadı:", error);
  }
}

async function checkForUpdates() {
  if (!updater || updateCheckInProgress || isQuittingForUpdate) return;

  try {
    updateCheckInProgress = true;
    await updater.checkForUpdatesAndNotify();
  } catch (error) {
    updateCheckInProgress = false;
    console.error("Güncelleme kontrolü tamamlanamadı:", error);
  }
}

// ============================================================
// ELECTRON BAŞLAT
// ============================================================

app.whenReady().then(async () => {
  console.log("Electron userData:", app.getPath("userData"));

  console.log("Electron sessionData:", app.getPath("sessionData"));

  await startServer();

  await createWindow();

  setTimeout(() => {
    void setupAutoUpdater();
  }, 3000);

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

// ============================================================
// ELECTRON KAPAT
// ============================================================

app.on("window-all-closed", () => {
  if (!isQuittingForUpdate) {
    stopServer();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }

  stopServer();
});
