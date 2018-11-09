import formatHit from './formatHit';
import version from './version';

export default function createAutocompleteSource({
  algoliasearch,
  clientOptions,
  apiKey,
  appId,
  hitsPerPage,
  aroundLatLng,
  aroundRadius,
  aroundLatLngViaIP,
  insideBoundingBox,
  insidePolygon,
  getRankingInfo,
  countries,
  formatInputValue,
  computeQueryParams = params => params,
  useDeviceLocation = false,
  language = navigator.language.split('-')[0],
  onHits = () => {},
  onError = e => {
    throw e;
  },
  onRateLimitReached,
  type,
}) {
  const placesClient = algoliasearch.initPlaces(appId, apiKey, clientOptions);
  placesClient.as.addAlgoliaAgent(`Algolia Places ${version}`);

  const defaultQueryParams = {
    countries,
    hitsPerPage: hitsPerPage || 5,
    language,
    type,
  };

  if (Array.isArray(defaultQueryParams.countries)) {
    defaultQueryParams.countries = defaultQueryParams.countries.map(country =>
      country.toLowerCase()
    );
  }

  if (typeof defaultQueryParams.language === 'string') {
    defaultQueryParams.language = defaultQueryParams.language.toLowerCase();
  }

  if (aroundLatLng) {
    defaultQueryParams.aroundLatLng = aroundLatLng;
  } else if (aroundLatLngViaIP !== undefined) {
    defaultQueryParams.aroundLatLngViaIP = aroundLatLngViaIP;
  }

  if (aroundRadius) {
    defaultQueryParams.aroundRadius = aroundRadius;
  }

  if (insideBoundingBox) {
    defaultQueryParams.insideBoundingBox = insideBoundingBox;
  }

  if (insidePolygon) {
    defaultQueryParams.insidePolygon = insidePolygon;
  }

  if (getRankingInfo) {
    defaultQueryParams.getRankingInfo = getRankingInfo;
  }

  let tracker = null;
  let userCoords;
  if (useDeviceLocation) {
    tracker = navigator.geolocation.watchPosition(({ coords }) => {
      userCoords = `${coords.latitude},${coords.longitude}`;
    });
  }

  const searcher = (query, cb) =>
    placesClient
      .search(
        computeQueryParams({
          ...defaultQueryParams,
          [userCoords ? 'aroundLatLng' : undefined]: userCoords,
          query,
        })
      )
      .then(content => {
        const hits = content.hits.map((hit, hitIndex) =>
          formatHit({
            formatInputValue,
            hit,
            hitIndex,
            query,
            rawAnswer: content,
          })
        );

        onHits({
          hits,
          query,
          rawAnswer: content,
        });

        return hits;
      })
      .then(cb)
      .catch(e => {
        if (e.statusCode === 429) {
          onRateLimitReached();
          return;
        }

        onError(e);
      });

  searcher.setUseDeviceLocation = bool => {
    if (bool && tracker === null) {
      tracker = navigator.geolocation.watchPosition(({ coords }) => {
        userCoords = `${coords.latitude},${coords.longitude}`;
      });
    } else if (!bool && tracker !== null) {
      navigator.geolocation.clearWatch(tracker);
      tracker = null;
    }
  };
  return searcher;
}
