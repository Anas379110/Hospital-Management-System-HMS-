import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const require=createRequire(import.meta.url);
const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
const backend=root+'/backend';
const {PrismaClient}=require(backend+'/node_modules/@prisma/client');
const password=randomBytes(24).toString('hex');
const url=process.env.HMS_BROWSER_DATABASE_URL;
if(!url||!new URL(url).pathname.includes('hms_test'))throw new Error('Set HMS_BROWSER_DATABASE_URL to an isolated disposable hms_test database');
const artifacts=process.env.HMS_BROWSER_ARTIFACTS??root+'/frontend/browser-artifacts';mkdirSync(artifacts,{recursive:true});
let prisma,app,browser,frontend;
let currentPage;
let viteOutput='';const results={scope:'real browser to Vite proxy to actual Nest AppModule/Prisma/PostgreSQL, isolated fictional data',checks:[]};
try{
 process.env.DATABASE_URL=url;
 process.env.JWT_SECRET=randomBytes(32).toString('hex');
 const migration=spawnSync('node',['node_modules/prisma/build/index.js','migrate','deploy'],{cwd:backend,env:process.env,encoding:'utf8'});if(migration.status!==0)throw new Error('migration failed');
 prisma=new PrismaClient();await prisma.$queryRawUnsafe('SELECT hms_cleanup_expired_workspaces()');await prisma.$executeRawUnsafe("INSERT INTO demo_workspaces(id) VALUES('browser-test')");const hash=await require(backend+'/node_modules/bcrypt').hash(password,4);
 await prisma.user.create({data:{username:'fictional_reception',passwordHash:hash,fullName:'Fictional Reception',role:'receptionist'}});
 const nurse=await prisma.user.create({data:{username:'fictional_pharmacist',passwordHash:hash,fullName:'Fictional Doctor',role:'pharmacist'}});
 const department=await prisma.department.create({data:{nameAr:'قسم تجريبي',nameEn:'Fictional Department',totalBeds:1}});
 const bed=await prisma.bed.create({data:{departmentId:department.id,bedNumber:'DEMO-01'}});
 const patient=await prisma.patient.create({data:{mrn:'DEMO-0001',fullName:'Fictional Browser Patient',dateOfBirth:new Date('2000-01-01'),gender:'male',phone:'0000000000',createdBy:nurse.id}});
 app=await require(backend+'/dist/src/app.factory.js').createApplication({logger:false});await app.listen(0,'127.0.0.1');const api=await app.getUrl();
 frontend=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5194','--strictPort'],{cwd:root+'/frontend',env:{...process.env,VITE_API_URL:api},stdio:'pipe'});
 frontend.stdout.on('data',data=>{viteOutput+=data.toString()});frontend.stderr.on('data',data=>{viteOutput+=data.toString()});
 let ready=false;
 for(let attempt=0;attempt<100;attempt++){
  if(frontend.exitCode!==null)throw new Error('Vite exited before readiness; see vite-output.log');
  try{const response=await fetch('http://127.0.0.1:5194/login');if(response.ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!ready)throw new Error('Vite readiness timeout; see vite-output.log');
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.HMS_BROWSER_EXECUTABLE?{executablePath:process.env.HMS_BROWSER_EXECUTABLE}:{})});

 const inventory=await prisma.medication.create({data:{name:'Fictional Inventory',unit:'test',currentStock:10}});
 for(const lang of ['en','ar']){
  const page=currentPage=await browser.newPage({viewport:{width:lang==='ar'?390:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5194/login');await page.evaluate(lang=>localStorage.setItem('hms_locale',lang),lang);await page.reload();
  await page.getByRole('textbox',{name:lang==='ar'?'اسم المستخدم':'Username',exact:true}).fill('fictional_pharmacist');await page.locator('input[type=password]').fill(password);
  await page.getByRole('button',{name:lang==='ar'?'تسجيل الدخول':'Log In',exact:true}).click();await page.waitForURL('**/pharmacy');
  await page.getByRole('combobox',{name:lang==='ar'?'الدواء من المخزون':'Inventory medication',exact:true}).click();
  await page.getByRole('option',{name:new RegExp('Fictional Inventory')}).click();
  await page.getByRole('spinbutton',{name:lang==='ar'?'التغير في الكمية، عدد صحيح بإشارة':'Quantity change, signed integer',exact:true}).fill('5');
  await page.getByLabel(lang==='ar'?'فئة السبب':'Reason category',{exact:true}).click();
  await page.getByRole('option',{name:lang==='ar'?'إعادة تعبئة':'Restock',exact:true}).click();
  await page.getByRole('button',{name:lang==='ar'?'تطبيق التعديل':'Apply adjustment',exact:true}).click();
  await page.getByText(lang==='ar'?'حُدث المخزون.':'Stock updated.',{exact:true}).waitFor();
  await page.waitForTimeout(300);await page.screenshot({path:`${artifacts}/stock-success-${lang}.png`,fullPage:true});
  if(errors.length||await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('stock browser runtime/overflow');
  results.checks.push({lang,stockAdjusted:true,reasonCategorySelected:true,overflow:false,runtimeErrors:0});await page.close();
 }
 results.finalStock=(await prisma.medication.findUniqueOrThrow({where:{id:inventory.id}})).currentStock;
 if(results.finalStock!==20)throw new Error('stock browser change mismatch');
 results.assertionsPassed=true;console.log(JSON.stringify(results,null,2));
}catch(e){if(currentPage)await currentPage.screenshot({path:artifacts+'/unexpected-failure.png',fullPage:true}).catch(()=>{});results.error=String(e?.stack??e).replaceAll(password,'[REDACTED]');console.error(results.error);process.exitCode=1}
finally{writeFileSync(artifacts+'/vite-output.log',viteOutput.replaceAll(password,'[REDACTED]'));writeFileSync(artifacts+'/stock-results.json',JSON.stringify(results,null,2));if(browser)await browser.close();if(frontend)frontend.kill();if(app)await app.close();if(prisma)await prisma.$disconnect()}
