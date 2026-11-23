/** Validate ages supplied by the traveler; no invented ages or inferred infant handling. */
const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
// With age-only input, the next birthday may be tomorrow; later birthdays are at least 365 days apart.
const couldReachAgeBoundary=(age,boundary,days)=>Number.isInteger(age)&&Number.isInteger(boundary)&&Number.isFinite(days)&&boundary>age&&days>=1+(boundary-age-1)*365;

/** Require DOB when an age-only child could cross Ignav's age-12 boundary. */
export function validateIgnavRoundTripAge(input) {
 if(input?.travelers===undefined&&input?.tripType==='round-trip'&&validDay(input.date)&&validDay(input.returnDate)&&input.returnDate>input.date&&Array.isArray(input.childrenAges)) {
  const days=(Date.parse(input.returnDate)-Date.parse(input.date))/86400000;
  const age=input.childrenAges.find(age=>age>=2&&age<12&&couldReachAgeBoundary(age,12,days));
  if(age!==undefined)throw Error(`An age-${age} traveler could enter Ignav’s adult fare category before the return. Provide each traveler’s date of birth and use identified traveler mode to validate both travel dates.`);
 }
}

/** Calendar age at travel date. Leap-day birthdays are deliberately unresolved in non-leap years. */
export function ageOnDate(birthDate, travelDate) {
 if (!validDay(birthDate) || !validDay(travelDate) || birthDate > travelDate) throw Error('Enter a valid birth date on or before travel.');
 const [birthYear,birthMonth,birthDay] = birthDate.split('-').map(Number);
 const [year,month,day] = travelDate.split('-').map(Number);
 const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
 if (birthMonth === 2 && birthDay === 29 && !leapYear && ((month === 2 && day === 28) || (month === 3 && day === 1))) throw Error('Age around February 29 for a leap-day birth requires carrier verification.');
 return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0);
}

/** Return only travelers verified to be adults on every supplied travel date. */
export function guardianCandidates(travelers, personId, travelDates) {
 if (!Array.isArray(travelers) || !Array.isArray(travelDates) || !travelDates.length) return [];
 const target=travelers.find(person=>person?.id===personId);
 let targetAges=[];
 try { if(target?.infantSeating==='lap') targetAges=travelDates.map(date=>ageOnDate(target.birthDate,date)); }
 catch { return []; }
 return travelers.filter(candidate => {
  if (!candidate || candidate.id === personId || typeof candidate.birthDate !== 'string') return false;
  try {
   if(!travelDates.every(date => ageOnDate(candidate.birthDate, date) >= 18))return false;
   if(targetAges.some(age=>age<2)&&travelers.some(other=>{
    if(other?.id===personId||other?.guardianId!==candidate.id||other?.infantSeating!=='lap')return false;
    try{return travelDates.some((date,index)=>targetAges[index]<2&&ageOnDate(other.birthDate,date)<2);}
    catch{return false;}
   }))return false;
   return true;
  }
  catch { return false; }
 });
}

/** Validate explicit traveler identities and guardian links without asserting carrier eligibility. */
export function validateTravelerIdentities(travelers, travelDates) {
 if (!Array.isArray(travelers) || travelers.length < 1 || travelers.length > 9 || !Array.isArray(travelDates) || !travelDates.length) throw Error('Enter one to nine travelers and travel dates.');
 const ids = new Set();
 const people = travelers.map(person => {
  if (!person || typeof person.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(person.id) || ids.has(person.id)) throw Error('Each traveler needs a unique identifier.');
  ids.add(person.id);
  const ages = travelDates.map(date => ageOnDate(person.birthDate, date));
  if (ages.some(age => age > 120)) throw Error('Check the traveler birth date.');
  if (ages.some(age => age < 2) && !['lap','seat'].includes(person.infantSeating)) throw Error('Choose lap or seat for every infant.');
  if (person.infantSeating !== undefined && !['lap','seat'].includes(person.infantSeating)) throw Error('Choose a valid infant seating option.');
  if (person.infantSeating !== undefined && ages.every(age => age >= 2)) throw Error('Remove infant seating for a traveler who is not an infant on the travel dates.');
  return {id:person.id,birthDate:person.birthDate,ages,...(person.guardianId !== undefined ? {guardianId:person.guardianId} : {}),...(person.infantSeating !== undefined ? {infantSeating:person.infantSeating} : {})};
 });
 for (const person of people) {
  if (!person.ages.some(age => age < 18)) continue;
  const guardian = people.find(candidate => candidate.id === person.guardianId);
  if (!guardian || guardian === person || guardian.ages.some(age => age < 18)) throw Error('Each minor needs an identified adult guardian on every travel date.');
 }
 for (let i=0;i<travelDates.length;i++) {
  const lapGuardians = new Set();
  for (const person of people) if (person.ages[i] < 2 && person.infantSeating === 'lap') {
   if (lapGuardians.has(person.guardianId)) throw Error('A guardian cannot hold more than one lap infant.');
   lapGuardians.add(person.guardianId);
  }
 }
 return people;
}

