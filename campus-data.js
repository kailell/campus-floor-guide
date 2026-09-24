// Geographic coordinates remain null until measured at the actual campus.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusPlaces = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const places = [
    {
      id: 'C', name: 'C 教学楼', category: 'teaching', aliases: ['C楼', '教学楼C'],
      latitude: null, longitude: null, coordinateSystem: 'gcj02',
      entrances: [
        { id: 'C-MAIN', name: '教学楼入口（待现场确认）', latitude: null,
          longitude: null, coordinateSystem: 'gcj02', verified: false }
      ],
      floors: ['4'], verified: false
    }
  ];
  const categories = {
    teaching: '教学楼', library: '图书馆', dining: '食堂',
    residence: '宿舍', sports: '体育馆', other: '其他'
  };
  const normalize = text => String(text || '').trim().toLowerCase().replace(/\s+/g, '');
  const find = id => places.find(place => place.id === id) || null;
  const search = query => {
    const keyword = normalize(query);
    return keyword ? places.filter(place => [place.id, place.name, ...place.aliases]
      .some(value => normalize(value).includes(keyword))) : places.slice();
  };
  const hasCoordinate = value => !!value && Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) && value.coordinateSystem === 'gcj02';
  return { places, categories, find, search, hasCoordinate };
});
