const fs = require('fs');
const path = require('path');

const pricing = fs.readFileSync(path.join(process.cwd(), 'src/data/pricing.ts'), 'utf8');
const checkout = fs.readFileSync(path.join(process.cwd(), 'src/app/api/checkout/route.ts'), 'utf8');

if (pricing.includes('launchPrice') || pricing.includes('regularPrice')) {
  throw new Error('Pricing catalog must not contain launchPrice or regularPrice.');
}

for (const [id, amount] of [
  ['derecho-peticion-simple', 49900],
  ['derecho-peticion-entidad', 69900],
  ['tutela-salud-vital-proceso', 99900],
  ['contrato-arrendamiento-comercial', 129900],
]) {
  const pattern = new RegExp(`['\"]${id}['\"]\\s*:\\s*\\{\\s*price:\\s*${amount}`);
  if (!pattern.test(pricing)) throw new Error(`Unexpected price for ${id}.`);
}

if (!checkout.includes('idempotencyKey')) {
  throw new Error('Checkout must require an idempotency key.');
}

console.log('Payment pricing and idempotency checks passed.');
