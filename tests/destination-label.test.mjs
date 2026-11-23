import test from 'node:test';
import assert from 'node:assert/strict';
import {destinationMethodLabel} from '../lib/destination-label.mjs';

test('destination provenance label describes the actual classification path',()=>{
 assert.equal(destinationMethodLabel({method:'Versioned local geographic policy',model:'not-used'}),'versioned local geographic policy');
 assert.equal(destinationMethodLabel({method:'Wikidata exact name or alias and description',model:'laya-local'}),'Wikidata checked by local Laya');
 assert.equal(destinationMethodLabel({method:'Wikidata exact name or alias and description',model:'starting'}),'Wikidata; local model starting');
 assert.equal(destinationMethodLabel({method:'Wikidata exact name or alias and description',model:'not-used'}),'Wikidata classification');
 assert.equal(destinationMethodLabel({method:'Three-letter code; flight source will resolve it'}),'IATA code; source will validate it');
 assert.equal(destinationMethodLabel({method:'Selected by traveler'}),'type selected manually');
 assert.equal(destinationMethodLabel(undefined),'classification source unavailable');
});
