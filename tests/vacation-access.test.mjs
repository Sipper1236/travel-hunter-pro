import test from 'node:test';
import assert from 'node:assert/strict';
import {isVacationAccessChallenge} from '../lib/vacation-access.mjs';

test('Air Canada Vacations access challenge detection recognizes explicit human checks',()=>{
 assert.equal(isVacationAccessChallenge({title:'Just a moment…',text:'Checking your browser before accessing Air Canada Vacations'}),true);
 assert.equal(isVacationAccessChallenge({title:'Security verification',text:'Please verify that you are human to continue'}),true);
 assert.equal(isVacationAccessChallenge({title:'One more step',text:'Please confirm you are not a robot'}),true);
 assert.equal(isVacationAccessChallenge({title:'Air Canada Vacations',text:'',challengeElementCount:1}),true);
});

test('ordinary widget and cookie text is not mistaken for an access challenge',()=>{
 assert.equal(isVacationAccessChallenge({title:'Air Canada Vacations',text:'Accept all cookies. Search flight and hotel packages.'}),false);
 assert.equal(isVacationAccessChallenge({title:'Terms and conditions',text:'Prices and passenger details must be verified at booking.'}),false);
 assert.equal(isVacationAccessChallenge({title:'',text:'',challengeElementCount:0}),false);
});
