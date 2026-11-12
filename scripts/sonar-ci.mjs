import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

// This runner owns an isolated evaluation server; it never accesses an existing SonarQube account.
const container = 'shine-sonar-' + (process.env.GITHUB_RUN_ID ?? process.pid);
const output = 'sonar-results';
const serverImage = 'sonarqube:community';
const scannerImage = 'sonarsource/sonar-scanner-cli:latest';
let base = '';
let auth = '';
function docker(args, { capture = false, env = process.env } = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      'Docker command failed: ' + args[0] + ' (exit ' + result.status + ').',
    );
  return result.stdout?.trim() ?? '';
}
async function api(path, body) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: 'Basic ' + auth,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: body ? new URLSearchParams(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      'SonarQube API ' +
        path.split('?')[0] +
        ' returned ' +
        response.status +
        '.',
    );
  if (response.status === 204) return null;
  return response.headers.get('content-type')?.includes('application/json')
    ? response.json()
    : response.text();
}
async function main() {
  await mkdir(output, { recursive: true });
  try {
    docker(
      [
        'run',
        '-d',
        '--name',
        container,
        '-p',
        '127.0.0.1::9000',
        '-e',
        'SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true',
        serverImage,
      ],
      { capture: true },
    );
    const port = docker(['port', container, '9000/tcp'], { capture: true })
      .split(':')
      .at(-1);
    if (!/^\d+$/.test(port ?? ''))
      throw new Error('Unable to identify the isolated SonarQube port.');
    base = 'http://127.0.0.1:' + port;
    console.log('Waiting for the isolated SonarQube server.');
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      try {
        const response = await fetch(base + '/api/system/status', {
          signal: AbortSignal.timeout(5000),
        });
        const status = await response.json();
        if (status.status === 'UP') {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    if (!ready) throw new Error('The evaluation server did not become ready.');
    auth = Buffer.from('admin:admin').toString('base64');
    const password = 'Shine!' + randomBytes(24).toString('hex');
    await api('/api/users/change_password', {
      login: 'admin',
      previousPassword: 'admin',
      password,
    });
    auth = Buffer.from('admin:' + password).toString('base64');
    await api('/api/projects/create', {
      project: 'shine-notes',
      name: 'Shine Notes',
      visibility: 'private',
    });
    const credential = await api('/api/user_tokens/generate', {
      name: 'isolated-ci-scan',
    });
    console.log(
      'Analyzing the assignment with the default Sonar way quality profiles.',
    );
    const scannerArgs = ['run', '--rm', '--network', 'host'];
    if (process.getuid)
      scannerArgs.push('--user', process.getuid() + ':' + process.getgid());
    scannerArgs.push(
      '-e',
      'SONAR_HOST_URL',
      '-e',
      'SONAR_TOKEN',
      '-e',
      'SONAR_USER_HOME=/tmp/sonar',
      '-v',
      process.cwd() + ':/usr/src',
      scannerImage,
      '-Dsonar.working.directory=/usr/src/.scannerwork',
    );
    const scan = spawnSync('docker', scannerArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        SONAR_HOST_URL: base,
        SONAR_TOKEN: credential.token,
      },
    });
    if (scan.error) throw scan.error;
    async function report(name, path) {
      const data = await api(path);
      await writeFile(
        output + '/' + name + '.json',
        JSON.stringify(data, null, 2) + '\n',
      );
      return data;
    }
    const gate = await report(
      'gate',
      '/api/qualitygates/project_status?projectKey=shine-notes',
    );
    const issues = await report(
      'issues',
      '/api/issues/search?componentKeys=shine-notes&resolved=false&ps=500',
    );
    const hotspots = await report(
      'hotspots',
      '/api/hotspots/search?project=shine-notes',
    );
    const measures = await report(
      'measures',
      '/api/measures/component?component=shine-notes&metricKeys=coverage,line_coverage,branch_coverage,duplicated_lines_density,ncloc',
    );
    await report('server', '/api/server/version');
    const summary = {
      qualityGate: gate.projectStatus.status,
      scannerExitCode: scan.status,
      issueCount: issues.total,
      hotspotCount: hotspots.paging?.total ?? hotspots.hotspots?.length ?? 0,
      measures: measures.component.measures,
    };
    await writeFile(
      output + '/summary.json',
      JSON.stringify(summary, null, 2) + '\n',
    );
    console.log(JSON.stringify(summary, null, 2));
    if (scan.status !== 0 || gate.projectStatus.status !== 'OK')
      process.exitCode = 1;
  } finally {
    docker(['rm', '-f', container], { capture: true });
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
