/*
  Order emails, sent with Resend (https://resend.com) over its HTTP API, so no extra package.

  Environment variables (Vercel → Project → Settings → Environment Variables):
    RESEND_API_KEY     the API key from resend.com                       (required to send anything)
    ORDER_EMAIL_TO     where new-order notifications go, e.g. the shop's inbox   (required)
    ORDER_EMAIL_FROM   sender, e.g. "Unfolding People <orders@unfoldingpeople.com>"
                       Needs the domain verified in Resend. Until then leave it unset: mail is sent
                       from Resend's test address, which can only deliver to the Resend account's
                       own email, so customers are not emailed until the domain is verified.

  If the variables are missing, nothing is sent and orders still save normally.
*/

const API = 'https://api.resend.com/emails'
const TEST_FROM = 'Unfolding People <onboarding@resend.dev>'

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const money = (n) => `£${Number(n || 0).toFixed(2)}`

async function send(message) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`)
}

function describeLayers(layers) {
  return layers.map((l) => {
    const where = l.side === 'back' ? 'Back' : 'Front'
    if (l.type === 'text') return `${where}: text “${esc(l.text)}” (${esc(l.font || 'font')}, ${esc(l.color)})`
    if (l.type === 'clipart') return `${where}: graphic “${esc(l.name)}” (${esc(l.color)})`
    return `${where}: uploaded image (${esc(l.artwork)})`
  })
}

// data:image/png;base64,... → an image attached to the email and shown inside it (cid:<id>)
function picture(id, name, dataUrl) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '')
  if (!m) return null
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
  return { filename: `${name}.${ext}`, content: m[2], content_type: `image/${m[1]}`, content_id: id }
}

// the design pictures side by side, as shown in both emails
const picturesHtml = (pics) => pics.length ? `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0"><tr>
    ${pics.map((p) => `<td style="padding:0 10px 0 0;text-align:center;vertical-align:top">
      <img src="cid:${p.content_id}" width="240" alt="${p.content_id === 'front' ? 'Front' : 'Back'} of the design"
           style="display:block;width:240px;max-width:100%;border-radius:12px;background:#111">
      <div style="font:12px Arial,sans-serif;color:#777;margin-top:6px">${p.content_id === 'front' ? 'Front' : 'Back'}</div>
    </td>`).join('')}
  </tr></table>` : ''

const wrap = (body) => `<div style="font:15px/1.55 Arial,sans-serif;color:#111;max-width:600px">${body}</div>`

/** Emails the shop about a new order, and the customer a confirmation. Never throws. */
export async function sendOrderEmails(order, previews = {}) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.ORDER_EMAIL_TO
  if (!key || !to) return { sent: false, reason: 'email not configured' }
  const from = process.env.ORDER_EMAIL_FROM || TEST_FROM
  const { customer: c, item, totals, delivery } = order
  const lines = describeLayers(item.layers)
  const pics = [picture('front', `${order.id}-front`, previews.front), picture('back', `${order.id}-back`, previews.back)].filter(Boolean)

  const shop = {
    from, to: [to], reply_to: c.email,
    subject: `New order ${order.id} · ${item.productName} · ${money(totals.total)}`,
    html: wrap(`
      <h2 style="margin:0 0 6px">New order ${esc(order.id)}</h2>
      <p style="margin:0"><b>${esc(item.productName)}</b> · ${esc(item.color)} · size ${esc(item.size)}</p>
      ${picturesHtml(pics)}
      <ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
      <p>Subtotal ${money(totals.subtotal)} · ${esc(delivery.label)} ${money(totals.delivery)} · <b>Total ${money(totals.total)}</b></p>
      <p>Payment: ${esc(order.payment.method)} — <b>not paid yet</b>. Send the customer a payment link.</p>
      <h3 style="margin:22px 0 6px">Customer</h3>
      <p style="margin:0">${esc(c.firstName)} ${esc(c.lastName)}<br>
         <a href="mailto:${esc(c.email)}">${esc(c.email)}</a> · ${esc(c.phone)}<br>
         ${esc(c.address)}, ${esc(c.city)} ${esc(c.postcode)}, ${esc(c.country)}</p>
      <p style="color:#777;font-size:13px">Reply to this email to write to the customer. Full order: Vercel Blob → orders/${esc(order.id)}.json</p>`),
    attachments: pics,
  }

  const customer = {
    from, to: [c.email],
    subject: `Your Unfolding People order ${order.id}`,
    html: wrap(`
      <h2 style="margin:0 0 6px">Thanks, ${esc(c.firstName)}!</h2>
      <p style="margin:0">We've got your order <b>${esc(order.id)}</b>: a custom ${esc(item.productName)} in ${esc(item.color)}, size ${esc(item.size)}.</p>
      ${picturesHtml(pics)}
      <p>Total <b>${money(totals.total)}</b> including ${esc(delivery.label.toLowerCase())} (${esc(delivery.eta)}).</p>
      <p>Delivering to: ${esc(c.firstName)} ${esc(c.lastName)}, ${esc(c.address)}, ${esc(c.city)} ${esc(c.postcode)}</p>
      <p>We'll email you a secure payment link shortly, and start printing as soon as it's paid.</p>
      <p>Any questions? Just reply to this email.</p>
      <p>— Unfolding People</p>`),
    reply_to: to,
    attachments: pics,
  }

  const result = { sent: true, shop: false, customer: false }
  try { await send(shop); result.shop = true } catch (err) { console.error('order email (shop) failed', order.id, err.message) }
  // Resend's test sender can only mail the account owner, so customers wait for a verified domain
  if (process.env.ORDER_EMAIL_FROM) {
    try { await send(customer); result.customer = true } catch (err) { console.error('order email (customer) failed', order.id, err.message) }
  }
  return result
}
