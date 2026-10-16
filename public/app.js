const DEFAULT_PROMPT =
  '把这张图片转成黑白线稿：纯白背景，只用清晰、干净、连续的黑色轮廓线勾出主体结构和主要细节，' +
  '严格保持原图的构图、比例和透视不变。去掉所有颜色、明暗调子、阴影、材质纹理和背景装饰，' +
  '线条粗细均匀，不要网格线、不要文字、不要水印。';
const DEFAULT_NEGATIVE = '彩色, 灰阶, 阴影, 明暗过渡, 色块, 背景, 纹理, 网格, 文字, 水印, 模糊, 噪点, 变形';
// 提临摹照片专用。模型天生想「把画修好看」，但这里要的是忠实还原用户画成什么样，
// 否则抖线被画直、断口被接上，叠上去对比就毫无意义 —— 所以「不许修正/美化/补线」写死在提示词里。
const PHOTO_PROMPT =
  '这是一张手机拍摄的手绘临摹照片（纸上有铅笔或钢笔线条）。只做一件事：把画面转成黑白线稿，纯白背景，只保留纸上已有的线条。' +
  '严格忠实原样：每一根线的位置、形状、长度、粗细、抖动、断口、画歪和画错的地方都必须原封不动保留；' +
  '绝对不要修正、不要美化、不要补全断线、不要加深或减淡、不要平滑、不要改变比例和透视、不要添加任何原图上没有的线条。' +
  '只去掉纸张颜色、光照不均、阴影、桌面背景和拍摄噪点。';
const PHOTO_NEGATIVE =
  '美化, 修正, 补线, 重绘, 加深, 加粗, 变细, 平滑, 完美线条, 彩色, 灰阶, 阴影, 背景, 纸张纹理, 桌面, 网格, 文字, 水印';
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
  extractMethod: el('extractMethod'),
  sauvolaOpts: el('sauvolaOpts'),
  cannyOpts: el('cannyOpts'),
  extractRadius: el('extractRadius'),
  extractRadiusValue: el('extractRadiusValue'),
  extractK: el('extractK'),
  extractKValue: el('extractKValue'),
  extractSkeleton: el('extractSkeleton'),
  extractSmooth: el('extractSmooth'),
  extractSigma: el('extractSigma'),
  extractSigmaValue: el('extractSigmaValue'),
  extractAuto: el('extractAuto'),
  extractLo: el('extractLo'),
  extractLoValue: el('extractLoValue'),
  extractHi: el('extractHi'),
  extractHiValue: el('extractHiValue'),
  extractThick: el('extractThick'),
  extractMinLen: el('extractMinLen'),
  extractMinLenValue: el('extractMinLenValue'),
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
  morphIter: el('morphIter'),
  morphIterValue: el('morphIterValue'),
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
  photoInput: el('photoInput'),
  photoInfo: el('photoInfo'),
  photoMethod: el('photoMethod'),
  aiWarn: el('aiWarn'),
  photoProcess: el('photoProcess'),
  photoClear: el('photoClear'),
  overlayMode: el('overlayMode'),
  overlayRefColor: el('overlayRefColor'),
  overlayPhotoColor: el('overlayPhotoColor'),
  overlayOpacity: el('overlayOpacity'),
  overlayOpacityValue: el('overlayOpacityValue'),
  overlaySel: el('overlaySel'),
  tfX: el('tfX'),
  tfXValue: el('tfXValue'),
  tfY: el('tfY'),
  tfYValue: el('tfYValue'),
  tfScale: el('tfScale'),
  tfScaleValue: el('tfScaleValue'),
  tfRot: el('tfRot'),
  tfRotValue: el('tfRotValue'),
  tfMatch: el('tfMatch'),
  tfReset: el('tfReset'),
  tfResetAll: el('tfResetAll'),
  exportOverlay: el('exportOverlay'),
  exportLineart: el('exportLineart'),
  exportGrid: el('exportGrid'),
  exportOriginalGrid: el('exportOriginalGrid'),
  exportGridOnly: el('exportGridOnly'),
  empty: el('empty'),
  singleView: el('singleView'),
  compareView: el('compareView'),
  mainCanvas: el('mainCanvas'),
  viewport: el('viewport'),
  zoomIn: el('zoomIn'),
  zoomOut: el('zoomOut'),
  zoomFit: el('zoomFit'),
  zoomReal: el('zoomReal'),
  zoomValue: el('zoomValue'),
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

const newTransform = () => ({ x: 0, y: 0, scale: 1, rot: 0 });