/** Translate identified travelers to Ignav's documented passenger categories. */
export function ignavIdentityParty(input) {
 if (['adults','children','childrenAges'].some(field=>input[field] !== undefined)) throw Error('Use either identified travelers or passenger counts, not both.');
 const dates = input.tripType === 'round-trip' ? [input.date,input.returnDate] : [input.date];
 const people = validateTravelerIdentities(input.travelers, dates);
 const category = (person, index) => person.ages[index] < 2 ? `infant_${person.infantSeating}` : person.ages[index] < 12 ? 'child' : 'adult';
 if (people.some(person => person.ages.some((_,index)=>category(person,index)!==category(person,0)))) throw Error('A traveler changes Ignav fare category during this trip; request an agent quote for the exact dates.');
 const adults = people.filter(person=>person.ages[0]>=12).length;
 const children = people.filter(person=>person.ages[0]>=2&&person.ages[0]<12).length;
 const infantsInSeat = people.filter(person=>person.ages[0]<2&&person.infantSeating==='seat').length;
 const infantsOnLap = people.filter(person=>person.ages[0]<2&&person.infantSeating==='lap').length;
 if (!people.some(person=>person.ages.every(age=>age>=18))) throw Error('At least one identified adult guardian must travel.');
 return {people,adults,children,infantsInSeat,infantsOnLap};
}

/** Reject party fields that the current adapters cannot yet price, including direct calls. */
export function rejectUnsupportedTravelerFields(input) {
  for (const field of ['infants','infantsInSeat','infantsInLap','infantsOnLap','infantInSeat','infantInLap','infants_in_seat','infants_on_lap','youths','seniors','passengers','travelers']) {
  if (input?.[field] !== undefined && input[field] !== 0 && input[field] !== null && !(Array.isArray(input[field]) && input[field].length === 0)) throw Error('Infant and traveler-identity searches are not yet supported by this search path.');
 }
}

export function validateTravelers(input) {
 rejectUnsupportedTravelerFields(input);
 const adults=input?.adults ?? 1, children=input?.children ?? 0, ages=input?.childrenAges ?? [];
 if(!Number.isInteger(adults)||adults<1||!Number.isInteger(children)||children<0||adults+children>9)throw Error('Enter one to nine travelers, including at least one adult.');
 if(!Array.isArray(ages)||ages.length!==children||ages.some(age=>!Number.isInteger(age)||age<2||age>17))throw Error('Enter the actual age at departure for every child or youth (ages 2–17). Infant fares are not supported yet.');
 return {adults,children,childrenAges:ages};
}

/** Validate either the legacy count form or a complete identified party. */
export function validateSearchParty(input) {
 if (input?.travelers === undefined) return validateTravelers(input);
 rejectUnsupportedTravelerFields({...input,travelers:undefined});
 return ignavIdentityParty(input);
}

/** Skyscanner accepts adults 18+ and exact ages for children; never infer DOB or infant seating. */
export function skyscannerIdentityParty(input){
 if(['adults','children','childrenAges'].some(field=>input[field]!==undefined))throw Error('Use either identified travelers or passenger counts, not both.');
 rejectUnsupportedTravelerFields({...input,travelers:undefined});
 const dates=input.tripType==='round-trip'?[input.date,input.returnDate]:[input.date];
 const people=validateTravelerIdentities(input.travelers,dates);
 if(people.length>8)throw Error('Skyscanner supports up to eight travelers.');
 if(people.some(person=>person.ages.some(age=>age<2)||person.infantSeating!==undefined))throw Error('Skyscanner infant seating is not supported by this integration.');
 if(people.some(person=>person.ages[0]<18&&person.ages.some(age=>age!==person.ages[0])))throw Error('A child changes age during this Skyscanner trip; an exact seller quote is required.');
 const adults=people.filter(person=>person.ages.every(age=>age>=18)).length;
 if(!adults)throw Error('At least one identified adult guardian must travel.');
 return {people,adults,childrenAges:people.filter(person=>person.ages[0]<18).map(person=>person.ages[0])};
}

