import {startSearchWorker} from '../lib/search-worker.mjs';
const worker=startSearchWorker();
console.log('Travel search worker ready. Polling durable flight, hotel, package, comparison and calendar jobs.');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{worker.stop();process.exit(0);});
