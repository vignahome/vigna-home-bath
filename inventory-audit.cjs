const { Module } = require('module');

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

class FakeSnapshot {
  constructor(exists, data, id) {
    this.exists = exists;
    this.dataObj = clone(data);
    this.id = id;
  }
  data() {
    return clone(this.dataObj);
  }
}

class FakeDoc {
  constructor(collection, id, store) {
    this.collection = collection;
    this.id = id;
    this.key = `${collection}/${id}`;
    this.store = store;
  }
  async get() {
    return this.store.getSnapshot(this);
  }
  set(data, opts) {
    this.store.setDoc(this, data, opts);
    return Promise.resolve();
  }
  update(data) {
    this.store.updateDoc(this, data);
    return Promise.resolve();
  }
}

class FakeCollection {
  constructor(name, store) {
    this.name = name;
    this.store = store;
  }
  doc(id) {
    return new FakeDoc(this.name, id, this.store);
  }
  async get() {
    return this.store.getCollection(this.name);
  }
  orderBy(field, dir) {
    return new FakeQuery(this.name, this.store).orderBy(field, dir);
  }
  limit(n) {
    return new FakeQuery(this.name, this.store).limit(n);
  }
}

class FakeQuery {
  constructor(name, store) {
    this.name = name;
    this.store = store;
    this.field = null;
    this.dir = 'asc';
    this.limitCount = null;
  }
  orderBy(field, dir) {
    this.field = field;
    this.dir = dir || 'asc';
    return this;
  }
  limit(n) {
    this.limitCount = n;
    return this;
  }
  async get() {
    return this.store.query(this.name, this.field, this.dir, this.limitCount);
  }
}

class FakeTransaction {
  constructor(store) {
    this.store = store;
    this.pending = new Map();
  }
  async get(ref) {
    if (this.pending.has(ref.key)) {
      return new FakeSnapshot(true, this.pending.get(ref.key).data, ref.id);
    }
    return this.store.getSnapshot(ref);
  }
  set(ref, data, opts) {
    const existing = this.pending.has(ref.key) ? this.pending.get(ref.key).data : this.store.docs.get(ref.key);
    let merged = clone(data);
    if (opts?.merge && existing) merged = { ...clone(existing), ...merged };
    this.pending.set(ref.key, { data: merged });
  }
  update(ref, data) {
    const existing = this.pending.has(ref.key) ? this.pending.get(ref.key).data : this.store.docs.get(ref.key);
    if (!existing) throw new Error('No existe documento');
    this.pending.set(ref.key, { data: { ...clone(existing), ...clone(data) } });
  }
  commit() {
    for (const [k, v] of this.pending.entries()) {
      this.store.docs.set(k, clone(v.data));
    }
  }
}

class FakeStore {
  constructor() {
    this.docs = new Map();
  }
  collection(name) {
    return new FakeCollection(name, this);
  }
  getSnapshot(ref) {
    const existing = this.docs.get(ref.key);
    return new FakeSnapshot(!!existing, clone(existing), ref.id);
  }
  setDoc(ref, data, opts) {
    const existing = this.docs.get(ref.key);
    let merged = clone(data);
    if (opts?.merge && existing) merged = { ...clone(existing), ...merged };
    this.docs.set(ref.key, merged);
  }
  updateDoc(ref, data) {
    const existing = this.docs.get(ref.key);
    if (!existing) throw new Error('No existe documento');
    this.docs.set(ref.key, { ...clone(existing), ...clone(data) });
  }
  async getCollection(name) {
    const docs = [...this.docs.entries()]
      .filter(([key]) => key.startsWith(`${name}/`))
      .map(([key, data]) => new FakeSnapshot(true, clone(data), key.split('/')[1]));
    return { docs };
  }
  async query(name, field, dir, limit) {
    let docs = [...this.docs.entries()]
      .filter(([key]) => key.startsWith(`${name}/`))
      .map(([key, data]) => ({ id: key.split('/')[1], data: clone(data) }));
    if (field) {
      docs.sort((a, b) => {
        const va = a.data[field] ?? 0;
        const vb = b.data[field] ?? 0;
        if (va < vb) return dir === 'desc' ? 1 : -1;
        if (va > vb) return dir === 'desc' ? -1 : 1;
        return 0;
      });
    }
    if (typeof limit === 'number') docs = docs.slice(0, limit);
    return { docs: docs.map((item) => new FakeSnapshot(true, item.data, item.id)) };
  }
  async runTransaction(fn) {
    const tx = new FakeTransaction(this);
    const result = await fn(tx);
    tx.commit();
    return result;
  }
}

