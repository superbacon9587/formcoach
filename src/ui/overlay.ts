import type { PoseFrame, SessionView } from '../shared/contracts';
export function drawOverlay(canvas:HTMLCanvasElement, frame:PoseFrame|null, view:SessionView){
  canvas.width=frame?.width??640;canvas.height=frame?.height??360;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);if(!frame)return;
  const joints=frame.joints;
  ctx.lineWidth=4;ctx.strokeStyle='#9db0c6';ctx.setLineDash([]);
  for(const [a,b] of [['shoulder','elbow'],['elbow','wrist'],['shoulder','hip'],['hip','knee'],['knee','ankle']] as const){
    const p=joints[a],q=joints[b];if(!p||!q||Math.min(p.visibility,q.visibility)<0.6)continue;
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
  }
  const s=joints.shoulder,a=joints.ankle;
  if(s&&a&&Math.min(s.visibility,a.visibility)>=0.6){
    ctx.strokeStyle={unknown:'#8290a3',pass:'#48d9a6',fail:'#ff7d80'}[view.checks.alignment];
    ctx.lineWidth=3;ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(a.x,a.y);ctx.stroke();ctx.setLineDash([]);
  }
  for(const p of Object.values(joints))if(p&&p.visibility>=0.6){ctx.fillStyle='#e7edf6';ctx.beginPath();ctx.arc(p.x,p.y,5,0,2*Math.PI);ctx.fill();}
}
