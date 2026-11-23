'use client';
export default function ComparisonStatus({search}){
  const {job,busy,connectionMessage,cancel,pause,resume}=search;
  if(!job)return null;
  return <div className="coverage" role="status"><strong>Ticket comparison: {job.status}</strong>
    <p>{connectionMessage || (job.retryAt?`Worker recovery retry scheduled for ${new Date(job.retryAt).toLocaleTimeString()}.`:job.progress?.stage?.replaceAll('_',' '))}{job.progress?.fareRequestsStarted!==undefined?` · ${job.progress.fareRequestsStarted} fare requests started; budget ${job.progress.requestBudget}`:''}{job.progress?.responsesReused?` · ${job.progress.responsesReused} saved responses reused`:''}</p>
    {job.status==='paused'?<button type="button" onClick={resume}>Resume comparison</button>:['queued','running'].includes(job.status)&&<button type="button" onClick={pause}>Pause comparison</button>}
    {busy&&<button type="button" onClick={cancel}>Cancel comparison</button>}
  </div>;
}
