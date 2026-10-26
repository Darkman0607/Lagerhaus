import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cameraProject,sceneStatus,layoutScene,warehouse3DPanel,sceneAction,getSceneCamera,turnAngle,clamp} from '../src/views/warehouse-3d.js';
const id1='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222';
const places=[
 {id:id1,name:'Regal & A',path:'Garage / Regal & A',kind:'regal',articleCount:2,items:[{name:'Schrauben',quantity:10,unit:'Stück',lowStock:false},{name:'Kabel',quantity:1,unit:'Stück',lowStock:true}]},
 {id:id2,name:'Schrank <B>',path:'Werkstatt / Schrank <B>',kind:'box',articleCount:0,items:[{name:'Leer',quantity:0,unit:'Stück',lowStock:true}]}
];
assert.deepEqual(sceneStatus(places[0]),{count:2,missing:0,low:1,warnings:1,level:'low'});
assert.deepEqual(sceneStatus(places[1]),{count:0,missing:1,low:0,warnings:1,level:'missing'});
assert.equal(sceneStatus({items:[],articleCount:0}).level,'ok');
assert.equal(turnAngle(-30),330);assert.equal(turnAngle(390),30);assert.equal(clamp(100,0,8),8);
const first=cameraProject(3,1,2,{angle:0,zoom:1,panX:0,panY:0});assert.ok(Number.isFinite(first.x)&&Number.isFinite(first.y));
const rotated=cameraProject(3,1,2,{angle:90,zoom:1,panX:0,panY:0});assert.notEqual(first.x,rotated.x);
assert.equal(layoutScene(places).slots.length,2);
assert.equal(layoutScene(Array.from({length:35},(_,i)=>({...places[0],id:String(i),path:`Lager ${i}`}))).omitted,7);
const html=warehouse3DPanel(places);
assert.match(html,/data-u09-select="11111111/);assert.match(html,/2 Artikel/);assert.ok(html.includes('<b>2</b> Warnungen'));assert.match(html,/Schrank &lt;B&gt;/);assert.doesNotMatch(html,/Schrank <B>/);
for(const label of ['3D-Ansicht','2D-Plan','Liste'])assert.ok(html.includes(label));
assert.equal(sceneAction('select',{id:id1}),true);assert.equal(getSceneCamera().selected,id1);
assert.equal(sceneAction('select',{id:'unknown'}),false);
const changed=warehouse3DPanel(places);assert.match(changed,/Garage \/ Regal &amp; A/);
sceneAction('right');assert.equal(getSceneCamera().angle,355);
for(let i=0;i<12;i++)sceneAction('right');assert.equal(getSceneCamera().angle,355);
sceneAction('pan-left');assert.equal(getSceneCamera().panX,-40);sceneAction('pan-right');assert.equal(getSceneCamera().panX,0);
for(let i=0;i<30;i++)sceneAction('zoom-in');assert.equal(getSceneCamera().zoom,1.8);
for(let i=0;i<30;i++)sceneAction('zoom-out');assert.equal(getSceneCamera().zoom,.58);
sceneAction('reset');assert.equal(getSceneCamera().angle,325);assert.equal(getSceneCamera().zoom,1);
assert.equal(sceneAction('mode',{mode:'2d'}),true);assert.match(warehouse3DPanel(places),/u09-plan-tile/);
assert.equal(sceneAction('mode',{mode:'list'}),true);assert.match(warehouse3DPanel(places),/u09-list-row/);
assert.equal(sceneAction('mode',{mode:'notallowed'}),false);assert.equal(getSceneCamera().mode,'list');
assert.equal(sceneAction('mode',{mode:'3d'}),true);assert.match(warehouse3DPanel([]),/keine Demodaten/);
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');assert.match(sw,/warehouse-3d\.js/);assert.match(sw,/v1\.1\.0-beta\.1/);
console.log('PASS U09: actual inventory, SVG scene, escaping, rotation/zoom/reset, click selection, 2D/list, empty data, cache');
