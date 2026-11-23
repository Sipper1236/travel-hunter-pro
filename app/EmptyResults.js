import {emptySearchOutcome} from '../lib/search-outcome.mjs';

export default function EmptyResults({result}) {
  const outcome = emptySearchOutcome(result);
  return outcome ? <div className="empty" data-outcome={outcome.code}><strong>{outcome.title}</strong><p>{outcome.message}</p></div> : null;
}
