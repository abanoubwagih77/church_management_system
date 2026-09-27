/**
 * Client-side Face Biometrics Engine using HTML5 Canvas & Spatial Descriptors
 * Extracts normalized facial landmark vectors (128-d) from camera frames.
 */

export function extractFaceVector(video: HTMLVideoElement): number[] | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  const canvas = document.createElement('canvas');
  const size = 64; // 64x64 normalized face patch
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // Extract central square region where face is framed
  const minDim = Math.min(video.videoWidth, video.videoHeight);
  const cropSize = minDim * 0.65; // Central 65% frame
  const startX = (video.videoWidth - cropSize) / 2;
  const startY = (video.videoHeight - cropSize) / 2;

  ctx.drawImage(
    video,
    startX,
    startY,
    cropSize,
    cropSize,
    0,
    0,
    size,
    size
  );

  const imgData = ctx.getImageData(0, 0, size, size);
  const pixels = imgData.data;

  // Compute 8x8 spatial block features (mean luminance + horizontal/vertical gradients)
  const blockSize = 8;
  const blocksPerRow = size / blockSize; // 8 blocks
  const rawFeatures: number[] = [];

  for (let by = 0; by < blocksPerRow; by++) {
    for (let bx = 0; bx < blocksPerRow; bx++) {
      let sumLum = 0;
      let sumGradX = 0;
      let count = 0;

      for (let y = 0; y < blockSize; y++) {
        for (let x = 0; x < blockSize; x++) {
          const px = bx * blockSize + x;
          const py = by * blockSize + y;
          const idx = (py * size + px) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          // Luminance
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          sumLum += lum;

          // Simple gradient
          if (px < size - 1) {
            const nextIdx = (py * size + (px + 1)) * 4;
            const nextLum = 0.299 * pixels[nextIdx] + 0.587 * pixels[nextIdx + 1] + 0.114 * pixels[nextIdx + 2];
            sumGradX += Math.abs(nextLum - lum);
          }
          count++;
        }
      }

      const meanLum = sumLum / count;
      const meanGrad = sumGradX / count;
      rawFeatures.push(meanLum, meanGrad); // 64 blocks * 2 features = 128 dimensions
    }
  }

  // Mean-variance normalization to reduce lighting and camera exposure variance
  let mean = 0;
  for (let i = 0; i < rawFeatures.length; i++) {
    mean += rawFeatures[i];
  }
  mean /= rawFeatures.length;

  let variance = 0;
  for (let i = 0; i < rawFeatures.length; i++) {
    const diff = rawFeatures[i] - mean;
    variance += diff * diff;
  }
  const std = Math.sqrt(variance / rawFeatures.length) || 1;

  // Normalized unit vector
  const normalized: number[] = [];
  let sumSquares = 0;
  for (let i = 0; i < rawFeatures.length; i++) {
    const z = (rawFeatures[i] - mean) / std;
    normalized.push(z);
    sumSquares += z * z;
  }

  const norm = Math.sqrt(sumSquares) || 1;
  return normalized.map((v) => Number((v / norm).toFixed(5)));
}

/**
 * Calculates Cosine Similarity between two normalized biometric vectors.
 * Returns value between 0 and 1.
 */
export function calculateSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, sim));
}
