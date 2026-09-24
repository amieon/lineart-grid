const DEFAULT_PROMPT =
  '把这张图片转成黑白线稿：纯白背景，只用清晰、干净、连续的黑色轮廓线勾出主体结构和主要细节，' +
  '严格保持原图的构图、比例和透视不变。去掉所有颜色、明暗调子、阴影、材质纹理和背景装饰，' +
  '线条粗细均匀，不要网格线、不要文字、不要水印。';
const DEFAULT_NEGATIVE = '彩色, 灰阶, 阴影, 明暗过渡, 色块, 背景, 纹理, 网格, 文字, 水印, 模糊, 噪点, 变形';
const MAX_UPLOAD_SIDE = 2048;

const el = (id) => document.getElementById(id);
const dom = {
  dropzone: el('dropzone'),
  fileInput: el('fileInput'),
  fileInfo: el('fileInfo'),
  prompt: el('prompt'),
  negativePrompt: el('negativePrompt'),
  resetPrompt: el('resetPrompt'),
  convertBtn: el('convertBtn'),
  status: el('status'),
  mode: el('mode'),
  gridN: el('gridN'),
  nValue: el('nValue'),
  showGrid: el('showGrid'),
  showLabels: el('showLabels'),
  gridColor: el('gridColor'),
  gridWidth: el('gridWidth'),
  widthValue: el('widthValue'),
  gridOpacity: el('gridOpacity'),
  opacityValue: el('opacityValue'),
  squareCells: el('squareCells'),
  exportLineart: el('exportLineart'),
  exportGrid: el('exportGrid'),
  exportOriginalGrid: el('exportOriginalGrid'),
  empty: el('empty'),
  singleView: el('singleView'),
  compareView: el('compareView'),
  mainCanvas: el('mainCanvas'),
  leftCanvas: el('leftCanvas'),
  rightCanvas: el('rightCanvas'),
  loading: el('loading'),
  modelBadge: el('modelBadge'),
};

const state = {
  original: null,
  lineart: null,
  uploadDataUrl: null,
  fileName: 'image',
};

dom.prompt.value = DEFAULT_PROMPT;
dom.negativePrompt.value = DEFAULT_NEGATIVE;

function setStatus(text, kind = '') {
  dom.status.textContent = text;
  dom.status.className = `hint status ${kind}`;
}

function readSettings() {
  return {
    n: Number(dom.gridN.value),
    showGrid: dom.showGrid.checked,
    showLabels: dom.showLabels.checked,
    color: dom.gridColor.value,
    width: Number(dom.gridWidth.value),
    opacity: Number(dom.gridOpacity.value) / 100,
    square: dom.squareCells.checked,
  };
}

function cropRect(img, square) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!square) return { sx: 0, sy: 0, sw: w, sh: h };
  const side = Math.min(w, h);
  return { sx: Math.round((w - side) / 2), sy: Math.round((h - side) / 2), sw: side, sh: side };
}

function drawScene(canvas, img, settings) {
  const { sx, sy, sw, sh } = cropRect(img, settings.square);
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  if (settings.showGrid) drawGrid(ctx, sw, sh, settings);
}

