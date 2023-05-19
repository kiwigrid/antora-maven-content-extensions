const chai = require('chai');
const expect = chai.expect
global.td = require('testdouble')
const tdChai = require('testdouble-chai');
chai.use(tdChai(td));
const chaiFiles = require('chai-files');
chai.use(chaiFiles);
const file = chaiFiles.file;
const finalhandler = require('finalhandler')
const http = require('http')
const serveStatic = require('serve-static')

const {mkdtemp} = require('fs/promises');
const {join} = require('path');
const {tmpdir} = require('os');
const { spawn } = require('child_process')


describe('Maven Content Extension', function () {

    const antoraVersions = [
        ["3.0.1", 'antoracli-301', 'antoragen-301'],
        ["3.0.2", 'antoracli-302', 'antoragen-302'],
        ["3.0.3", 'antoracli-303', 'antoragen-303']
    ];

    let testTmpDir;
    let cacheDir;
    let siteDir;
    let mavenRepo;

    beforeEach("create tmp folder and start maven repo", async function () {
        testTmpDir = await mkdtemp(join(tmpdir(), 'antora-mvn-content-tests-'));
        cacheDir = join(testTmpDir, '.cache');
        siteDir = join(testTmpDir, 'site');
        const serve = serveStatic('test/resources/maven-repo')
        mavenRepo = http.createServer(
            function onRequest(req, res) {
                serve(req, res, finalhandler(req, res))
            })
        // Listen
        await new Promise((resolve, reject) => {
            mavenRepo.on('error', e => reject(e));
            mavenRepo.on('listening', () => resolve());
            mavenRepo.listen(8991)
        })
    })

    afterEach("shutdown repo", async function () {
        await new Promise((resolve, reject) => {
            mavenRepo.close(e => e ? reject(e) : resolve());
        });
    });

    antoraVersions.forEach(([name, antoraModule, generatorModule]) => {
        it(`works with antora ${name}`, async function () {
            this.timeout(10000)

            const antoraProcess = spawn(
                `node_modules/${antoraModule}/bin/antora`,
                 [  '--stacktrace',
                    'generate',
                    `--cache-dir=${cacheDir}`,
                    `--to-dir=${siteDir}`,
                    `--generator=${generatorModule}`,
                    'test/resources/antora-playbook.yaml'
                ]
            );
            await new Promise((resolve, reject) => {
                antoraProcess.on('error', reject);
                antoraProcess.on('exit', (code, signal) => {
                    if (code === 0) {
                        return resolve();
                    }
                    if (signal) {
                        return reject(new Error(`Terminated on ${signal}`))
                    } else {
                        return reject(new Error(`Terminated with exit code ${code}`))
                    }
                });
                antoraProcess.stdout.on('data',  (data) => {
                    console.log(`antora ${name} stdout: ${data}`);
                });
                antoraProcess.stderr.on('data',  (data) => {
                    console.log(`antora ${name} stderr: ${data}`);
                });
            });

            expect(file(join(siteDir, 'index.html'))).to.exist;
            expect(file(join(siteDir, 'test-component', 'index.html'))).to.exist;
            expect(file(join(siteDir, 'test-component', 'index.html')))
                .to.contain('Hello World from the test component.')
                .and.to.contain(`Antora ${name}`)
        })
    })

})