/** Expedia listings price supplied child ages but cannot consume DOBs or infant seats. */
export function expediaParty(input){
 const party=validateTravelers(input);
 if(party.adults+party.children>6)throw Error('Expedia supports up to six travelers.');
 if(input.tripType==='round-trip'){
  if(!validDay(input.date)||!validDay(input.returnDate)||input.returnDate<input.date)throw Error('Enter valid exact Expedia departure and return dates.');
  const days=(Date.parse(`${input.returnDate}T00:00:00Z`)-Date.parse(`${input.date}T00:00:00Z`))/86400000;
  if(party.childrenAges.some(age=>age<12&&couldReachAgeBoundary(age,12,days)))throw Error('An Expedia child age could cross its adult-fare boundary before the return; provide exact dates and traveler birth dates to verify fare categories.');
 }
 return party;
}

const googlePartyError=message=>{throw Error(`Google round-trip evidence: ${message}`);};
/** Observed Google categories are distinct from legal adult/guardian status. */
export function googleRoundTripParty(input){
 rejectUnsupportedTravelerFields({...input,travelers:undefined});
 if(input.tripType!=='round-trip'||(input.cabin??'economy')!=='economy')return googlePartyError('only the observed economy round-trip contract is implemented.');
 const dates=[input.date,input.returnDate];if(dates.some(value=>!validDay(value)))return googlePartyError('valid exact departure and return dates are required.');
 if(dates[1]<dates[0])return googlePartyError('return precedes departure.');
 if(input.travelers!==undefined){
  if(['adults','children','childrenAges'].some(key=>input[key]!==undefined))return googlePartyError('mixed identified and count parties.');
  const people=validateTravelerIdentities(input.travelers,dates);
  if(people.some(person=>person.infantSeating!==undefined||person.ages.some(age=>age<2)))return googlePartyError('infant pricing is not verified by this operation.');
  if(people.some(person=>person.ages.some(age=>(age<12)!==(person.ages[0]<12))))return googlePartyError('a traveler changes fare category during the trip.');
  const adults=people.filter(person=>person.ages[0]>=12).length;
  return {adults,children:people.length-adults,total:people.length};
 }
 const party=validateTravelers(input),days=(Date.parse(dates[1])-Date.parse(dates[0]))/86400000;
 if(party.childrenAges.some(age=>age<12&&couldReachAgeBoundary(age,12,days)))return googlePartyError('a supplied child age could cross the adult fare boundary; birth dates are required.');
 const adults=party.adults+party.childrenAges.filter(age=>age>=12).length;
 return {adults,children:party.childrenAges.filter(age=>age<12).length,total:party.adults+party.children};
}


/** Matrix uses category counts; identities stay local and category changes are refused. */
export function matrixParty(input,observedDates){
 const date=input.date??input.departureDate,dates=observedDates??(input.tripType==='round-trip'||input.returnDate?[date,input.returnDate]:[date]);
 if(!dates.length||dates.some(day=>!validDay(day)))throw Error('Provide valid Matrix travel dates.');
 const category=(age,seating)=>age<2?(seating==='seat'?'infantsInSeat':'infantsInLap'):age<12?'children':age<18?'youths':age<62?'adults':'seniors';
 const passengers={};
 const add=key=>{passengers[key]=(passengers[key]??0)+1;};
 if(input.travelers!==undefined){
  if(['adults','children','childrenAges'].some(key=>input[key]!==undefined))throw Error('Use identified travelers or counts, not both.');
  rejectUnsupportedTravelerFields({...input,travelers:undefined});
  const people=validateTravelerIdentities(input.travelers,dates);
  for(const person of people){const key=category(person.ages[0],person.infantSeating);if(person.ages.some(age=>category(age,person.infantSeating)!==key))throw Error('A traveler changes Matrix fare category during this trip.');add(key);}
 }else{
  const party=validateTravelers(input);passengers.adults=party.adults;
  const days=(Math.max(...dates.map(Date.parse))-Date.parse(date))/86400000;
  for(const age of party.childrenAges){const boundary=age<12?12:18;if(couldReachAgeBoundary(age,boundary,days))throw Error('Provide birth dates when a traveler could change Matrix fare category before returning.');add(category(age));}
 }
 return passengers;
}
