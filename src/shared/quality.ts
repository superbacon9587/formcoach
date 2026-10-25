export type DepthGrade = 'met' | 'near' | 'partial' | 'uncertain';
export type RepFeedback = { score:number|null; depth:DepthGrade; suggestions:string[] };
