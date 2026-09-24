const test = require('node:test');
const assert = require('node:assert/strict');
const Service = require('../location-service.js');

function harness(permission = 'granted') {
  const watches = new Map(), cleared = [], timers = [], states = [], fixes = [];
  let next = 1;
  const geolocation = {
    watchPosition(success, error, options) {
      const id = next++;
      watches.set(id, { success, error, options });
      return id;
    },
    clearWatch(id) { cleared.push(id); watches.delete(id); }
  };
  const service = Service.create({ geolocation,
    permissions: { query: async () => ({ state: permission }) },
    secureContext: true, onState: state => states.push(state),
    onFix: (fix, mode) => fixes.push({ fix, mode }),
    schedule: callback => { timers.push(callback); return timers.length; },
    cancel: () => {}
  });
  return { service, watches, cleared, timers, states, fixes };
}

test('high accuracy timeout starts a lower accuracy watch while retaining high accuracy', () => {
  const h = harness();
  h.service.start();
  assert.equal(h.watches.get(1).options.enableHighAccuracy, true);
  h.watches.get(1).error({ code: 3 });
  assert.equal(h.watches.get(2).options.enableHighAccuracy, false);
  assert.equal(h.service.getState().lastError.code, 'TIMEOUT');
  h.watches.get(2).success({ coords: { accuracy: 70 }, timestamp: 100 });
  assert.equal(h.fixes[0].mode, 'fallback');
  h.watches.get(1).success({ coords: { accuracy: 12 }, timestamp: 200 });
  assert.equal(h.fixes[1].mode, 'high');
  assert.ok(h.cleared.includes(2));
});

test('missing callback becomes actionable instead of indefinite loading', async () => {
  const h = harness();
  h.service.start();
  await new Promise(resolve => setImmediate(resolve));
  h.timers[0]();
  assert.equal(h.service.getState().lastError.code, 'NO_CALLBACK');
  assert.match(h.service.getState().lastError.advice, /授权弹窗/);
  assert.equal(h.watches.size, 2);
});

test('permission denial and insecure contexts give specific failures', () => {
  const h = harness();
  h.service.start();
  h.watches.get(1).error({ code: 1 });
  assert.equal(h.service.getState().lastError.code, 'PERMISSION_DENIED');
  assert.match(h.service.getState().lastError.advice, /浏览器/);
  const states = [];
  const insecure = Service.create({ geolocation: h, secureContext: false,
    onState: state => states.push(state), onFix: () => {} });
  insecure.start();
  assert.equal(states.at(-1).lastError.code, 'INSECURE_CONTEXT');
});
