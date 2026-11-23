'use client';
import { guardianCandidates } from '../lib/travelers.mjs';

export default function IdentifiedTravelers({travelers,onChange,travelDates=[]}) {
 const update=(index,field,value)=>onChange(travelers.map((person,i)=>{if(i!==index)return person;const next={...person,[field]:value};if(!value&&(field==='infantSeating'||field==='guardianId'))delete next[field];return next;}));
 return <fieldset><legend>Travelers and guardians</legend>
  <p className="note">Enter each birth date. Choose the guardian for each traveler under 18 and lap or seat for infants. Ignav supports identified parties including infants. ITA Matrix can submit validated lap/seat infant counts for economy searches; it receives passenger categories, not traveler identities, and does not confirm carrier or fare eligibility. Skyscanner supports identified non-infant families on eligible dates when partner access is configured; child age changes during a trip require a seller quote. Carrier rules and seller eligibility still need confirmation.</p>
  {travelers.map((person,index)=><fieldset key={person.id}><legend>Traveler {index+1}</legend>
   <label>Birth date<input type="date" required value={person.birthDate} onChange={event=>update(index,'birthDate',event.target.value)}/></label>
   <label>Guardian for a minor<select value={person.guardianId || ''} onChange={event=>update(index,'guardianId',event.target.value)}><option value="">No guardian selected</option>{guardianCandidates(travelers,person.id,travelDates).map(other=><option key={other.id} value={other.id}>Traveler {travelers.indexOf(other)+1}</option>)}</select></label>
   <label>Infant seating<select value={person.infantSeating || ''} onChange={event=>update(index,'infantSeating',event.target.value)}><option value="">Not an infant</option><option value="lap">On guardian's lap</option><option value="seat">Own seat</option></select></label>
   {travelers.length>1&&<button type="button" onClick={()=>onChange(travelers.filter((_,i)=>i!==index))}>Remove traveler {index+1}</button>}
  </fieldset>)}
  {travelers.length<9&&<button type="button" onClick={()=>onChange([...travelers,{id:crypto.randomUUID(),birthDate:''}])}>Add traveler</button>}
 </fieldset>;
}
