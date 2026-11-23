import test from 'node:test';import assert from 'node:assert/strict';
import {withTransportMetrics,transportSnapshot,mergeTransportCoverage} from '../lib/transport-metrics.mjs';
import {fetchSource} from '../lib/source-fetch.mjs';
test('transport counts shared attempts, retries, HTTP outcomes and bounded request latency without URLs or headers',async()=>{
 let calls=0;const result=await withTransportMetrics(async()=>{await fetchSource('Ignav','https://example.com/private?key=secret',{headers:{authorization:'secret'}},{fetcher:async()=>++calls===1?Response.json({code:'unable_to_complete_request'},{status:424}):Response.json({ok:true}),retryIgnav424:true,sleep:async()=>{},random:()=>0});return {ok:true};});
 const row=result.transportCoverage.providers.Ignav;
 assert.deepEqual({attempts:row.attempts,retries:row.retries,responses:row.responses,networkFailures:row.networkFailures,httpStatuses:row.httpStatuses},{attempts:2,retries:1,responses:2,networkFailures:0,httpStatuses:{'200':1,'424':1}});
 assert.equal(row.requestLatency.samples,2);assert.equal(Object.values(row.requestLatency.buckets).reduce((sum,count)=>sum+count,0),2,'each observed request belongs to exactly one latency bucket');assert.ok(row.requestLatency.p95UpperBoundMs===null||Number.isInteger(row.requestLatency.p95UpperBoundMs));assert.ok(row.requestLatency.totalMs>=0);assert.ok(!JSON.stringify(result).includes('secret'));assert.equal(transportSnapshot(),undefined);
});
test('recovery preserves acknowledged counters and latency histograms and discloses interrupted lower bounds',async()=>{
 const previous={providers:{Ignav:{attempts:2,retries:1,responses:2,networkFailures:0,httpStatuses:{'200':1,'424':1},requestLatency:{samples:2,totalMs:20,maxMs:15,buckets:{'0_100':2,'100_250':0,'250_500':0,'500_1000':0,'1000_2500':0,'2500_5000':0,'5000_10000':0,'10000_30000':0,'30000_plus':0}}}}};
 const result=await withTransportMetrics(async()=>({}),{previous,interrupted:true});assert.equal(result.transportCoverage.providers.Ignav.attempts,2);assert.equal(result.transportCoverage.providers.Ignav.requestLatency.samples,2);assert.equal(result.transportCoverage.providers.Ignav.requestLatency.p95UpperBoundMs,100);assert.equal(result.transportCoverage.includesUnobservedInterruptedAttempts,true);
});
test('merging source transport summaries adds only bounded buckets and status counts',()=>{
 const latency={samples:1,totalMs:40,maxMs:40,buckets:{'0_100':1,'100_250':0,'250_500':0,'500_1000':0,'1000_2500':0,'2500_5000':0,'5000_10000':0,'10000_30000':0,'30000_plus':0}};
 const result=mergeTransportCoverage({providers:{Ignav:{attempts:1,retries:0,responses:1,networkFailures:0,httpStatuses:{'200':1},requestLatency:latency}}},{providers:{Ignav:{attempts:1,retries:0,responses:1,networkFailures:0,httpStatuses:{'429':1},requestLatency:latency}}});
 assert.equal(result.providers.Ignav.attempts,2);assert.equal(result.providers.Ignav.requestLatency.samples,2);assert.equal(result.providers.Ignav.requestLatency.p95UpperBoundMs,100);assert.deepEqual(result.providers.Ignav.httpStatuses,{'200':1,'429':1});
});
test('nested provider metric contexts roll up into the enclosing job without mixing provider labels',async()=>{
 const result=await withTransportMetrics(async()=>Promise.all([
  withTransportMetrics(()=>fetchSource('Ignav','https://example.com/a',{}, {fetcher:async()=>Response.json({ok:true})})),
  withTransportMetrics(()=>fetchSource('Skyscanner','https://example.com/b',{}, {fetcher:async()=>Response.json({ok:true})})),
 ]));
 assert.deepEqual(Object.keys(result.transportCoverage.providers).sort(),['Ignav','Skyscanner']);
 for(const row of Object.values(result.transportCoverage.providers)){assert.equal(row.attempts,1);assert.equal(row.responses,1);assert.equal(row.requestLatency.samples,1);}
});
