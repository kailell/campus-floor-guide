const test = require('node:test');
const assert = require('node:assert/strict');
const Position = require('../location-model.js');

test('GPS fix records accuracy and time without fabricating an indoor point', () => {
  const current = Position.withGps(Position.create(), { latitude: 30.1, longitude: 120.2, accuracy: 35 }, 1700000000000);
  assert.equal(current.type, 'current');
  assert.equal(current.latitude, 30.1);
  assert.equal(current.longitude, 120.2);
  assert.equal(current.gpsAccuracyMeters, 35);
  assert.equal(current.gpsUpdatedAt, 1700000000000);
  assert.equal(Position.hasIndoor(current), false);
  assert.equal(current.floor, null);
});

test('device updates preserve a manually confirmed indoor position', () => {
  const marked = Position.withIndoor(Position.create(), { floor: '4', x: 40, y: 75, source: 'manual', updatedAt: 1700000000000 });
  const updated = Position.withGps(marked, { latitude: 30.1, longitude: 120.2, accuracy: 20 }, 1700000001000);
  assert.equal(Position.hasIndoor(updated), true);
  assert.deepEqual([updated.floor, updated.x, updated.y, updated.indoorSource], ['4', 40, 75, 'manual']);
  assert.equal(updated.indoorUpdatedAt, 1700000000000);
  assert.equal(updated.updatedAt, 1700000001000);
});

test('future indoor provider can replace the manual point without changing GPS', () => {
  const gps = Position.withGps(Position.create(), { latitude: 30.1, longitude: 120.2, accuracy: 60 }, 1700000000000);
  const indoor = Position.withIndoor(gps, { floor: '4', x: 32, y: 63, source: 'indoor', accuracyMeters: 3, updatedAt: 1700000002000 });
  assert.equal(indoor.indoorSource, 'indoor');
  assert.equal(indoor.indoorAccuracyMeters, 3);
  assert.equal(indoor.latitude, gps.latitude);
  assert.equal(indoor.updatedAt, 1700000002000);
  assert.equal(Position.withoutIndoor(indoor).latitude, gps.latitude);
  assert.equal(Position.hasIndoor(Position.withoutIndoor(indoor)), false);
});

test('invalid GPS and image coordinates are rejected', () => {
  assert.throws(() => Position.withGps(Position.create(), { latitude: 91, longitude: 120, accuracy: 10 }, Date.now()));
  assert.throws(() => Position.withIndoor(Position.create(), { floor: '4', x: -1, y: 50, source: 'manual' }));
});

test('confirming a different building cannot retain an old indoor room point', () => {
  const indoor = Position.withIndoor(Position.create(), { building: 'C', floor: '4',
    x: 15, y: 61, source: 'qr', updatedAt: 1700000000000 });
  const campus = Position.withCampus(indoor, { building: 'LIBRARY', entrance: 'LIBRARY-EAST' });
  assert.equal(campus.building, 'LIBRARY');
  assert.equal(campus.entrance, 'LIBRARY-EAST');
  assert.equal(Position.hasIndoor(campus), false);
});

test('indoor fix priority is provider, QR, known place, then manual', () => {
  const base = Position.withIndoor(Position.create(), { floor: '4', x: 10, y: 20,
    source: 'manual', updatedAt: 1700000000000 });
  const qr = Position.withIndoor(base, { floor: '4', x: 15, y: 61,
    source: 'qr', navigationNode: 'l16_61', anchorId: 'C-F4-WEST-STAIR',
    updatedAt: 1700000001000 });
  assert.equal(qr.indoorSource, 'qr');
  assert.equal(Position.withIndoor(qr, { floor: '4', x: 40, y: 50,
    source: 'known', updatedAt: 1700000002000 }), qr);
  const provider = Position.withIndoor(qr, { floor: '4', x: 16, y: 62,
    source: 'indoor', updatedAt: 1700000003000 });
  assert.equal(provider.indoorSource, 'indoor');
  assert.equal(provider.x, 16);
});
