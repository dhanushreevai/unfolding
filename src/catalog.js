// Product, price and checkout options. Shared by the site and the /api functions,
// so order totals are always recalculated on the server from these values.

export const PRODUCTS = {
  tshirt: {
    name: 'T-Shirt', img: '/tshirt.jpg', price: 29, fabric: '100% Cotton (200 GSM)',
    print: { left: '30.9%', top: '23%', width: '40%', height: '40%' },
    // same colours as the design studio (src/studio/options.jsx)
    colors: [
      { name: 'White', swatch: '#f4f4f2' },
      { name: 'Black', swatch: '#1b1b1d' },
      { name: 'Heather Grey', swatch: '#b9b9bb' },
      { name: 'Charcoal', swatch: '#3d4148' },
      { name: 'Sand', swatch: '#d9cfbf' },
      { name: 'Navy', swatch: '#1f2a44' },
      { name: 'Red', swatch: '#b3261e' },
      { name: 'Forest', swatch: '#2f4a3a' },
      { name: 'Sky', swatch: '#8fb8de' },
      { name: 'Lilac', swatch: '#b9a7d9' },
      { name: 'Butter', swatch: '#efd98a' },
    ],
  },
  hoodie: {
    name: 'Hoodie', img: '/hoodie.jpg', price: 49, fabric: '80% Cotton, 20% Polyester (320 GSM)',
    print: { left: '32.5%', top: '27%', width: '36%', height: '27%' },
    // same colours as the design studio (src/studio/options.jsx)
    colors: [
      { name: 'White', swatch: '#f4f4f2' },
      { name: 'Black', swatch: '#1b1b1d' },
      { name: 'Heather Grey', swatch: '#b9b9bb' },
      { name: 'Charcoal', swatch: '#3d4148' },
      { name: 'Sand', swatch: '#d9cfbf' },
      { name: 'Navy', swatch: '#1f2a44' },
      { name: 'Red', swatch: '#b3261e' },
      { name: 'Forest', swatch: '#2f4a3a' },
      { name: 'Sky', swatch: '#8fb8de' },
      { name: 'Lilac', swatch: '#b9a7d9' },
      { name: 'Butter', swatch: '#efd98a' },
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
