export function frameTimes(length,fps=24){
  if(!Number.isFinite(length)||length<=0||length>60)throw Error('Preview duration must be 0..60 seconds');
  if(!Number.isFinite(fps)||fps<=0||fps>120)throw Error('Preview fps must be 0..120');
  const intervals=Math.min(240,Math.ceil(length*fps));
  return Array.from({length:intervals+1},(_,i)=>i*length/intervals);
}
export function playbackIndex(times,frameCount,elapsed){
  const count=Math.min(times.length,frameCount);
  if(count<2)return 0;
  const step=times[1]-times[0];if(!(step>0))return 0;
  // The explicit endpoint remains seekable but must not add an extra hold per loop.
  const period=times[count-1];if(!(period>0))return 0;
  const time=((elapsed%period)+period)%period;
  return Math.min(count-2,Math.floor((time+1e-9)/step));
}
export function playerHtml(report){
  const data=JSON.stringify({times:report.times,frames:report.frames}).replace(/</g,'\\u003c');
  return `<!doctype html><meta charset="utf-8"><title>Animation review</title><style>body{background:#222;color:#eee;font:18px sans-serif}img{max-width:90vw;image-rendering:auto}input{width:70vw}</style><h1>Animation review</h1><p>Captured frames, not Minecraft runtime verification. Loop playback includes the explicit end pose.</p><img id="image"><p><button id="play">Play / Pause</button><input id="seek" type="range" min="0" value="0"><output id="time"></output></p><script>
const data=${data};const playbackIndex=${playbackIndex.toString()};const picture=document.getElementById('image'),seek=document.getElementById('seek'),label=document.getElementById('time');let running=false,index=0,origin=0;
seek.max=Math.max(0,data.frames.length-1);function show(i){index=i;picture.src=data.frames[i];seek.value=i;label.textContent=(data.times[i]||0).toFixed(3)+' s';}seek.oninput=()=>{running=false;show(+seek.value)};document.getElementById('play').onclick=()=>{running=!running;origin=performance.now()-(data.times[index]||0)*1000};
function tick(now){if(running&&data.frames.length>1){const next=playbackIndex(data.times,data.frames.length,(now-origin)/1000);if(next!==index)show(next)}requestAnimationFrame(tick)}if(data.frames.length)show(0);requestAnimationFrame(tick);
</script>`;
}
