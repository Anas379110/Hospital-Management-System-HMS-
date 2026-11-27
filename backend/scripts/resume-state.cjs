module.exports=async function checkResumeState(p,control){
 const x=await p.$queryRawUnsafe('SELECT count(*)::int AS expired FROM public.demo_workspaces WHERE expires_at<=now()');
 const c=await p.$queryRawUnsafe('SELECT count(*)::int AS live FROM public.demo_workspaces WHERE id=$1 AND expires_at>now()',control);
 if(x[0]?.expired!==0)throw Error('Expired workspace remains after cleanup');
 if(c[0]?.live!==1)throw Error('Live control missing');
 return {expiredRemaining:0,liveControlSurvived:true};
};
