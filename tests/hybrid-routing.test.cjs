const test = require('node:test');
const assert = require('node:assert/strict');
const { selectStage } = require('../hybrid-routing.js');
const destination = { building: 'C', floor: '4', id: 'C120406' };
const place = { entrances: [{ verified: true, latitude: 30, longitude: 120 }] };

test('a matching indoor fix takes priority over GPS', () => {
  assert.equal(selectStage({ building: 'C', floor: '4', x: 15, y: 61,
    latitude: 30, longitude: 120 }, destination, place), 'indoor');
});

test('GPS routes outdoors only when a verified entrance is available', () => {
  const gps = { latitude: 30, longitude: 120 };
  assert.equal(selectStage(gps, destination, place), 'outdoor');
  assert.equal(selectStage(gps, destination,
    { entrances: [{ verified: false, latitude: 30, longitude: 120 }] }), 'needs-entrance');
  assert.equal(selectStage({}, destination, place), 'needs-location');
});
