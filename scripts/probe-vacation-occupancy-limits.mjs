import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {selectVacationParty} from '../lib/vacation-form.mjs';

// Read-only live widget probe. It does not submit a package search or open checkout.
const browser=await chromium.launch({executablePath:process.env.API_ANYTHING_BROWSER||'/usr/bin/chromium',headless:true});
try{
 const page=await browser.newPage();page.setDefaultTimeout(15000);
 await page.goto('https://vacations.aircanada.com/en/all-booking-options/flight-hotel/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForTimeout(8000);
 const cookie=page.getByRole('button',{name:'Accept all',exact:true});if(await cookie.isVisible())await cookie.click();
 const guests=page.locator('#flight_hotel_tab-Guests');await guests.click();
 const read=async kind=>Number(await page.locator(`#${kind}-value`).evaluate(node=>node.value??node.textContent));
 const adults=await read('adult');
 const roomAdd=page.getByRole('button',{name:'Add room',exact:true});
 if(await roomAdd.isEnabled())await roomAdd.click();
 const twoRoomCount=await read('room');
 const childAdd=page.getByRole('button',{name:'Add child',exact:true});
 const childEnabledAtTwoRooms=await childAdd.isEnabled();
 assert.equal(twoRoomCount,2,'The live widget did not retain a two-room selection.');
 assert.equal(childEnabledAtTwoRooms,false,'The widget unexpectedly enabled a child with two rooms; inspect the new source behavior before changing app validation.');
 const roomRemove=page.getByRole('button',{name:'Remove room',exact:true});
 if(!await roomRemove.isEnabled())throw Error('The provider did not allow returning to one room.');
 await roomRemove.click();
 if(await read('room')!==1||!await childAdd.isEnabled())throw Error('The provider did not re-enable child occupancy at one room.');
 const selected=await selectVacationParty(page,{adults,rooms:1,childrenAges:[7]});
 assert.deepEqual(selected.childrenAges,[7],'The ordinary age dropdown did not retain the selected child age.');
 console.log(JSON.stringify({source:'Air Canada Vacations public Flight + Hotel widget',observedAt:new Date().toISOString(),twoRoomsRetained:twoRoomCount,childAddEnabledAtTwoRooms:childEnabledAtTwoRooms,childAddEnabledAtOneRoom:true,oneRoomChildOccupancy:selected.childrenAges,exactChildAgeSelected:7,searchSubmitted:false,checkoutOpened:false},null,2));
}finally{await browser.close();}
