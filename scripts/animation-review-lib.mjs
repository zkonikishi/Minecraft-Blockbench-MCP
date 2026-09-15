export function frameTimes(length,fps=24){
  if(!Number.isFinite(length)||length<=0||length>60)throw Error('Preview duration must be 0..60 seconds');
  const intervals=Math.min(240,Math.ceil(length*fps));
  return Array.from({length:intervals+1},(_,i)=>i*length/intervals);
}
export function playerHtml(report){
  const data=JSON.stringify({times:report.times,frames:report.frames}).replace(/</g,'\\u003c');
  return `<!doctype html><meta charset="utf-8"><title>Animation review</title><style>body{background:#222;color:#eee;font:18px sans-serif}img{max-width:90vw;image-rendering:auto}input{width:70vw}</style><h1>Animation review</h1><p>Captured frames, not Minecraft runtime verification. Loop playback includes the explicit end pose.</p><img id="image"><p><button id="play">Play / Pause</button><input id="seek" type="range" min="0" value="0"><output id="time"></output></p><script>
const data=${data};const picture=document.getElementById('image'),seek=document.getElementById('seek'),label=document.getElementById('time');let running=false,index=0,last=0;
seek.max=Math.max(0,data.frames.length-1);function show(i){index=i;picture.src=data.frames[i];seek.value=i;label.textContent=(data.times[i]||0).toFixed(3)+' s';}seek.oninput=()=>{running=false;show(+seek.value)};document.getElementById('play').onclick=()=>{running=!running;last=performance.now()};
function tick(now){if(running&&data.frames.length>1&&now-last>=1000*(data.times[1]-data.times[0])){show((index+1)%data.frames.length);last=now}requestAnimationFrame(tick)}if(data.frames.length)show(0);requestAnimationFrame(tick);
</script>`;
}
