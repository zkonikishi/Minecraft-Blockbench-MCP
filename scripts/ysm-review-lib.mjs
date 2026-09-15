// Optional editor evidence collection, deliberately separate from offline recovery.
export function jsonResult(result) {
  if (result.isError) throw Error(result.content?.find(c=>c.type==='text')?.text || 'MCP tool failed');
  const text=result.content?.find(c=>c.type==='text')?.text;
  try { return JSON.parse(text); } catch { throw Error('Expected JSON tool response'); }
}
export function planPoses(model) {
  return [{label:'Rest pose',mode:'edit'}, ...(model.animations||[])
    .filter(a=>a.uuid && Number.isFinite(a.length) && a.length>0).slice(0,3)
    .flatMap(a=>[0,0.25,0.5,0.75].map(f=>({label:`${a.name} @ ${a.length*f}s`,animation:a.uuid,time:a.length*f,mode:'animate'})))];
}
export async function collectReview({model,call,saveImage,report}) {
  let owned;
  const json=async(name,args={})=>jsonResult(await call(name,args));
  const guard=async()=>{if((await json('mc_status')).project?.uuid!==owned)throw Error('Active project changed; review stopped without retry');};
  try {
    report.before=await json('mc_status');
    report.import=await json('mc_import_bbmodel',{model,name:'ysm_visual_review'});
    owned=report.import.project?.uuid;
    if(!owned)throw Error('Import did not return a project UUID');
    for(const pose of planPoses(model)) {
      await guard();
      const {label,...args}=pose;
      await json('mc_preview_animation',args);
      await guard();
      const result=await call('craft_capture_views',{views:['iso','north','east'],max_edge:512,format:'png'});
      if(result.isError)jsonResult(result);
      await guard();
      const images=result.content?.filter(c=>c.type==='image')||[];
      if(images.length!==3)throw Error('Expected three captured images');
      for(const [i,img] of images.entries()) {
        if(img.mimeType!=='image/png')throw Error('Expected PNG screenshot');
        const bytes=Buffer.from(img.data,'base64');
        if(!bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw Error('Invalid PNG screenshot');
        const filename=`view-${String(report.images.length+1).padStart(3,'0')}.png`;
        await saveImage(filename,bytes);
        report.images.push({filename,label,view:['iso','north','east'][i],animation:pose.animation??null,time:pose.time??null});
      }
    }
    report.captureComplete=true;
  } catch(error) { report.error=error.message; }
  finally {
    if(owned)try{await guard();await json('mc_preview_animation',{mode:'edit'});report.editModeRestored=true;}
    catch(error){report.cleanupError=error.message;}
    report.visualVerified=false;
    report.clientVerified=false;
  }
  return report;
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function reviewHtml(report) {
  return `<!doctype html><meta charset="utf-8"><title>YSM visual review</title><style>body{background:#20242b;color:#eee;font:16px sans-serif;padding:24px}main{display:flex;flex-wrap:wrap}figure{margin:12px}img{width:320px;max-width:100%}</style><h1>YSM visual review</h1><p>Capture complete: ${report.captureComplete===true}. Visual verdict pending; Minecraft runtime NOT verified.</p><p>${escape(report.error||'Check textures, silhouettes, pivots and clipping manually. No reference-image comparison performed.')}</p><main>${report.images.map(i=>`<figure><img src="${escape(i.filename)}"><figcaption>${escape(i.label)} / ${escape(i.view)}</figcaption></figure>`).join('')}</main>`;
}
