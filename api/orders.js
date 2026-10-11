import { put } from '@vercel/blob'
import { COUNTRIES, DELIVERY, PAYMENT_METHODS, PRODUCTS, SIZES, priceOrder } from '../src/catalog.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_PREVIEW_BYTES = 1.5 * 1024 * 1024

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v, min, max) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null)

function readCustomer(c = {}) {
  const customer = {
    firstName: str(c.firstName, 60),
    lastName: str(c.lastName, 60),
    email: str(c.email, 120).toLowerCase(),
    phone: str(c.phone, 30),
    address: str(c.address, 160),
    city: str(c.city, 80),
    postcode: str(c.postcode, 20),
    country: str(c.country, 2),
  }
  const errors = []
  if (!customer.firstName) errors.push('firstName')
  if (!customer.lastName) errors.push('lastName')
  if (!EMAIL.test(customer.email)) errors.push('email')
  if ((customer.phone.match(/\d/g) || []).length < 6) errors.push('phone')
  if (!customer.address) errors.push('address')
  if (!customer.city) errors.push('city')
  if (!customer.postcode) errors.push('postcode')
  if (!COUNTRIES.some((k) => k.code === customer.country)) errors.push('country')
  return { customer, errors }
}

// Keep only the fields the print team needs; artwork is referenced by its Blob pathname.
function readLayers(layers) {
  if (!Array.isArray(layers) || layers.length === 0 || layers.length > 20) return null
  const out = []
  for (const l of layers) {
    const base = {
      side: l.side === 'back' ? 'back' : 'front',
      x: num(l.x, 0, 100), y: num(l.y, 0, 100),
      scale: num(l.scale, 0.1, 3), rotate: num(l.rotate, -180, 180),
    }
    if (Object.values(base).includes(null)) return null
    if (l.type === 'text') {
      const text = str(l.text, 40)
      if (!text) return null
      out.push({ ...base, type: 'text', text, font: str(l.font, 30), color: str(l.color, 9) })
    } else if (l.type === 'clip') {
      out.push({ ...base, type: 'clipart', name: str(l.name, 30), path: str(l.d, 2000), color: str(l.color, 9) })
    } else if (l.type === 'image') {
      const artwork = str(l.artwork, 300)
      if (!artwork.startsWith('artwork/')) return null
      out.push({ ...base, type: 'image', artwork, fileName: str(l.fileName, 120) })
    } else {
      return null
    }
  }
  return out
}

function makeId() {
  const d = new Date()
  const date = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `UP-${date}-${rand}`
}

async function savePreview(id, side, dataUrl) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '')
  if (!match) return null
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length > MAX_PREVIEW_BYTES) return null
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
  const blob = await put(`orders/${id}/${side}.${ext}`, bytes, {
    access: 'private', contentType: `image/${match[1]}`, addRandomSuffix: false,
  })
  return blob.pathname
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const product = PRODUCTS[body.product]
  const color = product?.colors.find((c) => c.name === body.color)
  const layers = readLayers(body.layers)
  const { customer, errors } = readCustomer(body.customer)
  if (!product) errors.push('product')
  if (!color) errors.push('color')
  if (!SIZES.includes(body.size)) errors.push('size')
  if (!layers) errors.push('design')
  if (!DELIVERY[body.delivery]) errors.push('delivery')
  if (!PAYMENT_METHODS[body.paymentMethod]) errors.push('paymentMethod')
  if (errors.length) return Response.json({ error: 'Please check your details', fields: errors }, { status: 422 })

  const totals = priceOrder({ product: body.product, layers, delivery: body.delivery })
  const createdAt = new Date().toISOString()

  // pick an id that isn't taken (Blob refuses to overwrite an existing pathname)
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = makeId()
    const order = {
      id,
      createdAt,
      status: 'awaiting_payment',
      payment: { method: body.paymentMethod, status: 'unpaid' },
      customer,
      delivery: { option: body.delivery, ...DELIVERY[body.delivery] },
      item: {
        product: body.product, productName: product.name, color: color.name, size: body.size,
        fabric: product.fabric, layers,
      },
      totals: { ...totals, currency: 'GBP' },
      previews: {},
    }
    try {
      await put(`orders/${id}.json`, JSON.stringify(order, null, 2), {
        access: 'private', contentType: 'application/json', addRandomSuffix: false,
      })
    } catch (err) {
      if (/already exists/i.test(err.message)) continue
      console.error('order save failed', err)
      return Response.json({ error: 'Could not save your order. Please try again.' }, { status: 500 })
    }

    // previews are nice-to-have: save them after the order itself, then record their paths
    try {
      const [front, back] = await Promise.all([
        savePreview(id, 'front', body.previews?.front),
        savePreview(id, 'back', body.previews?.back),
      ])
      order.previews = { front, back }
      await put(`orders/${id}.json`, JSON.stringify(order, null, 2), {
        access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
      })
    } catch (err) {
      console.error('preview save failed', id, err)
    }

    return Response.json({ id, createdAt, totals }, { status: 201 })
  }
  return Response.json({ error: 'Could not save your order. Please try again.' }, { status: 500 })
}
