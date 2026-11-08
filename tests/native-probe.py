"""Run the SES native fixture in a new headless Zen profile only.

Uses the already-reviewed local standard-library Marionette adapter from the
Define Word test suite. No normal profile, browser session, or credentials used.
"""
import argparse, hashlib, importlib.util, json, os, socket, subprocess, time, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
spec = importlib.util.spec_from_file_location('wire', WORKSPACE/'Zen-Mods/define-word/tests/native/popup_probe.py')
wire = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wire)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--launch',action='store_true')
    parser.add_argument('--software-rendering',action='store_true',help='Disable hardware rendering in the disposable profile')
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args()
    if not args.launch: parser.error('Requires --launch for an authorized isolated test.')
    if args.output.exists(): parser.error('Refusing to overwrite an existing report.')
    port=2843
    with socket.socket() as guard:
        if guard.connect_ex(('127.0.0.1',port))==0: parser.error('Test port occupied; refusing to attach.')
    run=WORKSPACE/'.backup-scratch/ses-130-native'/('run-'+uuid.uuid4().hex)
    profile=run/'profile';profile.mkdir(parents=True)
    prefs={'marionette.port':port,'browser.shell.checkDefaultBrowser':False,'browser.startup.page':0,'browser.startup.homepage':'about:blank','browser.startup.homepage_override.mstone':'ignore','browser.aboutwelcome.enabled':False,'datareporting.policy.dataSubmissionEnabled':False,'toolkit.telemetry.enabled':False}
    if args.software_rendering: prefs.update({'gfx.webrender.software':True,'layers.acceleration.disabled':True,'gfx.webrender.all':False})
    (profile/'user.js').write_text('\n'.join(f'user_pref({json.dumps(k)}, {json.dumps(v)});' for k,v in prefs.items()),encoding='utf8')
    files=['src/presets.js','src/icons.js','src/engines.js','src/manager.js','style.css','search-engine-select-runtime.uc.js']
    report={'scope':'isolated headless Gecko, synthetic settings mount; not everyday Sine acceptance','profile':str(profile),'sourceHashes':{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files}}
    process=client=None;status=1
    try:
        with (run/'browser.log').open('wb') as log:
            startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=subprocess.SW_HIDE
            process=subprocess.Popen([str(wire.ZEN),'--headless','--no-remote','--profile',str(profile),'--marionette','--remote-allow-system-access','about:blank'],stdout=log,stderr=subprocess.STDOUT,env=dict(os.environ,MOZ_HEADLESS='1',MOZ_HEADLESS_WIDTH='1280',MOZ_HEADLESS_HEIGHT='1000'),startupinfo=startup,creationflags=subprocess.CREATE_NO_WINDOW)
            until=time.monotonic()+40
            while time.monotonic()<until:
                if process.poll() is not None: raise RuntimeError(f'Isolated Zen exited during startup: {process.returncode}')
                try:
                    sock=socket.create_connection(('127.0.0.1',port),timeout=1);sock.settimeout(55);client=wire.Marionette(sock);break
                except (ConnectionRefusedError,TimeoutError):time.sleep(.2)
            if client is None: raise TimeoutError('Isolated Zen did not become ready')
            report['session']=client.command('WebDriver:NewSession',{'capabilities':{'alwaysMatch':{}}})
            client.command('Marionette:SetContext',{'value':'chrome'})
            client.command('WebDriver:SetTimeouts',{'script':45000})
            sources='\n'.join((ROOT/f).read_text(encoding='utf8') for f in files[:4])
            fixture=(ROOT/'tests/native-settings.js').read_text(encoding='utf8')
            result=client.command('WebDriver:ExecuteAsyncScript',{'script':fixture,'args':[str(profile),sources,(ROOT/'style.css').as_uri()], 'newSandbox':True,'sandbox':'system'})
            report['probe']=result.get('value',result)
            status=0 if report['probe'].get('ok') and all(report['probe']['checks'].values()) else 1
    except Exception as error: report['error']=str(error)
    finally:
        if client:
            try: client.command('Marionette:Quit',{'flags':['eForceQuit']})
            except Exception: pass
            client.sock.close()
        if process:
            try: process.wait(timeout=10)
            except subprocess.TimeoutExpired: process.terminate();process.wait(timeout=10)
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8')
    print(json.dumps({'status':status,'report':str(args.output)}));return status

if __name__=='__main__':raise SystemExit(main())
