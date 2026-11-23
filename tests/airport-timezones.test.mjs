import test from 'node:test';import assert from 'node:assert/strict';
import {airportLocalInstant,airportLocalMatchesInstant,timezoneRecords,validateZonedItinerary} from '../lib/airport-timezones.mjs';
test('airport-local conversion rejects DST folds, gaps and invalid dates',()=>{
 assert.equal(airportLocalInstant('2027-04-15T08:00:00','America/Halifax'),'2027-04-15T11:00:00Z');
 for(const date of ['2027-03-14T02:30:00','2027-11-07T01:30:00','2027-02-30T12:00:00'])assert.throws(()=>airportLocalInstant(date,'America/New_York'));
 assert.throws(()=>airportLocalInstant('2027-04-15T08:00:00','Invalid/Zone'));
});
test('airport-local timestamps must agree with the observed UTC instant, including repeated DST times',()=>{
 assert.equal(airportLocalMatchesInstant('2027-04-15T08:00:00','2027-04-15T11:00:00Z','America/Halifax'),true);
 assert.equal(airportLocalMatchesInstant('2027-04-15T08:00:00','2027-04-15T12:00:00Z','America/Halifax'),false);
 assert.equal(airportLocalMatchesInstant('2027-04-15T08:00:00','2027-04-15T08:00:00Z','-04:00'),false);
 assert.equal(airportLocalMatchesInstant('2027-11-07T01:30:00','2027-11-07T05:30:00Z','America/New_York'),true);
 assert.equal(airportLocalMatchesInstant('2027-11-07T01:30:00','2027-11-07T06:30:00Z','America/New_York'),true);
});
test('timezone records reject ambiguous IATA codes and invalid zone evidence',()=>{
 const row=(iata,tz,icao)=>({iata,tz,icao,name:icao});
 assert.deepEqual(timezoneRecords({AAAA:row('AAA','Europe/London','AAAA'),BBBB:row('AAA','America/New_York','BBBB'),CCCC:row('CCC','Invalid/Zone','CCCC'),DDDD:row('DDD','Asia/Tokyo','DDDD')}).map(r=>r.code),['DDD']);
});
test('timezone validation accepts date-line flights with earlier local arrival but rejects reversed returns',()=>{
 const evidence={byCode:new Map([['NRT',{timeZone:'Asia/Tokyo'}],['LAX',{timeZone:'America/Los_Angeles'}]]),sourceUrl:'https://example.com/directory',retrievedAt:'2026-11-05T00:00:00Z'};
 const offer={segments:[{from:'NRT',to:'LAX',departureAt:'2027-04-15T17:00:00',arrivalAt:'2027-04-15T10:00:00'}]};
 const result=validateZonedItinerary(offer,evidence);assert.equal(result.segments[0].departure_time_utc,'2027-04-15T08:00:00Z');assert.equal(result.segments[0].arrival_time_utc,'2027-04-15T17:00:00Z');
 assert.throws(()=>validateZonedItinerary({...offer,inbound:{segments:[{from:'LAX',to:'NRT',departureAt:'2027-04-15T09:00:00',arrivalAt:'2027-04-16T14:00:00'}]}},evidence),/Return departs/);
 assert.throws(()=>validateZonedItinerary({segments:[{...offer.segments[0],from:'XXX'}]},evidence),/no unambiguous/);
});
