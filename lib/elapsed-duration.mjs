const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
function offsetInstant(value){
 if(typeof value!=='string')return null;
 const match=/^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,9})?)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
 if(!match||!validDay(match[1]))return null;
 if(match[5]!=='Z'){const hours=Number(match[7]),minutes=Number(match[8]);if(minutes>59||hours>14||hours===14&&minutes!==0||match[6]==='-'&&hours===0&&minutes===0)return null;}
 const instant=Date.parse(value);return Number.isFinite(instant)?instant:null;
}

/** Exact journey elapsed time from a complete, offset-aware, chronological segment chain. */
export function elapsedJourneyMinutes(leg){
 const segments=leg?.segments;if(!Array.isArray(segments)||segments.length<1||segments.length>12)return null;
 let previousArrival=null,previousAirport=null;
 for(const segment of segments){
  const from=segment?.departure_airport??segment?.from,to=segment?.arrival_airport??segment?.to;
  const departureValue=segment?.departure_time_utc??segment?.departureAt??segment?.departure_time_local;
  const arrivalValue=segment?.arrival_time_utc??segment?.arrivalAt??segment?.arrival_time_local;
  const departure=offsetInstant(departureValue),arrival=offsetInstant(arrivalValue);
  if(typeof from!=='string'||!/^[A-Z]{3}$/.test(from)||typeof to!=='string'||!/^[A-Z]{3}$/.test(to)||from===to||departure===null||arrival===null||arrival<=departure||previousArrival!==null&&(from!==previousAirport||departure<previousArrival))return null;
  previousAirport=to;previousArrival=arrival;
 }
 const firstDeparture=offsetInstant(segments[0].departure_time_utc??segments[0].departureAt??segments[0].departure_time_local);
 const minutes=(previousArrival-firstDeparture)/60000;
 return Number.isFinite(minutes)&&minutes>0?minutes:null;
}
