import { projectFrontArm, frontArmRig } from '../shared/front-guide';
/** Original frontal mannequin; feet/torso are illustrative, never tracking requirements. */
export function drawFrontDemo(ctx:CanvasRenderingContext2D,w:number,h:number,depth:number,bottom=90,top=160){
  ctx.clearRect(0,0,w,h);const angle=top+(bottom-top)*depth;
  const pose={left:projectFrontArm(w,h,angle,'left'),right:projectFrontArm(w,h,angle,'right')};
  const l=pose.left,r=pose.right,u=Math.min(w,h)/300;
  ctx.save();ctx.lineCap='round';
  ctx.strokeStyle='#50657c';ctx.lineWidth=3*u;ctx.beginPath();ctx.moveTo(w*0.15,h*0.86);ctx.lineTo(w*0.85,h*0.86);ctx.stroke();
  const sx=(l.shoulder!.x+r.shoulder!.x)/2,sy=(l.shoulder!.y+r.shoulder!.y)/2;
  // Foreshortened torso behind the head/shoulders; not a standing front-view person.
  ctx.fillStyle='#435971';ctx.beginPath();ctx.moveTo(l.shoulder!.x,sy);ctx.lineTo(sx+w*0.07,sy-25*u);ctx.lineTo(sx-w*0.07,sy-25*u);ctx.lineTo(r.shoulder!.x,sy);ctx.closePath();ctx.fill();
  for(const arm of [l,r]){
    for(const [a,b] of [['shoulder','elbow'],['elbow','wrist']] as const){ctx.strokeStyle='#8ea7c3';ctx.lineWidth=(a==='shoulder'?14:12)*u;ctx.beginPath();ctx.moveTo(arm[a]!.x,arm[a]!.y);ctx.lineTo(arm[b]!.x,arm[b]!.y);ctx.stroke();}
    ctx.strokeStyle='#a9c0d8';ctx.lineWidth=9*u;ctx.beginPath();ctx.moveTo(arm.wrist!.x-10*u,arm.wrist!.y);ctx.lineTo(arm.wrist!.x+10*u,arm.wrist!.y);ctx.stroke();
  }
  ctx.strokeStyle='#819ab5';ctx.lineWidth=18*u;ctx.beginPath();ctx.moveTo(l.shoulder!.x,sy);ctx.lineTo(r.shoulder!.x,sy);ctx.stroke();
  ctx.fillStyle='#a5bbd2';ctx.beginPath();ctx.arc(sx,sy-20*u,18*u,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#182d43';ctx.beginPath();ctx.arc(sx-6*u,sy-22*u,2*u,0,Math.PI*2);ctx.arc(sx+6*u,sy-22*u,2*u,0,Math.PI*2);ctx.fill();
  ctx.font=`600 ${Math.round(12*u)}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#c4d6e8';ctx.fillText(depth>0.75?'Lower arm position':'Push back to the upper position',w/2,Math.max(18*u,h*0.09));
  ctx.restore();
}
export {frontArmRig};
