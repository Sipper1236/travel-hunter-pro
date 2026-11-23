import test from 'node:test';
import assert from 'node:assert/strict';
import { carrierEligibilityGuidance } from '../lib/carrier-eligibility.mjs';

test('TAP guidance surfaces published child and infant rules while leaving fare and UM eligibility unverified', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [{ operating_carrier_code: 'TP', operating_carrier_name: 'TAP Air Portugal', marketing_carrier_code: 'TP' }],
  }, {
    date: '2026-11-12', returnDate: '2026-11-20', tripType: 'round-trip',
    travelers: [
      { id: 'child', birthDate: '2020-11-15', guardianId: 'adult' },
      { id: 'adult', birthDate: '1980-01-01' },
    ],
  });

  const tap = guidance.carriers.find(carrier => carrier.code === 'TP');
  assert.equal(guidance.status, 'unverified');
  assert.equal(tap.name, 'TAP Air Portugal');
  assert.match(tap.message, /passenger must be 18 or older/i);
  assert.match(tap.message, /one baby under 2/i);
  assert.match(tap.message, /approved car seat.*child ticket.*Contact Center/i);
  assert.match(tap.message, /children ages 2.?11 must occupy a seat/i);
  assert.match(tap.message, /special baby and child prices.*only on certain routes/i);
  assert.match(tap.message, /unaccompanied-minor.*cannot be purchased online/i);
  assert.match(tap.message, /maximum 6-hour connection/i);
  assert.match(tap.message, /eligibility and price are not verified/i);
  assert.ok(guidance.sources.some(source => source.url === 'https://www.flytap.com/en-us/information/babies-and-children'));
  assert.ok(guidance.sources.some(source => source.url === 'https://www.flytap.com/en-il/information/babies-and-children'));
  assert.ok(guidance.sources.some(source => source.url === 'https://www.flytap.com/en-us/help/frequently-asked-questions'));
});

test('TAP name-only results receive source-linked advisory guidance', () => {
  const guidance = carrierEligibilityGuidance({ airlines: ['TAP Air Portugal'], segments: [] }, {
    date: '2026-11-12', tripType: 'one-way', childrenAges: [9], children: 1,
  });
  assert.ok(guidance.carriers.some(carrier => carrier.code === 'TP' && carrier.name === 'TAP Air Portugal'));
  assert.equal(guidance.status, 'unverified');
  assert.match(guidance.message, /TAP Air Portugal/i);
});

test('carrier guidance never treats a marketing-carrier match as eligibility proof', () => {
  const guidance = carrierEligibilityGuidance({
    airlines: ['Air Canada'],
    segments: [{ marketing_carrier_code: 'AC', flight_number: 'AC123' }],
  }, { date: '2026-11-12', tripType: 'one-way', childrenAges: [10], children: 1 });

  assert.equal(guidance.status, 'unverified');
  assert.match(guidance.message, /marketing carrier/i);
  assert.match(guidance.message, /operating carrier/i);
  assert.match(guidance.message, /not verified/i);
  assert.ok(guidance.sources.some(source=>source.url==='https://www.aircanada.com/ch/en/ado/home/plan/special-assistance/travelling-with-children.html'));
});

test('carrier guidance uses supplied birth dates to expose a carrier age-category change without deciding eligibility', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [{ operating_carrier_code: 'AC', marketing_carrier_code: 'AC' }],
  }, {
    date: '2026-11-12', returnDate: '2026-11-19', tripType: 'round-trip',
    travelers: [{ id: 'child', birthDate: '2014-11-15', guardianId: 'adult' }, { id: 'adult', birthDate: '1980-01-01' }],
  });

  assert.equal(guidance.status, 'unverified');
  assert.match(guidance.message, /ages 11 and 12/i);
  assert.match(guidance.message, /confirm.*seller/i);
});

test('Air Canada guidance covers child accompaniment and unaccompanied-minor service limits',()=>{
 const guidance=carrierEligibilityGuidance({segments:[{operating_carrier_code:'AC',marketing_carrier_code:'AC'}]},{
  date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',
  travelers:[{id:'child',birthDate:'2018-11-15',guardianId:'adult'},{id:'adult',birthDate:'1980-01-01'}],
 });
 assert.equal(guidance.status,'unverified');
 assert.match(guidance.message,/ages 7 and 8/i);
 assert.match(guidance.message,/under age 8.*16 or older/i);
 assert.match(guidance.message,/mandatory for solo travelers ages 8.?11/i);
 assert.match(guidance.message,/nonstop.*cannot be purchased for connecting or codeshare/i);
 assert.match(guidance.message,/optional for ages 12.?17/i);
 assert.ok(guidance.sources.some(source=>source.url==='https://www.aircanada.com/us/en/ado/home/plan/special-assistance/unaccompanied-minor.html'));
 assert.match(guidance.message,/eligibility.*not verified/i);
});

test('carrier guidance does not label an Air Canada marketing code as the operating carrier', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [{ operating_carrier_code: 'WS', operating_carrier_name: 'WestJet', marketing_carrier_code: 'AC' }],
  }, { date: '2026-11-12', tripType: 'one-way', childrenAges: [10], children: 1 });

  const airCanada = guidance.carriers.find(carrier => carrier.code === 'AC');
  assert.match(airCanada.role, /only as a marketing carrier/i);
  assert.doesNotMatch(airCanada.role, /identified as an operating carrier/i);
});

test('carrier guidance keeps unsupported carriers and missing exact ages explicitly unknown', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [{ marketing_carrier_code: 'ZZ', flight_number: 'ZZ123' }],
  }, { date: '2026-11-12', tripType: 'one-way', children: 1 });

  assert.equal(guidance.status, 'unverified');
  assert.match(guidance.message, /ZZ/);
  assert.match(guidance.message, /actual birth dates/i);
});

