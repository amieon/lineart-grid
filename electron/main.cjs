const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// 打包后 .env 不放进安装包：优先读 exe 同级目录（portable 模式给的环境变量），
// 其次读用户数据目录，开发模式则回落到仓库根目录的 .env
function pickEnvFile() {
  const candidates = [
    process.env.LINEART_ENV_FILE,
    process.env.PORTABLE_EXECUTABLE_DIR && path.join(process.env.PORTABLE_EXECUTABLE_DIR, '.env'),
    path.join(path.dirname(process.execPath), '.env'),
    path.join(app.getPath('userData'), '.env'),
  ].filter(Boolean);
  return candidates.find((p) => {
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  });
}

let win = null;

async function boot() {
  const envFile = pickEnvFile();
  if (envFile) process.env.LINEART_ENV_FILE = envFile;
  else if (app.isPackaged) process.env.LINEART_ENV_FILE = path.join(app.getPath('userData'), '.env');

  const { start } = await import('../server.js');
  const port = await start(5173).catch(() => start(0));

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 480,
    minHeight: 420,
    title: '线稿临摹网格工具',
    autoHideMenuBar: true,
    backgroundColor: '#16181d',
  });
  win.loadURL(`http://127.0.0.1:${port}/`);
  win.on('closed', () => {
    win = null;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(boot);
  app.on('window-all-closed', () => app.quit());
}
