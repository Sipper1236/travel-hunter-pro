import test from 'node:test';
import assert from 'node:assert/strict';
import {POST as airlines} from '../app/api/airlines/route.js';
import {POST as airports} from '../app/api/airports/route.js';
import {POST as browserJobs} from '../app/api/browser-jobs/route.js';
import {GET as health,POST as healthPost} from '../app/api/health/route.js';
import {POST as hotelSearch} from '../app/api/hotels/search/route.js';
import {POST as memberOffers} from '../app/api/member-offers/route.js';
import {POST as packageLocations} from '../app/api/packages/locations/route.js';
import {POST as packageSearch} from '../app/api/packages/search/route.js';
import {POST as bookingLinks} from '../app/api/search/booking-links/route.js';
import {POST as calendar} from '../app/api/search/calendar/route.js';
import {POST as capabilities} from '../app/api/search/capabilities/route.js';
import {POST as jobs} from '../app/api/search/jobs/route.js';
import {POST as optimize} from '../app/api/search/optimize/route.js';
import {POST as refresh} from '../app/api/search/refresh/route.js';
import {POST as directSearch} from '../app/api/search/route.js';
import {POST as separateTickets} from '../app/api/search/separate-tickets/route.js';
import {POST as assistant} from '../app/api/travel-assistant/route.js';

const endpoints=[
 ['airline lookup',airlines],['airport lookup',airports],['browser jobs',browserJobs],
 ['health GET',health,'GET'],['health POST',healthPost],['hotel search',hotelSearch],['member offers',memberOffers],
 ['package locations',packageLocations],['package search',packageSearch],['seller links',bookingLinks],
 ['calendar',calendar],['capabilities',capabilities],['durable jobs',jobs],['party comparison',optimize],
 ['provider refresh',refresh],['direct flight search',directSearch],['separate tickets',separateTickets],
 ['travel assistant',assistant],
];

test('every API route rejects remote and cross-origin requests before parsing or source work',async()=>{
 for(const [name,handler,method='POST'] of endpoints){
  for(const [host,origin] of [['travel-hunter.example','https://travel-hunter.example'],['127.0.0.1:3000','https://evil.example']]){
   const url=`http://${host.split(':')[0]}/api/${name.replaceAll(' ','-')}`;
   const request=new Request(url,{method,headers:{host,origin,'content-type':'application/json'},...(method==='GET'?{}:{body:'not-json'})});
   const response=await handler(request);
   assert.equal(response.status,403,`${name} accepted remote host ${host} with origin ${origin}`);
  }
 }
});