test('carrier guidance identifies segments with missing carrier identities in a mixed itinerary', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [
      { operating_carrier_code: 'AC', operating_carrier_name: 'Air Canada', marketing_carrier_code: 'AC' },
      { flight_number: '123', departure_airport: 'YYZ', arrival_airport: 'FRA' },
      { operating_carrier_code: '???', marketing_carrier_code: 'AC', flight_number: '456' },
    ],
  }, { date: '2026-11-12', tripType: 'one-way', childrenAges: [10], children: 1 });

  assert.equal(guidance.status, 'unverified');
  assert.deepEqual(guidance.unidentifiedSegments, [
    { direction: 'outbound', segment: 2, missing: ['operating', 'marketing'] },
    { direction: 'outbound', segment: 3, missing: ['operating'] },
  ]);
  assert.match(guidance.message, /segment 2.*marketing and operating carrier identities are missing/i);
  assert.match(guidance.message, /segment 3.*operating carrier identity is missing/i);
  assert.match(guidance.message, /eligibility.*not verified/i);
});

test('segment airline names resolve supported source guidance when carrier codes are absent', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [{ operating_carrier_name: 'Air Canada', marketing_carrier_name: 'Air Canada' }],
    inbound: { segments: [{ operating_carrier_code: 'AC', marketing_carrier_code: 'AC' }] },
  }, { date: '2026-11-12', tripType: 'one-way', childrenAges: [10], children: 1 });

  const airCanada = guidance.carriers.find(carrier => carrier.code === 'AC');
  assert.equal(guidance.status, 'unverified');
  assert.equal(airCanada.role, 'Air Canada is identified in both operating and marketing roles (operating on outbound segment 1, inbound segment 1; marketing on outbound segment 1, inbound segment 1).');
  assert.deepEqual(airCanada.operatingSegments, [{ direction: 'outbound', segment: 1 }, { direction: 'inbound', segment: 1 }]);
  assert.deepEqual(airCanada.marketingSegments, [{ direction: 'outbound', segment: 1 }, { direction: 'inbound', segment: 1 }]);
  assert.deepEqual(guidance.unidentifiedSegments, []);
  assert.ok(guidance.sources.some(source => source.url === 'https://www.aircanada.com/ch/en/ado/home/plan/special-assistance/travelling-with-children.html'));
  assert.match(airCanada.message, /eligibility and price are not verified/i);
});

test('WestJet guidance uses current official age, infant-seat and accompaniment rules without deciding the fare', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [{ operating_carrier_code: 'WS', operating_carrier_name: 'WestJet', marketing_carrier_code: 'WS' }],
  }, {
    date: '2026-11-12', returnDate: '2026-11-19', tripType: 'round-trip',
    travelers: [
      { id: 'infant', birthDate: '2024-11-15', guardianId: 'adult', infantSeating: 'lap' },
      { id: 'adult', birthDate: '1980-01-01' },
    ],
  });

  assert.equal(guidance.status, 'unverified');
  assert.match(guidance.message, /WestJet/i);
  assert.match(guidance.message, /1 then 2/i);
  assert.match(guidance.message, /must occupy a seat/i);
  assert.match(guidance.message, /full fare/i);
  assert.match(guidance.message, /not verified/i);
  assert.ok(guidance.sources.some(source => source.url === 'https://www.westjet.com/content/dam/westjet/documents/en/tariffs/WSI_EN_FE_2026-06-18.pdf'));
  assert.ok(guidance.sources.some(source => source.url === 'https://www.westjet.com/content/dam/westjet/documents/en/tariffs/WSD_EN_FE_2026-06-18.pdf'));
});

test('Delta guidance distinguishes published travel age bands but keeps country and fare specifics unknown', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [{ operating_carrier_code: 'DL', operating_carrier_name: 'Delta Air Lines' }],
  }, { date: '2026-11-12', tripType: 'one-way', childrenAges: [4], children: 1 });

  assert.equal(guidance.status, 'unverified');
  assert.match(guidance.message, /0.?4/i);
  assert.match(guidance.message, /18\+/i);
  assert.match(guidance.message, /country-specific/i);
  assert.ok(guidance.sources.some(source => source.url === 'https://www.delta.com/ca/en/children-infant-travel/overview'));
});

test('Delta guidance marks an exact birthday across its age-five unaccompanied-travel boundary', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [{ operating_carrier_code: 'DL', operating_carrier_name: 'Delta Air Lines' }],
  }, {
    date: '2026-11-12', returnDate: '2026-11-19', tripType: 'round-trip',
    travelers: [{ id: 'child', birthDate: '2021-11-15', guardianId: 'adult' }, { id: 'adult', birthDate: '1980-01-01' }],
  });

  assert.match(guidance.message, /age-5 age-rule boundary/i);
  assert.match(guidance.message, /ages 4 and 5/i);
  assert.equal(guidance.status, 'unverified');
});

test('Delta guidance marks the current age-eight boundary for unaccompanied connecting itineraries',()=>{
 const guidance=carrierEligibilityGuidance({segments:[{operating_carrier_code:'DL',operating_carrier_name:'Delta Air Lines'}]}, {
  date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',
  travelers:[{id:'child',birthDate:'2018-11-15',guardianId:'adult'},{id:'adult',birthDate:'1980-01-01'}],
 });
 assert.match(guidance.message,/age-8 age-rule boundary/i);
 assert.match(guidance.message,/ages 7 and 8/i);
 assert.match(guidance.message,/5.?7.*non.?stop/i);
 assert.match(guidance.message,/8.?14.*connections/i);
 assert.ok(guidance.sources.some(source=>source.url==='https://www.delta.com/us/en/legal/contract-of-carriage-igr'));
 assert.equal(guidance.status,'unverified');
});