const state = {
  original: null,
  lineart: null,
  lineartProc: null,
  uploadDataUrl: null,
  uploadDims: null,
  fileName: 'image',
  zoom: null, // null = 适应窗口；数字 = 屏幕像素 / 画布像素
  photo: null,      // 手机拍的临摹照（原样）
  photoName: '',    // 照片文件名，只显示用
  photoLine: null,  // 当前用来叠的提墨稿；null = 没提墨，直接用照片
  photoAiLine: null, // 花钱提过的那一张，单独存着：切去本地再切回来不用重复付费
  flashRef: false,  // 空格按住 → 只显示原图层
  tf: { ref: newTransform(), photo: newTransform() },
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

// ---------- 本地抽线 A：Canny 边缘（双边滤波 → Scharr → 非极大值抑制 → 滞后阈值）----------
// 全程不调模型、不花钱。靠梯度找「像素突变」，适合照片；软笔会裂成两条描边（提墨那条路更适合手绘）。

// 双边滤波：邻域加权 = 空域高斯 × 值域高斯。既压掉明暗纹理，又保住强边缘不糊。
// sigmaS 越大越平滑；sigmaR 越大对灰度差越不敏感（保边变弱）。
// 权重全查表：内层循环一次 Math.exp 都没有，否则 1600×1120×49 次 exp 会卡死主线程。
function bilateral(g, w, h, sigmaS, sigmaR) {
  const out = new Float32Array(g.length);
  const rS = Math.max(1, Math.round(2 * sigmaS));
  const size = 2 * rS + 1;
  const ss = 2 * sigmaS * sigmaS;
  const sr = 2 * sigmaR * sigmaR;
  const sp = new Float32Array(size * size);
  for (let dy = -rS; dy <= rS; dy++) {
    for (let dx = -rS; dx <= rS; dx++) {
      sp[(dy + rS) * size + (dx + rS)] = Math.exp(-(dx * dx + dy * dy) / ss);
    }
  }
  const rangeLut = new Float32Array(257);
  for (let d = 0; d <= 256; d++) rangeLut[d] = Math.exp(-(d * d) / sr);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const center = g[y * w + x];
      let sum = 0, wsum = 0;
      for (let dy = -rS; dy <= rS; dy++) {
        const yy = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        const row = yy * w;
        const srow = (dy + rS) * size;
        for (let dx = -rS; dx <= rS; dx++) {
          const xx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
          const v = g[row + xx];
          let ad = v - center;
          if (ad < 0) ad = -ad;
          const ww = sp[srow + dx + rS] * rangeLut[ad > 256 ? 256 : ad | 0];
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
// 强边缘留，弱边缘只有连到强边缘才留 → 抑制孤立杂点、留住连续淡线。
// minLen：连通域像素数小于它就整块丢掉 —— 专门治纹理碎边变成的黑点。
function hysteresis(nms, w, h, hi, lo, minLen) {
  const out = new Uint8Array(nms.length); // 1=最终边缘
  const comp = new Int32Array(nms.length).fill(-1);
  const stack = new Int32Array(nms.length);
  const sizes = [];
  let cid = 0;
  for (let i = 0; i < nms.length; i++) {
    if (nms[i] < hi || comp[i] >= 0) continue; // 从每个未归块的强种子开一个新连通域
    let sp = 0;
    let size = 0;
    out[i] = 1;
    comp[i] = cid;
    stack[sp++] = i;
    while (sp > 0) {
      const p = stack[--sp];
      size++;
      const y = (p / w) | 0, x = p - y * w;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (comp[j] < 0 && nms[j] >= lo) { out[j] = 1; comp[j] = cid; stack[sp++] = j; }
        }
      }
    }
    sizes[cid] = size;
    cid++;
  }
  const keep = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) {
    if (out[i] && sizes[comp[i]] >= minLen) keep[i] = 1;
  }
  return keep;
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

// ---------- Sauvola 自适应阈值：提「比局部背景更黑的墨」，适合手绘 / 纸扫描的线稿 ----------
// 全局阈值（Otsu 那种）遇到纸面明暗不匀会一整片误判。Sauvola 让每个像素跟自己的邻域比：
//   t = mean · (1 + k·(std/R − 1))，R = 128，g < t 算墨
// 邻域 mean/std 用积分图 O(1) 查，整幅只多两趟线性扫描。
function sauvolaMask(g, w, h, radius, k) {
  const R = 128;
  const stride = w + 1;
  // 积分图带一圈 0 边方便做矩形和；求和必须 Float64：255×1.8M 已超 Float32 的精确整数范围
  const isum = new Float64Array(stride * (h + 1));
  const isq = new Float64Array(stride * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rowSum = 0, rowSq = 0;
    const cur = y * stride, prev = (y - 1) * stride, grow = (y - 1) * w;
    for (let x = 1; x <= w; x++) {
      const v = g[grow + x - 1];
      rowSum += v;
      rowSq += v * v;
      isum[cur + x] = isum[prev + x] + rowSum;
      isq[cur + x] = isq[prev + x] + rowSq;
    }
  }
  const mask = new Uint8Array(g.length);
  for (let y = 0; y < h; y++) {
    const y0 = y - radius < 0 ? 0 : y - radius;
    const y1 = y + radius > h - 1 ? h - 1 : y + radius;
    const top = y0 * stride, bot = (y1 + 1) * stride;
    const hh = y1 - y0 + 1;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const x0 = x - radius < 0 ? 0 : x - radius;
      const x1 = x + radius > w - 1 ? w - 1 : x + radius;
      const cnt = hh * (x1 - x0 + 1);
      const s = isum[bot + x1 + 1] - isum[top + x1 + 1] - isum[bot + x0] + isum[top + x0];
      const sq = isq[bot + x1 + 1] - isq[top + x1 + 1] - isq[bot + x0] + isq[top + x0];
      const mean = s / cnt;
      const varr = sq / cnt - mean * mean;
      const std = varr > 0 ? Math.sqrt(varr) : 0;
      mask[row + x] = g[row + x] < mean * (1 + k * (std / R - 1)) ? 1 : 0;
    }
  }
  return mask;
}

// 8 邻域连通域尺寸过滤：像素数 < minLen 的整块丢掉（治墨点、纸屑、断头碎块）
function dropSmall(mask, w, h, minLen) {
  if (minLen <= 1) return mask;
  const comp = new Int32Array(mask.length).fill(-1);
  const stack = new Int32Array(mask.length);
  const sizes = [];
  let cid = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || comp[i] >= 0) continue;
    let sp = 0, size = 0;
    comp[i] = cid;
    stack[sp++] = i;
    while (sp > 0) {
      const p = stack[--sp];
      size++;
      const y = (p / w) | 0, x = p - y * w;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (mask[j] && comp[j] < 0) { comp[j] = cid; stack[sp++] = j; }
        }
      }
    }
    sizes[cid] = size;
    cid++;
  }
  const keep = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] && sizes[comp[i]] >= minLen) keep[i] = 1;
  }
  return keep;
}