function drawGrid(ctx, w, h, s) {
  const n = s.n;
  const cellW = w / n;
  const cellH = h / n;
  const scale = Math.max(1, w / 1000);
  const lineWidth = Math.max(1, s.width * scale);

  ctx.save();
  ctx.globalAlpha = s.opacity;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (let i = 1; i < n; i++) {
    const x = Math.round(i * cellW) + 0.5;
    const y = Math.round(i * cellH) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  ctx.lineWidth = Math.max(lineWidth, 2 * scale);
  ctx.strokeRect(0, 0, w, h);

  if (s.showLabels) {
    const fontSize = Math.max(11, Math.round(Math.min(cellW, cellH) / 4.5));
    ctx.font = `600 ${fontSize}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.globalAlpha = Math.min(1, s.opacity + 0.1);
    const pad = Math.round(fontSize * 0.35);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const label = `${r + 1}-${c + 1}`;
        const x = c * cellW + pad;
        const y = r * cellH + pad;
        ctx.lineWidth = Math.max(2, fontSize / 6);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText(label, x, y);
        ctx.fillStyle = s.color;
        ctx.fillText(label, x, y);
      }
    }
  }
  ctx.restore();
}

function render() {
  const mode = dom.mode.value;
  const settings = readSettings();
  const hasOriginal = Boolean(state.original);
  const hasLineart = Boolean(state.lineart);

  const isCompare = mode === 'compare' && hasOriginal && hasLineart;
  dom.empty.hidden = hasOriginal || hasLineart;
  dom.compareView.hidden = !isCompare;
  dom.singleView.hidden = isCompare;

  if (isCompare) {
    drawScene(dom.leftCanvas, state.original, settings);
    drawScene(dom.rightCanvas, state.lineart, settings);
    return;
  }

  const img = mode === 'original' ? state.original : state.lineart || state.original;
  if (img) drawScene(dom.mainCanvas, img, settings);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = src;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

// 模型接口对图片大小有限制，超大图先等比缩到长边 2048
function downscale(img, maxSide) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const ratio = Math.min(1, maxSide / Math.max(w, h));
  if (ratio === 1) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

async function acceptFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('请选择图片文件', 'error');
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);
    state.original = img;
    state.lineart = null;
    state.fileName = (file.name || 'image').replace(/\.[^.]+$/, '');
    state.uploadDataUrl = downscale(img, MAX_UPLOAD_SIDE) || dataUrl;
    dom.fileInfo.textContent = `${file.name} · ${img.naturalWidth}×${img.naturalHeight} · ${(file.size / 1024).toFixed(0)} KB`;
    dom.mode.value = 'original';
    setStatus('图片已载入，可以直接叠格子，或点「生成线稿」', 'ok');
    render();
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function convert() {
  if (!state.uploadDataUrl) {
    setStatus('请先选择一张图片', 'error');
    return;
  }
  dom.convertBtn.disabled = true;
  dom.loading.hidden = false;
  setStatus('');
  const started = Date.now();
  try {
    const response = await fetch('/api/lineart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: state.uploadDataUrl,
        prompt: dom.prompt.value,
        negativePrompt: dom.negativePrompt.value,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
    state.lineart = await loadImage(data.image);
    dom.mode.value = 'lineart';
    setStatus(`线稿已生成，用时 ${((Date.now() - started) / 1000).toFixed(1)} 秒`, 'ok');
    render();
  } catch (err) {
    setStatus(err.message || '生成失败', 'error');
  } finally {
    dom.convertBtn.disabled = false;
    dom.loading.hidden = true;
  }
}

function exportCanvas(img, withGrid, suffix) {
  if (!img) {
    setStatus('没有可导出的图片', 'error');
    return;
  }
  const settings = readSettings();
  const canvas = document.createElement('canvas');
  drawScene(canvas, img, { ...settings, showGrid: withGrid });
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.fileName}_${suffix}${settings.n}x${settings.n}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

dom.dropzone.addEventListener('click', () => dom.fileInput.click());
dom.fileInput.addEventListener('change', () => acceptFile(dom.fileInput.files[0]));

['dragenter', 'dragover'].forEach((type) =>
  dom.dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dom.dropzone.classList.add('over');
  })
);
['dragleave', 'drop'].forEach((type) =>
  dom.dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dom.dropzone.classList.remove('over');
  })
);
dom.dropzone.addEventListener('drop', (e) => acceptFile(e.dataTransfer?.files?.[0]));

window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) acceptFile(item.getAsFile());
});

dom.convertBtn.addEventListener('click', convert);
dom.resetPrompt.addEventListener('click', () => {
  dom.prompt.value = DEFAULT_PROMPT;
  dom.negativePrompt.value = DEFAULT_NEGATIVE;
});

for (const input of [dom.gridN, dom.showGrid, dom.showLabels, dom.gridColor, dom.gridWidth, dom.gridOpacity, dom.squareCells, dom.mode]) {
  input.addEventListener('input', () => {
    dom.nValue.textContent = dom.gridN.value;
    dom.widthValue.textContent = dom.gridWidth.value;
    dom.opacityValue.textContent = `${dom.gridOpacity.value}%`;
    render();
  });
}

dom.exportLineart.addEventListener('click', () => exportCanvas(state.lineart, false, '线稿_'));
dom.exportGrid.addEventListener('click', () => exportCanvas(state.lineart || state.original, true, '线稿带格_'));
dom.exportOriginalGrid.addEventListener('click', () => exportCanvas(state.original, true, '原图带格_'));

fetch('/api/config')
  .then((r) => r.json())
  .then((cfg) => {
    dom.modelBadge.textContent = cfg.ready ? `模型 ${cfg.model}` : '未配置 API Key';
    dom.modelBadge.className = `badge ${cfg.ready ? 'ok' : 'bad'}`;
    dom.convertBtn.disabled = !cfg.ready;
    if (!cfg.ready) {
      setStatus('未检测到 DASHSCOPE_API_KEY：复制 .env.example 为 .env 填入 key 后重启服务。也可以直接载入已有线稿叠格子。');
    }
  })
  .catch(() => {
    dom.modelBadge.textContent = '无法连接服务';
    dom.modelBadge.className = 'badge bad';
  });
