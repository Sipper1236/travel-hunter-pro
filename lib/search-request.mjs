import {searchProviders} from './providers.mjs';
import {searchLocations} from './location-search.mjs';
import {validateSearchParty} from './travelers.mjs';
import {validateFilters} from './flight-filters.mjs';
import {detectDestination} from './destination.mjs';
import {M49_POLICY_VERSION,m49PolicyFor} from './m49-regions.mjs';

export async function executeFlightSearch(input,{onProgress=()=>{},allowExpanded=true,checkpoint,onCheckpoint,searchLocationsImpl=searchLocations,searchProvidersImpl=searchProviders,providerOptions,providerCache}={}) {
  onProgress({stage:'resolving_locations'});
    validateSearchParty(input);
    for (const side of ['origin','destination']) if (input[`${side}CityId`] !== undefined && (typeof input[`${side}CityId`] !== 'string' || !/^Q[1-9]\d*$/.test(input[`${side}CityId`]) || input[`${side}Type`] === 'region')) throw Error('Choose a valid city or clear the city selection before searching a region.');
    validateFilters(input.filters);
    for (const field of ['originType','destinationType']) if (input[field] !== undefined && !['auto','place','region'].includes(input[field])) throw new Error(`Choose a valid ${field === 'originType' ? 'origin' : 'destination'} type.`);
    const detectionFor = async (value, type) => {
      if (type === 'region') {
        const policy=m49PolicyFor(value);
        return policy?.scope ? {type:'region',canonicalName:value.trim(),method:'Versioned local geographic policy',model:'not-used',source:policy.sourceUrl??'https://unstats.un.org/unsd/methodology/m49/overview/',policyVersion:M49_POLICY_VERSION,policyNote:policy.note??null} : {type:'region',method:'Selected by traveler'};
      }
      if (type !== 'region' && typeof value === 'string' && /^[A-Z]{3}$/.test(value.trim())) return {type:'place',kind:'airport',method:'Three-letter code; source will validate it'};
      return !type || type === 'auto' ? detectDestination(value) : {type,method:'Selected by traveler'};
    };
    const [originDetection, destinationDetection] = checkpoint?.detections ? [checkpoint.detections.origin,checkpoint.detections.destination] : await Promise.all([
      input.originCityId ? {type:'place',kind:'city',method:'Selected city; server will revalidate'} : detectionFor(input.origin, input.originType),
      input.destinationCityId ? {type:'place',kind:'city',method:'Selected city; server will revalidate'} : detectionFor(input.destination, input.destinationType),
    ]);
    if (!['place','region'].includes(originDetection.type)) throw Object.assign(Error(`Origin: ${originDetection.reason}`),{status:422,originDetection});
    if (!['place','region'].includes(destinationDetection.type)) throw Object.assign(Error(`Destination: ${destinationDetection.reason}`),{status:422,destinationDetection});
    if (input.source === 'google' && input.tripType !== 'round-trip' && !input.originCityId && !input.destinationCityId && /^[A-Z]{3}$/.test(input.origin) && /^[A-Z]{3}$/.test(input.destination) && originDetection.type !== 'region' && destinationDetection.type !== 'region') {
      const result=await searchProvidersImpl(input,providerOptions);
      return {...result,originDetection,destinationDetection};
    }
    if(!allowExpanded)throw Object.assign(Error('Location-expanded searches are limited to the local app.'),{status:403});
    return {...(await searchLocationsImpl(input,{origin:originDetection,destination:destinationDetection},{onProgress,checkpoint,onCheckpoint,...(providerCache?{providerCache}:{})})), originDetection, destinationDetection};
}