function createServer(control) {
  const store = new FakeStore();
  const payments = new Map();
  const oldFetch = globalThis.fetch;
  const oldLoad = Module._load;

  globalThis.fetch = async (url, opts = {}) => {
    const stringUrl = String(url);
    if (stringUrl.startsWith('https://api.mercadopago.com/v1/payments/')) {
      const id = stringUrl.split('/').pop();
      const payload = payments.get(id);
      return { ok: !!payload, status: payload ? 200 : 404, json: async () => payload || {} };
    }
    return oldFetch(url, opts);
  };

  Module._load = function (request, parent, isMain) {
    if (request === 'firebase-admin/app') {
      return { initializeApp: () => {}, cert: () => ({}), applicationDefault: () => ({}), getApps: () => [] };
    }
    if (request === 'firebase-admin/firestore') {
      return { getFirestore: () => ({ collection: (name) => store.collection(name), runTransaction: store.runTransaction.bind(store) }) };
    }
    if (request === 'mercadopago') {
      return {
        WebhookSignatureValidator: {
          validate({ xSignature, xRequestId, dataId, secret }) {
            if (!xSignature || !xRequestId || !dataId) throw new Error('invalid signature');
            if (secret !== process.env.MP_WEBHOOK_SECRET && secret !== process.env.MP_WEBHOOK_SECRET_TEST) {
              throw new Error('invalid webhook secret');
            }
            if (xSignature !== `sig-${dataId}`) throw new Error('invalid signature');
            return true;
          }
        },
        InvalidWebhookSignatureError: class InvalidWebhookSignatureError extends Error {}
      };
    }
    return oldLoad(request, parent, isMain);
  };

  process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = Buffer.from(JSON.stringify({ type: 'service_account' }), 'utf8').toString('base64');
  process.env.CONTROL_INVENTARIO = control ? 'true' : 'false';
  process.env.MP_ACCESS_TOKEN = 'test-token';
  process.env.MP_WEBHOOK_SECRET = 'test-secret';
  process.env.MP_WEBHOOK_SECRET_TEST = 'test-secret-test';
  process.env.MP_NOTIFICATION_URL = 'https://example.com/webhook';
  process.env.PUBLIC_BASE_URL = 'http://localhost';

  delete require.cache[require.resolve('./server.js')];
  const srv = require('./server.js');

  return {
    app: srv.app,
    setPayment: (id, payload) => payments.set(id, payload),
    setInventory: (id, data) => store.setDoc({ key: `inventario/${id}`, id, collectionName: 'inventario' }, data, { merge: false }),
    setPedido: (id, data) => store.setDoc({ key: `pedidos/${id}`, id, collectionName: 'pedidos' }, data, { merge: false }),
    state: () => ({ stock: store.docs.get('inventario/grifos:1')?.stock, movimientos: [...store.docs.entries()].filter(([key]) => key.startsWith('movimientosInventario/')).map(([key, data]) => ({ key, data })) }),
    cleanup: () => {
      Module._load = oldLoad;
      globalThis.fetch = oldFetch;
    }
  };
}

const assert = (cond, desc) => ({ desc, passed: !!cond });
const results = [];

async function doReq(app, method, path, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const srv = app.listen(0, '127.0.0.1', async () => {
      const port = srv.address().port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
        const text = await res.text();
        resolve({ status: res.status, text });
      } catch (error) {
        reject(error);
      } finally {
        srv.close();
      }
    });
  });
}

