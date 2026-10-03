import fs from 'node:fs';

const required=[
  'index.html','teacher.html','student.html','teacher-app.html','student-app.html',
  'api.js','teacher-app.js','student-app.js','command-console.js',
  'supabase/functions/tamakkun-api/index.ts',
  'supabase/functions/tamakkun-command/index.ts'
];
const missing=required.filter(p=>!fs.existsSync(p));
if(missing.length)throw new Error('Missing required files: '+missing.join(', '));

const teacher=fs.readFileSync('teacher-app.html','utf8');
for(const marker of ['data-tview="commands"','id="commandForm"','command-console.js']){
  if(!teacher.includes(marker))throw new Error('Teacher operations UI missing marker: '+marker);
}

const studentJs=fs.readFileSync('student-app.js','utf8');
if(!studentJs.includes("lesson_access"))throw new Error('Student lesson access is not enforced server-side.');

const cmd=fs.readFileSync('supabase/functions/tamakkun-command/index.ts','utf8');
for(const marker of ['command_jobs','command_events','student_interventions','idempotency_key','rollback']){
  if(!cmd.includes(marker))throw new Error('Operations backend missing contract marker: '+marker);
}

const forbidden=[
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/,
  /password\s*[:=]\s*['"]\d{6,}['"]/i
];
for(const p of required.filter(x=>fs.existsSync(x))){
  const content=fs.readFileSync(p,'utf8');
  for(const re of forbidden)if(re.test(content))throw new Error('Potential hardcoded secret in '+p);
}

console.log('Static verification passed: '+required.length+' required files checked.');
