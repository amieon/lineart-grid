const DEFAULT_PROMPT =
  '把这张图片转成黑白线稿：纯白背景，只用清晰、干净、连续的黑色轮廓线勾出主体结构和主要细节，' +
  '严格保持原图的构图、比例和透视不变。去掉所有颜色、明暗调子、阴影、材质纹理和背景装饰，' +
  '线条粗细均匀，不要网格线、不要文字、不要水印。';
const DEFAULT_NEGATIVE = '彩色, 灰阶, 阴影, 明暗过渡, 色块, 背景, 纹理, 网格, 文字, 水印, 模糊, 噪点, 变形';
const MAX_UPLOAD_SIDE = 2048;
// 双边滤波是 O(n·k²)，本地抽线先把长边压到这个尺寸以内，否则大图要卡好几秒
const MAX_LOCAL_SIDE = 1600;

const el = (id) => document.getElementById(id);
const dom = {
  dropzone: el('dropzone'),
  fileInput: el('fileInput'),
  fileInfo: el('fileInfo'),
  prompt: el('prompt'),
  negativePrompt: el('negativePrompt'),
  resetPrompt: el('resetPrompt'),
  convertBtn: el('convertBtn'),
  extractBtn: el('extractBtn'),
  extractSmooth: el('extractSmooth'),
  extractSigma: el('extractSigma'),
  extractSigmaValue: el('extractSigmaValue'),
  extractAuto: el('extractAuto'),
  extractLo: el('extractLo'),
  extractLoValue: el('extractLoValue'),
  extractHi: el('extractHi'),
  extractHiValue: el('extractHiValue'),
  extractThick: el('extractThick'),
  convKernel: el('convKernel'),
  trim: el('trim'),
  trimTol: el('trimTol'),
  trimValue: el('trimValue'),
  denoise: el('denoise'),
  medianK: el('medianK'),
  binarize: el('binarize'),
  sharpenThreshold: el('sharpenThreshold'),
  sharpenValue: el('sharpenValue'),
  morph: el('morph'),
  upscale: el('upscale'),
  processBtn: el('processBtn'),
  resetProc: el('resetProc'),
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
  exportGridOnly: el('exportGridOnly'),
  empty: el('empty'),
  singleView: el('singleView'),
  compareView: el('compareView'),
  mainCanvas: el('mainCanvas'),
  leftCanvas: el('leftCanvas'),
  rightCanvas: el('rightCanvas'),
  loading: el('loading'),
  modelBadge: el('modelBadge'),
  configModal: el('configModal'),
  envPath: el('envPath'),
  cfgKey: el('cfgKey'),
  cfgModel: el('cfgModel'),
  toggleKey: el('toggleKey'),
  cfgCancel: el('cfgCancel'),
  cfgSave: el('cfgSave'),
  cfgStatus: el('cfgStatus'),
  galleryPage: el('galleryPage'),
  galleryGrid: el('galleryGrid'),
  galleryCount: el('galleryCount'),
  galleryCountSidebar: el('galleryCountSidebar'),
  openGallery: el('openGallery'),
  galleryBack: el('galleryBack'),
  saveToGallery: el('saveToGallery'),
  galleryRefresh: el('galleryRefresh'),
  galleryStatus: el('galleryStatus'),
};