(async () => {
  for (const control of [false, true]) {
    const s = createServer(control);
    s.setInventory('grifos:1', { sku: 'grifos:1', stock: 5, vendidos: 0, activo: true, stockMinimo: 1 });
    s.setPedido('VIGNA-PED-001', { pedidoId: 'VIGNA-PED-001', estado: 'pendiente', estadoPago: 'pendiente' });
    s.setPedido('VIGNA-PED-002', { pedidoId: 'VIGNA-PED-002', estado: 'pendiente', estadoPago: 'pendiente' });
    s.setPedido('VIGNA-PED-003', { pedidoId: 'VIGNA-PED-003', estado: 'pendiente', estadoPago: 'pendiente' });
    s.setPedido('VIGNA-PED-004', { pedidoId: 'VIGNA-PED-004', estado: 'pendiente', estadoPago: 'pendiente' });
    s.setPedido('VIGNA-PED-005', { pedidoId: 'VIGNA-PED-005', estado: 'pendiente', estadoPago: 'pendiente' });

    s.setPayment('123', { id: '123', status: 'approved', currency_id: 'PEN', transaction_amount: 180, metadata: { pedido_id: 'VIGNA-PED-001', carrito: JSON.stringify([{ sku: 'grifos:1', cantidad: 2 }]) } });
    s.setPayment('124', { id: '124', status: 'pending', currency_id: 'PEN', transaction_amount: 180, metadata: { pedido_id: 'VIGNA-PED-002', carrito: JSON.stringify([{ sku: 'grifos:1', cantidad: 2 }]) } });
    s.setPayment('125', { id: '125', status: 'rejected', currency_id: 'PEN', transaction_amount: 180, metadata: { pedido_id: 'VIGNA-PED-003', carrito: JSON.stringify([{ sku: 'grifos:1', cantidad: 2 }]) } });
    s.setPayment('126', { id: '126', status: 'cancelled', currency_id: 'PEN', transaction_amount: 180, metadata: { pedido_id: 'VIGNA-PED-004', carrito: JSON.stringify([{ sku: 'grifos:1', cantidad: 2 }]) } });
    s.setPayment('127', { id: '127', status: 'refunded', currency_id: 'PEN', transaction_amount: 180, metadata: { pedido_id: 'VIGNA-PED-001', carrito: JSON.stringify([{ sku: 'grifos:1', cantidad: 2 }]) } });

    const auth = { Authorization: 'Bearer test-token' };
    results.push(assert((await doReq(s.app, 'GET', '/movimientos-inventario', { headers: {} })).status === 401, 'movimientos sin auth 401'));
    results.push(assert((await doReq(s.app, 'GET', '/movimientos-inventario', { headers: { Authorization: 'Bearer wrong' } })).status === 403, 'movimientos token malo 403'));
    results.push(assert((await doReq(s.app, 'GET', '/movimientos-inventario', { headers: auth })).status === 200, 'movimientos token bueno 200'));

    const headers = { 'x-signature': 'sig-123', 'x-request-id': 'req1', 'Content-Type': 'application/json' };
    results.push(assert((await doReq(s.app, 'POST', '/webhook-mercadopago?data.id=123', { headers, body: {} })).status === 200, 'webhook approved 200'));
    const after1 = s.state();
    results.push(assert(after1.stock === (control ? 3 : 5), `stock ${control? 'descuenta' : 'no descuenta'} con CONTROL_INVENTARIO=${control}`));
    results.push(assert((await doReq(s.app, 'POST', '/webhook-mercadopago?data.id=123', { headers, body: {} })).status === 200, 'webhook approved repetido 200'));
    results.push(assert(s.state().stock === after1.stock, 'approved repetido no descuenta otra vez'));

    const pending = await doReq(s.app, 'POST', '/webhook-mercadopago?data.id=124', { headers: { ...headers, 'x-signature': 'sig-124' }, body: {} });
    results.push(assert(pending.status === 200, 'pending responde 200'));
    results.push(assert(s.state().stock === after1.stock, 'pending no cambia stock'));

    const rejected = await doReq(s.app, 'POST', '/webhook-mercadopago?data.id=125', { headers: { ...headers, 'x-signature': 'sig-125' }, body: {} });
    results.push(assert(rejected.status === 200, 'rejected responde 200'));
    results.push(assert(s.state().stock === after1.stock, 'rejected no cambia stock'));

    const cancelled = await doReq(s.app, 'POST', '/webhook-mercadopago?data.id=126', { headers: { ...headers, 'x-signature': 'sig-126' }, body: {} });
    results.push(assert(cancelled.status === 200, 'cancelled responde 200'));
    results.push(assert(s.state().stock === after1.stock, 'cancelled sin previo no cambia stock'));

    if (control) {
      results.push(assert((await doReq(s.app, 'POST', '/webhook-mercadopago?data.id=127', { headers: { ...headers, 'x-signature': 'sig-127' }, body: {} })).status === 200, 'refunded 200'));
      results.push(assert(s.state().stock === 5, 'refunded restaura stock'));
      results.push(assert((await doReq(s.app, 'POST', '/webhook-mercadopago?data.id=127', { headers: { ...headers, 'x-signature': 'sig-127' }, body: {} })).status === 200, 'refunded repetido 200'));
      results.push(assert(s.state().stock === 5, 'refunded repetido no restaura otra vez'));
      s.setPayment('128', { id: '128', status: 'approved', currency_id: 'PEN', transaction_amount: 500, metadata: { pedido_id: 'VIGNA-PED-005', carrito: JSON.stringify([{ sku: 'grifos:1', cantidad: 50 }]) } });
      results.push(assert((await doReq(s.app, 'POST', '/webhook-mercadopago?data.id=128', { headers: { ...headers, 'x-signature': 'sig-128' }, body: {} })).status === 200, 'approved insuficiente 200'));
      results.push(assert(s.state().stock === 5, 'insuficiente no cambia stock'));
      results.push(assert(!s.state().movimientos.some((m) => m.key.startsWith('movimientosInventario/mov-128-')), 'insuficiente no crea movimientos parciales'));
    }

    results.push(assert(s.state().movimientos.every((m) => /movimientosInventario\/mov-[^/]+-grifos_1-(descuento|restauracion)/.test(m.key)), 'ids determinísticos mov'));
    s.cleanup();
  }

  const passed = results.filter((r) => r.passed).length;
  console.log(`PASARON ${passed}/${results.length}`);
  results.filter((r) => !r.passed).forEach((r) => console.log('FALLÓ:', r.desc));
  process.exit(results.every((r) => r.passed) ? 0 : 1);
})();
