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
 prisma=new PrismaClient();const hash=await require(backend+'/node_modules/bcrypt').hash(password,4);
 await prisma.user.create({data:{username:'fictional_reception',passwordHash:hash,fullName:'Fictional Reception',role:'receptionist'}});
 const nurse=await prisma.user.create({data:{username:'fictional_fixture_doctor',passwordHash:hash,fullName:'Fictional Doctor',role:'doctor'}});
 const department=await prisma.department.create({data:{nameAr:'قسم تجريبي',nameEn:'Fictional Department',totalBeds:1}});
 const bed=await prisma.bed.create({data:{departmentId:department.id,bedNumber:'DEMO-01'}});
 const patient=await prisma.patient.create({data:{mrn:'DEMO-0001',fullName:'Fictional Browser Patient',dateOfBirth:new Date('2000-01-01'),gender:'male',phone:'0000000000',createdBy:nurse.id}});
 app=await require(backend+'/dist/src/app.factory.js').createApplication({logger:false});await app.listen(0,'127.0.0.1');const api=await app.getUrl();
 frontend=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5196','--strictPort'],{cwd:root+'/frontend',env:{...process.env,VITE_API_URL:api},stdio:'pipe'});
 frontend.stdout.on('data',data=>{viteOutput+=data.toString()});frontend.stderr.on('data',data=>{viteOutput+=data.toString()});
 let ready=false;
 for(let attempt=0;attempt<100;attempt++){
  if(frontend.exitCode!==null)throw new Error('Vite exited before readiness; see vite-output.log');
  try{const response=await fetch('http://127.0.0.1:5196/login');if(response.ok){ready=true;break}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!ready)throw new Error('Vite readiness timeout; see vite-output.log');
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.HMS_BROWSER_EXECUTABLE?{executablePath:process.env.HMS_BROWSER_EXECUTABLE}:{})});

 await prisma.user.create({data:{username:'fictional_billing',passwordHash:hash,fullName:'Fictional Billing',role:'billing_clerk'}});
 await prisma.user.create({data:{username:'fictional_manager',passwordHash:hash,fullName:'Fictional Manager',role:'manager'}});
 await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION hms_test_browser_audit_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$`);
 for(const lang of ['en','ar']){
  const page=currentPage=await browser.newPage({timezoneId:'Europe/Istanbul',viewport:{width:lang==='ar'?390:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const login=async username=>{await page.goto('http://127.0.0.1:5196/login');await page.evaluate(lang=>{localStorage.clear();localStorage.setItem('hms_locale',lang)},lang);await page.reload();await page.getByRole('textbox',{name:lang==='ar'?'اسم المستخدم':'Username',exact:true}).fill(username);await page.locator('input[type=password]').fill(password);await page.getByRole('button',{name:lang==='ar'?'تسجيل الدخول':'Log In',exact:true}).click();await page.waitForURL(username==='fictional_billing'?'**/billing':'**/patients');if(username!=='fictional_billing')await page.goto('http://127.0.0.1:5196/billing')};
  await login('fictional_billing');
  const billingStorage=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  await page.getByRole('textbox',{name:lang==='ar'?'معرّف المريض':'Patient ID',exact:true}).fill(patient.id);
  await page.getByRole('textbox',{name:lang==='ar'?'الوصف':'Description',exact:true}).fill('Fictional service');
  const price=page.getByRole('spinbutton',{name:lang==='ar'?'سعر الوحدة، ليرة صحيحة':'Unit price (integer SYP)',exact:true});
  await price.fill('1e3');if(!await page.getByRole('button',{name:lang==='ar'?'إنشاء الفاتورة':'Create invoice',exact:true}).isDisabled())throw new Error('scientific price enabled');await price.fill('100');
  const before={invoices:await prisma.invoice.count(),audits:await prisma.auditLog.count()};
  await prisma.$executeRawUnsafe('CREATE TRIGGER hms_test_browser_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_browser_audit_reject()');
  const create=()=>page.getByRole('button',{name:lang==='ar'?'إنشاء الفاتورة':'Create invoice',exact:true});
  const failure=()=>page.getByText(lang==='ar'?'لم تُنفذ العملية لتعذر حفظ سجلها. يمكنك إعادة المحاولة.':'Operation was not performed because its audit record could not be saved. You can retry.',{exact:true});
  await create().click();await failure().waitFor();if(await prisma.invoice.count()!==before.invoices||await prisma.auditLog.count()!==before.audits)throw new Error('invoice failure changed state');
  await page.waitForTimeout(300);await page.screenshot({path:artifacts+'/billing-create-failure-'+lang+'.png',fullPage:true});
  await prisma.$executeRawUnsafe('DROP TRIGGER hms_test_browser_audit_failure ON audit_logs');await create().click();await page.getByText(lang==='ar'?'أُنشئت فاتورة وهمية. لم يُخصم أي مبلغ حقيقي.':'Fictional invoice created. No money was charged.',{exact:true}).waitFor();
  const invoice=await prisma.invoice.findFirstOrThrow({orderBy:{createdAt:'desc'}});if(await prisma.invoice.count()!==before.invoices+1||await prisma.auditLog.count()!==before.audits+1)throw new Error('invoice retry audit mismatch');
  const amount=page.getByRole('spinbutton',{name:lang==='ar'?'المبلغ، ليرة صحيحة':'Amount (integer SYP)',exact:true});await amount.fill('1e1');if(!await page.getByRole('button',{name:lang==='ar'?'تسجيل الدفعة':'Record payment',exact:true}).isDisabled())throw new Error('scientific payment enabled');await amount.fill('101');if(!await page.getByRole('button',{name:lang==='ar'?'تسجيل الدفعة':'Record payment',exact:true}).isDisabled())throw new Error('overpayment enabled');await amount.fill('40');const paymentAudits=await prisma.auditLog.count();
  await prisma.$executeRawUnsafe('CREATE TRIGGER hms_test_browser_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_browser_audit_reject()');
  const pay=()=>page.getByRole('button',{name:lang==='ar'?'تسجيل الدفعة':'Record payment',exact:true});await pay().click();await failure().waitFor();if(await prisma.payment.count({where:{invoiceId:invoice.id}})!==0||await prisma.auditLog.count()!==paymentAudits)throw new Error('payment failure changed state');
  await page.waitForTimeout(300);await page.screenshot({path:artifacts+'/billing-payment-failure-'+lang+'.png',fullPage:true});await prisma.$executeRawUnsafe('DROP TRIGGER hms_test_browser_audit_failure ON audit_logs');await pay().click();await page.getByText(lang==='ar'?'سُجلت الدفعة الوهمية وحُدث الرصيد.':'Fictional payment recorded. Balance updated.',{exact:true}).waitFor();
  await page.getByTestId('billing-paid').filter({hasText:lang==='ar'?'٤٠':'40'}).waitFor();await page.getByTestId('billing-remaining').filter({hasText:lang==='ar'?'٦٠':'60'}).waitFor();await page.getByText(lang==='ar'?/مدفوعة جزئياً/:/Partially paid/).waitFor();
  if((await prisma.payment.aggregate({where:{invoiceId:invoice.id},_sum:{amount:true}}))._sum.amount!==40||await prisma.auditLog.count()!==paymentAudits+1)throw new Error('payment retry mismatch');
  await page.screenshot({path:artifacts+'/billing-payment-success-'+lang+'.png',fullPage:true});
  await login('fictional_manager');if(await page.getByRole('button',{name:lang==='ar'?'إنشاء الفاتورة':'Create invoice',exact:true}).count())throw new Error('manager create visible');
  await page.getByRole('textbox',{name:lang==='ar'?'فتح فاتورة بمعرّفها':'Open invoice by ID',exact:true}).fill(invoice.id);await page.getByRole('button',{name:lang==='ar'?'فتح':'Open',exact:true}).click();await page.getByTestId('billing-remaining').filter({hasText:lang==='ar'?'٦٠':'60'}).waitFor();if(await pay().count()||await page.getByRole('region',{name:lang==='ar'?'إضافة بند لهذه الفاتورة':'Add item to this invoice',exact:true}).count())throw new Error('manager write visible');
  await page.screenshot({path:artifacts+'/billing-manager-read-'+lang+'.png',fullPage:true});
  await page.evaluate(storage=>{localStorage.clear();for(const [key,value] of Object.entries(storage))localStorage.setItem(key,value)},billingStorage);
  await page.goto('http://127.0.0.1:5196/billing');
  const openInvoice=async id=>{await page.getByRole('textbox',{name:lang==='ar'?'فتح فاتورة بمعرّفها':'Open invoice by ID',exact:true}).fill(id);await page.getByRole('button',{name:lang==='ar'?'فتح':'Open',exact:true}).click()};
  await openInvoice(invoice.id);await page.getByTestId('billing-remaining').filter({hasText:lang==='ar'?'٦٠':'60'}).waitFor();
  const addSection=page.getByRole('region',{name:lang==='ar'?'إضافة بند لهذه الفاتورة':'Add item to this invoice',exact:true});
  await addSection.getByRole('textbox',{name:lang==='ar'?'الوصف':'Description',exact:true}).fill('Fictional added service');
  await addSection.getByRole('spinbutton',{name:lang==='ar'?'سعر الوحدة، ليرة صحيحة':'Unit price (integer SYP)',exact:true}).fill('25');
  await addSection.getByRole('spinbutton',{name:lang==='ar'?'الكمية':'Quantity',exact:true}).fill('0');if(!await addSection.getByRole('button',{name:lang==='ar'?'إضافة بند لهذه الفاتورة':'Add item to this invoice',exact:true}).isDisabled())throw new Error('zero add quantity enabled');await addSection.getByRole('spinbutton',{name:lang==='ar'?'الكمية':'Quantity',exact:true}).fill('1');
  const itemBefore=await prisma.invoiceItem.count({where:{invoiceId:invoice.id}}),itemAudits=await prisma.auditLog.count();
  await prisma.$executeRawUnsafe('CREATE TRIGGER hms_test_browser_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION hms_test_browser_audit_reject()');
  const add=()=>addSection.getByRole('button',{name:lang==='ar'?'إضافة بند لهذه الفاتورة':'Add item to this invoice',exact:true});await add().click();await failure().waitFor();
  if(await prisma.invoiceItem.count({where:{invoiceId:invoice.id}})!==itemBefore||await prisma.auditLog.count()!==itemAudits)throw new Error('item failure mutated state');
  await prisma.$executeRawUnsafe('DROP TRIGGER hms_test_browser_audit_failure ON audit_logs');await add().click();
  await page.getByText(lang==='ar'?'أُضيف بند الفاتورة وحُدث الرصيد.':'Invoice item added. Balance updated.',{exact:true}).waitFor();await page.getByTestId('billing-remaining').filter({hasText:lang==='ar'?'٨٥':'85'}).waitFor();
  await page.getByRole('region',{name:lang==='ar'?'بنود الفاتورة':'Invoice items',exact:true}).getByText(/Fictional added service/).waitFor();
  if(await prisma.invoiceItem.count({where:{invoiceId:invoice.id}})!==itemBefore+1||await prisma.auditLog.count()!==itemAudits+1)throw new Error('item retry mismatch');
  await page.screenshot({path:artifacts+'/billing-item-success-'+lang+'.png',fullPage:true});
  await page.getByRole('spinbutton',{name:lang==='ar'?'المبلغ، ليرة صحيحة':'Amount (integer SYP)',exact:true}).fill('85');await pay().click();
  await page.getByTestId('billing-remaining').filter({hasText:lang==='ar'?/^المتبقي: ٠ ل.س$/:/^Remaining: 0 SYP$/}).waitFor();await page.getByText(lang==='ar'?/فاتورة #.+ مدفوعة$/:/Invoice #.+ Paid$/).waitFor();
  if(await pay().count()||await addSection.count())throw new Error('paid invoice has write controls');
  const history=page.getByRole('region',{name:lang==='ar'?'الدفعات الوهمية المسجلة':'Recorded fictional payments',exact:true});
  for(const text of (lang==='ar'?['٤٠ ل.س نقداً','٨٥ ل.س نقداً']:['40 SYP Cash','85 SYP Cash']))await history.getByText(text,{exact:true}).waitFor();
  const denyMutation=async (id,path,body)=>{
   const counts={items:await prisma.invoiceItem.count(),payments:await prisma.payment.count(),audits:await prisma.auditLog.count()};
   const response=await page.evaluate(async ({id,path,body})=>{const result=await fetch('/api/v1/invoices/'+id+'/'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('hms_token')},body:JSON.stringify(body)});return {status:result.status,body:await result.json()}},{id,path,body});
   if(response.status!==409||await prisma.invoiceItem.count()!==counts.items||await prisma.payment.count()!==counts.payments||await prisma.auditLog.count()!==counts.audits)throw new Error('locked invoice HTTP mutation allowed');
  };
  await denyMutation(invoice.id,'items',{description:'Blocked extra',quantity:1,unitPrice:1});await denyMutation(invoice.id,'payments',{amount:1,method:'cash'});
  await page.screenshot({path:artifacts+'/billing-paid-'+lang+'.png',fullPage:true});
  const cancelled=await prisma.invoice.create({data:{patientId:patient.id,createdBy:nurse.id,status:'cancelled',items:{create:{description:'Fictional cancelled service',quantity:1,unitPrice:10}}}});
  await openInvoice(cancelled.id);await page.getByRole('region',{name:lang==='ar'?'بنود الفاتورة':'Invoice items',exact:true}).getByText(/Fictional cancelled service/).waitFor();
  if(await pay().count()||await addSection.count())throw new Error('cancelled invoice has write controls');
  await denyMutation(cancelled.id,'items',{description:'Blocked cancelled extra',quantity:1,unitPrice:1});await denyMutation(cancelled.id,'payments',{amount:1,method:'cash'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(errors.length||overflow)throw new Error('billing runtime/overflow');results.checks.push({lang,invoiceRollbackRetry:true,paymentRollbackRetry:true,managerReadOnly:true,managerContentVerified:true,itemAuditRollbackRetry:true,itemDetailVisible:true,historyExactAmountsMethods:true,paidCancelledHttp409NoMutation:true,paidCancelledNoWriteControls:true,visiblePaymentBalanceStatusUpdated:true,scientificPricePaymentBlocked:true,runtimeErrors:errors.length,overflow});await page.close();
 }
 results.assertionsPassed=true;console.log(JSON.stringify(results,null,2));
}catch(e){if(currentPage)await currentPage.screenshot({path:artifacts+'/unexpected-failure.png',fullPage:true}).catch(()=>{});results.error=String(e?.stack??e).replaceAll(password,'[REDACTED]');console.error(results.error);process.exitCode=1}
finally{writeFileSync(artifacts+'/billing-vite-output.log',viteOutput.replaceAll(password,'[REDACTED]'));writeFileSync(artifacts+'/billing-results.json',JSON.stringify(results,null,2));if(browser)await browser.close();if(frontend)frontend.kill();if(app)await app.close();if(prisma)await prisma.$disconnect()}
