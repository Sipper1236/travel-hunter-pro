import {fetchSource} from './source-fetch.mjs';
import {createRegionCache} from './region-cache.mjs';
import {join} from 'node:path';
const EUROPE_POPULARITY_EXCLUSION_LIMIT=3;
export const OUR_AIRPORTS_URL='https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
export function parseAirportCsv(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(cell.replace(/\r$/,''));cell='';if(c==='\n'){rows.push(row);row=[];}}else cell+=c;}
 if(quoted)throw Error('OurAirports CSV has an unterminated quoted field.');if(cell||row.length){row.push(cell);rows.push(row);}
 const header=rows.shift(),required=['ident','name','iata_code','iso_country','latitude_deg','longitude_deg','scheduled_service','type'];
 if(!header||required.some(key=>!header.includes(key)))throw Error('OurAirports CSV schema changed.');
 const airports=[];
 for(const values of rows){const r=Object.fromEntries(header.map((key,i)=>[key,values[i]])),latitude=Number(r.latitude_deg),longitude=Number(r.longitude_deg);
  if(!/^[A-Z]{3}$/.test(r.iata_code??'')||!r.name||!r.ident||!['large_airport','medium_airport','small_airport'].includes(r.type)||r.scheduled_service!=='yes'||!r.latitude_deg?.trim()||!r.longitude_deg?.trim()||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)continue;
  airports.push({code:r.iata_code,name:r.name,country:r.iso_country,iso:r.iso_country,latitude,longitude,type:r.type,sourceUrl:`https://ourairports.com/airports/${encodeURIComponent(r.ident)}/`,source:'OurAirports'});
 }
 return airports;
}
const cache=createRegionCache({directory:join(process.cwd(),'.cache','ourairports-v1')});
export async function loadOurAirports(){return cache('world',async()=>{
 const response=await fetchSource('OurAirports directory',OUR_AIRPORTS_URL,{},{timeoutMs:45000});if(!response.ok)throw Error(`OurAirports HTTP ${response.status}.`);
 const reader=response.body.getReader(),chunks=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>25_000_000){await reader.cancel();throw Error('OurAirports download exceeds size limit.');}chunks.push(Buffer.from(value));}
 const airports=parseAirportCsv(Buffer.concat(chunks).toString('utf8'));if(airports.length<1000)throw Error('OurAirports snapshot has too few usable airports.');
 return {region:{name:'OurAirports worldwide snapshot'},airports,method:'Runtime downloaded OurAirports scheduled-service airports with IATA codes.'};
});}

export function mergeAirportSources(primary,secondary,{strictPopularity=false}={}){
 const excludedAirports=secondary?.excludedAirports??[],excludedCodes=new Set(excludedAirports.map(airport=>airport.code));
 const byCode=new Map();for(const airport of [...(primary?.airports??[]),...(primary?.uncheckedAirports??[])])if(!excludedCodes.has(airport.code)&&!byCode.has(airport.code))byCode.set(airport.code,{...airport,sources:['OurAirports']});
 for(const airport of [...(secondary?.airports??[]),...(secondary?.uncheckedAirports??[])])if(!excludedCodes.has(airport.code)){const prior=byCode.get(airport.code);byCode.set(airport.code,{...prior,...airport,sources:prior?['OurAirports','Wikidata']:['Wikidata']});}
 const rank={large_airport:3,medium_airport:2,small_airport:1};
 const airports=[...byCode.values()].sort((a,b)=>{
  if(strictPopularity){const ap=Number.isFinite(a.passengers)&&a.passengers>0,bp=Number.isFinite(b.passengers)&&b.passengers>0;if(ap!==bp)return ap?-1:1;return ap?b.passengers-a.passengers||a.code.localeCompare(b.code):a.code.localeCompare(b.code);}
  return (b.passengers??0)-(a.passengers??0)||(rank[b.type]??0)-(rank[a.type]??0)||a.code.localeCompare(b.code);
 });
 const base=primary??secondary;if(!base)throw Error('Neither airport directory is available.');
 const orderNote=strictPopularity?'Europe candidates with recorded passenger figures rank by those figures only; candidates without traffic data follow alphabetically and are not described as popularity-ranked.':'Available historical passenger figures rank first; remaining candidates use airport size then IATA code, not measured popularity.';
 const popularityCoverage=strictPopularity?{popularityExclusionLimit:secondary?.popularityExclusionLimit??EUROPE_POPULARITY_EXCLUSION_LIMIT,popularityRankedCandidates:secondary?.popularityRankedCandidates??(secondary?undefined:0),popularityExclusionShortfall:secondary?.popularityExclusionShortfall??(secondary?undefined:EUROPE_POPULARITY_EXCLUSION_LIMIT)}:{};
 return {...base,countries:[...new Map([...(primary?.countries??[]),...(secondary?.countries??[])].map(country=>[country.iso??country.name,country])).values()],airports:airports.slice(0,100),uncheckedAirports:airports.slice(100),excludedAirports,...popularityCoverage,geographicExcludedAirportCount:secondary?.geographicExcludedAirportCount??0,geographyUnknownAirportCount:secondary?.geographyUnknownAirportCount??0,geographicExcludedAirports:secondary?.geographicExcludedAirports??[],geographyUnknownAirports:secondary?.geographyUnknownAirports??[],moreAvailable:airports.length>100||Boolean(primary?.moreAvailable||secondary?.moreAvailable),method:`${base.method} Combined OurAirports and Wikidata candidates, deduplicated by IATA code. ${orderNote} ${excludedCodes.size?`The Wikidata policy deliberately excludes its top ${excludedCodes.size} ranked airport candidates from the merged selection.`:''} Source absence is not proof an airport does not exist.`,directorySources:[{source:'OurAirports',status:primary?'available':'unavailable',cache:primary?.cache},{source:'Wikidata',status:secondary?'available':'unavailable',cache:secondary?.cache}]};
}
