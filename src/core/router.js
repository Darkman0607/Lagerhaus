export const routes = {
 dashboard:{label:'Dashboard',icon:'dashboard', eyebrow:'Übersicht'},
 warehouse:{label:'Lager',icon:'warehouse', eyebrow:'Lagerorte'},
 articles:{label:'Artikel',icon:'box', eyebrow:'Artikelstamm'},
 shopping:{label:'Einkauf',icon:'shopping', eyebrow:'Nachkauf'},
 more:{label:'Mehr',icon:'more', eyebrow:'Verwaltung'},
};
export function routeFromHash(){const key=location.hash.replace(/^#\/?/,'').split('/')[0];return Object.hasOwn(routes,key)?key:'dashboard';}
export function navigate(name){if(!Object.hasOwn(routes,name))return; if(location.hash==='#/'+name){window.dispatchEvent(new Event('hashchange'));}else{location.hash='#/'+name;}}
