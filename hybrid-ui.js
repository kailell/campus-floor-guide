// Coordinates the outdoor map and the existing fourth-floor route UI.
(function (root) {
  const guide = root.CampusGuide;
  const places = root.CampusPlaces;
  const anchors = root.CampusIndoorAnchors;
  const graph = root.CampusNavigationData;
  const indoor = root.CampusIndoorNavigation;
  const campusSection = document.getElementById('campus-section');
  const floorSection = document.getElementById('floor-section');
  const campusButton = document.getElementById('mode-campus');
  const floorButton = document.getElementById('mode-floor');
  const campusStatus = document.getElementById('campus-status');
  const campusPosition = document.getElementById('campus-position');
  const placeList = document.getElementById('campus-places');
  const arrivalPrompt = document.getElementById('arrival-prompt');
  const anchorNotice = document.getElementById('anchor-notice');
  const knownPicker = document.getElementById('known-location');
  const targetKey = 'campus-floor-guide-target-v1';
  let selectedPlace = places.find('C'), mapStarted = false, routeEntrance = null;

  function setStatus(message, error = false) {
    campusStatus.textContent = message;
    campusStatus.classList.toggle('error', error);
  }
  const outdoor = root.CampusOutdoorMap.create({
    element: document.getElementById('campus-map'),
    config: root.CampusMapConfig,
    onStatus: (message, error) => { setStatus(message, error); checkArrival(); }
  });
  function showMode(mode) {
    const campus = mode === 'campus';
    campusSection.hidden = !campus; floorSection.hidden = campus;
    campusButton.classList.toggle('active', campus); floorButton.classList.toggle('active', !campus);
    if (campus && !mapStarted) {
      mapStarted = true;
      requestAnimationFrame(async () => {
        const ready = await outdoor.load();
        if (ready) outdoor.addPlaces(places.places);
      });
    }
  }
  function saveTarget(id) {
    try { localStorage.setItem(targetKey, JSON.stringify({ id, time: Date.now() })); } catch {}
  }
  function restoreTarget() {
    try {
      const stored = JSON.parse(localStorage.getItem(targetKey));
      if (stored && Date.now() - stored.time < 2 * 60 * 60 * 1000 && guide.findRoom(stored.id)) return stored.id;
    } catch {}
    return null;
  }
  function pointArray(point) {
    return point ? [typeof point.getLng === 'function' ? point.getLng() : point.lng,
      typeof point.getLat === 'function' ? point.getLat() : point.lat] : null;
  }
  function distanceMeters(a, b) {
    const radians = Math.PI / 180, dLat = (b[1] - a[1]) * radians;
    const dLng = (b[0] - a[0]) * radians;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * radians) *
      Math.cos(b[1] * radians) * Math.sin(dLng / 2) ** 2;
    return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function checkArrival() {
    const gps = guide.getCurrentLocation(), point = pointArray(outdoor.getCurrentLngLat());
    if (!routeEntrance || !point || !Number.isFinite(gps.gpsAccuracyMeters)) return;
    const distance = distanceMeters(point, [routeEntrance.longitude, routeEntrance.latitude]);
    arrivalPrompt.hidden = distance > Math.max(40, Math.min(100, gps.gpsAccuracyMeters * 2));
  }
  async function routeToPlace(place) {
    selectedPlace = place; showMode('campus'); arrivalPrompt.hidden = true;
    try {
      const result = await outdoor.routeTo(place);
      routeEntrance = result.entrance;
      checkArrival();
    } catch (error) { setStatus(error.message + '。可以先查看四楼图，并用二维码或已知地点确认楼内位置。', true); }
  }
  function renderPlaces() {
    placeList.replaceChildren();
    for (const place of places.places) {
      const card = document.createElement('div'); card.className = 'place-card';
      const name = document.createElement('strong'); name.textContent = place.name;
      const note = document.createElement('small');
      note.textContent = place.entrances.some(entrance => entrance.verified && places.hasCoordinate(entrance))
        ? '已核对建筑入口' : '建筑入口坐标待现场采集';
      const route = document.createElement('button'); route.type = 'button'; route.className = 'primary';
      route.textContent = '步行导航到入口'; route.addEventListener('click', () => routeToPlace(place));
      card.append(name, note, route); placeList.append(card);
    }
  }
  function fillKnownLocations() {
    for (const anchor of anchors.anchors) {
      const option = document.createElement('option'); option.value = 'anchor:' + anchor.id;
      option.textContent = anchor.name + (anchor.verified ? '' : '（图上推定）'); knownPicker.append(option);
    }
    for (const room of guide.getRooms()) {
      const destination = graph.destinations[room.id];
      if (!destination) continue;
      const option = document.createElement('option'); option.value = 'room:' + room.id;
      option.textContent = room.id + ' 门口（示意）'; knownPicker.append(option);
    }
  }
  function selectKnownLocation() {
    const [kind, id] = knownPicker.value.split(':');
    if (!id) return;
    if (kind === 'anchor') {
      const anchor = anchors.find(id);
      if (!anchors.validate(anchor, graph)) return;
      guide.setIndoorPosition({ ...anchor, source: 'known', updatedAt: Date.now(), force: true });
      anchorNotice.textContent = anchor.verified ? '已选择 '+anchor.name : '已选择 '+anchor.name+'；位置来自示意图，尚未现场核对。';
    } else {
      const destination = graph.destinations[id];
      if (!destination) return;
      guide.setIndoorPosition({ building: 'C', floor: '4', x: destination.entrance[0],
        y: destination.entrance[1], navigationNode: destination.via,
        source: 'known', updatedAt: Date.now(), force: true });
      anchorNotice.textContent = '已选择 '+id+' 门口作为起点；门口位置依据示意图推断，需现场核对。';
    }
    anchorNotice.hidden = false; guide.hideDetail();
  }
  function applyQrAnchor() {
    const params = new URLSearchParams(root.location.search);
    const anchorId = params.get('anchor');
    if (!anchorId) return;
    showMode('floor');
    const anchor = anchors.find(anchorId);
    if (!anchors.validate(anchor, graph)) {
      anchorNotice.textContent = '二维码定位点不存在或数据无效：'+anchorId;
      anchorNotice.hidden = false; return;
    }
    guide.setIndoorPosition({ ...anchor, source: 'qr', anchorId: anchor.id, updatedAt: Date.now() });
    anchorNotice.textContent = '二维码定位：'+anchor.name +
      (anchor.verified ? '。' : '。该图上坐标尚未现场核对，投放二维码前请先确认。');
    anchorNotice.hidden = false;
    const targetId = params.get('target') || restoreTarget();
    if (targetId) {
      const room = guide.selectRoomById(targetId);
      if (room) indoor.startNavigation(room);
    }
  }

  campusButton.addEventListener('click', () => showMode('campus'));
  floorButton.addEventListener('click', () => showMode('floor'));
  document.getElementById('campus-enter-floor').addEventListener('click', () => showMode('floor'));
  document.getElementById('arrival-enter').addEventListener('click', () => {
    if (routeEntrance) guide.confirmEntrance({ building: 'C', entrance: routeEntrance.id });
    showMode('floor');
  });
  document.getElementById('campus-follow').addEventListener('click', () => outdoor.centerOnMe());
  document.getElementById('campus-diagnose').addEventListener('click', () => {
    showMode('floor'); guide.showLocation(); document.getElementById('geo-diagnostics').open = true;
  });
  document.getElementById('use-known-location').addEventListener('click', selectKnownLocation);
  document.addEventListener('guide:location-updated', event => {
    const position = event.detail.location;
    if (Number.isFinite(position.latitude) && Number.isFinite(position.longitude)) {
      campusPosition.textContent = '设备位置：'+position.latitude.toFixed(5)+', '+position.longitude.toFixed(5)+
        ' · 约 '+Math.round(position.gpsAccuracyMeters)+' 米 · 更新 '+
        new Date(position.gpsUpdatedAt).toLocaleTimeString('zh-CN');
      outdoor.updateGps({ latitude: position.latitude, longitude: position.longitude,
        accuracy: position.gpsAccuracyMeters });
      checkArrival();
    }
  });
  document.addEventListener('guide:geo-state', event => {
    const state = event.detail.state;
    if (state.lastError) {
      campusPosition.textContent = '设备定位：'+state.lastError.message+'。'+state.lastError.advice;
    }
  });
  document.addEventListener('guide:room-selected', event => {
    saveTarget(event.detail.room.id); showMode('floor');
  });
  document.addEventListener('guide:navigation-ended', () => {
    try { localStorage.removeItem(targetKey); } catch {}
  });
  document.addEventListener('guide:navigation-requested', event => {
    if (!event.detail.room) return;
    event.preventDefault();
    saveTarget(event.detail.room.id);
    const stage = root.CampusHybridRouting.selectStage(guide.getCurrentLocation(),
      { building: 'C', floor: '4', id: event.detail.room.id }, places.find('C'));
    if (stage === 'indoor') indoor.startNavigation(event.detail.room);
    else if (stage === 'outdoor') routeToPlace(places.find('C'));
    else if (stage === 'needs-location') {
      guide.showLocation();
      anchorNotice.textContent = '尚未得到设备位置。可查看定位诊断，或扫描二维码、选择已知地点、手动标记楼内起点。';
      anchorNotice.hidden = false;
    } else routeToPlace(places.find('C'));
  });
  root.CampusHybrid = { showMode, routeToPlace, selectKnownLocation };
  renderPlaces(); fillKnownLocations();
  if (outdoor.configured()) showMode('campus');
  applyQrAnchor();
})(window);
