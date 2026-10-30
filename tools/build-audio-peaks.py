"""Rebuild the small, real-audio waveform overviews. No browser-side whole-song decoding."""
from pathlib import Path
import argparse, array, hashlib, json, math, subprocess, sys
parser=argparse.ArgumentParser();parser.add_argument('--ffmpeg',required=True);args=parser.parse_args()
root=Path(__file__).resolve().parents[1];catalog=json.loads((root/'public/audio/catalog.json').read_text(encoding='utf-8'));dest=root/'public/audio/peaks';dest.mkdir(exist_ok=True)
for track in catalog:
    file=root/'public'/track['file'].lstrip('/')
    decoded=subprocess.run([args.ffmpeg,'-v','error','-i',str(file),'-ac','1','-ar','8000','-f','f32le','pipe:1'],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE).stdout
    samples=array.array('f');samples.frombytes(decoded)
    if sys.byteorder!='little':samples.byteswap()
    count=384;values=[]
    for index in range(count):
        segment=samples[len(samples)*index//count:len(samples)*(index+1)//count]
        values.append(math.sqrt(sum(n*n for n in segment)/max(1,len(segment))))
    maximum=max(values) or 1
    peaks=[round((n/maximum)**.7,4) for n in values]
    result={'version':1,'cid':track['cid'],'audioSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'duration':len(samples)/8000,'sampleRate':8000,'method':'normalized RMS in equal time windows; power 0.7 for display','peaks':peaks}
    (dest/(track['cid']+'.json')).write_text(json.dumps(result,separators=(',',':'))+'\n',encoding='utf-8')
    print(track['cid'],len(peaks),'audio-derived waveform bins')
