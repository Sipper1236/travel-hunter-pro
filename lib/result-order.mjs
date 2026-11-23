/** Price-only observations have no verified duration/time; place them last for those sorts. */
export function flightDisplayItems(result){
 if(!result)return [];
 const sort=result.query?.filters?.sort??'price';
 const items=[...(result.offers??[]).map(offer=>({kind:'itinerary',price:offer.price,offer})),...(result.priceObservations??[]).map(observation=>({kind:'matrix',price:observation.price,observation}))];
 const value=item=>{
  if(sort==='duration'){const offer=item.offer;return offer&&Number.isFinite(offer.durationMinutes)&&(!offer.inbound||Number.isFinite(offer.inbound.durationMinutes))?offer.durationMinutes+(offer.inbound?.durationMinutes??0):Infinity;}
  if(sort==='departure')return item.offer?.departureTime??'99:99';
  return item.price;
 };
 return items.sort((a,b)=>{const x=value(a),y=value(b);if(x!==y)return typeof x==='string'?x.localeCompare(y):sort==='price_high'?y-x:x-y;return Number(a.kind==='matrix')-Number(b.kind==='matrix');});
}
