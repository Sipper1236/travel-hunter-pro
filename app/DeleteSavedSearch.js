'use client';
export default function DeleteSavedSearch({search,label}){
 if(!search.job?.ownerToken||!['complete','error','cancelled'].includes(search.job.status))return null;
 return <div className="note"><button type="button" disabled={search.removing} onClick={()=>{if(window.confirm(`Delete this saved ${label} search and its stored query, traveler data and results? This cannot be undone.`))void search.remove();}}>{search.removing?'Deleting…':`Delete saved ${label} search`}</button><p>Removes this saved job and its results, not your draft form or separate searches. Local database journals or backups may retain earlier data; this is not secure disk erasure.</p></div>;
}