const state = {
  original: null,
  lineart: null,
  lineartProc: null,
  uploadDataUrl: null,
  uploadDims: null,
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

function dims(img) {
  return { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
}

function cropRect(img, square) {
  const { w, h } = dims(img);
  if (!square) return { sx: 0, sy: 0, sw: w, sh: h };
  const side = Math.min(w, h);
  return { sx: Math.round((w - side) / 2), sy: Math.round((h - side) / 2), sw: side, sh: side };
}

// ---------- 本地图像处理管线（不调模型，免费、可反复） ----------
// 每个滤波器是独立小函数，加新滤波器 = 一个函数 + 一个控件。
// 顺序：原尺寸 → 中值去噪 → 裁白边 → 放大 → 色阶二值化 → 形态学。
// 中值(带排序、最贵)放在放大前的小尺寸上做，且在裁边前（先把杂点去掉才裁得干净）；放大后二值化=带抗锯齿。

function canvasOf(img, scale = 1) {
  const { w, h } = dims(img);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = scale !== 1;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toGray(id) {
  const d = id.data;
  const g = new Uint8ClampedArray(d.length >> 2);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    g[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  return g;
}

function toGrayFloat(id) {
  const d = id.data;
  const g = new Float32Array(d.length >> 2);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    g[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  return g;
}

function writeGrayBack(id, g) {
  const d = id.data;
  for (let p = 0, i = 0; p < g.length; p++, i += 4) {
    d[i] = g[p]; d[i + 1] = g[p]; d[i + 2] = g[p]; d[i + 3] = 255;
  }
}

// 中值滤波：顺序统计、保边去椒盐噪点。k = 3 或 5（奇数）
function medianFilter(g, w, h, k) {
  const out = new Uint8ClampedArray(g.length);
  const r = (k - 1) >> 1;
  const size = k * k;
  const mid = size >> 1;
  const buf = new Uint8ClampedArray(size);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
          buf[n++] = g[yy * w + xx];
        }
      }
      buf.sort();
      out[y * w + x] = buf[mid];
    }
  }
  return out;
}

// 形态学（灰度）：dilate=邻域取 min → 黑线扩张/连断裂；erode=取 max → 黑线收缩/去杂点
function morphFilter(g, w, h, mode) {
  const out = new Uint8ClampedArray(g.length);
  for (let y = 0; y < h; y++) {
    const y0 = (y > 0 ? y - 1 : 0) * w, y1 = y * w, y2 = (y < h - 1 ? y + 1 : h - 1) * w;
    for (let x = 0; x < w; x++) {
      const x0 = x > 0 ? x - 1 : 0, x1 = x, x2 = x < w - 1 ? x + 1 : w - 1;
      let v = g[y0 + x0];
      if (mode === 'dilate') {
        if (g[y0 + x1] < v) v = g[y0 + x1];
        if (g[y0 + x2] < v) v = g[y0 + x2];
        if (g[y1 + x0] < v) v = g[y1 + x0];
        if (g[y1 + x1] < v) v = g[y1 + x1];
        if (g[y1 + x2] < v) v = g[y1 + x2];
        if (g[y2 + x0] < v) v = g[y2 + x0];
        if (g[y2 + x1] < v) v = g[y2 + x1];
        if (g[y2 + x2] < v) v = g[y2 + x2];
      } else {
        if (g[y0 + x1] > v) v = g[y0 + x1];
        if (g[y0 + x2] > v) v = g[y0 + x2];
        if (g[y1 + x0] > v) v = g[y1 + x0];
        if (g[y1 + x1] > v) v = g[y1 + x1];
        if (g[y1 + x2] > v) v = g[y1 + x2];
        if (g[y2 + x0] > v) v = g[y2 + x0];
        if (g[y2 + x1] > v) v = g[y2 + x1];
        if (g[y2 + x2] > v) v = g[y2 + x2];
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

// 通用 3×3 线性卷积（钳制边界）：out = Σ k·g / div + off
function convolve3(g, w, h, k, div, off) {
  const out = new Uint8ClampedArray(g.length);
  for (let y = 0; y < h; y++) {
    const ym = (y > 0 ? y - 1 : 0) * w, yc = y * w, yp = (y < h - 1 ? y + 1 : h - 1) * w;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : 0, xp = x < w - 1 ? x + 1 : w - 1;
      const s =
        k[0] * g[ym + xm] + k[1] * g[ym + x] + k[2] * g[ym + xp] +
        k[3] * g[yc + xm] + k[4] * g[yc + x] + k[5] * g[yc + xp] +
        k[6] * g[yp + xm] + k[7] * g[yp + x] + k[8] * g[yp + xp];
      const v = s / div + off;
      out[y * w + x] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return out;
}

// Sobel：Gx/Gy 两个核对称差分算子，梯度幅值 |∇| = √(Gx²+Gy²)。
// 这里把强边缘映射成“暗线在亮底上”，跟线稿约定一致。
function sobel(g, w, h) {
  const out = new Uint8ClampedArray(g.length);
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 0; y < h; y++) {
    const ym = (y > 0 ? y - 1 : 0) * w, yc = y * w, yp = (y < h - 1 ? y + 1 : h - 1) * w;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : 0, xp = x < w - 1 ? x + 1 : w - 1;
      const a = g[ym + xm], b = g[ym + x], c = g[ym + xp];
      const d = g[yc + xm], e = g[yc + x], f = g[yc + xp];
      const p = g[yp + xm], q = g[yp + x], r = g[yp + xp];
      const sx = (c + 2 * f + r) - (a + 2 * d + p);
      const sy = (p + 2 * q + r) - (a + 2 * b + c);
      const mag = Math.sqrt(sx * sx + sy * sy);
      const v = 255 - mag;
      out[y * w + x] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return out;
}

// 拉普拉斯（各向同性 8 邻域，中心 -8）：二阶导数边缘图，同样映射成暗线
function laplacian(g, w, h) {
  const out = new Uint8ClampedArray(g.length);
  for (let y = 0; y < h; y++) {
    const ym = (y > 0 ? y - 1 : 0) * w, yc = y * w, yp = (y < h - 1 ? y + 1 : h - 1) * w;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : 0, xp = x < w - 1 ? x + 1 : w - 1;
      const lap =
        g[ym + xm] + g[ym + x] + g[ym + xp] +
        g[yc + xm] - 8 * g[yc + x] + g[yc + xp] +
        g[yp + xm] + g[yp + x] + g[yp + xp];
      const v = 255 - Math.abs(lap);
      out[y * w + x] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return out;
}

function applyConv(g, w, h, kernel) {
  switch (kernel) {
    case 'gaussian': return convolve3(g, w, h, [1, 2, 1, 2, 4, 2, 1, 2, 1], 16, 0);
    case 'box': return convolve3(g, w, h, [1, 1, 1, 1, 1, 1, 1, 1, 1], 9, 0);
    case 'sharpen': return convolve3(g, w, h, [0, -1, 0, -1, 5, -1, 0, -1, 0], 1, 0);
    case 'sobel': return sobel(g, w, h);
    case 'laplacian': return laplacian(g, w, h);
    default: return g;
  }
}

// ---------- 本地抽线：双边滤波 → Scharr → 非极大值抑制 → 滞后阈值(Canny) ----------
// 全程不调模型、不花钱。目的是从照片里纯靠梯度找出「线条」，跟 AI 稿做对比。

// 双边滤波：邻域加权 = 空域高斯 × 值域高斯。既压掉明暗纹理，又保住强边缘不糊。
// sigmaS 越大越平滑；sigmaR 越大对灰度差越不敏感（保边变弱）。
function bilateral(g, w, h, sigmaS, sigmaR) {
  const out = new Float32Array(g.length);
  const rS = Math.max(1, Math.round(2 * sigmaS));
  const ss = 2 * sigmaS * sigmaS;
  const sr = 2 * sigmaR * sigmaR;
  const cs = new Float32Array(2 * rS + 1); // 空域核（可分离）
  for (let d = -rS; d <= rS; d++) cs[d + rS] = Math.exp(-(d * d) / ss);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const center = g[y * w + x];
      let sum = 0, wsum = 0;
      for (let dy = -rS; dy <= rS; dy++) {
        const yy = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        const wy = cs[dy + rS];
        const row = yy * w;
        for (let dx = -rS; dx <= rS; dx++) {
          const xx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
          const v = g[row + xx];
          const range = Math.exp(-((v - center) * (v - center)) / sr);
          const ww = wy * cs[dx + rS] * range;
          sum += ww * v;
          wsum += ww;
        }
      }
      out[y * w + x] = sum / wsum;
    }
  }
  return out;
}

// Scharr 梯度：比 Sobel 旋转对称性更好，返回幅值 mag 和角度 ang（弧度）。
function scharr(g, w, h) {
  const mag = new Float32Array(g.length);
  const ang = new Float32Array(g.length);
  for (let y = 0; y < h; y++) {
    const ym = (y > 0 ? y - 1 : 0) * w, yc = y * w, yp = (y < h - 1 ? y + 1 : h - 1) * w;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : 0, xp = x < w - 1 ? x + 1 : w - 1;
      const a = g[ym + xm], b = g[ym + x], c = g[ym + xp];
      const d = g[yc + xm], f = g[yc + xp];
      const p = g[yp + xm], q = g[yp + x], r = g[yp + xp];
      const gx = 3 * (c + 2 * f + r - a - 2 * d - p);
      const gy = 3 * (p + 2 * q + r - a - 2 * b - c);
      const idx = yc + x;
      mag[idx] = Math.sqrt(gx * gx + gy * gy) / 16;
      ang[idx] = Math.atan2(gy, gx);
    }
  }
  return { mag, ang };
}

// 非极大值抑制：沿梯度方向比较，只保留局部最强的脊点 → 边缘变细成 1px
function nonMaxSuppress(mag, ang, w, h) {
  const out = new Float32Array(mag.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const m = mag[idx];
      const a = ang[idx];
      // 梯度方向 -> 取法线两侧邻域（把 22.5° 分箱到 0/45/90/135）
      const angle = (a * 180) / Math.PI;
      let d1x, d1y, d2x, d2y;
      const q = Math.round(angle / 45) * 45;
      if (q === 0 || q === 180 || q === -180) { d1x = 1; d1y = 0; d2x = -1; d2y = 0; }
      else if (q === 45 || q === -135) { d1x = 1; d1y = -1; d2x = -1; d2y = 1; }
      else if (q === 90 || q === -90) { d1x = 0; d1y = -1; d2x = 0; d2y = 1; }
      else { d1x = -1; d1y = -1; d2x = 1; d2y = 1; } // 135 / -45
      const cx = x + d1x < 0 ? 0 : x + d1x >= w ? w - 1 : x + d1x;
      const cy = y + d1y < 0 ? 0 : y + d1y >= h ? h - 1 : y + d1y;
      const ox = x + d2x < 0 ? 0 : x + d2x >= w ? w - 1 : x + d2x;
      const oy = y + d2y < 0 ? 0 : y + d2y >= h ? h - 1 : y + d2y;
      out[idx] = (m >= mag[cy * w + cx] && m >= mag[oy * w + ox]) ? m : 0;
    }
  }
  return out;
}

// 一幅图上算 Otsu 阈值（返回 0..255），用于自动定边缘强/弱阈值
function otsuThreshold(g) {
  const hist = new Int32Array(256);
  for (let i = 0; i < g.length; i++) hist[Math.round(g[i]) > 255 ? 255 : g[i] < 0 ? 0 : Math.round(g[i])]++;
  const total = g.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, maxVar = -1, thresh = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) { maxVar = between; thresh = t; }
  }
  return thresh;
}

// 滞后双阈值 + 8 邻域连通（栈做 flood fill，避免递归爆栈）：
// 强边缘留，弱边缘只有连到强边缘才留 → 抑制孤立杂点、留住连续淡线
function hysteresis(nms, w, h, hi, lo) {
  const out = new Uint8Array(nms.length); // 1=最终边缘
  const stack = new Int32Array(nms.length);
  let sp = 0;
  for (let i = 0; i < nms.length; i++) {
    if (nms[i] >= hi) { out[i] = 1; stack[sp++] = i; }
    else out[i] = nms[i] >= lo ? 2 : 0; // 2=候选弱边缘
  }
  while (sp > 0) {
    const i = stack[--sp];
    const y = (i / w) | 0, x = i - y * w;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const j = yy * w + xx;
        if (out[j] === 2) { out[j] = 1; stack[sp++] = j; }
      }
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = out[i] === 1 ? 1 : 0;
  return out;
}

// 把二值边缘画成「暗线在亮底」的线稿 canvas；thicken = 膨胀次数（3×3 方核，每次加粗 1px）
function edgesToCanvas(edge, w, h, thicken) {
  let g = new Uint8ClampedArray(w * h);
  for (let i = 0; i < g.length; i++) g[i] = edge[i] ? 0 : 255; // 1 → 黑线
  for (let t = 0; t < thicken; t++) g = morphFilter(g, w, h, 'dilate');
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const id = ctx.createImageData(w, h);
  writeGrayBack(id, g);
  ctx.putImageData(id, 0, 0);
  return canvas;
}

// 一键本地抽线，结果塞进 state.lineart（之后可照常叠格子、导出）
function buildLocalLineart() {
  const src = state.original;
  if (!src) return null;
  const { w, h } = dims(src);
  const scale = Math.min(1, MAX_LOCAL_SIDE / Math.max(w, h));
  const canvas = canvasOf(src, scale);
  const ctx = canvas.getContext('2d');
  const cw = canvas.width, ch = canvas.height;
  const id = ctx.getImageData(0, 0, cw, ch);
  let g = toGrayFloat(id);
  const smooth = dom.extractSmooth.checked;
  if (smooth) g = bilateral(g, cw, ch, 1.5, Number(dom.extractSigma.value)); // 压纹理、保强边
  const { mag, ang } = scharr(g, cw, ch);       // 梯度幅值 + 方向
  const nms = nonMaxSuppress(mag, ang, cw, ch); // 细化成 1px 脊线
  let hi, lo, auto = 0;
  if (dom.extractAuto.checked) {
    auto = otsuThreshold(nms);
    // Otsu 分的是「有脊线 / 无脊线」两类，直接当高阈会太狠、把柔和明暗边整条丢掉，
    // 所以按 Canny 惯例降一档：高阈 = 0.6×Otsu，低阈 = 高阈的 40%
    hi = Math.max(8, auto * 0.6);
    lo = Math.max(3, hi * 0.4);
  } else {
    lo = Number(dom.extractLo.value);
    hi = Math.max(lo + 2, Number(dom.extractHi.value));
  }
  const edge = hysteresis(nms, cw, ch, hi, lo);
  const out = edgesToCanvas(edge, cw, ch, Number(dom.extractThick.value));
  state.lineart = out;
  state.lineartProc = null;
  return { canvas: out, lo, hi, auto };
}

function upscaleCanvas(canvas, scale) {
  if (scale === 1) return canvas;
  const out = document.createElement('canvas');
  out.width = canvas.width * scale;
  out.height = canvas.height * scale;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

// 自动裁白边：找非白内容的包围盒（治 Qwen 上下加的大白边）
function trimCanvas(canvas, tol) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const g = toGray(ctx.getImageData(0, 0, w, h));
  const limit = 255 - tol;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (g[row + x] < limit) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return canvas;
  const padX = Math.round((maxX - minX + 1) * 0.02) + 4;
  const padY = Math.round((maxY - minY + 1) * 0.02) + 4;
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(w - 1, maxX + padX);
  maxY = Math.min(h - 1, maxY + padY);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d').drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
  return out;
}

function readPipeline() {
  return {
    convKernel: dom.convKernel.value,
    trim: dom.trim.checked,
    trimTol: Number(dom.trimTol.value),
    denoise: dom.denoise.checked,
    medianK: Number(dom.medianK.value),
    binarize: dom.binarize.checked,
    threshold: Number(dom.sharpenThreshold.value),
    morph: dom.morph.value,
    upscale: Number(dom.upscale.value),
  };
}

// 跑整条管线，结果存进 state.lineartProc；不碰模型、不花钱
function buildProcessedLineart() {
  state.lineartProc = null;
  const src = state.lineart || state.original;
  if (!src) return false;
  const s = readPipeline();
  let canvas = canvasOf(src, 1);
  // 空间卷积核放在最前（源尺寸、灰度），后面各步在它的结果上继续
  if (s.convKernel !== 'none') {
    const cctx = canvas.getContext('2d');
    const cid = cctx.getImageData(0, 0, canvas.width, canvas.height);
    writeGrayBack(cid, applyConv(toGray(cid), canvas.width, canvas.height, s.convKernel));
    cctx.putImageData(cid, 0, 0);
  }
  // 先去噪再裁边：否则靠近边缘的杂点会把包围盒撑大，裁不掉
  if (s.denoise) {
    const dctx = canvas.getContext('2d');
    const did = dctx.getImageData(0, 0, canvas.width, canvas.height);
    writeGrayBack(did, medianFilter(toGray(did), canvas.width, canvas.height, s.medianK));
    dctx.putImageData(did, 0, 0);
  }
  if (s.trim) canvas = trimCanvas(canvas, s.trimTol);
  canvas = upscaleCanvas(canvas, s.upscale);
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const id = ctx.getImageData(0, 0, w, h);
  let g = toGray(id);
  if (s.binarize) {
    const soft = 45;
    const lo = s.threshold - soft;
    const range = soft * 2;
    for (let p = 0; p < g.length; p++) {
      let v = ((g[p] - lo) * 255) / range;
      g[p] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  if (s.morph === 'open') {
    g = morphFilter(morphFilter(g, w, h, 'erode'), w, h, 'dilate');
  } else if (s.morph === 'close') {
    g = morphFilter(morphFilter(g, w, h, 'dilate'), w, h, 'erode');
  } else if (s.morph !== 'none') {
    g = morphFilter(g, w, h, s.morph);
  }
  writeGrayBack(id, g);
  ctx.putImageData(id, 0, 0);
  state.lineartProc = canvas;
  return true;
}

function lineartImg() {
  return state.lineartProc || state.lineart;
}

// 按输入比例请求模型出大图（长边 2048），比例失真超过 2% 就不强制
function sizeHint() {
  const d = state.uploadDims;
  if (!d) return '';
  const long = Math.max(d.w, d.h);
  const target = 2048;
  let w = Math.round((d.w * target) / long);
  let h = Math.round((d.h * target) / long);
  w = Math.min(2048, Math.max(512, w));
  h = Math.min(2048, Math.max(512, h));
  if (Math.abs((w / h) / (d.w / d.h) - 1) > 0.02) return '';
  return `${w}*${h}`;
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
    drawScene(dom.rightCanvas, lineartImg(), settings);
    return;
  }

  const img = mode === 'original' ? state.original : lineartImg() || state.original;
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
    state.lineartProc = null;
    state.fileName = (file.name || 'image').replace(/\.[^.]+$/, '');
    const ratio = Math.min(1, MAX_UPLOAD_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    state.uploadDims = {
      w: Math.round(img.naturalWidth * ratio),
      h: Math.round(img.naturalHeight * ratio),
    };
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
        size: sizeHint(),
        fileName: state.fileName,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
    state.lineart = await loadImage(data.image);
    state.lineartProc = null;
    dom.mode.value = 'lineart';
    setStatus(
      `线稿已生成并存入线稿库（原始，未处理），用时 ${((Date.now() - started) / 1000).toFixed(1)} 秒。之后随时从第 7 组取用，本地处理不花钱。`,
      'ok'
    );
    render();
    refreshGallery();
  } catch (err) {
    setStatus(err.message || '生成失败', 'error');
  } finally {
    dom.convertBtn.disabled = false;
    dom.loading.hidden = true;
  }
}

function downloadCanvas(canvas, name) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function exportCanvas(img, withGrid, suffix) {
  if (!img) {
    setStatus('没有可导出的图片', 'error');
    return;
  }
  const settings = readSettings();
  const canvas = document.createElement('canvas');
  drawScene(canvas, img, { ...settings, showGrid: withGrid });
  downloadCanvas(canvas, `${state.fileName}_${suffix}${settings.n}x${settings.n}.png`);
}

// 透明背景只留格线，打印出来垫在纸下或叠在别的图上都能用
function exportGridOnly() {
  const settings = readSettings();
  const img = state.lineart || state.original;
  const { sw, sh } = img ? cropRect(img, settings.square) : { sw: 2048, sh: 2048 };
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  drawGrid(canvas.getContext('2d'), sw, sh, settings);
  downloadCanvas(canvas, `${state.fileName}_空白网格_${settings.n}x${settings.n}.png`);
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

dom.extractSigma.addEventListener('input', () => {
  dom.extractSigmaValue.textContent = dom.extractSigma.value;
});
dom.extractLo.addEventListener('input', () => {
  dom.extractLoValue.textContent = dom.extractLo.value;
});
dom.extractHi.addEventListener('input', () => {
  dom.extractHiValue.textContent = dom.extractHi.value;
});

function syncExtractUi() {
  const manual = !dom.extractAuto.checked;
  dom.extractLo.disabled = !manual;
  dom.extractHi.disabled = !manual;
}
dom.extractAuto.addEventListener('change', syncExtractUi);
syncExtractUi();

dom.extractBtn.addEventListener('click', () => {
  if (!state.original) {
    setStatus('本地抽线要有原图：先在 1. 里放一张图片', 'error');
    return;
  }
  dom.extractBtn.disabled = true;
  setStatus('本地抽线中…（Canny 边缘检测，不调模型、不花钱）');
  setTimeout(() => {
    try {
      const r = buildLocalLineart();
      if (!r) {
        setStatus('本地抽线失败：没有原图', 'error');
        return;
      }
      dom.mode.value = 'lineart';
      render();
      setStatus(
        `本地抽线完成（${r.canvas.width}×${r.canvas.height}，低阈 ${r.lo.toFixed(0)} / 高阈 ${r.hi.toFixed(0)}${r.auto ? '，Otsu 自动' : ''}，免费）。` +
        '导出后可和 AI 稿对比：本地法线条更碎、纹理杂线多，AI 稿会替你简化。',
        'ok'
      );
    } catch (err) {
      setStatus(`本地抽线出错：${err.message}`, 'error');
    } finally {
      dom.extractBtn.disabled = false;
    }
  }, 30);
});

for (const input of [dom.gridN, dom.showGrid, dom.showLabels, dom.gridColor, dom.gridWidth, dom.gridOpacity, dom.squareCells, dom.mode]) {
  input.addEventListener('input', () => {
    dom.nValue.textContent = dom.gridN.value;
    dom.widthValue.textContent = dom.gridWidth.value;
    dom.opacityValue.textContent = `${dom.gridOpacity.value}%`;
    render();
  });
}

dom.exportLineart.addEventListener('click', () => exportCanvas(lineartImg(), false, '线稿_'));
dom.exportGrid.addEventListener('click', () => exportCanvas(lineartImg() || state.original, true, '线稿带格_'));
dom.exportOriginalGrid.addEventListener('click', () => exportCanvas(state.original, true, '原图带格_'));
dom.exportGridOnly.addEventListener('click', exportGridOnly);

// 滤波器控件只更新数字标签；真正生效靠「应用处理」按钮（本地免费，可反复）
dom.sharpenThreshold.addEventListener('input', () => {
  dom.sharpenValue.textContent = dom.sharpenThreshold.value;
});
dom.trimTol.addEventListener('input', () => {
  dom.trimValue.textContent = dom.trimTol.value;
});

dom.processBtn.addEventListener('click', () => {
  if (!state.lineart && !state.original) {
    setStatus('先载入图片或生成线稿，再应用处理', 'error');
    return;
  }
  dom.processBtn.disabled = true;
  setStatus('本地处理中…（不调模型，不花钱）');
  // 让“处理中”先绘制一帧再跑（中值滤波可能几百毫秒）
  setTimeout(() => {
    const ok = buildProcessedLineart();
    dom.processBtn.disabled = false;
    if (ok) {
      dom.mode.value = 'lineart';
      render();
      const d = state.lineartProc;
      setStatus(`处理完成（${d.width}×${d.height}，本地免费）。不满意可改参数再点一次。`, 'ok');
    }
  }, 30);
});

dom.resetProc.addEventListener('click', () => {
  state.lineartProc = null;
  render();
  setStatus('已清除处理结果，显示未处理的原始线稿。', 'ok');
});

let lastConfig = null;

function applyConfigBadge(cfg) {
  lastConfig = cfg;
  dom.modelBadge.textContent = cfg.ready ? `模型 ${cfg.model}` : '未配置 API Key';
  dom.modelBadge.className = `badge ${cfg.ready ? 'ok' : 'bad'}`;
  dom.convertBtn.disabled = !cfg.ready;
}

function openConfigModal() {
  dom.envPath.textContent = lastConfig?.envFile || '未知';
  dom.cfgModel.value = lastConfig?.model || '';
  dom.cfgKey.value = '';
  dom.cfgKey.type = 'password';
  dom.toggleKey.textContent = '显示';
  dom.cfgStatus.textContent = '';
  dom.configModal.hidden = false;
  dom.cfgKey.focus();
}

function closeConfigModal() {
  dom.configModal.hidden = true;
}

dom.modelBadge.addEventListener('click', openConfigModal);
dom.modelBadge.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openConfigModal();
  }
});
dom.cfgCancel.addEventListener('click', closeConfigModal);
dom.configModal.addEventListener('click', (e) => {
  if (e.target === dom.configModal) closeConfigModal();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !dom.configModal.hidden) closeConfigModal();
  if (e.key === 'Escape' && !dom.galleryPage.hidden) closeGallery();
});
dom.toggleKey.addEventListener('click', () => {
  const show = dom.cfgKey.type === 'password';
  dom.cfgKey.type = show ? 'text' : 'password';
  dom.toggleKey.textContent = show ? '隐藏' : '显示';
});
dom.cfgSave.addEventListener('click', async () => {
  const body = {};
  if (dom.cfgKey.value.trim()) body.apiKey = dom.cfgKey.value.trim();
  if (dom.cfgModel.value.trim()) body.model = dom.cfgModel.value.trim();
  if (!Object.keys(body).length) {
    dom.cfgStatus.textContent = 'key 和模型至少填一项';
    dom.cfgStatus.className = 'hint status error';
    return;
  }
  dom.cfgSave.disabled = true;
  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `保存失败 (${response.status})`);
    applyConfigBadge(data);
    closeConfigModal();
    setStatus('设置已保存并立即生效', 'ok');
  } catch (err) {
    dom.cfgStatus.textContent = err.message || '保存失败';
    dom.cfgStatus.className = 'hint status error';
  } finally {
    dom.cfgSave.disabled = false;
  }
});