test('carrier guidance checks supplied ages on observed segment dates, not only the query date', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [{
      operating_carrier_code: 'AA', marketing_carrier_code: 'AA',
      departure_time_local: '2099-04-16T00:15:00', arrival_time_local: '2099-04-16T08:00:00',
    }],
  }, {
    date: '2099-04-15', tripType: 'one-way',
    travelers: [
      { id: 'child', birthDate: '2094-04-16', guardianId: 'adult' },
      { id: 'adult', birthDate: '1980-01-01' },
    ],
  });

  assert.match(guidance.message, /age-5 age-rule boundary/i);
  assert.match(guidance.message, /ages 4 and 5/i);
  assert.equal(guidance.status, 'unverified');
});

test('mixed carrier itineraries show separate carrier guidance and preserve marketing/operating roles', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [
      { operating_carrier_code: 'WS', operating_carrier_name: 'WestJet', marketing_carrier_code: 'DL' },
      { operating_carrier_code: 'DL', marketing_carrier_code: 'DL' },
    ],
  }, { date: '2026-11-12', tripType: 'one-way', childrenAges: [10], children: 1 });

  assert.equal(guidance.carriers.length, 2);
  assert.match(guidance.carriers.find(carrier => carrier.code === 'DL').role, /operating and marketing/i);
  assert.match(guidance.carriers.find(carrier => carrier.code === 'WS').role, /operating carrier/i);
  assert.equal(guidance.sources.length, 4);
});

test('American guidance exposes age-based seating, lap-infant and unaccompanied-minor rules without asserting fare eligibility', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [{ operating_carrier_code: 'AA', operating_carrier_name: 'American Airlines', marketing_carrier_code: 'AA' }],
  }, {
    date: '2026-11-12', returnDate: '2026-11-19', tripType: 'round-trip',
    travelers: [
      { id: 'child', birthDate: '2021-11-15', guardianId: 'adult' },
      { id: 'adult', birthDate: '1980-01-01' },
    ],
  });

  assert.equal(guidance.status, 'unverified');
  assert.match(guidance.message, /own seat and ticket/i);
  assert.match(guidance.message, /one infant may be lap-held/i);
  assert.match(guidance.message, /unaccompanied-minor service/i);
  assert.match(guidance.message, /age-5 age-rule boundary/i);
  assert.match(guidance.message, /ages 4 and 5/i);
  assert.match(guidance.message, /do not establish a fare discount/i);
  assert.match(guidance.message, /CLT, DCA, DFW, JFK, LAX, LGA, MIA, ORD, PHL and PHX/i);
  assert.match(guidance.message, /does not accept other-airline\/codeshare connections/i);
  assert.match(guidance.message, /overnight.*last flight|last flight.*overnight/i);
  assert.ok(guidance.sources.some(source => source.url === 'https://www.aa.com/web/i18n/travel-info/special-assistance/traveling-children.html'));
  assert.ok(guidance.sources.some(source => source.url === 'https://www.aa.com/pubcontent/en_US/travel-info/special-assistance/unaccompanied-minors.html'));
  assert.ok(guidance.sources.some(source => source.url === 'https://www.aa.com/web/i18n/customer-service/support/customer-service-plan.html'));
});

test('Porter guidance covers infant seating, age-8 unaccompanied rules, and conflicting companion-age wording without deciding eligibility',()=>{
 const guidance=carrierEligibilityGuidance({segments:[{operating_carrier_code:'PD',operating_carrier_name:'Porter Airlines',marketing_carrier_code:'PD'}]}, {
  date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',
  travelers:[{id:'child',birthDate:'2018-11-15',guardianId:'adult'},{id:'adult',birthDate:'1980-01-01'}],
 });
 const porter=guidance.carriers.find(carrier=>carrier.code==='PD');
 assert.equal(guidance.status,'unverified');
 assert.equal(porter.name,'Porter Airlines');
 assert.match(porter.message,/ages 7 and 8/i);
 assert.match(porter.message,/mandatory.*non.?stop/i);
 assert.match(porter.message,/at least 16|older than 16/i);
 assert.match(porter.message,/published pages differ.*threshold/i);
 assert.match(porter.message,/not verified/i);
 assert.ok(guidance.sources.some(source=>source.url==='https://www.flyporter.com/en-ca/travel-information/children-infants/booking'));
 assert.ok(guidance.sources.some(source=>source.url==='https://www.flyporter.com/en-ca/travel-information/children-infants/children-travelling-alone'));
});

test('Porter guidance flags a supplied birth date below its published seven-day infant range',()=>{
 const offer={segments:[{operating_carrier_code:'PD',operating_carrier_name:'Porter Airlines',departure_time_local:'2026-11-12T08:00:00-04:00'}]};
 const belowMinimum=carrierEligibilityGuidance(offer,{date:'2026-11-12',tripType:'one-way',travelers:[{id:'infant',birthDate:'2026-11-10'}]});
 assert.match(belowMinimum.message,/under 7 days old.*published infant booking range starts at 7 days/i);
 assert.match(belowMinimum.message,/does not treat the trip as permitted/i);

 const atMinimum=carrierEligibilityGuidance(offer,{date:'2026-11-12',tripType:'one-way',travelers:[{id:'infant',birthDate:'2026-11-05'}]});
 assert.doesNotMatch(atMinimum.message,/under 7 days old/i);
 assert.match(atMinimum.message,/eligibility and price are not verified/i);
});

