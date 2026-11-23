// Test-only worker preload. Reuse the isolated Ignav fixture; expose every attempted request to the test parent.
import './comparison-transport.mjs';
const interceptedFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 process.send?.({auditProviderRequest:{url:String(url),body:JSON.parse(init?.body??'{}')}});
 return interceptedFetch(url,init);
};
