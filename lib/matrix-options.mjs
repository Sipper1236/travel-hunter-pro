export const DEFAULT_MATRIX_OPTIONS = Object.freeze({
  maxExtraLegsRelativeToMinimum: 1,
  allowAirportChanges: true,
  expandDetailedItineraries: false,
});

export function matrixDetailExpansionEligible({origin,destination,originType='auto',destinationType='auto',dateSearchMode='dates',cabin='economy',maxExtraLegsRelativeToMinimum=DEFAULT_MATRIX_OPTIONS.maxExtraLegsRelativeToMinimum}={}) {
  const airportCode=value=>typeof value==='string'&&/^[A-Z]{3}$/i.test(value.trim());
  return dateSearchMode==='dates'&&originType!=='region'&&destinationType!=='region'&&airportCode(origin)&&airportCode(destination)&&origin.trim().toUpperCase()!==destination.trim().toUpperCase()&&cabin==='economy'&&Number.isInteger(maxExtraLegsRelativeToMinimum)&&maxExtraLegsRelativeToMinimum>=0&&maxExtraLegsRelativeToMinimum<=2;
}

export function validateMatrixOptions(input = DEFAULT_MATRIX_OPTIONS) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Error('Invalid ITA Matrix search settings.');
  }
  const maxExtraLegsRelativeToMinimum = input.maxExtraLegsRelativeToMinimum ?? DEFAULT_MATRIX_OPTIONS.maxExtraLegsRelativeToMinimum;
  const allowAirportChanges = input.allowAirportChanges ?? DEFAULT_MATRIX_OPTIONS.allowAirportChanges;
  const expandDetailedItineraries = input.expandDetailedItineraries ?? DEFAULT_MATRIX_OPTIONS.expandDetailedItineraries;
  if (!Number.isInteger(maxExtraLegsRelativeToMinimum) || maxExtraLegsRelativeToMinimum < 0 || maxExtraLegsRelativeToMinimum > 5) {
    throw Error('Choose between 0 and 5 extra ITA Matrix flight legs.');
  }
  if (typeof allowAirportChanges !== 'boolean') throw Error('Choose whether ITA Matrix may change airports during a connection.');
  if (typeof expandDetailedItineraries !== 'boolean') throw Error('Choose whether ITA Matrix should expand detailed itineraries.');
  return { maxExtraLegsRelativeToMinimum, allowAirportChanges, expandDetailedItineraries };
}
