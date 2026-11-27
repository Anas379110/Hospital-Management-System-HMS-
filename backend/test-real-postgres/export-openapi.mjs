// Reproducible contract snapshot from compiled controllers, guards and validators.
// Run from backend after npm run build. This never connects to a database.
import {createRequire} from 'node:module';
import {readdirSync,writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);require('reflect-metadata');
const backend=fileURLToPath(new URL('../',import.meta.url));
const {getMetadataStorage}=require('class-validator');
const {defaultMetadataStorage}=require('class-transformer/cjs/storage');
const storage=getMetadataStorage(),schemas={},operations=[];
const verbs={0:'get',1:'post',2:'put',3:'delete',4:'patch',5:'all',6:'options',7:'head'};
function schemaFor(D){if(schemas[D.name])return{$ref:'#/components/schemas/'+D.name};const out={type:'object',additionalProperties:false,properties:{},required:[]};schemas[D.name]=out;
 const groups={};for(const m of storage.getTargetValidationMetadatas(D,'',false,false))(groups[m.propertyName]??=[]).push(m);
 for(const [name,metas] of Object.entries(groups)){const p={},type=Reflect.getMetadata('design:type',D.prototype,name);if(type===String)p.type='string';if(type===Number)p.type='number';if(type===Boolean)p.type='boolean';if(type===Array)p.type='array';
 const optional=metas.some(m=>m.name==='isOptional'||m.type==='conditionalValidation');if(!optional)out.required.push(name);else p.nullable=true;
 for(const m of metas){const c=m.constraints??[];switch(m.name){case'isString':p.type='string';break;case'isBoolean':p.type='boolean';break;case'isInt':p.type='integer';break;case'isUuid':p.type='string';p.format='uuid';break;case'isDateString':p.type='string';p.description='ISO8601 validated date/date-time; see route notes for stricter range rules';break;case'isEnum':p.type='string';p.enum=c[1];break;case'isIn':p.enum=c[0];break;case'minLength':p.minLength=c[0];break;case'maxLength':p.maxLength=c[0];break;case'min':p.minimum=Math.max(p.minimum??-Infinity,c[0]);break;case'max':p.maximum=Math.min(p.maximum??Infinity,c[0]);break;case'arrayMinSize':p.minItems=c[0];break;case'arrayMaxSize':p.maxItems=c[0];break;case'isByteLength':p['x-byte-length']={min:c[0],max:c[1]};break;case'notEquals':p.not={enum:[c[0]]};break;case'matches':p.pattern=c[0].source;break;}}
 if(type===Array){const nested=defaultMetadataStorage.findTypeMetadata(D,name)?.typeFunction?.();assert.ok(nested,'Unknown nested array '+D.name+'.'+name);p.items=schemaFor(nested)}
 out.properties[name]=p;}
 if(!out.required.length)delete out.required;return{$ref:'#/components/schemas/'+D.name};}
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(dir+'/'+d.name):[dir+'/'+d.name])}
for(const file of walk(backend+'dist/src/modules').filter(x=>x.endsWith('.controller.js'))){for(const C of Object.values(require(file))){if(typeof C!=='function'||!Reflect.getMetadata('__controller__',C))continue;const prefix=Reflect.getMetadata('path',C)||'';
 for(const name of Object.getOwnPropertyNames(C.prototype)){const fn=C.prototype[name];if(typeof fn!=='function'||Reflect.getMetadata('method',fn)===undefined)continue;const method=verbs[Reflect.getMetadata('method',fn)];assert.ok(method&&method!=='all');const suffix=Reflect.getMetadata('path',fn)||'';const path=('/'+prefix+'/'+suffix).replace(/\/+/g,'/').replace(/\/$/,'').replace(/:([a-zA-Z_]+)/g,'{$1}');
 const guards=[...(Reflect.getMetadata('__guards__',C)??[]),...(Reflect.getMetadata('__guards__',fn)??[])].map(g=>g.name);const roles=Reflect.getMetadata('roles',fn)??Reflect.getMetadata('roles',C)??[];
 const op={operationId:C.name+'_'+name,tags:[prefix||C.name.replace('Controller','').toLowerCase()],summary:C.name+'.'+name,'x-controller':file.split('/dist/src/')[1].replace('.js','.ts'),'x-roles':roles,'x-guards':guards,security:guards.includes('JwtAuthGuard')?[{bearerAuth:[]}]:[],parameters:[],responses:{[Reflect.getMetadata('__httpCode__',fn)??(method==='post'?201:200)]:{description:'Successful JSON response. Result shape is service-defined; no unverified response schema is asserted.'},'400':{description:'Invalid request'},'429':{description:'Rate limit exceeded'}}};if(guards.includes('JwtAuthGuard'))op.responses['401']={description:'Missing/expired token, inactive current user, or invalid/expired workspace'};if(guards.includes('RolesGuard'))op.responses['403']={description:'Current persisted role is not permitted'};
 const args=Reflect.getMetadata('__routeArguments__',C,name)??{},types=Reflect.getMetadata('design:paramtypes',C.prototype,name)??[];
 for(const [key,arg] of Object.entries(args)){const kind=Number(key.split(':')[0]),D=types[arg.index];if(kind===3){assert.ok(D?.name&&D!==Object,'Unknown body type');op.requestBody={required:true,content:{'application/json':{schema:schemaFor(D)}}};}else if(kind===5)op.parameters.push({name:arg.data,in:'path',required:true,schema:{type:'string'}});else if(kind===4){if(arg.data)op.parameters.push({name:arg.data,in:'query',required:false,schema:{type:'string'}});else{schemaFor(D);const s=schemas[D.name];for(const [key,p] of Object.entries(s.properties))op.parameters.push({name:key,in:'query',required:s.required?.includes(key)??false,schema:p});}}}
 if(!op.parameters.length)delete op.parameters;operations.push({path,method,op});
 }}}
