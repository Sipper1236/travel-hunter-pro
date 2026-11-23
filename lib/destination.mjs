import { classifyDescriptions, localModelStatus } from './local-decision.mjs';
import { M49_POLICY_VERSION, m49PolicyFor } from './m49-regions.mjs';
const regionWords = /\b(continent|country|sovereign state|region|subregion|archipelago|territory|island group|state of the united states|province of|country in|country located)\b/i;
const placeWords = /\b(city|town|village|municipality|airport|aerodrome|airfield|metropolitan area)\b/i;
const normalize = value => value.trim().toLocaleLowerCase('en');
export async function detectDestination(value, options = {}) {
  if (typeof value !== 'string' || value.trim().length < 2 || value.length > 60) throw new Error('Enter a destination.');
  const text = value.trim();
  // Known region labels and named conventions have a versioned local policy.
  // Resolve them before Wikidata/model classification so an entity label (for
  // example the Mediterranean Sea) cannot silently change the airport scope.
  const regionPolicy = m49PolicyFor(text);
  // GCC is both the Gulf Cooperation Council alias and Gillette-Campbell
  // County Airport's IATA code. In automatic mode, prefer the code and let the
  // flight source validate it; choosing Region explicitly still selects GCC.
  if (regionPolicy?.scope && /^[A-Z]{3}$/.test(text)) return {
    type: 'place', kind: 'airport', method: 'Three-letter code; flight source will resolve it', model: 'not-used',
  };
  if (regionPolicy?.scope) return {
    type: 'region', canonicalName: text, method: 'Versioned local geographic policy',
    model: 'not-used', source: regionPolicy.sourceUrl ?? 'https://unstats.un.org/unsd/methodology/m49/overview/',
    policyVersion: M49_POLICY_VERSION, policyNote: regionPolicy.note ?? null,
  };
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({action:'wbsearchentities',search:text,language:'en',format:'json',limit:'50'});
  let data;
  try {
    const response = await (options.fetcher ?? fetch)(url,{headers:{'User-Agent':'TravelHunterPro/0.1 (local travel research prototype)',Accept:'application/json'},signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw Error('lookup failed');
    data = await response.json();
  } catch {return {type:'unknown',reason:'Destination lookup is unavailable. Choose the destination type manually.'};}
  if (!Array.isArray(data?.search)) return {type:'unknown',reason:'Destination lookup returned an unexpected response. Choose the destination type manually.'};
  const exact = data.search.filter(item=>normalize(item.label||'')===normalize(text) || (item.match?.type==='alias' && normalize(item.match.text||'')===normalize(text)));
  const candidates=exact.filter(item => item.description).slice(0,12);
  // Model scores classify cited descriptions, never create a new location or price.
  const model = options.classifier ?? (options.fetcher ? null : classifyDescriptions);
  const selected = [];
  const ordered = /^[A-Z]{3}$/.test(text) ? [...candidates].sort((a,b) => Number(/\b(airport|aerodrome|airfield)\b/i.test(b.description)) - Number(/\b(airport|aerodrome|airfield)\b/i.test(a.description))) : candidates;
  for (const item of ordered) { const type = placeWords.test(item.description) ? 'place' : regionWords.test(item.description) ? 'region' : null; if (type && !selected.some(entry => entry.type === type)) selected.push({item,type}); }
  const answers = model && selected.length ? await model(selected.map(({item})=>`${item.label}: ${item.description}`)).catch(()=>null) : null;
  const answerByItem = new Map(selected.map(({item}, index) => [item, answers?.[index]]));
  const classifications = candidates.map((item,index)=>{
    const description=item.description||'';
    const heuristic = placeWords.test(description) ? 'place' : regionWords.test(description) ? 'region' : null;
    const answer=answerByItem.get(item);
    const modelType = answer && Number.isFinite(answer.answer_confidence) && answer.answer_confidence >= 0.85 ? ({airport:'place',city:'place',country:'region',region:'region'}[answer.choice] || null) : null;
    // Explicit evidence wins; an agreeing decision enriches the subtype. Model-only predictions abstain.
    return {item,type:heuristic,kind:modelType && modelType === heuristic ? answer.choice : null, conflict:Boolean(modelType && heuristic && modelType !== heuristic)};
  });
  if (classifications.some(x=>x.conflict)) return {type:'ambiguous', reason:'Local model and geographic evidence disagree. Choose the destination type manually.'};
  const types = new Set(classifications.map(x=>x.type).filter(Boolean));
  if(types.size===1){
    const type=[...types][0], matches=classifications.filter(x=>x.type===type), decided=matches.find(x=>x.kind);
    return {type, canonicalName:type==='region' && matches.length===1 ? matches[0].item.label : text, kind:decided?.kind, method:decided?'Wikidata descriptions classified by local Laya and checked against location evidence':'Wikidata exact name or alias and description', model:decided?'laya-local':options.fetcher?'not-used':localModelStatus(), source:'https://www.wikidata.org/'};
  }
  if(types.size>1)return {type:'ambiguous',reason:'This name matches both a place and a region or country. Choose the destination type manually.'};
  if (/^[A-Z]{3}$/.test(text)) return {type:'place',method:'three-letter code; flight source will resolve it'};
  return {type:'unknown',reason:'Could not identify this destination as a city, airport, country or region. Choose the destination type manually.'};
}