test('Air Transat guidance covers infant, own-seat and unaccompanied age rules without asserting fare eligibility',()=>{
 const guidance=carrierEligibilityGuidance({segments:[{operating_carrier_code:'TS',operating_carrier_name:'Air Transat',marketing_carrier_code:'TS',departure_time_local:'2026-11-12T08:00:00-04:00'}]}, {
  date:'2026-11-12',returnDate:'2026-11-20',tripType:'round-trip',
  travelers:[{id:'child',birthDate:'2018-11-15',guardianId:'adult'},{id:'adult',birthDate:'1980-01-01'}],
 });
 const transat=guidance.carriers.find(carrier=>carrier.code==='TS');
 assert.equal(guidance.status,'unverified');assert.equal(transat.name,'Air Transat');
 assert.match(transat.message,/ages 7 and 8/i);
 assert.match(transat.message,/at least 8 days old/i);
 assert.match(transat.message,/at most one infant.*passenger/i);
 assert.match(transat.message,/aged 2.?11.*own seat/i);
 assert.match(transat.message,/unaccompanied-minor.*mandatory for ages 8.?11/i);
 assert.match(transat.message,/unavailable on connecting or codeshare flights.*Colombia/i);
 assert.match(transat.message,/ages 12.?17 may travel alone/i);
 assert.match(transat.message,/same cabin.*passenger age 16 or older/i);
 assert.match(transat.message,/not verified/i);
 assert.ok(guidance.sources.some(source=>source.url==='https://www.airtransat.com/en-CA/travel-information/families-and-children/travelling-with-children'));
 assert.ok(guidance.sources.some(source=>source.url==='https://www.airtransat.com/en-CA/travel-information/families-and-children/unaccompanied-minors'));
});

test('Air Transat name-only results receive the same source-linked guidance as TS segments',()=>{
 const guidance=carrierEligibilityGuidance({airlines:['Air Transat'],segments:[]},{date:'2026-11-12',tripType:'one-way',childrenAges:[7],children:1});
 assert.ok(guidance.carriers.some(carrier=>carrier.code==='TS'&&carrier.name==='Air Transat'));
 assert.ok(guidance.sources.some(source=>source.url==='https://www.airtransat.com/en-CA/travel-information/families-and-children/travelling-with-children'));
 assert.match(guidance.message,/Air Transat defines an infant/i);
 assert.equal(guidance.status,'unverified');
});

test('Air Transat guidance flags an actual birth date below its published eight-day minimum',()=>{
 const guidance=carrierEligibilityGuidance({segments:[{operating_carrier_code:'TS',operating_carrier_name:'Air Transat',departure_time_local:'2026-11-12T08:00:00-04:00'}]}, {
  date:'2026-11-12',tripType:'one-way',travelers:[{id:'infant',birthDate:'2026-11-05'}],
 });
 assert.match(guidance.message,/under 8 days old.*minimum is 8 days/i);
 assert.match(guidance.message,/does not treat the trip as permitted/i);
});

test('Flair guidance applies published domestic and international age rules without guessing route eligibility',()=>{
 const guidance=carrierEligibilityGuidance({segments:[{operating_carrier_code:'F8',operating_carrier_name:'Flair Airlines',marketing_carrier_code:'F8',marketing_carrier_name:'Flair Airlines',departure_time_local:'2026-11-12T08:00:00-04:00'}]}, {
  date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',
  travelers:[{id:'teen',birthDate:'2010-11-15',guardianId:'adult'},{id:'adult',birthDate:'1980-01-01'}],
 });
 const flair=guidance.carriers.find(carrier=>carrier.code==='F8');
 assert.equal(guidance.status,'unverified');assert.equal(flair.name,'Flair Airlines');
 assert.match(flair.message,/ages 15 and 16/i);
 assert.match(flair.message,/domestic tariff.*under 12.*18 or older/i);
 assert.match(flair.message,/international tariff.*does not provide an unaccompanied.?minor service/i);
 assert.match(flair.message,/Canada.*children under 16.*ages 16.?17 may travel alone only on non.?stop/i);
 assert.match(flair.message,/other international routes.*under 18.*18 or older/i);
 assert.match(flair.message,/lap-infant pricing.*20%.*excluding taxes/i);
 assert.match(flair.message,/not verified/i);
 assert.ok(guidance.sources.some(source=>source.url==='https://assets.ctfassets.net/w0vm39jo1zxb/1g5N6y60MbcdTJeZ24iUlB/8b8327de57089f2b5372f90a4c435229/Rev_15_Flair_Domestic_Tariff_2026.06.01.pdf'));
 assert.ok(guidance.sources.some(source=>source.url==='https://assets.ctfassets.net/w0vm39jo1zxb/3PcQEGe95opez5AV5X7d1/ecbf4bd07654dd0b5da1cdddca8573e4/Flair_Airlines_Ltd._-_International_Tariff_2026-06-01.pdf'));
});

