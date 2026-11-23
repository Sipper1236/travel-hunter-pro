import {useEffect,useState} from 'react';
import {matrixDetailExpansionEligible} from '../lib/matrix-options.mjs';

function codes(value) {
  return value.split(',').map(code => code.trim().toUpperCase()).filter(Boolean);
}

function toggleCode(current, code) {
  return current.includes(code) ? current.filter(value => value !== code) : [...current, code];
}

export default function AdvancedFilters({ filters, onChange, cabin, source, matrixOptions, onMatrixOptionsChange, airlineSuggestions, origin, destination, originType, destinationType, dateSearchMode }) {
  const [directoryQuery,setDirectoryQuery]=useState(''),[directory,setDirectory]=useState({status:'idle',items:[],sourceUrl:null,limitation:null});
  const update = patch => onChange(current => ({ ...current, ...patch }));
  const updateMatrix = patch => onMatrixOptionsChange(current => ({ ...current, ...patch }));
  const toggleInclude = code => {
    const removing = filters.airlinesInclude.includes(code);
    update({
      airlinesInclude: toggleCode(filters.airlinesInclude, code),
      ...(removing ? {} : { airlinesExclude: filters.airlinesExclude.filter(value => value !== code) }),
    });
  };
  const toggleExclude = code => {
    const removing = filters.airlinesExclude.includes(code);
    update({
      airlinesExclude: toggleCode(filters.airlinesExclude, code),
      ...(removing ? {} : { airlinesInclude: filters.airlinesInclude.filter(value => value !== code) }),
    });
  };
  const includeText = filters.airlinesInclude.join(', ');
  const excludeText = filters.airlinesExclude.join(', ');
  const detailEligible=matrixDetailExpansionEligible({origin,destination,originType,destinationType,dateSearchMode,cabin,maxExtraLegsRelativeToMinimum:matrixOptions.maxExtraLegsRelativeToMinimum});
  const matrixOnlyAuto=source==='ita-matrix'&&detailEligible;
  const reset=()=>onChange({maxStops:null,maxPrice:null,maxDurationMinutes:null,departureWindow:null,sort:'price',airlinesInclude:[],airlinesExclude:[],minLayover:null,maxLayover:null,countriesExclude:[]});

  useEffect(()=>{
    const query=directoryQuery.trim();
    if(query.length<2){setDirectory({status:'idle',items:[],sourceUrl:null,limitation:null});return;}
    const controller=new AbortController(),timer=setTimeout(async()=>{
      setDirectory(previous=>({...previous,status:'loading',items:[]}));
      try{
        const response=await fetch('/api/airlines',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query}),signal:controller.signal});
        const result=await response.json();if(!response.ok)throw Error(result.error||'Airline lookup unavailable.');
        setDirectory({status:'ready',items:result.items??[],sourceUrl:result.sourceUrl??null,limitation:result.limitation??null});
      }catch(error){if(error.name!=='AbortError')setDirectory({status:'error',items:[],sourceUrl:null,limitation:error.message});}
    },300);
    return()=>{clearTimeout(timer);controller.abort();};
  },[directoryQuery]);

  const chooseDirectoryCode=(mode,code)=>{
    const removing=filters[mode].includes(code);
    update({[mode]:toggleCode(filters[mode],code),...(removing?{}:mode==='airlinesInclude'?{airlinesExclude:filters.airlinesExclude.filter(value=>value!==code)}:{airlinesInclude:filters.airlinesInclude.filter(value=>value!==code)})});
  };

  return <details className="advanced-filters" open>
    <summary>More search settings</summary>
    <button type="button" className="filter-reset" onClick={reset}>Reset flight filters</button>
    <div className="advanced-filter-groups">
      <fieldset>
        <legend>Stops and budget</legend>
        <label htmlFor="filter-max-stops">Maximum stops<select id="filter-max-stops" value={filters.maxStops ?? ''} onChange={event => update({ maxStops: event.target.value === '' ? null : Number(event.target.value) })}>
          <option value="">Any</option><option value="0">Nonstop</option><option value="1">1 stop</option><option value="2">2 stops</option>
        </select></label>
        <label htmlFor="filter-max-price">Group budget (CAD)<input id="filter-max-price" type="number" min="1" step="0.01" value={filters.maxPrice ?? ''} onChange={event => update({ maxPrice: event.target.value === '' ? null : Number(event.target.value) })} placeholder="No limit"/></label>
        <label htmlFor="filter-max-duration">Maximum duration per direction (hours)<input id="filter-max-duration" type="number" min="1" max="48" step="1" value={filters.maxDurationMinutes === null ? '' : filters.maxDurationMinutes / 60} onChange={event => update({ maxDurationMinutes: event.target.value === '' ? null : Number(event.target.value) * 60 })} placeholder="No limit" aria-describedby="duration-filter-help"/></label>
        <p id="duration-filter-help" className="note">Applies to each outbound and return direction using the first departure and final arrival timestamps, including layovers. Results without a complete offset-aware segment timeline are omitted when this limit is set.</p>
      </fieldset>

      <fieldset>
        <legend>Departure time</legend>
        <label htmlFor="filter-departure-window">Local departure time for each direction<select id="filter-departure-window" value={filters.departureWindow ?? ''} onChange={event => update({ departureWindow: event.target.value || null })}>
          <option value="">Any time</option><option value="before_0600">Before 6:00 a.m.</option><option value="0600_1200">6:00 a.m. to noon</option><option value="1200_1800">Noon to 6:00 p.m.</option><option value="1800_2400">6:00 p.m. to midnight</option>
        </select></label>
        <p className="note">Uses the provider’s reported local departure time for the outbound and, on round trips, the return. Offers with missing or invalid times are omitted and counted when a window is selected.</p>
      </fieldset>

      <fieldset>
        <legend>Airlines</legend>
        <label htmlFor="filter-airlines-include">Airline codes to include<input id="filter-airlines-include" value={includeText} onChange={event => update({ airlinesInclude: codes(event.target.value) })} placeholder="e.g. AC, BA" aria-describedby="airline-filter-help"/></label>
        <label htmlFor="filter-airlines-exclude">Airline codes to exclude<input id="filter-airlines-exclude" value={excludeText} onChange={event => update({ airlinesExclude: codes(event.target.value) })} placeholder="e.g. AC, BA" aria-describedby="airline-filter-help"/></label>
        <p id="airline-filter-help" className="note">Use two-character airline codes. Suggestions come from fresh carrier codes in your latest observed results; they do not predict other airlines.</p>
        <label htmlFor="airline-directory-query">Find an airline by name or code<input id="airline-directory-query" value={directoryQuery} onChange={event=>setDirectoryQuery(event.target.value)} placeholder="e.g. Air Canada or AC" autoComplete="off" aria-describedby="airline-directory-help"/></label>
        <p id="airline-directory-help" className="note">Live lookup from Wikidata’s IATA-designator records. Coverage may be incomplete or historical; this directory does not validate a carrier for your exact flights.</p>
        {directoryQuery.trim().length>=2&&<div className="airline-directory-results" aria-live="polite" aria-label="Live airline directory suggestions">
          {directory.status==='loading'&&<p className="note">Searching the live airline directory…</p>}
          {directory.status==='error'&&<p className="note" role="status">{directory.limitation}</p>}
          {directory.status==='ready'&&<>
            {directory.items.length===0&&<p className="note">No matching carrier records were returned.</p>}
            {directory.items.map(item=><div className="airline-suggestion" key={item.code}>
              <span>{item.name} ({item.code}){item.otherNames?.length>0&&<small>Also listed as: {item.otherNames.join(', ')}</small>}</span>
              <button type="button" aria-pressed={filters.airlinesInclude.includes(item.code)} aria-label={`${filters.airlinesInclude.includes(item.code)?'Remove':'Include'} ${item.name} (${item.code}) ${filters.airlinesInclude.includes(item.code)?'from':'in'} airline filter`} onClick={()=>chooseDirectoryCode('airlinesInclude',item.code)}>Include</button>
              <button type="button" aria-pressed={filters.airlinesExclude.includes(item.code)} aria-label={`${filters.airlinesExclude.includes(item.code)?'Remove':'Exclude'} ${item.name} (${item.code}) ${filters.airlinesExclude.includes(item.code)?'from':'in'} airline filter`} onClick={()=>chooseDirectoryCode('airlinesExclude',item.code)}>Exclude</button>
            </div>)}
            {directory.sourceUrl&&<p className="note">Source: <a href={directory.sourceUrl} target="_blank" rel="noreferrer">Wikidata IATA designators ↗</a>. {directory.limitation}</p>}
          </>}
        </div>}
        {airlineSuggestions.length > 0 ? <div className="airline-suggestions" aria-label="Airlines in latest observed results">
          {airlineSuggestions.map(({ code, name, offerCount }) => <div className="airline-suggestion" key={code}>
            <span>{name} ({code}) <small>{offerCount} result {offerCount === 1 ? 'offer' : 'offers'}</small></span>
            <button type="button" aria-pressed={filters.airlinesInclude.includes(code)} aria-label={`${filters.airlinesInclude.includes(code) ? 'Remove' : 'Include'} ${name} (${code}) ${filters.airlinesInclude.includes(code) ? 'from' : 'in'} airline filter`} onClick={() => toggleInclude(code)}>Include</button>
            <button type="button" aria-pressed={filters.airlinesExclude.includes(code)} aria-label={`${filters.airlinesExclude.includes(code) ? 'Remove' : 'Exclude'} ${name} (${code}) ${filters.airlinesExclude.includes(code) ? 'from' : 'in'} airline filter`} onClick={() => toggleExclude(code)}>Exclude</button>
          </div>)}
        </div> : <p className="note">Search for flights to see airline suggestions from observed itineraries.</p>}
      </fieldset>

      <fieldset>
        <legend>Layovers and countries</legend>
        <label htmlFor="filter-exclude-countries">Exclude layover countries<input id="filter-exclude-countries" value={filters.countriesExclude.join(', ')} onChange={event => update({ countriesExclude: codes(event.target.value) })} placeholder="e.g. US, GB"/></label>
        <label htmlFor="filter-min-layover">Minimum layover (minutes)<input id="filter-min-layover" type="number" min="0" max="2880" value={filters.minLayover ?? ''} onChange={event => update({ minLayover: event.target.value === '' ? null : Number(event.target.value) })}/></label>
        <label htmlFor="filter-max-layover">Maximum layover (minutes)<input id="filter-max-layover" type="number" min="0" max="2880" value={filters.maxLayover ?? ''} onChange={event => update({ maxLayover: event.target.value === '' ? null : Number(event.target.value) })}/></label>
      </fieldset>

      <fieldset>
        <legend>Sort results</legend>
        <label htmlFor="filter-sort">Sort by<select id="filter-sort" value={filters.sort} onChange={event => update({ sort: event.target.value })}>
          <option value="price">Lowest price</option><option value="price_high">Highest price</option><option value="duration">Shortest duration</option><option value="departure">Departure time</option>
        </select></label>
      </fieldset>

      <fieldset>
        <legend>ITA Matrix route options</legend>
        <label htmlFor="matrix-extra-legs">Extra flight legs<select id="matrix-extra-legs" value={matrixOptions.maxExtraLegsRelativeToMinimum} onChange={event => updateMatrix({ maxExtraLegsRelativeToMinimum: Number(event.target.value) })}>
          {[0, 1, 2, 3, 4, 5].map(value => <option value={value} key={value}>{value}</option>)}
        </select></label>
        <p className="note">Maximum legs above the fewest-leg itinerary found for the route. Zero prefers the fewest legs; higher values may include more connections.</p>
        <label htmlFor="matrix-airport-changes"><input id="matrix-airport-changes" type="checkbox" checked={matrixOptions.allowAirportChanges} onChange={event => updateMatrix({ allowAirportChanges: event.target.checked })} /> Allow airport changes during a connection</label>
        <p className="note">When enabled, Matrix may include itineraries that switch airports between flights. Check the connection location and transfer time with the seller.</p>
        <label htmlFor="matrix-expand-details"><input id="matrix-expand-details" type="checkbox" checked={detailEligible&&(matrixOnlyAuto||matrixOptions.expandDetailedItineraries)} disabled={!detailEligible||matrixOnlyAuto} onChange={event => updateMatrix({ expandDetailedItineraries: event.target.checked })} /> Expand detailed Matrix itineraries</label>
        <p className="note">Available only for a fixed-date, single-airport economy search with at most two extra stops. Matrix expands up to three connecting results into flight segments. This runs automatically when ITA Matrix is the only selected source; with all sources, opt in here. Regional, city-wide and flexible-calendar searches keep this off to bound browser and provider work. Matrix prices remain observations, not seller-confirmed offers, and incomplete results stay labeled price-only.</p>
      </fieldset>
    </div>
  </details>;
}