fetch('/api/config')
  .then((r) => r.json())
  .then((cfg) => {
    applyConfigBadge(cfg);
    if (!cfg.ready) {
      setStatus('未检测到 API Key：点右上角「未配置 API Key」徽章，在弹窗里粘贴 key 保存即可，不用手动改 .env。也可以直接载入已有线稿叠格子。');
    }
  })
  .catch(() => {
    dom.modelBadge.textContent = '无法连接服务';
    dom.modelBadge.className = 'badge bad';
  });

// ---------- 6. 线稿库（AI 原稿存盘，免费复用） ----------
function galleryMsg(text, kind = '') {
  dom.galleryStatus.textContent = text;
  dom.galleryStatus.className = `hint status ${kind}`;
}

function imgToDataUrl(img) {
  const { w, h } = dims(img);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

function renderGallery(items) {
  const n = items.length;
  if (dom.galleryCount) dom.galleryCount.textContent = n;
  if (dom.galleryCountSidebar) dom.galleryCountSidebar.textContent = n;
  dom.galleryGrid.innerHTML = '';
  if (!n) {
    galleryMsg('库里还没有线稿。生成一次就会自动存进来。');
    return;
  }
  galleryMsg('');
  for (const it of items) {
    const card = document.createElement('div');
    card.className = 'gpcard';
    const img = document.createElement('img');
    img.src = `/api/gallery/${it.id}`;
    img.alt = it.name || '线稿';
    img.loading = 'lazy';
    img.title = '点击载入到编辑器（不花钱）';
    img.addEventListener('click', () => loadFromGallery(it));
    const when = new Date(it.createdAt);
    const pad = (x) => String(x).padStart(2, '0');
    const dateStr = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ${pad(when.getHours())}:${pad(when.getMinutes())}`;
    const meta = document.createElement('div');
    meta.className = 'gpmeta';
    const nameEl = document.createElement('div');
    nameEl.className = 'gpname';
    nameEl.textContent = it.name || '未命名';
    nameEl.title = it.name || '';
    const subEl = document.createElement('div');
    subEl.className = 'gpsub';
    subEl.textContent = it.model ? `${dateStr} · ${it.model}` : dateStr;
    meta.append(nameEl, subEl);
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'btn primary gpop';
    open.textContent = '载入';
    open.addEventListener('click', () => loadFromGallery(it));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn ghost gpdel';
    del.textContent = '删除';
    del.addEventListener('click', () => deleteFromGallery(it.id));
    const acts = document.createElement('div');
    acts.className = 'gpacts';
    acts.append(open, del);
    card.append(img, meta, acts);
    dom.galleryGrid.appendChild(card);
  }
}

function openGalleryPage() {
  dom.galleryPage.hidden = false;
  refreshGallery();
}

function closeGallery() {
  dom.galleryPage.hidden = true;
}

async function refreshGallery() {
  try {
    const r = await fetch('/api/gallery');
    const d = await r.json();
    renderGallery(d.items || []);
  } catch {
    galleryMsg('线稿库读取失败', 'error');
  }
}

async function loadFromGallery(it) {
  try {
    const img = await loadImage(`/api/gallery/${it.id}`);
    state.lineart = img;
    state.lineartProc = null;
    state.fileName = it.name || '线稿';
    dom.mode.value = 'lineart';
    setStatus(`已从线稿库载入「${it.name || '未命名'}」，去第 4 组本地处理，不花钱。`, 'ok');
    render();
    closeGallery();
  } catch (err) {
    galleryMsg(`载入失败：${err.message}`, 'error');
  }
}

async function deleteFromGallery(id) {
  try {
    const r = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || '删除失败');
    renderGallery(d.items || []);
    galleryMsg('已删除。', 'ok');
  } catch (err) {
    galleryMsg(err.message, 'error');
  }
}

async function saveCurrentToGallery() {
  const img = lineartImg();
  if (!img) {
    galleryMsg('没有可存入的线稿', 'error');
    return;
  }
  let dataUrl;
  try {
    dataUrl = img instanceof HTMLCanvasElement ? img.toDataURL('image/png') : imgToDataUrl(img);
  } catch (err) {
    galleryMsg(`读取图像失败：${err.message}`, 'error');
    return;
  }
  dom.saveToGallery.disabled = true;
  try {
    const r = await fetch('/api/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl, name: state.fileName, prompt: dom.prompt.value, model: lastConfig?.model || '' }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || '存入失败');
    renderGallery(d.items || []);
    galleryMsg('已存入线稿库。', 'ok');
  } catch (err) {
    galleryMsg(err.message, 'error');
  } finally {
    dom.saveToGallery.disabled = false;
  }
}

dom.saveToGallery.addEventListener('click', saveCurrentToGallery);
dom.galleryRefresh.addEventListener('click', refreshGallery);
dom.openGallery.addEventListener('click', openGalleryPage);
dom.galleryBack.addEventListener('click', closeGallery);
refreshGallery();
