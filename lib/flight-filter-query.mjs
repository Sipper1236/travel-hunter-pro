/** Browser-safe flight filter validation; source and geographic lookups belong to the server. */
export function validateFilters(input={}) {
 if(!input || typeof input!=='object'||Array.isArray(input))throw Error('Invalid flight filters.');
 const maxStops=input.maxStops ?? null, maxPrice=input.maxPrice ?? null, maxDurationMinutes=input.maxDurationMinutes ?? null, sort=input.sort ?? 'price';
 const departureWindow=input.departureWindow ?? null;
 const minLayover=input.minLayover ?? null, maxLayover=input.maxLayover ?? null;
 const airlinesInclude=input.airlinesInclude ?? [], airlinesExclude=input.airlinesExclude ?? [], countriesExclude=input.countriesExclude ?? [];
 if(maxStops!==null && (!Number.isInteger(maxStops)||maxStops<0||maxStops>2))throw Error('Choose a maximum of 0, 1 or 2 stops.');
 if(maxPrice!==null && (!Number.isFinite(maxPrice)||maxPrice<=0))throw Error('Enter a positive CAD budget.');
 if(maxDurationMinutes!==null && (!Number.isInteger(maxDurationMinutes)||maxDurationMinutes<60||maxDurationMinutes>2880))throw Error('Maximum journey duration must be between 60 and 2880 minutes.');
 for(const value of [minLayover,maxLayover])if(value!==null&&(!Number.isInteger(value)||value<0||value>2880))throw Error('Layover limits must be between 0 and 2880 minutes.');
 if(minLayover!==null&&maxLayover!==null&&minLayover>maxLayover)throw Error('Minimum layover cannot exceed maximum layover.');
 for(const codes of [airlinesInclude,airlinesExclude])if(!Array.isArray(codes)||codes.length>20||codes.some(code=>typeof code!=='string'||!/^[A-Z0-9]{2}$/.test(code)))throw Error('Enter two-character airline codes separated by commas.');
 if(!Array.isArray(countriesExclude)||countriesExclude.length>30||countriesExclude.some(code=>typeof code!=='string'||!/^[A-Z]{2}$/.test(code)))throw Error('Enter two-letter country codes separated by commas.');
 if(!['price','price_high','duration','departure'].includes(sort))throw Error('Choose a supported sort order.');
 if(departureWindow!==null&&!['before_0600','0600_1200','1200_1800','1800_2400'].includes(departureWindow))throw Error('Choose a supported departure-time window.');
 return {maxStops,maxPrice,maxDurationMinutes,departureWindow,sort,minLayover,maxLayover,airlinesInclude,airlinesExclude,countriesExclude};
}
