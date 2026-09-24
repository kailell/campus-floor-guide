// One location record can hold a device fix and an independently sourced indoor fix.
// GPS updates must never invent or overwrite a position on the floor image.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusPosition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const validPercent = value => Number.isFinite(value) && value >= 0 && value <= 100;
  const validTime = value => Number.isFinite(value) && value > 0;

  function create() {
    return {
      type: 'current', latitude: null, longitude: null, gpsAccuracyMeters: null,
      gpsUpdatedAt: null, floor: null, x: null, y: null,
      indoorSource: null, indoorAccuracyMeters: null, indoorUpdatedAt: null,
      updatedAt: null
    };
  }

  function withGps(position, coords, timestamp) {
    const { latitude, longitude, accuracy } = coords;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
        !Number.isFinite(accuracy) || accuracy < 0 || !validTime(timestamp)) {
      throw new Error('无效的设备定位数据');
    }
    return {
      ...position, latitude, longitude, gpsAccuracyMeters: accuracy,
      gpsUpdatedAt: timestamp, updatedAt: Math.max(position.updatedAt || 0, timestamp)
    };
  }

  function withIndoor(position, fix) {
    const { floor, x, y, source, accuracyMeters = null, updatedAt = null } = fix;
    if (typeof floor !== 'string' || !floor.trim() || !validPercent(x) || !validPercent(y) ||
        !['manual', 'indoor'].includes(source) ||
        (accuracyMeters !== null && (!Number.isFinite(accuracyMeters) || accuracyMeters < 0)) ||
        (updatedAt !== null && !validTime(updatedAt))) {
      throw new Error('无效的楼层图位置数据');
    }
    return {
      ...position, floor, x, y, indoorSource: source,
      indoorAccuracyMeters: accuracyMeters, indoorUpdatedAt: updatedAt,
      updatedAt: Math.max(position.gpsUpdatedAt || 0, updatedAt || 0) || null
    };
  }

  function withoutIndoor(position) {
    return {
      ...position, floor: null, x: null, y: null, indoorSource: null,
      indoorAccuracyMeters: null, indoorUpdatedAt: null,
      updatedAt: position.gpsUpdatedAt
    };
  }

  const hasIndoor = position => validPercent(position.x) && validPercent(position.y) && !!position.floor;
  return { create, withGps, withIndoor, withoutIndoor, hasIndoor };
});
