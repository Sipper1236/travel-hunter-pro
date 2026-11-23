import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { selectVacationParty } from '../lib/vacation-form.mjs';

test('package widget helper sends the exact child age and validates the one-room limit', async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<div id="flight_hotel_tab">
      <input id="flight_hotel_tab-Guests" value="2 Guests - 1 Room">
      <button aria-label="Remove adult" onclick="setCount('adult',-1)"></button><span id="adult-value">2</span><button aria-label="Add adult" onclick="setCount('adult',1)"></button>
      <button aria-label="Remove child" onclick="setCount('child',-1)"></button><span id="child-value">0</span><button aria-label="Add child" onclick="setCount('child',1)"></button>
      <button aria-label="Remove infant" onclick="setCount('infant',-1)"></button><span id="infant-value">0</span><button aria-label="Add infant" onclick="setCount('infant',1)"></button>
      <button aria-label="Remove room" onclick="setCount('room',-1)"></button><span id="room-value">1</span><button aria-label="Add room" onclick="setCount('room',1)"></button>
      <div id="dropdown-input-child-age-0" role="combobox" onclick="document.querySelector('#child-age-0-option-10').hidden=false">Select Child 1 Age</div>
      <div id="child-age-0-option-10" role="option" aria-selected="false" hidden onclick="this.setAttribute('aria-selected','true');document.querySelector('#dropdown-input-child-age-0').textContent='10 years old'">10 years old</div>
      <button onclick="document.querySelector('#flight_hotel_tab-Guests').value=document.querySelector('#adult-value').textContent+' Guests - '+document.querySelector('#room-value').textContent+' Room'">DONE</button>
      <script>function setCount(kind,delta){const n=document.querySelector('#'+kind+'-value');n.textContent=String(Number(n.textContent)+delta);}</script>
    </div>`);

    const selected = await selectVacationParty(page, { adults: 1, rooms: 1, childrenAges: [10] });
    assert.deepEqual(selected, { adults: 1, rooms: 1, childrenAges: [10], infants: 0, display: '1 Guests - 1 Room' });
    assert.equal(await page.locator('#child-age-0-option-10').getAttribute('aria-selected'), 'true');
    await assert.rejects(selectVacationParty(page, { adults: 2, rooms: 2, childrenAges: [10] }), /one room/i);
  } finally {
    await browser.close();
  }
});

test('package widget submits only the explicitly selected lap-infant count', async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<div id="flight_hotel_tab">
      <input id="flight_hotel_tab-Guests" value="1 Guests - 1 Room">
      <button aria-label="Remove adult" onclick="setCount('adult',-1)"></button><span id="adult-value">1</span><button aria-label="Add adult" onclick="setCount('adult',1)"></button>
      <button aria-label="Remove child" onclick="setCount('child',-1)"></button><span id="child-value">0</span><button aria-label="Add child" onclick="setCount('child',1)"></button>
      <button aria-label="Remove infant" onclick="setCount('infant',-1)"></button><span id="infant-value">0</span><button aria-label="Add infant" onclick="setCount('infant',1)"></button>
      <button aria-label="Remove room" onclick="setCount('room',-1)"></button><span id="room-value">1</span><button aria-label="Add room" onclick="setCount('room',1)"></button>
      <button onclick="document.querySelector('#flight_hotel_tab-Guests').value=document.querySelector('#adult-value').textContent+' Guests - '+document.querySelector('#room-value').textContent+' Room'">DONE</button>
      <script>function setCount(kind,delta){const n=document.querySelector('#'+kind+'-value');n.textContent=String(Number(n.textContent)+delta);}</script>
    </div>`);
    const infant = {seating:'lap',departureAge:0,returnAge:1};
    const selected = await selectVacationParty(page, {adults:1,rooms:1,childrenAges:[],infants:[infant]});
    assert.deepEqual(selected, {adults:1,rooms:1,childrenAges:[],infants:1,display:'1 Guests - 1 Room'});
    assert.equal(await page.locator('#infant-value').textContent(),'1');
    await assert.rejects(selectVacationParty(page,{adults:1,rooms:1,childrenAges:[],infants:[{...infant,seating:'seat'}]}),/lap infants/i);
  } finally {
    await browser.close();
  }
});
