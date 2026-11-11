import { get, put } from '@vercel/blob'

/*
  Bridge for the "Unfolding People Designer" custom GPT in ChatGPT.

  POST (called by the GPT's Action): the GPT sends the image it generated in the conversation
  (openaiFileIdRefs). We download it straight away (OpenAI's links last five minutes), keep it
  privately, and reply with a link that opens the design studio with the artwork on the garment.
  Protected by a shared key (GPT_ACTION_KEY) set in the GPT's Action authentication.

  GET ?code=… (called by the studio): returns that artwork so it can be placed on the garment.
*/

const MAX_BYTES = 8 * 1024 * 1024
const TYPES = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' }
// OpenAI file links come from these hosts; anything else is refused
const ALLOWED_HOSTS = /(^|\.)oaiusercontent\.com$|(^|\.)openai\.com$/
const SITE = process.env.SITE_URL || 'https://www.unfoldingpeople.com'

const makeCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('')
}

export async function POST(request) {
  const key = process.env.GPT_ACTION_KEY
  if (!key || request.headers.get('x-api-key') !== key) {
    return Response.json({ error: 'Not authorised' }, { status: 401 })
  }
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
  const garment = body.garment === 'hoodie' ? 'hoodie' : 'tshirt'
  const ref = Array.isArray(body.openaiFileIdRefs) ? body.openaiFileIdRefs.find((f) => f && f.download_link) : null
  if (!ref) {
    return Response.json({ error: 'No image was attached. Generate the design image first, then send it.' }, { status: 400 })
  }

  let url
  try {
    url = new URL(ref.download_link)
  } catch {
    return Response.json({ error: 'Invalid file link' }, { status: 400 })
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.test(url.hostname)) {
    return Response.json({ error: 'File link not accepted' }, { status: 400 })
  }

  let bytes, type
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`download failed (${res.status})`)
    type = (res.headers.get('content-type') || ref.mime_type || '').split(';')[0].trim()
    if (!TYPES[type]) throw new Error('not a PNG, JPG or WebP image')
    bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > MAX_BYTES) throw new Error('image too large')
  } catch (err) {
    console.error('gpt-design download', err)
    return Response.json({ error: `Could not fetch the image: ${err.message}` }, { status: 400 })
  }

  const code = makeCode()
  try {
    await put(`gpt/${code}.${TYPES[type]}`, bytes, { access: 'private', contentType: type, addRandomSuffix: false })
  } catch (err) {
    console.error('gpt-design store', err)
    return Response.json({ error: 'Could not save the design. Please try again.' }, { status: 500 })
  }

  const link = `${SITE}/?gpt=${code}#design-${garment}`
  return Response.json({
    link,
    message: `Your design is ready. Open this link to see it on your ${garment === 'hoodie' ? 'hoodie' : 'T-shirt'}: ${link}`,
  })
}

export async function GET(request) {
  const code = new URL(request.url).searchParams.get('code') || ''
  if (!/^[a-z2-9]{12}$/.test(code)) return Response.json({ error: 'Invalid code' }, { status: 400 })
  for (const ext of Object.values(TYPES)) {
    try {
      const blob = await get(`gpt/${code}.${ext}`, { access: 'private' })
      if (blob?.statusCode === 200) {
        return new Response(blob.stream, {
          headers: { 'Content-Type': blob.headers.get('content-type') || 'image/png', 'Cache-Control': 'private, max-age=3600' },
        })
      }
    } catch { /* try the next extension */ }
  }
  return Response.json({ error: 'Design not found' }, { status: 404 })
}
