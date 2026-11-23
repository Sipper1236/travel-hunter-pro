export const M49_POLICY_VERSION='UNSD-M49-2026-10+TH-2026-11.1';
const policy=(scope,note=null,sourceUrl=null)=>({scope,note,sourceUrl});
const nordicRegion=policy({iso2:['AX','DK','FI','FO','GL','IS','NO','SE']},'Travel Hunter convention: typed “Scandinavia” and “Nordic countries” resolve to the Nordic Council of Ministers’ eight-entity Nordic Region. This is broader than the narrow Scandinavia usage and differs from the M49 Northern Europe policy; review this exact membership.', 'https://www.norden.org/en/information/facts-about-nordic-countries');
const mediterraneanConventionParties=policy({iso2:['AL','DZ','BA','HR','CY','EG','FR','GR','IL','IT','LB','LY','MT','MC','ME','MA','SI','ES','SY','TN','TR']},'Travel Hunter convention: typed “Mediterranean” resolves to the 21 state parties to the Barcelona Convention as a reproducible coastal-region proxy. The Convention defines a marine area, not this country list; airports anywhere in these states may be included. This differs from M49 Southern Europe and is not an exhaustive shoreline definition.', 'https://www.unep.org/unepmap/node/19634');
const oceania=policy({regions:['009']},'Travel Hunter convention: typed “Oceania” or “South Pacific” resolves to the full UNSD M49 Oceania set, including Australia and New Zealand. “South Pacific” has no single canonical boundary; review the 29-area coverage note.', 'https://unstats.un.org/unsd/methodology/m49/overview/');
const policies=new Map([
 ['north america',policy({subregions:['021'],intermediates:['013','029']},'M49 North America (003) combines Northern America, Caribbean and Central America; these scopes overlap the separately requested region labels.')],
 ['united states',policy({areas:['840']},'Uses M49 area 840 only; separately coded US territories are not included.')],
 ['canada',policy({areas:['124']})],
 ['greenland & st. pierre',policy({areas:['304','666']},'Composite M49 areas: Greenland and Saint Pierre and Miquelon; not the administering states.')],
 ['latin america & the caribbean',policy({subregions:['419']})],
 ['central america & mexico',policy({intermediates:['013']})],
 ['south america',policy({intermediates:['005']})],
 ['the caribbean',policy({intermediates:['029']})],
 ['europe',policy({regions:['150']})],
 ['western europe',policy({subregions:['155']})],
 ['eastern europe',policy({subregions:['151']})],
 ['northern europe / scandinavia',policy({subregions:['154']},'Provisional: uses all M49 Northern Europe, not the narrower and variably defined Scandinavia region.')],
 ['southern europe / mediterranean',policy({subregions:['039']},'Provisional: uses M49 Southern Europe only; Mediterranean coastal areas outside Europe are not included.')],
 ['middle east',policy({subregions:['145'],iso2:['EG','IR']},'Travel Hunter convention: all UNSD M49 Western Asia, plus Egypt and Iran. This includes Türkiye, Cyprus, Armenia, Azerbaijan and Georgia; other “Middle East” definitions differ.', 'https://unstats.un.org/unsd/methodology/m49/overview/')],
 ['gulf states',policy({iso2:['BH','KW','OM','QA','SA','AE']},'Provisional: “Gulf States” means the six Gulf Cooperation Council members. Membership source: GCC official member states.', 'https://www.gcc-sg.org/en/AboutUs/MemberStates/Pages/default.aspx')],
 ['levant & beyond',policy({iso2:['CY','EG','IQ','IL','JO','LB','PS','SY','TR']},'Travel Hunter convention: Cyprus, Egypt, Iraq, Israel, Jordan, Lebanon, State of Palestine, Syria and Türkiye. This treats “beyond” as adjacent Eastern Mediterranean and northern Mesopotamia; Gulf states and Iran are excluded.', 'https://unstats.un.org/unsd/methodology/m49/overview/')],
 ['africa',policy({regions:['002']})],
 ['north africa',policy({subregions:['015']})],
 ['sub-saharan africa',policy({subregions:['202']})],
 ['southern africa',policy({intermediates:['018']},'Uses the narrower UNSD M49 Southern Africa intermediate region.')],
 ['asia',policy({regions:['142']})],
 ['east asia',policy({subregions:['030']})],
 ['southeast asia',policy({subregions:['035']})],
 ['south asia',policy({subregions:['034']})],
 ['central asia',policy({subregions:['143']})],
 ['oceania / south pacific',oceania],
 ['australia & new zealand',policy({subregions:['053']})],
 ['pacific islands',policy({subregions:['054','057','061']},'Provisional geographic definition: Melanesia, Micronesia and Polynesia, excluding Australia and New Zealand.')],
 ['northern europe',policy({subregions:['154']},'Uses the same 16 country/area scope as the work.md label “Northern Europe / Scandinavia”; M49 Northern Europe is broader than narrow Scandinavia.')],
 ['scandinavia',nordicRegion],
 ['nordic region',nordicRegion],
 ['nordic countries',nordicRegion],
 ['southern europe',policy({subregions:['039']},'Uses the same 16-area UNSD M49 subregion as “Southern Europe / Mediterranean”; Mediterranean coastal countries assigned elsewhere in M49 are excluded.')],
 ['mediterranean',mediterraneanConventionParties],
 ['oceania',oceania],
 ['south pacific',oceania],
]);

