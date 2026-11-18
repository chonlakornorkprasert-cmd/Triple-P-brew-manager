const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3101';
const results = [];

async function call(name, path, options = {}, expected = [200]) {
  const response = await fetch(base + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  if (!expected.includes(response.status)) {
    throw new Error(`${name}: HTTP ${response.status} ${text}`);
  }
  const data = text ? JSON.parse(text) : null;
  results.push({ name, status: response.status });
  return data;
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });

await call('health/read', '/api/health');

const input = await call('ingredient/create', '/api/ingredients', json('POST', {
  sku: 'TEST-SAVE-IN', name: 'Test input', category: 'Test', purchase_qty: 1,
  purchase_unit: 'bag', purchase_price: 100, base_unit: 'g', conversion_to_base: 100,
  reorder_level: 0, supplier: 'Test supplier', barcode: 'TEST001', expiry_date: null,
}), [201]);
await call('ingredient/update', `/api/ingredients/${input.id}`, json('PUT', {
  ...input, name: 'Test input updated', purchase_price: 110,
}));

const output = await call('ingredient-output/create', '/api/ingredients', json('POST', {
  sku: 'TEST-SAVE-OUT', name: 'Test output', category: 'Test', purchase_qty: 1,
  purchase_unit: 'unit', purchase_price: 1, base_unit: 'unit', conversion_to_base: 1,
  reorder_level: 0,
}), [201]);

const recipe = await call('recipe/create', '/api/recipes', json('POST', {
  code: 'TEST-SAVE-MENU', name: 'Test menu', category: 'Test', serving_size: '1 serving',
  selling_price: 50, online_selling_price: 60,
  items: [{ ingredient_id: input.id, qty_base: 2 }],
}), [201]);
await call('recipe/update', `/api/recipes/${recipe.id}`, json('PUT', {
  code: recipe.code, name: 'Test menu updated', category: 'Test', serving_size: '1 serving',
  selling_price: 55, online_selling_price: 65,
  items: [{ ingredient_id: input.id, qty_base: 3 }],
}));

await call('stock/save', '/api/stock/transaction', json('POST', {
  ingredient_id: input.id, txn_type: 'PURCHASE', qty_base: 100, unit_cost: 1.1,
  reference: 'TEST-SAVE', note: 'smoke test',
}), [201]);

const table = await call('table/create', '/api/tables', json('POST', {
  name: 'TEST TABLE', seats: 2, zone: 'Test', status: 'AVAILABLE',
}), [201]);
await call('table/update', `/api/tables/${table.id}`, json('PUT', {
  name: 'TEST TABLE UPDATED', seats: 4, zone: 'Test', status: 'AVAILABLE',
}));

const order = await call('order/create', '/api/orders', json('POST', {
  order_type: 'TAKEAWAY', customer: 'Smoke test', items: [{
    recipe_id: recipe.id, menu_name: 'Test menu updated', quantity: 1, unit_price: 55,
  }],
}), [201]);
await call('order/update', `/api/orders/${order.id}`, json('PUT', {
  order_type: 'TAKEAWAY', customer: 'Smoke test updated', items: [{
    recipe_id: recipe.id, menu_name: 'Test menu updated', quantity: 2, unit_price: 55,
  }],
}));
await call('order/checkout', `/api/orders/${order.id}/checkout`, json('POST', {
  payment_method: 'CASH', paid_amount: 110,
}));

const cancelOrder = await call('order-cancel/create', '/api/orders', json('POST', {
  order_type: 'TAKEAWAY', customer: 'Cancel test', items: [{
    recipe_id: recipe.id, menu_name: 'Test menu updated', quantity: 1, unit_price: 55,
  }],
}), [201]);
await call('order/cancel', `/api/orders/${cancelOrder.id}`, { method: 'DELETE' }, [204]);

const po = await call('purchase-order/create', '/api/purchase-orders', json('POST', {
  supplier: 'Test supplier', ingredient_id: input.id, quantity: 1, unit_price: 110,
  note: 'smoke test',
}), [201]);
await call('purchase-order/receive', `/api/purchase-orders/${po.id}/receive`, { method: 'POST' });

await call('production/create', '/api/production', json('POST', {
  batch_code: 'TEST-BATCH', output_ingredient_id: output.id, output_qty: 10,
  input_ingredient_id: input.id, input_qty: 5, note: 'smoke test',
}), [201]);

const settings = await call('settings/read', '/api/settings');
await call('settings/save', '/api/settings', json('PUT', settings));
await call('reports/read', '/api/reports/sales?period=all');
await call('dashboard/read', '/api/dashboard');
await call('ingredients/read', '/api/ingredients');
await call('recipes/read', '/api/recipes');
await call('orders/read', '/api/orders');
await call('tables/read', '/api/tables');
await call('purchase-orders/read', '/api/purchase-orders');
await call('production/read', '/api/production');
await call('table/delete', `/api/tables/${table.id}`, { method: 'DELETE' }, [204]);

console.log(JSON.stringify({ ok: true, passed: results.length, results }, null, 2));
