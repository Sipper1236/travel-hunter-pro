import {lookup as dnsLookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {request as httpsRequest} from 'node:https';
import {createGunzip,createInflate,createBrotliDecompress} from 'node:zlib';

export function publicAddress(address){
  if(isIP(address)===4){
    const [a,b,c]=address.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0&&(c===0||c===2)||b===88&&c===99)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
  }
  if(isIP(address)!==6)return false;
  const parts=address.toLowerCase().split(':'),first=parseInt(parts[0]||'0',16),second=parseInt(parts[1]||'0',16);
  return first>=0x2000&&first<=0x3fff&&first!==0x2002&&first!==0x3ffe&&!(first===0x2001&&(second<0x200||second===0xdb8))&&!(first===0x3fff&&second<0x1000);
}

/** Resolve once and pin the public address into the TLS connection, including redirects. */
export async function publicTarget(value,{lookup=dnsLookup}={}){
  let url;try{url=new URL(value);}catch{throw Error('Enter a public HTTPS hotel website.');}
  const host=url.hostname.replace(/^\[|\]$/g,'');
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||!host||/(?:^|\.)(?:localhost|local|internal|home|test|invalid|example|onion)$/.test(host))throw Error('Only public HTTPS hotel websites on port 443 are supported.');
  const records=isIP(host)?[{address:host,family:isIP(host)}]:await lookup(host,{all:true,verbatim:true});
  if(!records.length||records.some(record=>!publicAddress(record.address)))throw Error('The hotel website resolves to a private or reserved network address.');
  const record=records.find(record=>record.family===4) ?? records[0];return {url,address:record.address,family:record.family};
}

export async function fetchPublic(value,{signal,lookup,request=httpsRequest,maxBytes=3*1024*1024,timeoutMs=20000,maxRedirects=3,accept='text/html,application/json;q=0.9'}={}){
  const timeout=AbortSignal.timeout(timeoutMs),abort=signal?AbortSignal.any([signal,timeout]):timeout;
  for(let redirects=0;;redirects++){
    abort.throwIfAborted();let target,aborted;
    try{target=await Promise.race([publicTarget(value,{lookup}),new Promise((_,reject)=>{aborted=()=>reject(abort.reason);abort.addEventListener('abort',aborted,{once:true});if(abort.aborted)aborted();})]);}finally{if(aborted)abort.removeEventListener('abort',aborted);}
    abort.throwIfAborted();
    const result=await new Promise((resolve,reject)=>{
      const req=request(target.url,{method:'GET',agent:false,signal:abort,headers:{Accept:accept,'User-Agent':'TravelHunterPro/0.1 (public hotel research)','Accept-Encoding':'gzip, deflate, br'},lookup:(_host,options,done)=>options.all?done(null,[{address:target.address,family:target.family}]):done(null,target.address,target.family)},res=>{
        if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.destroy();resolve({redirect:res.headers.location});return;}
        const encoding=res.headers['content-encoding'],decoder=encoding==='gzip'?createGunzip():encoding==='deflate'?createInflate():encoding==='br'?createBrotliDecompress():null;
        if(encoding&&!['gzip','deflate','br','identity'].includes(encoding)){res.destroy();reject(Error('Unsupported hotel response encoding.'));return;}
        const stream=decoder?res.pipe(decoder):res,chunks=[];let size=0;
        const fail=error=>{res.destroy();decoder?.destroy();reject(error);};
        res.on('error',fail);if(decoder)decoder.on('error',fail);
        stream.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){fail(Error('Hotel response exceeded the size limit.'));return;}chunks.push(chunk);});
        stream.on('end',()=>{
          if(size>maxBytes)return;
          const headers=new Headers();for(const [key,values]of Object.entries(res.headers)){if(['content-encoding','content-length','transfer-encoding','connection','set-cookie'].includes(key)||values===undefined)continue;for(const value of [values].flat())headers.append(key,value);}
          const response=new Response([204,205,304].includes(res.statusCode)?null:Buffer.concat(chunks),{status:res.statusCode,headers});Object.defineProperty(response,'url',{value:target.url.toString()});resolve({response});
        });
      });
      req.on('error',reject);req.end();
    });
    if(result.response)return result.response;
    if(redirects>=maxRedirects)throw Error('Hotel website redirected too many times.');
    value=new URL(result.redirect,target.url).toString();
  }
}
