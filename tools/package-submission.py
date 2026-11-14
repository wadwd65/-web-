"""Create a clean source ZIP and Windows portable ZIP; never includes local secrets.

Run after tests/build and memory/log checks. Output must be a new directory.
"""
from pathlib import Path
import argparse, hashlib, json, shutil, tempfile, zipfile, urllib.request

ROOT = Path(__file__).resolve().parent.parent

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b''): h.update(data)
    return h.hexdigest()

def copy_tree(src, dest):
    shutil.copytree(src, dest, ignore=shutil.ignore_patterns('*.tsbuildinfo', '__pycache__'))

def archive(folder, target):
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as out:
        for path in sorted(folder.rglob('*')):
            if path.is_file(): out.write(path, Path(folder.name) / path.relative_to(folder))
    with zipfile.ZipFile(target) as check:
        if check.testzip(): raise RuntimeError('ZIP CRC mismatch')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--node-dir', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists(): raise RuntimeError('Choose a new output directory; old deliverables are protected.')
    version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    node = args.node_dir / 'node.exe'
    sums_url = 'https://nodejs.org/dist/v24.21.0/SHASUMS256.txt'
    sums = urllib.request.urlopen(sums_url, timeout=30).read().decode()
    expected = next(line.split()[0] for line in sums.splitlines() if line.endswith('win-x64/node.exe'))
    if digest(node) != expected: raise RuntimeError('Node executable differs from official SHA256.')
    if not (ROOT / 'dist/index.html').is_file(): raise RuntimeError('Run npm run build first.')
    output.mkdir(parents=True)
    # Temporary staging is outside the workspace/shared node_modules junction.
    with tempfile.TemporaryDirectory(prefix='first-step-delivery-') as temporary:
        source = Path(temporary) / ('初程-v' + version + '-源码')
        source.mkdir()
        for name in ['src', 'tools', 'tests', 'public', 'docs', '.github']:
            copy_tree(ROOT / name, source / name)
        for name in ['package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','.gitignore','.env.example','README.md','AGENTS.md','CONTRIBUTING.md','SECURITY.md','THIRD_PARTY_NOTICES.md']:
            shutil.copy2(ROOT / name, source / name)
        archive(source, output / '02-完整源码.zip')
        portable = Path(temporary) / ('初程-v' + version + '-Windows离线即用')
        portable.mkdir()
        for name in ['dist','src','tools']:
            copy_tree(ROOT / name, portable / name)
        (portable / 'public/audio').mkdir(parents=True)
        shutil.copy2(ROOT / 'public/audio/catalog.json', portable / 'public/audio/catalog.json')
        for name in ['package.json','.env.example','THIRD_PARTY_NOTICES.md']:
            shutil.copy2(ROOT / name, portable / name)
        runtime = portable / 'runtime'; runtime.mkdir()
        shutil.copy2(node, runtime / 'node.exe')
        shutil.copy2(args.node_dir / 'LICENSE', runtime / 'NODE-LICENSE.txt')
        # CMD contains only ASCII; Chinese paths are handled by quoted paths and Node.
        (portable / '开始使用.cmd').write_bytes(b'@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\nif not exist "runtime\\node.exe" (echo Extract the entire ZIP first. & pause & exit /b 1)\r\n"runtime\\node.exe" --experimental-strip-types "tools\\launch-local.mjs"\r\nif errorlevel 1 pause\r\n')
        help_text = f'''初程 v{version} / Windows x64 即用包

1. 先全部解压 ZIP，不要在压缩软件窗口中运行。
2. 双击“开始使用.cmd”，校验完成会打开浏览器；保持命令窗口开启。
3. 不需要管理员权限、npm安装或另装Node。关闭服务用命令窗口Ctrl+C。

本包没有任何API密钥、账号数据或真实材料。
联网AI：右上角“API设置”填写自己的官方DeepSeek密钥与模型；或由维护者按.env.example在工程外配置比赛接口。
本地工具、模型、音乐、PDF提取资源已包含，断网可使用本地能力；AI与实时政策发现需要网络及接口。不要声称AI离线运行。
账号/用量默认保存到用户目录.config/first-step/private-data，未随作品提交。
只监听127.0.0.1，在5380–5399中选空闲端口；腾讯云部署需源码README中的HTTPS反向代理配置，本包不会自动部署。
若文件校验失败，请重新全部解压原ZIP，不要只复制启动文件。运行中的文件不要覆盖；更新使用新文件夹。
Windows x64可用；Linux/macOS请用源码包和Node>=24.21.0构建运行。

模型、字体、图片与音频的作者/许可分别见THIRD_PARTY_NOTICES.md及dist/credits。第三方素材不因非商用或修改而自动获得授权。
'''
        (portable / '先读我.txt').write_text(help_text, encoding='utf-8-sig')
        files = [{'path':p.relative_to(portable).as_posix(),'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted(portable.rglob('*')) if p.is_file()]
        (portable / 'runtime-manifest.json').write_text(json.dumps({'version':version,'files':files,'nodeOfficial':{'url':sums_url,'sha256':expected},'containsCredentials':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        archive(portable, output / '03-Windows离线即用包.zip')
    receipts = [{'path':p.name,'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted(output.iterdir()) if p.is_file()]
    (output / '工程包校验.json').write_text(json.dumps({'version':version,'files':receipts,'scope':'Source + Windows portable; documents/video are tracked separately.','containsCredentials':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(str(output))

if __name__ == '__main__': main()
