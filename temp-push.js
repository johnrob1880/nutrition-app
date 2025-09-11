import { spawn } from 'child_process';

const push = spawn('npx', ['drizzle-kit', 'push'], {
  stdio: ['pipe', 'inherit', 'inherit']
});

// Send empty input to select default (first) option
push.stdin.write('\n');
push.stdin.end();

push.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
  process.exit(code);
});