// Explicit test preload: all network requests are intercepted and unexpected endpoints fail.
import https from 'node:https';
import dns from 'node:dns/promises';
import {syncBuiltinESMExports} from 'node:module';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
const html='<title>Test Hotel · 4-star hotel</title><script type="application/ld+json">'+JSON.stringify({'@type':'Hotel',name:'Test Hotel',starRating:{ratingValue:4},address:{addressLocality:'Example',addressCountry:'CA'}})+'</script><a href="https://secure.reservit.com/engine/booking/58/123/dates">Book direct</a>';
dns.lookup=async()=>[{address:'8.8.8.8',family:4}];
https.request=(url,options,callback)=>{
 const req=new EventEmitter();req.end=()=>queueMicrotask(()=>{
  try{
   let body,type='application/json';if(url.hostname==='hotel.example.com'){body=html;type='text/html';}
   else if(url.origin==='https://secure.reservit.com'&&url.pathname==='/api/rs/bestprice/58/123'){
    if(url.searchParams.get('roomAge1')!=='35,10'||url.searchParams.get('currency')!=='CAD')throw Error('Incorrect test occupancy or currency.');
    body=JSON.stringify({bestPrice:'C$ 450.00',bestPrice_unFormatted:450});
   }else throw Error('Unexpected HTTPS test URL.');
   const response=Readable.from([Buffer.from(body)]);response.statusCode=200;response.headers={'content-type':type};callback(response);
  }catch(error){req.emit('error',error);}
 });return req;
};
syncBuiltinESMExports();
globalThis.fetch=async url=>{
 const target=new URL(url);if(target.hostname==='www.wikidata.org')return Response.json({search:[{id:'Q123',label:'Example',description:'city in Canada'}]});
 if(target.hostname==='query.wikidata.org')return Response.json({results:{bindings:[{city:{value:'https://www.wikidata.org/entity/Q123'},countryLabel:{value:'Canada'},iso:{value:'CA'},coordinates:{value:'Point(-73 45)'}}]}});
 throw Error('Unexpected fetch test URL.');
};