test('Lufthansa guidance reports exact age transitions, Canadian child rules and unverified fare eligibility',()=>{
 const guidance=carrierEligibilityGuidance({segments:[
  {operating_carrier_code:'LH',operating_carrier_name:'Lufthansa',marketing_carrier_code:'LH',marketing_carrier_name:'Lufthansa',departure_time_local:'2026-11-12T08:00:00-04:00'},
  {operating_carrier_code:'LH',operating_carrier_name:'Lufthansa',marketing_carrier_code:'LH',marketing_carrier_name:'Lufthansa',departure_time_local:'2026-11-19T08:00:00-05:00'},
 ]}, {
  date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',
  travelers:[{id:'child',birthDate:'2014-11-15',guardianId:'adult'},{id:'adult',birthDate:'1980-01-01'}],
 });
 const lufthansa=guidance.carriers.find(carrier=>carrier.code==='LH');
 assert.equal(guidance.status,'unverified');assert.equal(lufthansa.name,'Lufthansa');
 assert.match(lufthansa.message,/ages 11 and 12/i);
 assert.match(lufthansa.message,/lap-held travelers under age 2.*10% of the regular fare/i);
 assert.match(lufthansa.message,/separate infant seat.*child fare.*approved child restraint system/i);
 assert.match(lufthansa.message,/aged 2.?11 need their own seat/i);
 assert.match(lufthansa.message,/under 5.*adult age 18 or older/i);
 assert.match(lufthansa.message,/unaccompanied children ages 5.?11.*registered in advance/i);
 assert.match(lufthansa.message,/under 12.*different cabin.*unaccompanied minor/i);
 assert.match(lufthansa.message,/not verified/i);
 assert.ok(guidance.sources.some(source=>source.url==='https://www.lufthansa.com/ca/en/prepare-for-your-trip/travelling-with-children/planning-with-kids'));
 assert.ok(guidance.sources.some(source=>source.url==='https://www.lufthansa.com/ca/en/terms-and-conditions-lh'));
});

test('Lufthansa guidance flags an infant who turns two between outbound and return dates',()=>{
 const guidance=carrierEligibilityGuidance({segments:[
  {operating_carrier_code:'LH',operating_carrier_name:'Lufthansa',departure_time_local:'2026-11-12T08:00:00-04:00'},
  {operating_carrier_code:'LH',operating_carrier_name:'Lufthansa',departure_time_local:'2026-11-19T08:00:00-05:00'},
 ]}, {
  date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',
  travelers:[{id:'infant',birthDate:'2024-11-15'}],
 });
 assert.match(guidance.message,/ages 1 and 2/i);
 assert.match(guidance.message,/crosses this carrier’s published age-2 age-rule boundary/i);
 assert.match(guidance.message,/child turning 2 during the trip needs a seat and child fare/i);
 assert.equal(guidance.status,'unverified');
});

test('Qatar Airways guidance exposes infant minimum, infant seating, and young-solo age rules without approving a fare',()=>{
 const guidance=carrierEligibilityGuidance({segments:[
  {operating_carrier_code:'QR',operating_carrier_name:'Qatar Airways',marketing_carrier_code:'QR',marketing_carrier_name:'Qatar Airways',departure_time_local:'2026-11-12T08:00:00-04:00'},
 ]},{date:'2026-11-12',tripType:'one-way',travelers:[
  {id:'infant',birthDate:'2026-11-05',guardianId:'adult',infantSeating:'lap'},
  {id:'adult',birthDate:'1980-01-01'},
 ]});
 const qatar=guidance.carriers.find(carrier=>carrier.code==='QR');
 assert.equal(guidance.status,'unverified');assert.equal(qatar.name,'Qatar Airways');
 assert.match(qatar.message,/under 8 days old.*specified medically cleared exceptions/i);
 assert.match(qatar.message,/infants from 8 days to under 2 may travel/i);
 assert.match(qatar.message,/each adult to one lap infant/i);
 assert.match(qatar.message,/second infant.*at least 1 year old.*separate seat/i);
 assert.match(qatar.message,/unaccompanied.*ages 5.?11/i);
 assert.match(qatar.message,/optional young-passenger service for ages 12/i);
 assert.match(qatar.message,/stricter local-government.*codeshare or interline/i);
 assert.match(qatar.message,/eligibility and price are not verified/i);
 assert.ok(guidance.sources.some(source=>source.url==='https://www.qatarairways.com/en-us/family/child-fares-baggage.html'));
 assert.ok(guidance.sources.some(source=>source.url==='https://www.qatarairways.com/en-no/family/child-fares-baggage.html'));
 assert.ok(guidance.sources.some(source=>source.url==='https://www.qatarairways.com/tradeportal/en/specialservices/Children-and-Infants.html'));
});

test('British Airways guidance exposes published age rules and booking-page conflict without deciding eligibility', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [{
      operating_carrier_code: 'BA', operating_carrier_name: 'British Airways',
      marketing_carrier_code: 'BA', departure_time_local: '2026-11-12T08:00:00Z',
    }],
  }, {
    date: '2026-11-12', returnDate: '2026-11-19', tripType: 'round-trip',
    travelers: [
      { id: 'teen', birthDate: '2012-11-15', guardianId: 'adult' },
      { id: 'adult', birthDate: '1980-01-01' },
    ],
  });

  const britishAirways = guidance.carriers.find(carrier => carrier.code === 'BA');
  assert.equal(guidance.status, 'unverified');
  assert.equal(britishAirways.name, 'British Airways');
  assert.match(britishAirways.message, /ages 13 and 14/i);
  assert.match(britishAirways.message, /age-14 age-rule boundary/i);
  assert.match(britishAirways.message, /ages 12.?15/i);
  assert.match(britishAirways.message, /under 14.*age 16 or older/i);
  assert.match(britishAirways.message, /ages 14.?15.*parent or legal guardian/i);
  assert.match(britishAirways.message, /online passenger guidance.*differs/i);
  assert.match(britishAirways.message, /exact fare category at age 16 is not established/i);
  assert.match(britishAirways.message, /eligibility and price are not verified/i);
  assert.ok(guidance.sources.some(source => source.url === 'https://www.britishairways.com/content/en/us/information/family-travel/tickets-and-travel-documents'));
  assert.ok(guidance.sources.some(source => source.url === 'https://hotline.britishairways.com/content/information/travel-assistance/children-travelling-alone.html'));
  assert.ok(guidance.sources.some(source => source.url === 'https://www.britishairways.com/travel/pop_paxinfo/public/en_gb'));
});

