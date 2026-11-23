import {rejectUnsupportedTravelerFields} from './travelers.mjs';
export function validateVacationQuery(input,today=new Date().toISOString().slice(0,10)){
 rejectUnsupportedTravelerFields({...input,infants:undefined});
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!input||!['origin','destinationAirport'].every(k=>/^[A-Z]{3}$/.test(input[k]||''))||input.origin===input.destinationAirport)throw Error('Supply distinct origin and destination airport codes.');
 for(const key of ['originLabel','destinationLabel'])if(typeof input[key]!=='string'||input[key].trim().length<3||input[key].length>160)throw Error('Supply exact provider location labels; ambiguous locations are not selected automatically.');
 if(!valid(input.date)||!valid(input.returnDate)||input.date<today||input.returnDate<=input.date)throw Error('Supply valid departure and return dates.');
 const infants=input.infants??[];
 if(!Array.isArray(infants)||infants.length>6||infants.some(infant=>!infant||Object.keys(infant).length!==3||!['seating','departureAge','returnAge'].every(key=>Object.hasOwn(infant,key))||infant.seating!=='lap'||![0,1].includes(infant.departureAge)||![0,1].includes(infant.returnAge)))throw Error('Package searches support only lap infants who remain under age two on both travel dates; birth dates are not accepted by the worker.');
 if(!Number.isInteger(input.adults)||input.adults<1||input.adults>6||!Number.isInteger(input.rooms)||input.rooms<1||input.rooms>input.adults||!Array.isArray(input.childrenAges)||input.childrenAges.length>8||input.childrenAges.some(age=>!Number.isInteger(age)||age<2||age>17)||input.adults+input.childrenAges.length+infants.length>9)throw Error('Package search needs 1–6 adults, actual child ages 2–17, supported lap infants, and no more than 9 travelers.');
 if(infants.length>input.adults)throw Error('Air Canada Vacations permits no more than one lap infant per accompanying adult.');
 if((input.childrenAges.length||infants.length)&&input.rooms!==1)throw Error('Air Canada Vacations currently allows a maximum of one room when children or infants are included.');
 if(input.cabin!==undefined&&input.cabin!=='economy')throw Error('Package cabin selection is not supported yet.');
 if(input.filters!==undefined)throw Error('Use the supported package hotel-class, budget and maximum-stops controls; other package filters are not supported yet.');
 if(input.minStars!==undefined&&![4,5].includes(input.minStars))throw Error('Choose a minimum hotel class of four or five stars.');
 if(input.maxPrice!==undefined&&input.maxPrice!==null&&(!Number.isFinite(input.maxPrice)||input.maxPrice<=0||!Number.isSafeInteger(Math.round(input.maxPrice*100))||Math.abs(input.maxPrice*100-Math.round(input.maxPrice*100))>1e-6))throw Error('Enter a valid CAD group budget.');
 if(input.maxStops!==undefined&&input.maxStops!==null&&(!Number.isInteger(input.maxStops)||input.maxStops<0||input.maxStops>2))throw Error('Choose a maximum of zero, one, or two stops.');
 if(input.maxResults!==undefined&&![20,40].includes(input.maxResults))throw Error('Choose a package result limit of 20 or 40.');
 return {origin:input.origin,originLabel:input.originLabel.trim(),destinationAirport:input.destinationAirport,destinationLabel:input.destinationLabel.trim(),date:input.date,returnDate:input.returnDate,adults:input.adults,rooms:input.rooms,childrenAges:[...input.childrenAges],...(infants.length?{infants:infants.map(({seating,departureAge,returnAge})=>({seating,departureAge,returnAge}))}:{}),...(input.minStars!==undefined?{minStars:input.minStars}:{}),...(input.maxPrice!==undefined&&input.maxPrice!==null?{maxPrice:input.maxPrice}:{}),...(input.maxStops!==undefined&&input.maxStops!==null?{maxStops:input.maxStops}:{}),...(input.maxResults!==undefined?{maxResults:input.maxResults}:{})};
}

