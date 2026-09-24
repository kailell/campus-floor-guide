(function (root) {
  function create({ element, config, onStatus }) {
    let AMap = null, map = null, blueDot = null, accuracyCircle = null;
    let walking = null, currentLngLat = null, lastGps = null, sequence = 0;
    let follow = true, placesShown = false;

    function status(message, error = false) { onStatus(message, error); }
    function configured() {
      return !!config.amapKey && /^https:\/\//.test(config.amapServiceHost || '');
    }
    function loadScript() {
      return new Promise((resolve, reject) => {
        const callback = '__campusAmapReady';
        const timer = setTimeout(() => { cleanup(); reject(new Error('高德地图脚本加载超时')); }, 20000);
        function cleanup() { clearTimeout(timer); delete root[callback]; }
        root[callback] = () => { cleanup(); resolve(root.AMap); };
        root._AMapSecurityConfig = { serviceHost: config.amapServiceHost };
        const script = document.createElement('script');
        script.src = 'https://webapi.amap.com/maps?v=2.0&key=' + encodeURIComponent(config.amapKey) +
          '&plugin=AMap.Walking&callback=' + callback;
        script.async = true;
        script.onerror = () => { cleanup(); reject(new Error('高德地图脚本无法加载，请检查网络、Key 和域名配置')); };
        document.head.append(script);
      });
    }
    async function load() {
      if (!configured()) {
        status('校园底图尚未配置：需要高德 Web 端 Key 与安全密钥代理地址。四楼地图和定位诊断仍可使用。', true);
        return false;
      }
      try {
        AMap = await loadScript();
        if (!AMap) throw new Error('高德地图脚本未返回地图对象');
        map = new AMap.Map(element, { zoom: 16, viewMode: '2D' });
        map.on('dragstart', () => { follow = false; });
        status('校园地图已加载，等待设备位置');
        if (lastGps) updateGps(lastGps);
        return true;
      } catch (error) { status(error.message, true); return false; }
    }
    function addPlaces(places) {
      if (!map || placesShown) return;
      placesShown = true;
      places.filter(place => place.verified && place.entrances.some(entrance =>
        root.CampusPlaces.hasCoordinate(entrance))).forEach(place => {
        const entrance = place.entrances.find(root.CampusPlaces.hasCoordinate);
        map.add(new AMap.Marker({ position: [entrance.longitude, entrance.latitude], title: place.name }));
      });
    }
    function updateGps(position) {
      lastGps = position;
      if (!map) return;
      const ticket = ++sequence;
      // Browser geolocation is WGS84; AMap tiles and routes use GCJ-02.
      AMap.convertFrom([position.longitude, position.latitude], 'gps', (resultStatus, result) => {
        if (ticket !== sequence) return;
        if (resultStatus !== 'complete' || result.info !== 'ok' || !result.locations?.length) {
          status('设备位置已获取，但 GPS 坐标无法转换为高德坐标；地图蓝点暂不可用。', true);
          return;
        }
        const point = result.locations[0];
        currentLngLat = point;
        if (!blueDot) {
          blueDot = new AMap.CircleMarker({ center: point, radius: 9,
            fillColor: '#1678e8', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3,
            zIndex: 100 });
          accuracyCircle = new AMap.Circle({ center: point, radius: position.accuracy,
            fillColor: '#5da4f5', fillOpacity: .13, strokeColor: '#3586e3',
            strokeOpacity: .45, strokeWeight: 1 });
          map.add([accuracyCircle, blueDot]);
        } else {
          blueDot.setCenter(point); accuracyCircle.setCenter(point);
          accuracyCircle.setRadius(position.accuracy);
        }
        if (follow) map.setCenter(point);
        status('我的位置已显示在校园地图 · 精度约 '+Math.round(position.accuracy)+' 米');
      });
    }
    function centerOnMe() { follow = true; if (map && currentLngLat) map.setCenter(currentLngLat); }
    function routeTo(place) {
      return new Promise((resolve, reject) => {
        if (!map) return reject(new Error('校园地图尚未加载，请先配置高德地图服务'));
        if (!currentLngLat) return reject(new Error('尚未获得可用于地图的设备位置'));
        const entrance = place.entrances.find(root.CampusPlaces.hasCoordinate);
        if (!entrance || !entrance.verified) return reject(new Error('此建筑入口坐标尚未现场采集和核对'));
        if (!walking) walking = new AMap.Walking({ map, hideMarkers: true, autoFitView: true });
        walking.clear();
        walking.search(currentLngLat, [entrance.longitude, entrance.latitude], (resultStatus, result) => {
          if (resultStatus === 'complete' && result.routes?.length) {
            status('步行路线已生成：前往 '+entrance.name); resolve({ entrance, route: result.routes[0] });
          } else reject(new Error(resultStatus === 'no_data'?'没有找到可步行路线':'高德步行路线请求失败'));
        });
      });
    }
    return { configured, load, addPlaces, updateGps, centerOnMe, routeTo,
      getCurrentLngLat: () => currentLngLat, getMap: () => map };
  }
  root.CampusOutdoorMap = { create };
})(window);