const normalize=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
const aliases=new Map([['levant and beyond','levant & beyond'],['the middle east','middle east'],['gcc','gulf states'],['gcc countries','gulf states'],['gulf cooperation council','gulf states']]);
export function m49PolicyFor(name){const key=normalize(name);return policies.get(aliases.get(key)??key)??null;}

function decodeHtml(value){return value.replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16))).replace(/&#(\d+);/g,(_,num)=>String.fromCodePoint(Number(num))).replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&mdash;/gi,'—').replace(/&ndash;/gi,'–').replace(/&rsquo;|&apos;/gi,"'").replace(/&quot;/gi,'"').trim();}
function cellText(value){return decodeHtml(value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' '));}

/** Parse the English UNSD M49 overview table. Airport and country records are not bundled. */
export function parseM49Catalog(html,{minimumRecords=200}={}){
 if(typeof html!=='string'||html.length>5_000_000)throw Error('UN M49 data is missing or exceeds the supported size.');
 const marker=html.search(/id\s*=\s*["']downloadTableEN["']/i);if(marker<0)throw Error('UN M49 English table is missing.');
 const start=html.lastIndexOf('<table',marker),end=html.indexOf('</table>',marker);if(start<0||end<0)throw Error('UN M49 table structure changed.');
 const table=html.slice(start,end),rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)],areas=[];
 for(const row of rows){const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match=>cellText(match[1]));if(cells.length<12||!/^\d{3}$/.test(cells[9]??''))continue;
  areas.push({regionCode:/^\d{3}$/.test(cells[2])?cells[2]:null,regionName:cells[3]||null,subregionCode:/^\d{3}$/.test(cells[4])?cells[4]:null,subregionName:cells[5]||null,intermediateCode:/^\d{3}$/.test(cells[6])?cells[6]:null,intermediateName:cells[7]||null,name:cells[8],m49Code:cells[9],iso2:/^[A-Z]{2}$/.test(cells[10]??'')?cells[10]:null,iso3:/^[A-Z]{3}$/.test(cells[11]??'')?cells[11]:null});
 }
 if(areas.length<minimumRecords)throw Error('UN M49 table has too few country/area records.');
 return areas;
}

export function selectM49Areas(catalog,scope){
 if(!scope)return [];
 return catalog.filter(area=>(scope.regions??[]).includes(area.regionCode)||(scope.subregions??[]).includes(area.subregionCode)||(scope.intermediates??[]).includes(area.intermediateCode)||(scope.areas??[]).includes(area.m49Code)||(scope.iso2??[]).includes(area.iso2));
}
