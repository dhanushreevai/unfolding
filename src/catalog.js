// Product, price and checkout options. Shared by the site and the /api functions,
// so order totals are always recalculated on the server from these values.

export const PRODUCTS = {
  tshirt: {
    name: 'T-Shirt', img: '/tshirt.jpg', price: 29, fabric: '100% Cotton (200 GSM)',
    print: { left: '30.9%', top: '23%', width: '40%', height: '40%' },
    colors: [
      { name: 'White', swatch: '#f2f2f2', tint: '#ffffff' },
      { name: 'Black', swatch: '#0d0d0d', tint: '#262626' },
      { name: 'Grey', swatch: '#b5b5b5', tint: '#b0b0b0' },
      { name: 'Charcoal', swatch: '#3a3f47', tint: '#474c55' },
      { name: 'Sand', swatch: '#d8cfc2', tint: '#ddd2c2' },
    ],
  },
  hoodie: {
    name: 'Hoodie', img: '/hoodie.jpg', price: 49, fabric: '80% Cotton, 20% Polyester (320 GSM)',
    print: { left: '32.5%', top: '27%', width: '36%', height: '27%' },
    colors: [
      { name: 'Black', swatch: '#0d0d0d', tint: '#ffffff', bright: 1 },
      { name: 'Charcoal', swatch: '#3a3f47', tint: '#c9d0da', bright: 2.2 },
      { name: 'Grey', swatch: '#8d8d8d', tint: '#ffffff', bright: 3.6 },
      { name: 'Navy', swatch: '#1f2a44', tint: '#6f86c4', bright: 3 },
      { name: 'Sand', swatch: '#d8cfc2', tint: '#e8d9c0', bright: 4 },
    ],
  },
}

export const SIZES = ['S', 'M', 'L', 'XL', 'XXL']
export const BACK_PRINT_PRICE = 5
export const CURRENCY = '£'
export const formatPrice = (n) => `${CURRENCY}${n.toFixed(2)}`

export const DELIVERY = {
  standard: { label: 'Standard Delivery', eta: '3–5 working days', price: 0 },
  express: { label: 'Express Delivery', eta: '1–2 working days', price: 5 },
}

export const PAYMENT_METHODS = {
  card: 'Card Payment',
  paypal: 'PayPal',
  googlepay: 'Google Pay',
}

export const COUNTRIES = [
  { code: 'GB', name: 'United Kingdom', dial: '+44' },
  { code: 'IE', name: 'Ireland', dial: '+353' },
  { code: 'US', name: 'United States', dial: '+1' },
  { code: 'CA', name: 'Canada', dial: '+1' },
  { code: 'AU', name: 'Australia', dial: '+61' },
  { code: 'NZ', name: 'New Zealand', dial: '+64' },
  { code: 'IN', name: 'India', dial: '+91' },
  { code: 'LK', name: 'Sri Lanka', dial: '+94' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { code: 'SG', name: 'Singapore', dial: '+65' },
  { code: 'DE', name: 'Germany', dial: '+49' },
  { code: 'FR', name: 'France', dial: '+33' },
  { code: 'NL', name: 'Netherlands', dial: '+31' },
  { code: 'ES', name: 'Spain', dial: '+34' },
  { code: 'IT', name: 'Italy', dial: '+39' },
]

export const printSides = (layers) => ({
  front: layers.some((l) => l.side === 'front'),
  back: layers.some((l) => l.side === 'back'),
})

export const printLabel = (layers) => {
  const { front, back } = printSides(layers)
  if (front && back) return 'Front & Back'
  return front ? 'Front' : back ? 'Back' : 'None'
}

export function priceOrder({ product, layers, delivery }) {
  const subtotal = PRODUCTS[product].price + (printSides(layers).back ? BACK_PRINT_PRICE : 0)
  const deliveryPrice = DELIVERY[delivery]?.price ?? 0
  return { subtotal, delivery: deliveryPrice, total: subtotal + deliveryPrice }
}
