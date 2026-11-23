// Ordinary public UI interaction. Does not submit searches or infer package prices.
export async function typeVacationLocation(field,text){
 for(let attempt=0;attempt<2;attempt++){
  await field.click();await field.press('Control+A');await field.pressSequentially(text,{delay:100});
  if(await field.inputValue()===text)return;
 }
 throw Error('Provider changed the location text while typing. Start a new location lookup.');
}
export function vacationLocationSelection(query,kind){
 if(!query||!['from','to'].includes(kind))throw Error('Choose a supported provider location field.');
 const label=kind==='from'?query.originLabel:query.destinationLabel;
 if(typeof label!=='string'||label.trim().length<3||/^[A-Z]{3}$/.test(label.trim()))throw Error('Supply the exact provider location label.');
 return {kind,searchText:label,exactLabel:label};
}

export async function openVacationFlightPanel(card){
 const links=card.locator('.flight-details-link');const visible=[];
 for(let i=0;i<await links.count();i++){const link=links.nth(i);if(await link.isVisible())visible.push(link);}
 if(!visible.length)return false;
 const targets=await Promise.all(visible.map(link=>link.getAttribute('aria-controls')));
 if(targets.some(target=>!target)||new Set(targets).size!==1)throw Error('Provider displayed ambiguous flight details controls.');
 const link=visible[0];if(await link.getAttribute('aria-expanded')!=='true')await link.click();
 return true;
}

export async function selectVacationLocation(page,{kind,searchText,exactLabel}){
 if(!['from','to'].includes(kind)||typeof searchText!=='string'||!searchText.trim()||typeof exactLabel!=='string'||!exactLabel.trim())throw Error('Supply a location query and exact provider suggestion.');
 const field=page.locator(`#flight_hotel_tab-${kind}-input`);
 await field.waitFor({state:'visible',timeout:20000});
 await typeVacationLocation(field,searchText);
 const list=page.locator(`#flight_hotel_tab-${kind}-listbox`);
 const selection=list.getByText(exactLabel,{exact:true});
 await selection.waitFor({state:'visible',timeout:15000});
 if(await selection.count()!==1)throw Error('Provider location is ambiguous; choose a unique suggestion.');
 await selection.click();
 const value=await field.inputValue();
 if(value.trim()!==exactLabel.trim())throw Error('Provider did not retain the exact selected location.');
 return {kind,label:exactLabel,value};
}

export async function selectVacationDates(page,{departure,returnDate}){
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!valid(departure)||!valid(returnDate)||departure<new Date().toISOString().slice(0,10)||returnDate<=departure)throw Error('Supply valid future package dates with return after departure.');
 await page.locator('#flight_hotel_tab-departureDateId').click();
 for(const date of [departure,returnDate]){
  let selected=false;
  for(let move=0;move<18;move++){
   const cells=page.locator(`[data-test-id="dp-${date}"]`);
   for(let i=0;i<await cells.count();i++){
    const cell=cells.nth(i);
    if(await cell.isVisible()&&(await cell.innerText()).trim()){
     if(await cell.getAttribute('aria-disabled')==='true')throw Error('Provider has disabled the requested date.');
     await cell.click();selected=true;break;
    }
   }
   if(selected)break;
   await page.getByRole('button',{name:'Next month',exact:true}).click();
  }
  if(!selected)throw Error('Requested date not found within the provider calendar.');
 }
 await page.getByRole('button',{name:'Select',exact:true}).click();
 const values={departure:await page.locator('#flight_hotel_tab-departureDateId').inputValue(),returnDate:await page.locator('#flight_hotel_tab-returnDateId').inputValue()};
 const displayed=d=>d.split('-').reverse().join('/');
 if(values.departure!==displayed(departure)||values.returnDate!==displayed(returnDate))throw Error('Provider did not retain the exact requested travel dates.');
 return values;
}

export async function selectVacationParty(page,{adults,rooms,childrenAges,infants=[]}){
 if(!Number.isInteger(adults)||adults<1||adults>6||!Number.isInteger(rooms)||rooms<1||rooms>adults||!Array.isArray(childrenAges)||childrenAges.length>8||childrenAges.some(age=>!Number.isInteger(age)||age<2||age>17)||!Array.isArray(infants)||infants.some(infant=>!infant||Object.keys(infant).length!==3||!['seating','departureAge','returnAge'].every(key=>Object.hasOwn(infant,key))||infant.seating!=='lap'||![0,1].includes(infant.departureAge)||![0,1].includes(infant.returnAge))||infants.length>adults||adults+childrenAges.length+infants.length>9)throw Error('Select 1–6 adults, actual child ages and only lap infants under two throughout the trip; the party limit is nine travelers.');
 if((childrenAges.length||infants.length)&&rooms!==1)throw Error('Air Canada Vacations currently permits only one room when children or infants are included.');
 await page.locator('#flight_hotel_tab-Guests').click();
 const read=async kind=>Number(await page.locator(`#${kind}-value`).evaluate(n=>n.value??n.textContent));
 for(const [kind,target] of [['child',childrenAges.length],['infant',infants.length],['adult',adults],['room',rooms]]){
  for(let step=0;step<12;step++){
   const current=await read(kind);if(!Number.isInteger(current))throw Error('Provider guest count could not be read.');
   if(current===target)break;
   const button=page.getByRole('button',{name:`${current<target?'Add':'Remove'} ${kind}`,exact:true});
   if(!await button.isEnabled())throw Error('Provider does not permit the requested occupancy.');
   await button.click();
  }
  if(await read(kind)!==target)throw Error('Provider did not retain requested occupancy.');
 }
 for(let index=0;index<childrenAges.length;index++){
  const age=childrenAges[index],field=page.locator(`#dropdown-input-child-age-${index}`),option=page.locator(`#child-age-${index}-option-${age}`);
  await field.waitFor({state:'visible'});await field.click();await option.waitFor({state:'visible'});
  if(await option.getAttribute('role')!=='option')throw Error('Provider child age option is not a selectable choice.');
  await option.click();
  if(await option.getAttribute('aria-selected')!=='true')throw Error('Provider did not retain the requested child age.');
 }
 await page.getByText(/^done$/i,{exact:true}).click();
 return {adults,rooms,childrenAges:[...childrenAges],infants:infants.length,display:await page.locator('#flight_hotel_tab-Guests').inputValue()};
}

export const selectVacationAdults=selectVacationParty;
