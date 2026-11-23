export function itineraryNotes(offer) {
 const notes=[];
 if(offer?.requiresSelfTransfer===true) notes.push('Provider reports a self-transfer; verify connections and baggage.');
 if(typeof offer?.departureDate==='string'&&typeof offer?.arrivalDate==='string'&&offer.arrivalDate>offer.departureDate) notes.push('Arrival is on a later calendar date.');
 if(Array.isArray(offer?.via)&&offer.via.length) notes.push(`${offer.via.length} connection${offer.via.length===1?'':'s'}: ${offer.via.join(', ')}.`);
 return notes;
}
