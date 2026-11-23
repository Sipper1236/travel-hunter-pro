import {interpretPreferences,localModelStatus} from './local-decision.mjs';
const labels = {
 business: 'Business class', direct: 'Direct or nonstop flights', hotel: 'Hotel or accommodation',
 return_trip: 'Round trip or return flight', avoid_self_transfer: 'Avoid self-transfers or separate tickets',
};
const evidence = {
 business:/\bbusiness(?:\s+class)?\b/i, direct:/\b(non[ -]?stop|direct|no stops)\b/i, hotel:/\b(hotel|accommodation|lodging)\b/i,
 return_trip:/\b(round[ -]?trip|return flight|return ticket)\b/i, avoid_self_transfer:/\b(?:avoid|without|no)\s+(?:any\s+)?(?:self[ -]?transfers?|separate tickets?)\b/i,
};
function supports(key,text){const match=evidence[key].exec(text);if(!match)return false;if(key==='avoid_self_transfer'||/^no stops$/i.test(match[0]))return true;return !/\b(?:no|not|without|avoid|never)\s+(?:a\s+|any\s+)?$/i.test(text.slice(Math.max(0,match.index-35),match.index));}
export async function interpretTravelRequest(text, options={}) {
 if(typeof text!=='string'||text.trim().length<3||text.length>600) throw Error('Enter a travel request between 3 and 600 characters.');
 const answers=await (options.infer ?? interpretPreferences)(text.trim());
 if(!answers || typeof answers!=='object' || Array.isArray(answers)) { const status=options.status?.() ?? localModelStatus(); return {status:status==='ready'?'error':status,suggestions:[]}; }
 const suggestions=Object.entries(labels).flatMap(([key,label])=>{
  const value=answers[key]?.noul;
  // Scores are advisory: never infer a yes from uncertain or malformed values.
  return typeof value==='number' && Number.isFinite(value) && value>=0.75 && value<=1 && supports(key,text) ? [{key,label}] : [];
 });
 return {status:'ready',suggestions,limitation:'Model suggestions are not applied to a search. Check them before using them.'};
}
