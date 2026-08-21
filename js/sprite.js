/**
 * sprite.js — Sprite sheet animation for yokai icons
 * 
 * Handles vertical 2-frame sprite sheets where frames are separated
 * by transparent rows. Animates by alternating between frames using
 * requestAnimationFrame().
 */
const _spriteCache = new Map(); // url → { frames: [canvas, canvas], width, height }
const _activeAnimations = new Map(); // element → { frame, timer, running }

/**
 * Load a sprite sheet and detect its frames by finding transparent row gaps.
 * Returns { frames: [ImageData, ImageData], width, height }
 */
async function loadSpriteSheet(url) {
  if (_spriteCache.has(url)) return _spriteCache.get(url);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // Draw to canvas to read pixel data
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = w;
      tmpCanvas.height = h;
      const ctx = tmpCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h).data;

      // Find transparent rows (all pixels alpha < 1)
      const rowAlpha = new Float64Array(h);
      for (let y = 0; y < h; y++) {
        let sum = 0;
        for (let x = 0; x < w; x++) {
          sum += data[(y * w + x) * 4 + 3]; // alpha channel
        }
        rowAlpha[y] = sum / w;
      }

      // Find gaps (consecutive transparent rows)
      const gaps = [];
      let gapStart = -1;
      for (let y = 0; y < h; y++) {
        if (rowAlpha[y] < 1) {
          if (gapStart === -1) gapStart = y;
        } else {
          if (gapStart !== -1) {
            gaps.push([gapStart, y - 1]);
            gapStart = -1;
          }
        }
      }
      if (gapStart !== -1) gaps.push([gapStart, h - 1]);

      // Extract frames from non-transparent regions
      const frames = [];
      let lastEnd = 0;
      for (const [gapStart, gapEnd] of gaps) {
        if (gapStart > lastEnd) {
          frames.push({ y: lastEnd, h: gapStart - lastEnd });
        }
        lastEnd = gapEnd + 1;
      }
      if (lastEnd < h) {
        frames.push({ y: lastEnd, h: h - lastEnd });
      }

      // If no gaps found, treat entire image as 1 frame
      if (frames.length === 0) {
        frames.push({ y: 0, h: h });
      }

      // Crop each frame into a canvas
      const frameCanvases = frames.map(f => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = f.h;
        const fctx = c.getContext('2d');
        fctx.drawImage(img, 0, f.y, w, f.h, 0, 0, w, f.h);
        return c;
      });

      const result = { frames: frameCanvases, width: w, height: frames[0]?.h || h, frameCount: frameCanvases.length };
      _spriteCache.set(url, result);
      resolve(result);
    };
    img.onerror = () => reject(new Error(`Failed to load sprite: ${url}`));
    img.src = url;
  });
}

/**
 * Start animating a sprite on a canvas element.
 * Alternates between frames at the given FPS.
 */
function startSpriteAnimation(canvas, url, fps = 2) {
  // Stop any existing animation on this canvas
  stopSpriteAnimation(canvas);

  loadSpriteSheet(url).then(sprite => {
    if (sprite.frameCount <= 1) {
      // Single frame — just draw it
      const ctx = canvas.getContext('2d');
      canvas.width = sprite.width;
      canvas.height = sprite.height;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite.frames[0], 0, 0);
      return;
    }

    canvas.width = sprite.width;
    canvas.height = sprite.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let frameIdx = 0;
    let running = true;

    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(sprite.frames[frameIdx], 0, 0);
      frameIdx = (frameIdx + 1) % sprite.frameCount;
    }

    draw(); // Draw first frame immediately

    const timer = setInterval(() => {
      if (!running) return;
      draw();
    }, 1000 / fps);

    _activeAnimations.set(canvas, { timer, running: () => running, stop: () => { running = false; clearInterval(timer); } });
  }).catch(err => {
    // Fallback: load as regular image
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
    };
    img.src = url;
  });
}

/**
 * Stop animating a sprite on a canvas element.
 */
function stopSpriteAnimation(canvas) {
  const anim = _activeAnimations.get(canvas);
  if (anim) {
    anim.stop();
    _activeAnimations.delete(canvas);
  }
}

/**
 * Check if a URL points to a sprite sheet (has >1 frame).
 */
async function isSpriteSheet(url) {
  try {
    const sprite = await loadSpriteSheet(url);
    return sprite.frameCount > 1;
  } catch {
    return false;
  }
}
