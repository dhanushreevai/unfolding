// Uploads any customer artwork to private Blob storage, then saves the order.

async function uploadArtwork(layers) {
  const images = layers.filter((l) => l.type === 'image')
  if (!images.length) return new Map()
  const { upload } = await import('@vercel/blob/client')
  const bySrc = new Map()
  for (const l of images) {
    if (bySrc.has(l.src)) continue
    const blob = await (await fetch(l.src)).blob()
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' }[blob.type] || 'png'
    const base = (l.name || 'artwork').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 40) || 'artwork'
    const result = await upload(`artwork/${base}.${ext}`, blob, {
      access: 'private', handleUploadUrl: '/api/upload', contentType: blob.type,
    })
    bySrc.set(l.src, result.pathname)
  }
  return bySrc
}

export async function placeOrder({ productKey, color, size, layers, customer, delivery, paymentMethod, previews }) {
  const artwork = await uploadArtwork(layers)
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: productKey,
      color: color.name,
      size,
      delivery,
      paymentMethod,
      customer,
      previews: { front: previews[0], back: previews[1] },
      layers: layers.map((l) => ({
        type: l.type, side: l.side, x: l.x, y: l.y, scale: l.scale, rotate: l.rotate,
        text: l.text, font: l.font?.label, color: l.color, d: l.d, name: l.name,
        artwork: l.type === 'image' ? artwork.get(l.src) : undefined,
        fileName: l.type === 'image' ? l.name : undefined,
      })),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Could not place your order. Please try again.')
    err.fields = data.fields
    throw err
  }
  return data
}
