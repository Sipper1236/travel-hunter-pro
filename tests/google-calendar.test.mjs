import test from 'node:test';
import assert from 'node:assert/strict';
import {googleCalendarPageMatchesQuery,googleCurrencyIsVisible,parseGoogleCalendarResponse} from '../lib/google-calendar.mjs';
import {googleCalendarErrorResponse,googleCalendarResponse} from './fixtures/google-calendar-response.mjs';

const query={origin:'YHZ',destination:'LAX',start:'2026-12-01',end:'2026-12-03',tripType:'one-way',cabin:'economy',adults:1,children:0};
const observedAt='2026-11-14T19:00:00.000Z';
const row=(date,price)=>[date,`${date} display`,[[null,price]],0];

test('Google calendar request binding requires the exact public route, date, locale and CAD page state',()=>{
 const url=new URL('https://www.google.com/travel/flights');url.search=new URLSearchParams({q:'Flights from YHZ to LAX on 2026-12-01 one way',hl:'en-CA',gl:'CA',curr:'CAD'}).toString();
 assert.equal(googleCalendarPageMatchesQuery(url.toString(),{...query,start:'2026-12-01'},'2026-12-01'),true);
 assert.equal(googleCalendarPageMatchesQuery(url.toString(),{...query,origin:'YYZ',start:'2026-12-01'},'2026-12-01'),false);
 url.searchParams.set('curr','USD');assert.equal(googleCalendarPageMatchesQuery(url.toString(),{...query,start:'2026-12-01'},'2026-12-01'),false);
});

test('Google calendar accepts only a visible CAD currency indicator',()=>{
 assert.equal(googleCurrencyIsVisible('CurrencyCAD'),true);
 assert.equal(googleCurrencyIsVisible('Showing prices in CAD for December'),true);
 assert.equal(googleCurrencyIsVisible('CAD was requested in the URL'),false);
 assert.equal(googleCurrencyIsVisible('Estimated price 752 CAD'),false);
});

test('Google calendar parser returns only exact CAD date rows with explicit price-only scope',()=>{
 const result=parseGoogleCalendarResponse(googleCalendarResponse([row('2026-11-30',99),row('2026-12-01',752),row('2026-12-02',null),row('2026-12-03',810),row('2026-12-04',101)]),query,observedAt);
 assert.equal(result.status,'ok');assert.equal(result.coverage.complete,true);assert.equal(result.coverage.datesReturned,3);assert.deepEqual(result.coverage.missingDates,[]);
 assert.deepEqual(result.priceObservations.map(({date,price,currency,from,to,provider,observedAt:seen})=>({date,price,currency,from,to,provider,observedAt:seen})),[
  {date:'2026-12-01',price:752,currency:'CAD',from:'YHZ',to:'LAX',provider:'Google Flights',observedAt},
  {date:'2026-12-03',price:810,currency:'CAD',from:'YHZ',to:'LAX',provider:'Google Flights',observedAt}
 ]);
 assert.deepEqual(result.noPriceDates,['2026-12-02']);
 assert.match(result.priceObservations[0].bookingStatus,/Price-only/);
});

test('Google calendar parser binds round-trip prices to the fixed return date and exact query URL',()=>{
 const roundTrip={...query,start:'2026-12-01',end:'2026-12-03',tripType:'round-trip',returnDate:'2026-12-08'};
 const url=new URL('https://www.google.com/travel/flights');url.search=new URLSearchParams({q:'Flights from YHZ to LAX on 2026-12-01 through 2026-12-08',hl:'en-CA',gl:'CA',curr:'CAD'}).toString();
 const parsed=parseGoogleCalendarResponse(googleCalendarResponse([row('2026-12-01',752),row('2026-12-02',810)]),roundTrip,observedAt,url.toString());
 assert.equal(parsed.status,'partial');assert.equal(parsed.coverage.requestedDates,3);assert.deepEqual(parsed.coverage.missingDates,['2026-12-03']);
 assert.ok(parsed.priceObservations.every(item=>item.tripType==='round-trip'&&item.returnDate==='2026-12-08'&&item.calendarStart==='2026-12-01'&&item.calendarEnd==='2026-12-03'));
 assert.match(parsed.priceObservations[0].priceScope,/round-trip one adult economy; return 2026-12-08/);
 assert.equal(googleCalendarPageMatchesQuery(url.toString(),roundTrip,'2026-12-01'),true);
 url.searchParams.set('q','Flights from YHZ to LAX on 2026-12-01 through 2026-12-09');
 assert.equal(googleCalendarPageMatchesQuery(url.toString(),roundTrip,'2026-12-01'),false);
});

test('Google calendar parser preserves holes rather than calling them no-price dates',()=>{
 const result=parseGoogleCalendarResponse(googleCalendarResponse([row('2026-12-01',752),row('2026-12-03',810)]),query,observedAt);
 assert.equal(result.status,'partial');assert.equal(result.coverage.complete,false);assert.deepEqual(result.coverage.missingDates,['2026-12-02']);assert.deepEqual(result.noPriceDates,[]);
});

test('Google calendar parser rejects bad frames, duplicate conflicts, bad dates and unbounded queries',()=>{
 for(const body of ['',`)]}'\nnot-json`,googleCalendarResponse([row('2026-12-01',752.25)])])assert.throws(()=>parseGoogleCalendarResponse(body,query,observedAt));
 assert.throws(()=>parseGoogleCalendarResponse(googleCalendarResponse([row('2026-12-01',752),row('2026-12-01',801)]),query,observedAt),/conflicting/);
 assert.throws(()=>parseGoogleCalendarResponse(googleCalendarResponse([row('2026-02-30',752)]),query,observedAt));
 assert.throws(()=>parseGoogleCalendarResponse(googleCalendarResponse([row('2026-12-01',752)]),{...query,end:'2027-01-02'},observedAt),/31 departure dates/);
 assert.throws(()=>parseGoogleCalendarResponse(googleCalendarResponse([row('2026-12-01',752)]),{...query,origin:'Europe'},observedAt));
});

test('Google calendar parser fails closed on oversized response and mismatched observation timezone',()=>{
 const body=googleCalendarResponse([row('2026-12-01',752)]);
 assert.throws(()=>parseGoogleCalendarResponse(body.repeat(100_000),query,observedAt),/size limit/);
 assert.throws(()=>parseGoogleCalendarResponse(body,query,'2026-11-14T19:00:00'),/timezone/);
});

test('Google calendar response errors retain only a bounded numeric provider marker',()=>{
 assert.throws(()=>parseGoogleCalendarResponse(googleCalendarErrorResponse(4),query,observedAt),error=>error.providerCode==='google_calendar_error_4');
 assert.throws(()=>parseGoogleCalendarResponse(googleCalendarErrorResponse(10_000),query,observedAt),error=>!error.providerCode);
});