const paths={};for(const {path,method,op} of operations.sort((a,b)=>(a.path+a.method).localeCompare(b.path+b.method))){assert.ok(!paths[path]?.[method],'Duplicate route');(paths[path]??={})[method]=op;}
// Middleware health is not a controller. The public-only route is explicit here.
paths['/health']={get:{operationId:'publicDemoLiveness',summary:'DB-independent liveness, only mounted with HMS_PUBLIC_DEMO=true',security:[],responses:{'200':{description:'Process is live, not database/readiness proof'}}}};
const doc={openapi:'3.0.3',info:{title:'HMS fictional demo API',version:'0.2.0',description:'Generated controller/DTO/role contract. Body validation and authorization metadata come from compiled source. Service rules, result shapes and deployment details are documented in API.md; no exhaustive response contract is claimed. All data must be fictional.'},servers:[{url:'/api/v1',description:'Same-origin versioned API'}],paths,components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT'}},schemas}};
// JSON is a YAML1.2-compatible representation. Keep the established .yaml path.
const text=JSON.stringify(doc,null,2)+'\n';const destination=backend+'../docs/api/openapi.yaml';if(process.argv.includes('--check'))assert.equal(readFileSync(destination,'utf8'),text,'OpenAPI drift: regenerate after build');else writeFileSync(destination,text);
const inventory=operations.map(x=>({method:x.method.toUpperCase(),path:x.path,controller:x.op['x-controller'],roles:x.op['x-roles'],guards:x.op['x-guards']}));
const inventoryText=JSON.stringify(inventory,null,2)+'\n';if(process.argv.includes('--check'))assert.equal(readFileSync(backend+'../docs/api/ROUTE-INVENTORY.json','utf8'),inventoryText,'Route inventory drift');else writeFileSync(backend+'../docs/api/ROUTE-INVENTORY.json',inventoryText);
console.log(JSON.stringify({paths:Object.keys(paths).length,controllerOperations:operations.length,schemas:Object.keys(schemas).length,mode:process.argv.includes('--check')?'checked':'written'}));