test('British Airways name-only carrier evidence is recognized but never treated as fare proof', () => {
  const guidance = carrierEligibilityGuidance({ airlines: ['British Airways'], segments: [] }, {
    date: '2026-11-12', tripType: 'one-way', childrenAges: [14], children: 1,
  });

  assert.equal(guidance.status, 'unverified');
  assert.ok(guidance.carriers.some(carrier => carrier.code === 'BA'));
  assert.match(guidance.message, /identified only as a marketing carrier/i);
  assert.match(guidance.message, /online passenger guidance.*differs/i);
});

test('British Airways guidance flags a supplied infant birthday that changes seat requirements mid-trip', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [
      { operating_carrier_code: 'BA', departure_time_local: '2026-11-12T08:00:00Z' },
      { operating_carrier_code: 'BA', departure_time_local: '2026-11-19T08:00:00Z' },
    ],
  }, {
    date: '2026-11-12', returnDate: '2026-11-19', tripType: 'round-trip',
    travelers: [{ id: 'infant', birthDate: '2024-11-15', guardianId: 'adult' }, { id: 'adult', birthDate: '1980-01-01' }],
  });

  assert.equal(guidance.status, 'unverified');
  assert.match(guidance.message, /ages 1 and 2/i);
  assert.match(guidance.message, /age-2 age-rule boundary/i);
  assert.match(guidance.message, /needs a seat on flights on and after the birthday/i);
  assert.match(guidance.message, /arranged with it directly/i);
});

test('Southwest guidance exposes infant, child, minor and PNR conditions without deciding eligibility', () => {
  const guidance = carrierEligibilityGuidance({ segments: [
    { operating_carrier_code: 'WN', operating_carrier_name: 'Southwest Airlines', marketing_carrier_code: 'WN', marketing_carrier_name: 'Southwest Airlines', departure_time_local: '2026-11-12T08:00:00-05:00' },
    { operating_carrier_code: 'WN', operating_carrier_name: 'Southwest Airlines', marketing_carrier_code: 'WN', marketing_carrier_name: 'Southwest Airlines', departure_time_local: '2026-11-19T08:00:00-05:00' },
  ] }, {
    date: '2026-11-12', returnDate: '2026-11-19', tripType: 'round-trip',
    travelers: [
      { id: 'child', birthDate: '2014-11-15', guardianId: 'adult' },
      { id: 'infant', birthDate: '2026-11-01', guardianId: 'adult', infantSeating: 'lap' },
      { id: 'adult', birthDate: '1980-01-01' },
    ],
  });

  const southwest = guidance.carriers.find(carrier => carrier.code === 'WN');
  assert.equal(guidance.status, 'unverified');
  assert.equal(southwest.name, 'Southwest Airlines');
  assert.match(southwest.message, /ages 11 and 12/i);
  assert.match(southwest.message, /age-12 age-rule boundary/i);
  assert.match(southwest.message, /under 14 days old/i);
  assert.match(southwest.message, /one lap child.*per accompanying adult/i);
  assert.match(southwest.message, /channel-specific age thresholds conflict/i);
  assert.match(southwest.message, /ages 5.?11.*unaccompanied-minor/i);
  assert.match(southwest.message, /ages 12.?17.*Young Travelers/i);
  assert.match(southwest.message, /Young Travelers on international itineraries.*parent or guardian age 18 or older/i);
  assert.match(southwest.message, /without a change of aircraft or flight number/i);
  assert.match(southwest.message, /not verified/i);
  assert.ok(guidance.sources.some(source => source.url === 'https://support.southwest.com/helpcenter/article/flying-with-infants'));
  assert.ok(guidance.sources.some(source => source.url === 'https://support.southwest.com/helpcenter/article/young-travelers-flying-alone'));
  assert.ok(guidance.sources.some(source => source.url === 'https://www.southwest.com/about-southwest/terms-and-conditions/gds-policy/'));
});

test('Southwest name-only carrier evidence is recognized without asserting fare eligibility', () => {
  const guidance = carrierEligibilityGuidance({ airlines: ['Southwest Airlines'], segments: [] }, {
    date: '2026-11-12', tripType: 'one-way', childrenAges: [14], children: 1,
  });

  assert.equal(guidance.status, 'unverified');
  assert.ok(guidance.carriers.some(carrier => carrier.code === 'WN'));
  assert.match(guidance.message, /identified only as a marketing carrier/i);
  assert.match(guidance.message, /young travelers/i);
});

test('United carrier guidance links its official pages and states source limits without inventing rules', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [{
      operating_carrier_code: 'UA', operating_carrier_name: 'United Airlines',
      marketing_carrier_code: 'UA', marketing_carrier_name: 'United Airlines',
      departure_time_local: '2026-11-12T08:00:00-04:00',
    }],
  }, {
    date: '2026-11-12', tripType: 'one-way',
    travelers: [
      { id: 'child', birthDate: '2014-11-15', guardianId: 'adult' },
      { id: 'adult', birthDate: '1980-01-01' },
    ],
  });

  const united = guidance.carriers.find(carrier => carrier.code === 'UA');
  assert.equal(guidance.status, 'unverified');
  assert.equal(united.name, 'United Airlines');
  assert.match(united.message, /current public source text could not be verified/i);
  assert.match(united.message, /does not assume United-specific age bands, infant seating rules, solo-minor eligibility, route restrictions, charges, or partner rules/i);
  assert.match(united.message, /confirm the exact travelers, operated flights, seating and fees directly with United or the issuing seller/i);
  assert.ok(guidance.sources.some(source => source.url === 'https://www.united.com/en/us/fly/travel/accessibility-and-assistance/traveling-with-children.html'));
  assert.ok(guidance.sources.some(source => source.url === 'https://www.united.com/en/us/fly/travel/accessibility-and-assistance/unaccompanied-minors.html'));

  const nameOnly = carrierEligibilityGuidance({ airlines: ['United Airlines'], segments: [] }, {
    date: '2026-11-12', tripType: 'one-way', childrenAges: [11], children: 1,
  });
  assert.ok(nameOnly.carriers.some(carrier => carrier.code === 'UA'));
  assert.ok(nameOnly.sources.some(source => source.url === 'https://www.united.com/en/us/fly/travel/accessibility-and-assistance/unaccompanied-minors.html'));
});