// Zhang-Suen 细化：两轮子迭代各自删「可删点」（邻域 2..6 个前景、0→1 跳变恰好 1 次、
// 再按四个方向的条件放行），反复啃掉笔画外圈，最后只剩 1px 中线。实心粗笔变单线就靠它。
function zhangSuen(mask, w, h) {
  let cur = mask.slice();
  for (let iter = 0; iter < 300; iter++) {
    let any = false;
    for (let sub = 1; sub <= 2; sub++) {
      const del = [];
      for (let y = 1; y < h - 1; y++) {
        const row = y * w;
        for (let x = 1; x < w - 1; x++) {
          const p = row + x;
          if (!cur[p]) continue;
          const P2 = cur[p - w], P3 = cur[p - w + 1], P4 = cur[p + 1], P5 = cur[p + w + 1];
          const P6 = cur[p + w], P7 = cur[p + w - 1], P8 = cur[p - 1], P9 = cur[p - w - 1];
          const B = P2 + P3 + P4 + P5 + P6 + P7 + P8 + P9;
          if (B < 2 || B > 6) continue;
          const A =
            (P2 === 0 && P3 === 1) + (P3 === 0 && P4 === 1) +
            (P4 === 0 && P5 === 1) + (P5 === 0 && P6 === 1) +
            (P6 === 0 && P7 === 1) + (P7 === 0 && P8 === 1) +
            (P8 === 0 && P9 === 1) + (P9 === 0 && P2 === 1);
          if (A !== 1) continue;
          if (sub === 1 ? (P2 * P4 * P6 !== 0 || P4 * P6 * P8 !== 0)
                        : (P2 * P4 * P8 !== 0 || P2 * P6 * P8 !== 0)) continue;
          del.push(p);
        }
      }
      if (del.length) { any = true; for (const p of del) cur[p] = 0; }
    }
    if (!any) break;
  }
  return cur;
}

function readExtractOpts() {
  return {
    method: dom.extractMethod.value,
    radius: Number(dom.extractRadius.value),
    k: Number(dom.extractK.value),
    skeleton: dom.extractSkeleton.checked,
    smooth: dom.extractSmooth.checked,
    sigma: Number(dom.extractSigma.value),
    auto: dom.extractAuto.checked,
    lo: Number(dom.extractLo.value),
    hi: Number(dom.extractHi.value),
    minLen: Number(dom.extractMinLen.value),
    thicken: Number(dom.extractThick.value),
  };
}

// 纯函数：任意图 → 线稿 canvas。第 3 组（原图抽线）和第 6 组（临摹照片提墨）共用。
// 里面不许碰 state，否则两条路会互相覆盖对方的结果。
function extractInk(src, o) {
  const { w, h } = dims(src);
  const scale = Math.min(1, MAX_LOCAL_SIDE / Math.max(w, h));
  const canvas = canvasOf(src, scale);
  const ctx = canvas.getContext('2d');
  const cw = canvas.width, ch = canvas.height;
  const g = toGrayFloat(ctx.getImageData(0, 0, cw, ch));
  let out, detail, tip;

  if (o.method === 'sauvola') {
    let mask = dropSmall(sauvolaMask(g, cw, ch, o.radius, o.k), cw, ch, o.minLen);
    if (o.skeleton) mask = zhangSuen(mask, cw, ch);
    out = edgesToCanvas(mask, cw, ch, o.thicken);
    detail = `Sauvola 提墨，窗口半径 ${o.radius}，k ${o.k.toFixed(2)}，${o.skeleton ? '已骨架化' : '实心墨块'}`;
    tip = '淡线提不到：k 调小或窗口半径调大（半径要大于笔宽）。纸面阴影被整片提出来：k 调大。想要墨色浓淡：关骨架、线宽 1px。';
  } else {
    let gs = g;
    if (o.smooth) gs = bilateral(gs, cw, ch, 1.5, o.sigma);
    const { mag, ang } = scharr(gs, cw, ch);
    const nms = nonMaxSuppress(mag, ang, cw, ch);
    let hi, lo, auto = 0;
    if (o.auto) {
      auto = otsuThreshold(nms);
      // Otsu 分的是「有脊线 / 无脊线」两类，直接当高阈会太狠、把柔和明暗边整条丢掉，
      // 所以按 Canny 惯例降一档：高阈 = 0.6×Otsu，低阈 = 高阈的 40%
      hi = Math.max(8, auto * 0.6);
      lo = Math.max(3, hi * 0.4);
    } else {
      lo = o.lo;
      hi = Math.max(lo + 2, o.hi);
    }
    out = edgesToCanvas(hysteresis(nms, cw, ch, hi, lo, o.minLen), cw, ch, o.thicken);
    detail = `Canny 边缘，低阈 ${lo.toFixed(0)} / 高阈 ${hi.toFixed(0)}${auto ? '，Otsu 自动' : ''}`;
    tip = '黑点还多就把「最短笔画」往上调、或加大值域 σ；软笔裂成两条描边就改用「提墨」方法。';
  }
  return { canvas: out, detail, tip };
}

// 一键本地抽线，结果塞进 state.lineart（之后可照常叠格子、导出）
function buildLocalLineart() {
  if (!state.original) return null;
  const r = extractInk(state.original, readExtractOpts());
  state.lineart = r.canvas;
  state.lineartProc = null;
  return r;
}

// 临摹照片提墨：结果进 state.photoLine，绝不碰 state.lineart（那是参考原图）
// local 免费同步跑；none 直接用照片；ai 花钱，只能由按钮显式触发，这里绝不自动调
function processPhoto() {
  if (!state.photo) return null;
  const method = dom.photoMethod.value;
  prepPhoto = null; // 换了提墨稿，叠加层的逐像素缓存作废
  if (method === 'ai') {
    state.photoLine = state.photoAiLine; // 花钱提过的单独存着，切去本地再切回来直接复用
    return null;
  }
  if (method === 'none') {
    state.photoLine = null;
    return null;
  }
  const r = extractInk(state.photo, readExtractOpts());
  state.photoLine = r.canvas;
  return r;
}

