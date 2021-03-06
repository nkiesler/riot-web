const { exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const shellescape = require('shell-escape');

exports.default = async function(options) {
    const inPath = options.path;
    const appOutDir = path.dirname(inPath);

    // get the token passphrase from the keychain
    let tokenPassphrase;
    try {
        tokenPassphrase = await new Promise((resolve, reject) => {
            execFile(
                'security',
                ['find-generic-password', '-s', 'riot_signing_token', '-w'],
                {},
                (err, stdout) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(stdout.trim());
                    }
                },
            );
        });
    } catch (err) {
        console.warn(
            "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n" +
            "! Skipping Windows signing.            !\n" +
            "! Signing token not found in keychain. !\n" +
            "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
        );
        return;
    }

    return new Promise((resolve, reject) => {
        let cmdLine = 'osslsigncode sign ';
        if (process.env.OSSLSIGNCODE_SIGNARGS) {
            cmdLine += process.env.OSSLSIGNCODE_SIGNARGS + ' ';
        }
        const tmpFile = path.join(
            appOutDir,
            'tmp_' + Math.random().toString(36).substring(2, 15) + '.exe',
        );
        const args = [
            '-h', options.hash,
            '-pass', tokenPassphrase,
            '-in', inPath,
            '-out', tmpFile,
        ];
        if (options.isNest) args.push('-nest');
        cmdLine += shellescape(args);

        let signStdout;
        const signproc = exec(cmdLine, {}, (error, stdout) => {
            signStdout = stdout;
        });
        signproc.on('exit', (code) => {
            if (code !== 0) {
                console.log("Running", cmdLine);
                console.log(signStdout);
                console.error("osslsigncode failed with code " + code);
                reject("osslsigncode failed with code " + code);
                return;
            }
            fs.rename(tmpFile, inPath, (err) => {
                if (err) {
                    console.error("Error renaming file", err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    });
};