test('Air France guidance exposes route-dependent infant, child and Kids Solo rules with current sources', () => {
  const guidance = carrierEligibilityGuidance({
    segments: [{
      operating_carrier_code: 'AF', operating_carrier_name: 'Air France',
      marketing_carrier_code: 'AF', marketing_carrier_name: 'Air France',
      departure_time_local: '2026-11-12T08:00:00-04:00',
    }],
  }, {
    date: '2026-11-12', returnDate: '2026-11-19', tripType: 'round-trip',
    travelers: [
      { id: 'teen', birthDate: '2011-11-15', guardianId: 'adult' },
      { id: 'adult', birthDate: '1980-01-01' },
    ],
  });

  const airFrance = guidance.carriers.find(carrier => carrier.code === 'AF');
  assert.equal(guidance.status, 'unverified');
  assert.equal(airFrance.name, 'Air France');
  assert.match(airFrance.message, /ages 14 and 15/i);
  assert.match(airFrance.message, /age-15 age-rule boundary/i);
  assert.match(airFrance.message, /lap infant.*up to a 90% fare reduction/i);
  assert.match(airFrance.message, /turns 2 during the trip, the child rate applies to the entire booking/i);
  assert.match(airFrance.message, /approved car seat or harness/i);
  assert.match(airFrance.message, /ages 2.?13.*up to 20%.*33%/i);
  assert.match(airFrance.message, /4.?11 domestic and 5.?14 international/i);
  assert.match(airFrance.message, /Nouméa and Saint-Pierre-et-Miquelon/i);
  assert.match(airFrance.message, /connections involving another airline/i);
  assert.match(airFrance.message, /eligibility and price are not verified/i);
  assert.ok(guidance.sources.some(source => source.url === 'https://wwws.airfrance.ca/en/information/passagers/familles-enfants'));
  assert.ok(guidance.sources.some(source => source.url === 'https://wwws.airfrance.ca/en/information/passagers/enfants-voyageant-seuls/a-l-aeroport-enregistrement-depart'));
  assert.ok(guidance.sources.some(source => source.url === 'https://wwws.airfrance.ca/en/information/legal/option-kids-solo'));
});

test('Air France exact birth dates flag an infant turning two during the booking', () => {
  const guidance = carrierEligibilityGuidance({ segments: [
    { operating_carrier_code: 'AF', departure_time_local: '2026-11-12T08:00:00Z' },
    { operating_carrier_code: 'AF', departure_time_local: '2026-11-19T08:00:00Z' },
  ] }, {
    date: '2026-11-12', returnDate: '2026-11-19', tripType: 'round-trip',
    travelers: [{ id: 'infant', birthDate: '2024-11-15', guardianId: 'adult' }, { id: 'adult', birthDate: '1980-01-01' }],
  });

  assert.equal(guidance.status, 'unverified');
  assert.match(guidance.message, /age-2 age-rule boundary/i);
  assert.match(guidance.message, /turns 2 during the trip, the child rate applies to the entire booking/i);
});

test('Air France name-only carrier evidence receives guidance without proving fare eligibility', () => {
  const guidance = carrierEligibilityGuidance({ airlines: ['Air France'], segments: [] }, {
    date: '2026-11-12', tripType: 'one-way', childrenAges: [10], children: 1,
  });

  assert.equal(guidance.status, 'unverified');
  assert.ok(guidance.carriers.some(carrier => carrier.code === 'AF'));
  assert.match(guidance.message, /identified only as a marketing carrier/i);
  assert.match(guidance.message, /Kids Solo availability and fees depend/i);
});

