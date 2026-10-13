import { performance } from 'node:perf_hooks';
import { cpus, platform, arch } from 'node:os';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { IntentTracker, safeCorridor } from '../dist/core/index.js';
const iterations=100000, batches=11;
const source={left:0,top:0,right:100,bottom:40},target={left:150,top:-40,right:300,bottom:240};
const points=[{x:50,y:20},{x:80,y:50},{x:125,y:100},{x:180,y:150}];
let checksum=0;
function measure(name,run) {
 for(let i=0;i<2;i++)run(10000);
 const timings=[];
 for(let batch=0;batch<batches;batch++) {
  const start=performance.now();run(iterations);
  timings.push((performance.now()-start)*1000/iterations);
 }
 const sorted=[...timings].sort((a,b)=>a-b);
 return {name,iterationsPerBatch:iterations,batches,microsecondsPerSample:{median:sorted[Math.floor(sorted.length/2)],min:sorted[0],max:sorted.at(-1)},batchMicrosecondsPerSample:timings};
}
const measurements=[
 measure('safeCorridor: convex hull, one origin and one target',n=>{for(let i=0;i<n;i++)checksum+=safeCorridor(points[i%4],target).length;}),
 measure('IntentTracker: repeated source -> diagonal -> gap -> target path',n=>{
  const tracker=new IntentTracker();
  for(let i=0;i<n;i++)checksum+=Number(tracker.sample({point:points[i%4],source,target,time:i}).hold);
 }),
];
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const report={version,measuredAt:new Date().toISOString(),node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model??'unknown',measurements,checksum,
 scope:'Local Node.js microbenchmark of the DOM-free core only. Mixed intent path is 50% endpoint samples and 50% corridor samples. Includes core allocations, excludes browser events, style, layout and rendering. Not an end-to-end latency or FPS claim. Shared-host timing is not a universal performance guarantee.'};
await mkdir(new URL('../docs/evidence/',import.meta.url),{recursive:true});
await writeFile(new URL('../docs/evidence/benchmark.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
