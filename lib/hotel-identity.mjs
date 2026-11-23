export const normalizeLocation=value=>typeof value==='string'?value.trim().normalize('NFD').replace(/\p{M}/gu,'').replace(/\s+/g,' ').toLocaleLowerCase('en'):'';
export function bookingPropertyKey(value){
  try{const url=new URL(value);if(url.protocol!=='https:'||url.hostname!=='www.booking.com'||url.username||url.password||!/^\/hotel\/[a-z]{2}\//.test(url.pathname))return null;return url.hostname+url.pathname.replace(/\.[a-z]{2}(?:-[a-z]{2})?\.html$/i,'.html');}catch{return null;}
}
export function reservitPropertyKey(value){
 try{const url=new URL(value),match=/^\/(?:engine|fo)\/booking\/(\d{1,8})\/(\d{1,8})(?:\/|$)/.exec(url.pathname);return url.protocol==='https:'&&url.hostname==='secure.reservit.com'&&!url.username&&!url.password&&match?`reservit:${match[1]}:${match[2]}`:null;}catch{return null;}
}
export function hotelPropertyKey(hotel){
 const booking=bookingPropertyKey(hotel?.url);if(booking)return booking;
 const direct=reservitPropertyKey(hotel?.url),proof=hotel?.officialEvidence;
 try{const source=new URL(proof.officialUrl);return direct&&proof.status==='verified'&&proof.propertyKey===direct&&source.protocol==='https:'&&!source.username&&!source.password?direct:null;}catch{return null;}
}
