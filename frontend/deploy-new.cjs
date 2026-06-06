const { spawn } = require('child_process');

const email = `tariff-tracker-${Math.floor(Math.random() * 1000000)}@mailinator.com`;
const password = "ExecutiveTariff2026!";
const domain = `tariff-tracker-tabs-preserved.surge.sh`;

console.log(`🚀 Starting automated deployment to Surge (New Link)...`);
console.log(`📧 Temporary credentials:`);
console.log(`   Email:    ${email}`);
console.log(`   Password: ${password}`);
console.log(`🌐 Target Domain: http://${domain}\n`);

const child = spawn('npx', ['surge', 'dist', '--domain', domain], {
  stdio: ['pipe', 'pipe', 'inherit'],
  shell: true
});

child.stdout.on('data', (data) => {
  const str = data.toString();
  process.stdout.write(data);

  if (str.toLowerCase().includes('email:')) {
    child.stdin.write(email + '\n');
  } else if (str.toLowerCase().includes('password:')) {
    child.stdin.write(password + '\n');
  } else if (str.toLowerCase().includes('project:')) {
    child.stdin.write('\n');
  } else if (str.toLowerCase().includes('domain:')) {
    child.stdin.write('\n');
  }
});

child.on('close', (code) => {
  console.log(`\n🎉 Surge deployment finished with exit code ${code}`);
  if (code === 0) {
    console.log(`\n✨ SUCCESS! YOUR NEW TARIFF TRACKER DEPLOYMENT IS LIVE AT:`);
    console.log(`   👉 http://${domain} 👈`);
  }
});
