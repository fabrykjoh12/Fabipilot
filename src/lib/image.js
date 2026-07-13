// Bilde-hjelper: les en valgt fil, skaler den ned og komprimer til en liten
// JPEG-data-URL. Vi lagrer bildet rett på prosjekt-raden og synker via Dexie
// Cloud, så det MÅ være lite — derfor maks ~640px og moderat kvalitet.
// (DOM-avhengig: bruker createImageBitmap/canvas — kjøres kun i nettleseren.)

function loadViaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kunne ikke lese bildet')) }
    img.src = url
  })
}

/**
 * Skaler ned + komprimer et bilde til en JPEG-data-URL.
 * @param {File} file  valgt bildefil
 * @param {{max?:number, quality?:number}} opts  maks kant (px) og JPEG-kvalitet (0–1)
 * @returns {Promise<string>} data:image/jpeg;base64,…
 */
export async function downscaleImage(file, { max = 640, quality = 0.72 } = {}) {
  if (!file || !file.type?.startsWith('image/')) throw new Error('Velg en bildefil.')

  const source = await (typeof createImageBitmap === 'function'
    ? createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadViaImg(file))
    : loadViaImg(file))

  const w0 = source.width
  const h0 = source.height
  const scale = Math.min(1, max / Math.max(w0, h0))
  const w = Math.max(1, Math.round(w0 * scale))
  const h = Math.max(1, Math.round(h0 * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, 0, 0, w, h)
  if (typeof source.close === 'function') source.close()

  return canvas.toDataURL('image/jpeg', quality)
}