test('KLM guidance covers exact age-two transitions, child fares, and booking restrictions without approving eligibility',()=>{
 const guidance=carrierEligibilityGuidance({segments:[
  {operating_carrier_code:'KL',operating_carrier_name:'KLM',marketing_carrier_code:'KL',marketing_carrier_name:'KLM',departure_time_local:'2026-11-12T08:00:00-04:00'},
  {operating_carrier_code:'KL',operating_carrier_name:'KLM',marketing_carrier_code:'KL',marketing_carrier_name:'KLM',departure_time_local:'2026-11-19T08:00:00-04:00'},
 ]},{date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',travelers:[{id:'infant',birthDate:'2024-11-15',guardianId:'adult'},{id:'adult',birthDate:'1980-01-01'}]});
 const klm=guidance.carriers.find(carrier=>carrier.code==='KL');
 assert.equal(guidance.status,'unverified');assert.equal(klm.name,'KLM');assert.match(klm.message,/ages 1 and 2/i);assert.match(klm.message,/age-2 age-rule boundary/i);
 assert.match(klm.message,/child ticket covers ages 2.?11/i);assert.match(klm.message,/turns 2 during the trip.*child fare applies to all flights.*cannot be booked online/i);
 assert.match(klm.message,/at most two babies per adult, with only one on the adult’s lap/i);assert.match(klm.message,/contact KLM/i);assert.match(klm.message,/eligibility and price are not verified/i);
 assert.ok(guidance.sources.some(source=>source.url==='https://www.klm.ca/information/kids'));
 assert.ok(guidance.sources.some(source=>source.url==='https://www.klm.com/information/ticket-services/tickets-kids'));
 assert.ok(guidance.sources.some(source=>source.url==='https://www.klm.com/information/assistance-health/children-travelling-alone'));
 assert.ok(guidance.sources.some(source=>source.url==='https://www.klm.com/information/legal/fees-paid-options/'));
});

test('KLM name-only guidance preserves its Canadian seating wording conflict and solo age band',()=>{
 const guidance=carrierEligibilityGuidance({airlines:['KLM Royal Dutch Airlines'],segments:[]},{date:'2026-11-12',tripType:'one-way',childrenAges:[10],children:1});
 const klm=guidance.carriers.find(carrier=>carrier.code==='KL');assert.equal(guidance.status,'unverified');assert.ok(klm);
 assert.match(klm.role,/marketing carrier/i);assert.match(klm.message,/solo children ages 5.?14.*requires its Unaccompanied Minor service/i);assert.match(klm.message,/ages 15.?17/i);
 assert.match(klm.message,/Transfers.*allowed only on KLM, Air France, and Delta flights/i);assert.match(klm.message,/under 13.*14 and younger/i);
});

test('KLM exact birth dates flag solo-service age transitions during the trip',()=>{
 const segments=[
  {operating_carrier_code:'KL',departure_time_local:'2026-11-12T08:00:00-04:00'},
  {operating_carrier_code:'KL',departure_time_local:'2026-11-19T08:00:00-04:00'},
 ];
 const guidanceFor=birthDate=>carrierEligibilityGuidance({segments},{date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',travelers:[{id:'child',birthDate}]});
 const turnsFive=guidanceFor('2021-11-15');
 assert.match(turnsFive.message,/ages 4 and 5/i);assert.match(turnsFive.message,/age-5 age-rule boundary/i);assert.equal(turnsFive.status,'unverified');
 const turnsFourteen=guidanceFor('2012-11-15');
 assert.match(turnsFourteen.message,/ages 13 and 14/i);assert.match(turnsFourteen.message,/age-14 age-rule boundary/i);assert.equal(turnsFourteen.status,'unverified');
});

test('Emirates guidance covers infant age changes, infant minimum, and Canada UM transfer limits',()=>{
 const segments=[
  {operating_carrier_code:'EK',operating_carrier_name:'Emirates',marketing_carrier_code:'EK',marketing_carrier_name:'Emirates',departure_time_local:'2026-11-12T08:00:00-04:00'},
  {operating_carrier_code:'EK',operating_carrier_name:'Emirates',marketing_carrier_code:'EK',marketing_carrier_name:'Emirates',departure_time_local:'2026-11-19T08:00:00-04:00'},
 ];
 const infant=carrierEligibilityGuidance({segments},{date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',travelers:[{id:'infant',birthDate:'2024-11-15'}]});
 const emirates=infant.carriers.find(carrier=>carrier.code==='EK');
 assert.equal(infant.status,'unverified');assert.ok(emirates);assert.match(emirates.message,/ages 1 and 2/i);assert.match(emirates.message,/crosses age 2.*needs a seat and applicable child fare/i);
 assert.match(emirates.message,/child-ticketing guidance says children ages 2.?11 need their own seat/i);assert.match(emirates.message,/cannot be booked online/i);
 assert.ok(infant.sources.some(source=>source.url==='https://www.emirates.com/english/family/planning-your-family-trip/unaccompanied-minors/'));
 const newborn=carrierEligibilityGuidance({segments},{date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',travelers:[{id:'newborn',birthDate:'2026-11-10'}]});
 assert.match(newborn.message,/under 7 days old.*emergency medical or compassionate exceptions/i);assert.equal(newborn.status,'unverified');
});

test('Emirates name-only guidance preserves solo age ambiguity and Canadian transfer restrictions',()=>{
 const guidance=carrierEligibilityGuidance({airlines:['Emirates Airlines'],segments:[]},{date:'2026-11-12',tripType:'one-way',childrenAges:[10],children:1});
 const emirates=guidance.carriers.find(carrier=>carrier.code==='EK');assert.equal(guidance.status,'unverified');assert.ok(emirates);
 assert.match(emirates.role,/marketing carrier/i);assert.match(emirates.message,/solo children ages 5.?11.*adult fare/i);
 assert.match(emirates.message,/exact age.?12 threshold is therefore unclear/i);assert.match(emirates.message,/only as far as Toronto/i);
 assert.match(emirates.message,/only to Emirates-operated flights/i);assert.match(emirates.message,/eligibility and price are not verified/i);
});

test('Emirates exact birth dates surface solo-service and guardian age boundaries',()=>{
 const segments=[{operating_carrier_code:'EK',departure_time_local:'2026-11-12T08:00:00-04:00'},{operating_carrier_code:'EK',departure_time_local:'2026-11-19T08:00:00-04:00'}];
 for(const [birthDate,ages,boundary] of [
  ['2021-11-15','ages 4 and 5','age-5'],
  ['2014-11-15','ages 11 and 12','age-12'],
  ['2010-11-15','ages 15 and 16','age-16'],
  ['2008-11-15','ages 17 and 18','age-18'],
 ]){
  const guidance=carrierEligibilityGuidance({segments},{date:'2026-11-12',returnDate:'2026-11-19',tripType:'round-trip',travelers:[{id:'child',birthDate}]});
  assert.match(guidance.message,new RegExp(ages));assert.match(guidance.message,new RegExp(`${boundary} age-rule boundary`));assert.equal(guidance.status,'unverified');
 }
});
