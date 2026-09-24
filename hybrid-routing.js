(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusHybridRouting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function selectStage(location, destination, place) {
    if (location && location.building === destination.building &&
        location.floor === destination.floor &&
        Number.isFinite(location.x) && Number.isFinite(location.y)) return 'indoor';
    if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return 'needs-location';
    if (!place || !place.entrances.some(entrance => entrance.verified &&
        Number.isFinite(entrance.latitude) && Number.isFinite(entrance.longitude))) return 'needs-entrance';
    return 'outdoor';
  }
  return { selectStage };
});
