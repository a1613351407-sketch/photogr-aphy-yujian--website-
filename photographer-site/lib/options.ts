export const STYLES = [
 { id: 'fresh', name: '小清新', en: 'The natural you', tags: '自然光 · 清透 · 松弛', description: '在阳光和微风里，留下轻盈、自在的你。', image: '/images/fresh.png' },
 { id: 'bold', name: '个性人像', en: 'Make it your own', tags: '鲜明 · 自我 · 表现力', description: '用大胆的色彩和姿态，表达独一份的自己。', image: '/images/bold.png' },
 { id: 'mood', name: '情绪人像', en: 'A feeling, a frame', tags: '光影 · 氛围 · 故事感', description: '让情绪自然发生，把没说出口的故事留在画面里。', image: '/images/mood.png' },
];
export const OPTIONS = {
 purpose:['个人写真','生日纪念','职业形象','情侣 / 朋友','其他'],
 location:['户外自然','城市街头','室内影棚','居家 / 咖啡馆','一起商量'],
 retouch:['自然真实，保留细节','适度修饰，保留个人特点','更精致的画面效果','听摄影师建议'],
 makeup:['自己准备','希望协助安排','还没确定'],
};
export type Answers={styles:string[];undecided:boolean;customStyle:string;purpose:string;location:string;retouch:string;makeup:string;date:string;budget:string;notes:string;referenceNotes:string;name:string;contact:string;consent:boolean;website:string};
export const emptyAnswers:Answers={styles:[],undecided:false,customStyle:'',purpose:'',location:'',retouch:'',makeup:'',date:'',budget:'',notes:'',referenceNotes:'',name:'',contact:'',consent:false,website:''};