// 现在叠着的这张是不是花钱提来的
function photoIsAi() {
  return Boolean(state.photoLine) && state.photoLine === state.photoAiLine;
}

// AI 提墨要重传照片：长边压到 2048、存成 JPEG（照片用 PNG 能有好几 MB，白等）
function photoUploadUrl(img) {
  const { w, h } = dims(img);
  const ratio = Math.min(1, MAX_UPLOAD_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * ratio));
  canvas.height = Math.max(1, Math.round(h * ratio));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

// 第 6 组唯一花钱的一步：按张计费，所以必须显式点按钮，且结果自动入库供复用
async function aiExtractPhoto() {
  if (!state.photo) {
    setStatus('还没有临摹照片，先在上面选一张。', 'error');
    return;
  }
  dom.photoProcess.disabled = true;
  dom.loading.hidden = false;
  setStatus('AI 提墨中…（这一步花钱，按张计费；完成后自动存进线稿库，之后复用不再花钱）');
  const started = Date.now();
  try {
    const response = await fetch('/api/lineart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: photoUploadUrl(state.photo),
        prompt: PHOTO_PROMPT,
        negativePrompt: PHOTO_NEGATIVE,
        size: sizeHintFor(dims(state.photo)),
        fileName: `${state.fileName}_临摹`,
        kind: 'photo',
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
    state.photoLine = await loadImage(data.image);
    state.photoAiLine = state.photoLine;
    prepPhoto = null;
    dom.mode.value = 'overlay';
    refreshPhotoInfo(`${((Date.now() - started) / 1000).toFixed(1)} 秒`);
    setStatus(
      'AI 提墨完成，已存入线稿库（标「照片」），之后从库里载入不再花钱。' +
      '注意它可能把线画「顺」了一点，看着失真就切回本地提墨。',
      'ok'
    );
    render();
    refreshGallery();
  } catch (err) {
    setStatus(err.message || 'AI 提墨失败', 'error');
  } finally {
    dom.photoProcess.disabled = false;
    dom.loading.hidden = true;
  }
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
    morphIter: Math.max(1, Number(dom.morphIter.value) || 1),
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
  // 形态学：核是 3×3（每次只啃 1px），所以「次数」就是结构元的半径。
  // 闭运算 = 膨胀 m 次 → 腐蚀 m 次：能填掉宽 ≤ 2m px 的白缝/白洞，而线宽基本还原。
  if (s.morph === 'open' || s.morph === 'close') {
    const first = s.morph === 'open' ? 'erode' : 'dilate';
    const second = s.morph === 'open' ? 'dilate' : 'erode';
    for (let i = 0; i < s.morphIter; i++) g = morphFilter(g, w, h, first);
    for (let i = 0; i < s.morphIter; i++) g = morphFilter(g, w, h, second);
  } else if (s.morph !== 'none') {
    for (let i = 0; i < s.morphIter; i++) g = morphFilter(g, w, h, s.morph);
  }
  writeGrayBack(id, g);
  ctx.putImageData(id, 0, 0);
  state.lineartProc = canvas;
  return true;
}

function lineartImg() {
  return state.lineartProc || state.lineart;
}

// ---------- 叠加对比：临摹照片 vs 原图 ----------
// 白变透明不用阈值化（会把淡笔弄断、还留白边），而是 alpha 反推：alpha = 255 − 灰度，RGB 固定成层色。
// 浅灰笔画自然变淡，浓淡保住，叠上去也没有白晕。
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0x111111;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function inkify(img, color) {
  const { w, h } = dims(img);
  const src = canvasOf(img, 1);
  const id = src.getContext('2d').getImageData(0, 0, w, h);
  const d = id.data;
  const [r, g, b] = hexToRgb(color);
  for (let p = 0, i = 0; p < d.length >> 2; p++, i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
    d[i + 3] = 255 - gray; // 白 → 全透明，墨 → 不透明，灰边自然过渡
  }
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d').putImageData(id, 0, 0);
  return out;
}

// 差值模式要的是「墨在白底」的灰度图（不是透明），这样两张相减后重合处才是 0
function grayCanvas(img) {
  const { w, h } = dims(img);
  const src = canvasOf(img, 1);
  const id = src.getContext('2d').getImageData(0, 0, w, h);
  writeGrayBack(id, toGray(id));
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d').putImageData(id, 0, 0);
  return out;
}

// 以画布中心为原点：平移 → 旋转 → 缩放。两层各自独立，动哪层都不影响另一层。
function drawLayer(ctx, img, tf, bw, bh) {
  const { w, h } = dims(img);
  ctx.save();
  ctx.translate(bw / 2 + tf.x, bh / 2 + tf.y);
  ctx.rotate((tf.rot * Math.PI) / 180);
  ctx.scale(tf.scale, tf.scale);
  ctx.drawImage(img, -w / 2, -h / 2);
  ctx.restore();
}

function overlayRefImg() {
  return lineartImg() || state.original;
}
function overlayPhotoImg() {
  return state.photoLine || state.photo;
}

// 拖动时每帧都重画，逐像素的 inkify/grayCanvas 太贵，按 (源图, 模式, 颜色) 缓存
let prepRef = null;
let prepPhoto = null;
function prepLayer(which) {
  const mode = dom.overlayMode.value;
  const src = which === 'ref' ? overlayRefImg() : overlayPhotoImg();
  if (!src) return null;
  const color = which === 'ref' ? dom.overlayRefColor.value : dom.overlayPhotoColor.value;
  const cached = which === 'ref' ? prepRef : prepPhoto;
  if (cached && cached.src === src && cached.mode === mode && cached.color === color) return cached.out;
  const out = mode === 'diff' ? grayCanvas(src) : inkify(src, color);
  const rec = { src, mode, color, out };
  if (which === 'ref') prepRef = rec; else prepPhoto = rec;
  return out;
}

function buildOverlayCanvas() {
  const ref = overlayRefImg();
  const photo = overlayPhotoImg();
  if (!ref || !photo) return null;
  const { w: bw, h: bh } = dims(ref); // 画布 = 原图尺寸，格子和导出都按它算
  const cv = document.createElement('canvas');
  cv.width = bw; cv.height = bh;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, bw, bh);
  const mode = dom.overlayMode.value;

  if (mode === 'flash') {
    const only = state.flashRef ? 'ref' : 'photo';
    drawLayer(ctx, prepLayer(only), state.tf[only], bw, bh);
    return cv;
  }
  if (mode === 'diff') {
    // 两张都铺满白底再相减：|A−B|，重合=黑、错位=亮。
    // 必须各自先画到不透明画布上，否则照片边框外的透明区会留下原图的暗线，看着像错位。
    const a = document.createElement('canvas');
    a.width = bw; a.height = bh;
    const ac = a.getContext('2d');
    ac.fillStyle = '#ffffff'; ac.fillRect(0, 0, bw, bh);
    drawLayer(ac, prepLayer('ref'), state.tf.ref, bw, bh);
    const b = document.createElement('canvas');
    b.width = bw; b.height = bh;
    const bc = b.getContext('2d');
    bc.fillStyle = '#ffffff'; bc.fillRect(0, 0, bw, bh);
    drawLayer(bc, prepLayer('photo'), state.tf.photo, bw, bh);
    ctx.drawImage(a, 0, 0);
    ctx.globalCompositeOperation = 'difference';
    ctx.drawImage(b, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    return cv;
  }
  drawLayer(ctx, prepLayer('ref'), state.tf.ref, bw, bh);
  ctx.globalAlpha = Number(dom.overlayOpacity.value) / 100;
  drawLayer(ctx, prepLayer('photo'), state.tf.photo, bw, bh);
  ctx.globalAlpha = 1;
  return cv;
}

// 墨迹包围盒。相机远近不同，两张图的画面尺寸没有可比性 —— 只有「墨迹占了多大范围」
// 才是同一个东西的大小，所以自动匹配大小要按这个算，不能按画布尺寸算。
const bboxCache = new WeakMap();
function inkBBox(img) {
  if (bboxCache.has(img)) return bboxCache.get(img);
  const { w, h } = dims(img);
  const s = Math.min(1, MAX_LOCAL_SIDE / Math.max(w, h)); // 大图先压，12MP 逐像素扫要几百毫秒
  const src = canvasOf(img, s);
  const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      const a = d[i + 3] / 255;
      if (a < 0.06) continue; // 全透明当纸
      const gray = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * a + 255 * (1 - a);
      if (gray >= 200) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const box = x1 < 0 ? null : { x0: x0 / s, y0: y0 / s, x1: (x1 + 1) / s, y1: (y1 + 1) / s };
  bboxCache.set(img, box);
  return box;
}

// 某一层的墨迹在输出画布上的位置和大小：把包围盒四个角过一遍 drawLayer 的变换，再取外接框
function layerBox(which) {
  const img = which === 'ref' ? overlayRefImg() : overlayPhotoImg();
  if (!img) return null;
  const box = inkBBox(img);
  if (!box) return null;
  const { w, h } = dims(img);
  const ref = overlayRefImg();
  const { w: bw, h: bh } = dims(ref);
  const tf = state.tf[which];
  const rad = (tf.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const px of [box.x0, box.x1]) {
    for (const py of [box.y0, box.y1]) {
      const dx = (px - w / 2) * tf.scale;
      const dy = (py - h / 2) * tf.scale;
      const X = bw / 2 + tf.x + dx * cos - dy * sin;
      const Y = bh / 2 + tf.y + dx * sin + dy * cos;
      if (X < x0) x0 = X;
      if (X > x1) x1 = X;
      if (Y < y0) y0 = Y;
      if (Y > y1) y1 = Y;
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// 缩放滑块的范围：写死 0.2~3 时，12MP 手机照配小参考图会缩不下去；
// 但也不能无脑放到 0.01~20，否则 1.0 附近没法精调。以「两层画布一样大」为基准各留 4× 余量。
function scaleRange() {
  const ref = overlayRefImg();
  const photo = overlayPhotoImg();
  if (!ref || !photo) return { min: 0.05, max: 5 };
  const r = Math.max(dims(ref).w, dims(ref).h) / Math.max(dims(photo).w, dims(photo).h);
  return { min: Math.min(0.05, r / 4), max: Math.max(5, r * 4) };
}

function clampScale(v) {
  const { min, max } = scaleRange();
  return Math.min(max, Math.max(min, v));
}

// 「自动匹配大小」：把选中层的墨迹缩放到和另一层一样大，并对齐两者中心
function matchSize() {
  const sel = dom.overlaySel.value;
  const other = sel === 'ref' ? 'photo' : 'ref';
  const a = layerBox(sel);
  const b = layerBox(other);
  if (!a || !b) {
    setStatus('两层都要有墨迹才能自动匹配大小（照片还没提墨、或者整张全白都不行）。', 'error');
    return;
  }
  const tf = state.tf[sel];
  const from = { w: a.w, h: a.h };
  // 拍照带角度时宽高比不可能一致，取几何平均折中
  tf.scale = clampScale(tf.scale * Math.sqrt((b.w * b.h) / (a.w * a.h)));
  const a2 = layerBox(sel); // 缩放绕的是画布中心，中心会跟着跑，所以要重算一次再补平移
  tf.x += b.cx - a2.cx;
  tf.y += b.cy - a2.cy;
  syncTfUi();
  render();
  setStatus(
    `已把${sel === 'photo' ? '照片' : '原图'}层缩放 ${tf.scale.toFixed(3)}×` +
    `（墨迹 ${Math.round(from.w)}×${Math.round(from.h)} → ${Math.round(a2.w)}×${Math.round(a2.h)}，目标 ${Math.round(b.w)}×${Math.round(b.h)}）并对齐中心。` +
    '照片带角度时包围盒会偏大，所以先把旋转调正、再点一次本按钮，缩放才准。',
    'ok'
  );
}

// 按输入比例请求模型出大图（长边 2048），比例失真超过 2% 就不强制
function sizeHintFor(d) {
  if (!d || !d.w || !d.h) return '';
  const long = Math.max(d.w, d.h);
  const target = 2048;
  let w = Math.round((d.w * target) / long);
  let h = Math.round((d.h * target) / long);
  w = Math.min(2048, Math.max(512, w));
  h = Math.min(2048, Math.max(512, h));
  if (Math.abs((w / h) / (d.w / d.h) - 1) > 0.02) return '';
  return `${w}*${h}`;
}

function sizeHint() {
  return sizeHintFor(state.uploadDims);
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

// ---------- 舞台缩放：只改 CSS 显示尺寸，画布内部分辨率（和格子）不动 ----------
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

function visibleCanvas() {
  if (!dom.singleView.hidden) return dom.mainCanvas;
  if (!dom.compareView.hidden) return dom.leftCanvas;
  return null;
}

// 当前实际显示倍率；「适应」状态下从 DOM 反推
function renderedScale() {
  const cv = visibleCanvas();
  if (!cv || !cv.width || !cv.clientWidth) return 1;
  return cv.clientWidth / cv.width;
}

function applyZoom() {
  const z = state.zoom;
  for (const cv of [dom.mainCanvas, dom.leftCanvas, dom.rightCanvas]) {
    if (z == null) {
      cv.style.width = '';
      cv.style.height = '';
    } else {
      cv.style.width = `${Math.round(cv.width * z)}px`;
      cv.style.height = `${Math.round(cv.height * z)}px`;
    }
  }
  dom.viewport.classList.toggle('zoomed', z != null);
  dom.zoomValue.textContent = z == null ? '适应' : `${Math.round(z * 100)}%`;
}

// 以光标为锚点缩放：缩放后把滚动量补回去，光标下的那个点不跑
function setZoom(next, clientX, clientY) {
  const vp = dom.viewport;
  const old = renderedScale();
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
  const rect = vp.getBoundingClientRect();
  const keepX = clientX == null ? null : clientX - rect.left;
  const keepY = clientY == null ? null : clientY - rect.top;
  state.zoom = z;
  applyZoom();
  if (keepX != null && old > 0) {
    const k = z / old;
    vp.scrollLeft = (vp.scrollLeft + keepX) * k - keepX;
    vp.scrollTop = (vp.scrollTop + keepY) * k - keepY;
  }
}

dom.zoomIn.addEventListener('click', () => setZoom(renderedScale() * 1.25));
dom.zoomOut.addEventListener('click', () => setZoom(renderedScale() / 1.25));
dom.zoomFit.addEventListener('click', () => { state.zoom = null; applyZoom(); });
dom.zoomReal.addEventListener('click', () => setZoom(1));

dom.viewport.addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.metaKey) return; // 普通滚轮留给平移，不抢页面滚动
  e.preventDefault();
  // 叠加模式下 Ctrl+滚轮让给「缩放选中的图层」（照片和原图大小必然对不上，滑块太慢）；
  // 视图缩放还有缩放条，所以不冲突。Shift 叠加 = 1/3 步长，用来精调。
  if (dom.mode.value === 'overlay' && overlayRefImg() && overlayPhotoImg()) {
    const tf = state.tf[dom.overlaySel.value];
    const step = e.shiftKey ? 1.025 : 1.08;
    tf.scale = clampScale(tf.scale * (e.deltaY < 0 ? step : 1 / step));
    syncTfUi();
    scheduleRender();
    return;
  }
  setZoom(renderedScale() * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
}, { passive: false });

let panFrom = null;
dom.viewport.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  panFrom = { x: e.clientX, y: e.clientY, sl: dom.viewport.scrollLeft, st: dom.viewport.scrollTop };
  dom.viewport.setPointerCapture(e.pointerId);
  dom.viewport.classList.add('grabbing');
});
dom.viewport.addEventListener('pointermove', (e) => {
  if (!panFrom) return;
  dom.viewport.scrollLeft = panFrom.sl - (e.clientX - panFrom.x);
  dom.viewport.scrollTop = panFrom.st - (e.clientY - panFrom.y);
});
for (const end of ['pointerup', 'pointercancel']) {
  dom.viewport.addEventListener(end, () => {
    panFrom = null;
    dom.viewport.classList.remove('grabbing');
  });
}

function render() {
  const mode = dom.mode.value;
  const settings = readSettings();
  const hasOriginal = Boolean(state.original);
  const hasLineart = Boolean(state.lineart);
  const hasPhoto = Boolean(state.photo);

  const isCompare = mode === 'compare' && hasOriginal && hasLineart;
  const isOverlay = mode === 'overlay' && overlayRefImg() && overlayPhotoImg();
  dom.empty.hidden = hasOriginal || hasLineart || hasPhoto;
  dom.compareView.hidden = !isCompare;
  dom.singleView.hidden = isCompare;
  dom.viewport.classList.toggle('overlay', isOverlay);

  if (isCompare) {
    drawScene(dom.leftCanvas, state.original, settings);
    drawScene(dom.rightCanvas, lineartImg(), settings);
  } else if (isOverlay) {
    drawScene(dom.mainCanvas, buildOverlayCanvas(), settings);
    syncTfUi();
  } else {
    const img = mode === 'original' ? state.original
      : mode === 'overlay' ? (overlayPhotoImg() || overlayRefImg())
      : (lineartImg() || state.original);
    if (img) drawScene(dom.mainCanvas, img, settings);
  }
  applyZoom();
}

// 拖动时每帧都要重画，用 rAF 合并，别在一次 pointermove 里画两遍
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
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
      `线稿已生成并存入线稿库（原始，未处理），用时 ${((Date.now() - started) / 1000).toFixed(1)} 秒。之后随时从第 8 组取用，本地处理不花钱。`,
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
dom.extractRadius.addEventListener('input', () => {
  dom.extractRadiusValue.textContent = dom.extractRadius.value;
});
dom.extractK.addEventListener('input', () => {
  dom.extractKValue.textContent = Number(dom.extractK.value).toFixed(2);
});
function syncExtractMethod() {
  const sv = dom.extractMethod.value === 'sauvola';
  dom.sauvolaOpts.hidden = !sv;
  dom.cannyOpts.hidden = sv;
}
dom.extractMethod.addEventListener('change', syncExtractMethod);
syncExtractMethod();
dom.extractLo.addEventListener('input', () => {
  dom.extractLoValue.textContent = dom.extractLo.value;
});
dom.extractHi.addEventListener('input', () => {
  dom.extractHiValue.textContent = dom.extractHi.value;
});
dom.extractMinLen.addEventListener('input', () => {
  dom.extractMinLenValue.textContent = dom.extractMinLen.value;
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
  setStatus('本地抽线中…（全在浏览器里算，不调模型、不花钱）');
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
        `本地抽线完成（${r.canvas.width}×${r.canvas.height}，${r.detail}，免费）。` +
        r.tip,
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
dom.morphIter.addEventListener('input', () => {
  dom.morphIterValue.textContent = dom.morphIter.value;
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

// ---------- 第 6 组：叠加对比（临摹照片 vs 原图） ----------
function syncTfUi() {
  const tf = state.tf[dom.overlaySel.value] || state.tf.photo;
  const ref = overlayRefImg();
  const { w, h } = ref ? dims(ref) : { w: 1000, h: 1000 };
  dom.tfX.min = String(-w); dom.tfX.max = String(w);
  dom.tfY.min = String(-h); dom.tfY.max = String(h);
  const sr = scaleRange();
  dom.tfScale.min = String(sr.min.toFixed(4));
  dom.tfScale.max = String(sr.max.toFixed(4));
  dom.tfX.value = String(tf.x);
  dom.tfY.value = String(tf.y);
  dom.tfScale.value = String(tf.scale);
  dom.tfRot.value = String(tf.rot);
  dom.tfXValue.textContent = String(Math.round(tf.x));
  dom.tfYValue.textContent = String(Math.round(tf.y));
  dom.tfScaleValue.textContent = tf.scale.toFixed(3);
  dom.tfRotValue.textContent = tf.rot.toFixed(1);
}

function onTfInput() {
  const tf = state.tf[dom.overlaySel.value];
  tf.x = Number(dom.tfX.value);
  tf.y = Number(dom.tfY.value);
  tf.scale = Number(dom.tfScale.value);
  tf.rot = Number(dom.tfRot.value);
  dom.tfXValue.textContent = String(Math.round(tf.x));
  dom.tfYValue.textContent = String(Math.round(tf.y));
  dom.tfScaleValue.textContent = tf.scale.toFixed(3);
  dom.tfRotValue.textContent = tf.rot.toFixed(1);
  scheduleRender();
}
for (const s of [dom.tfX, dom.tfY, dom.tfScale, dom.tfRot]) s.addEventListener('input', onTfInput);
dom.overlaySel.addEventListener('change', syncTfUi);
dom.tfMatch.addEventListener('click', matchSize);
dom.tfReset.addEventListener('click', () => {
  state.tf[dom.overlaySel.value] = newTransform();
  syncTfUi();
  render();
});
dom.tfResetAll.addEventListener('click', () => {
  state.tf = { ref: newTransform(), photo: newTransform() };
  syncTfUi();
  render();
});
dom.overlayMode.addEventListener('change', render);
dom.overlayRefColor.addEventListener('input', render);
dom.overlayPhotoColor.addEventListener('input', render);
dom.overlayOpacity.addEventListener('input', () => {
  dom.overlayOpacityValue.textContent = `${dom.overlayOpacity.value}%`;
  scheduleRender();
});

function refreshPhotoInfo(extra) {
  if (!state.photo && !state.photoLine) {
    dom.photoInfo.textContent = '';
    return;
  }
  const parts = [];
  if (state.photo) {
    const { w, h } = dims(state.photo);
    parts.push(`${state.photoName || '临摹照片'} · ${w}×${h}`);
  }
  if (state.photoLine) {
    const l = state.photoLine;
    parts.push(`${photoIsAi() ? 'AI' : '本地'}提墨 ${l.width}×${l.height}${extra ? `（${extra}）` : ''}`);
  } else if (dom.photoMethod.value === 'ai') {
    parts.push('还没提墨（点下面的按钮，这一步花钱）');
  } else {
    parts.push('未提墨（直接用照片叠）');
  }
  dom.photoInfo.textContent = parts.join(' · ');
}

// 换提墨方式：按钮文字和 AI 警告跟着变。本地和不提墨立刻生效，AI 只能等用户点按钮
function updatePhotoUi() {
  const method = dom.photoMethod.value;
  const ai = method === 'ai';
  dom.aiWarn.hidden = !ai;
  dom.photoProcess.hidden = method === 'none'; // 不提墨时这按钮没事可做
  dom.photoProcess.textContent = ai ? 'AI 提墨（花钱 · 一张一次）' : '重跑提墨';
  dom.photoProcess.classList.toggle('primary', ai);
  dom.photoProcess.classList.toggle('ghost', !ai);
}

function runLocalPhotoInk() {
  const t0 = performance.now();
  const r = processPhoto();
  refreshPhotoInfo(r ? `${Math.round(performance.now() - t0)}ms，${r.detail}` : '');
  render();
}

async function acceptPhoto(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('请选择图片文件', 'error');
    return;
  }
  try {
    const img = await loadImage(await fileToDataUrl(file));
    state.photo = img;
    state.photoName = file.name || 'photo';
    state.photoLine = null;
    state.photoAiLine = null;
    prepPhoto = null;
    const t0 = performance.now();
    const r = processPhoto(); // 方式是 AI 时这里不会调接口，只是把提墨稿清空等按钮
    refreshPhotoInfo(r ? `${Math.round(performance.now() - t0)}ms，${r.detail}` : '');
    dom.mode.value = 'overlay';
    setStatus(
      dom.photoMethod.value === 'ai'
        ? '临摹照片已载入，还没花钱：提墨方式选的是 AI，点「AI 提墨」才会调用。'
        : '临摹照片已载入，切到「叠加对比」。先点「自动匹配大小」补掉相机远近造成的大小差，' +
          '再拖动 / Ctrl+滚轮微调；切到「差值」模式，整张是黑底，发亮的地方就是画偏了。',
      'ok'
    );
    render();
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

dom.photoInput.addEventListener('change', () => acceptPhoto(dom.photoInput.files[0]));
dom.photoMethod.addEventListener('change', () => {
  updatePhotoUi();
  if (dom.photoMethod.value === 'ai') {
    processPhoto();
    refreshPhotoInfo();
    render();
    return;
  }
  runLocalPhotoInk();
});
dom.photoProcess.addEventListener('click', () => {
  if (!state.photo) {
    setStatus('还没有临摹照片，先在上面选一张。', 'error');
    return;
  }
  if (dom.photoMethod.value === 'ai') aiExtractPhoto();
  else runLocalPhotoInk();
});
dom.photoClear.addEventListener('click', () => {
  state.photo = null;
  state.photoName = '';
  state.photoLine = null;
  state.photoAiLine = null;
  prepPhoto = null;
  dom.photoInput.value = '';
  refreshPhotoInfo();
  render();
});

dom.exportOverlay.addEventListener('click', () => {
  const cv = buildOverlayCanvas();
  if (!cv) {
    setStatus('还没有可导出的对比图：需要原图（第 2 组生成，或第 8 组线稿库载入）+ 临摹照片。', 'error');
    return;
  }
  const settings = readSettings();
  const out = document.createElement('canvas');
  drawScene(out, cv, settings);
  downloadCanvas(out, `${state.fileName}_对比_${settings.n}x${settings.n}.png`);
});

// 叠加模式下，在图上按住拖动 = 平移选中的那一层（stopPropagation 免得 viewport 也跟着平移视图）
let layerDrag = null;
dom.mainCanvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || dom.mode.value !== 'overlay' || !overlayPhotoImg() || !overlayRefImg()) return;
  e.stopPropagation();
  const sel = dom.overlaySel.value;
  layerDrag = { sel, x: e.clientX, y: e.clientY, from: { ...state.tf[sel] } };
  dom.mainCanvas.setPointerCapture(e.pointerId);
  dom.mainCanvas.classList.add('dragging');
});
dom.mainCanvas.addEventListener('pointermove', (e) => {
  if (!layerDrag) return;
  const k = renderedScale() || 1; // 屏幕像素 → 画布像素
  const tf = state.tf[layerDrag.sel];
  tf.x = Math.round(layerDrag.from.x + (e.clientX - layerDrag.x) / k);
  tf.y = Math.round(layerDrag.from.y + (e.clientY - layerDrag.y) / k);
  syncTfUi();
  scheduleRender();
});
for (const end of ['pointerup', 'pointercancel']) {
  dom.mainCanvas.addEventListener(end, () => {
    layerDrag = null;
    dom.mainCanvas.classList.remove('dragging');
  });
}

// 闪烁模式：按住空格只看原图，松开看照片
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || state.flashRef || dom.mode.value !== 'overlay') return;
  const t = e.target;
  if (t && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName)) return;
  e.preventDefault();
  state.flashRef = true;
  render();
});
window.addEventListener('keyup', (e) => {
  if (e.code !== 'Space' || !state.flashRef) return;
  state.flashRef = false;
  render();
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
    const isPhoto = it.kind === 'photo'; // 临摹照片的提墨稿，载入时回到照片层而不是参考层
    const card = document.createElement('div');
    card.className = 'gpcard';
    const img = document.createElement('img');
    img.src = `/api/gallery/${it.id}`;
    img.alt = it.name || '线稿';
    img.loading = 'lazy';
    img.title = isPhoto ? '点击载入到照片层（不花钱）' : '点击载入到编辑器（不花钱）';
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
    subEl.textContent = [dateStr, isPhoto ? '临摹照片' : '', it.model].filter(Boolean).join(' · ');
    meta.append(nameEl, subEl);
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'btn primary gpop';
    open.textContent = isPhoto ? '载入到照片层' : '载入';
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
    if (it.kind === 'photo') {
      // 花钱提过的临摹稿要回到照片层，盖到 state.lineart 上会把参考原图毁掉
      state.photoLine = img;
      state.photoAiLine = img;
      prepPhoto = null;
      dom.photoMethod.value = 'ai';
      updatePhotoUi();
      refreshPhotoInfo('从线稿库载入，没花钱');
      dom.mode.value = 'overlay';
      setStatus(`已把「${it.name || '未命名'}」载入到照片层（没花钱）。原照片不在库里，所以只能叠着用、不能再本地重提。`, 'ok');
    } else {
      state.lineart = img;
      state.lineartProc = null;
      state.fileName = it.name || '线稿';
      dom.mode.value = 'lineart';
      setStatus(`已从线稿库载入「${it.name || '未命名'}」，去第 4 组本地处理，不花钱。`, 'ok');
    }
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
