# Third-party notices

The interface bundles a character subset of Noto Sans SC from the official Google Fonts repository (https://github.com/google/fonts/tree/main/ofl/notosanssc). It is licensed under the SIL Open Font License 1.1; the full notice is included in `public/fonts/OFL-NotoSansSC.txt` and the built `dist/fonts/` directory. The subset is locally hosted, retains variable weights, and is used under the CSS family name First Step Sans. No font file from the four visual reference projects is included.

Business scenes use independent dossier geometry and shaders. The music scene reuses the attributed MIT archive model and, since v0.25, five attributed non-character Arknights environment images at the user's request. No Active Theory runtime or character cutouts are bundled. The dated sections below describe their corresponding versions.

The optional music player includes five locally compressed MP3 recordings downloaded from the official public MSR sources at the user's request on 2026-10-29. Normal playback uses these local files; the same-origin resolver is only an online fallback, restricted to the five catalogued official CIDs. It does not proxy audio. Recordings and related rights remain with their respective owners; this notice does not assert a commercial redistribution license. Track provenance, sizes and SHA-256 checksums are in public/audio/catalog.json. Tracks: Rhine Lab.LLC (https://monster-siren.hypergryph.com/music/779491); A World Above (https://monster-siren.hypergryph.com/music/232265); Ad astra (https://monster-siren.hypergryph.com/music/125074); Control's Wishes (https://monster-siren.hypergryph.com/music/880337); The Coming of the Future (https://monster-siren.hypergryph.com/music/461158).

Three.js 0.183.0 is used for real-time interface rendering. Its MIT license follows.

The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.


The optional v0.20 player studies the information hierarchy, numbered lists and persistent playback controls of MikeQu223/Rhine-Music-Database (https://github.com/MikeQu223/Rhine-Music-Database), alongside the previously documented terminal references. No Qt source, screenshots, cover art or models from that repository are bundled. The React interface, live waveform display and waveform-processing tool are independently implemented. The overview packets are derived from the already credited local audio recordings and do not change their ownership.


## v0.24 原始档案模型 / MIT

本版经用户明确同意，复用原始档案模型。上游作者：LBEILC / RhineLabUI (Copyright 2026 LBEILC)。取得路径：MikeQu223/Rhine-Music-Database 的 Assets/models/archive-cassette.glb，固定提交15139d4b3562edcf3d9b24b50ca502bd42f784d7。文件SHA256：dda42b9b3b471d11c69820a64084d254a64b27761287ab0e35dd8387ec0a0bed。

完整MIT许可证：public/credits/RhineLabUI-MIT.txt。来源/哈希：public/credits/model-source.json；网页鸣谢：public/credits/models.html。模型几何保留，运行时改为冷银蓝色材质；唱片几何、盘面、曲目贴签、背景、UI与动画独立设计。未复制参考界面、源代码、封面或CG。历史“未复用模型”表述仅适用于v0.23及更早版本，不能描述当前版本。

《明日方舟》、莱茵生命相关名称与标志的权利仍归原权利方；此处MIT声明不代替第三方内容授权。本作品不声明这些名称/标志为原创。

## v0.25 non-character scene artwork

Five Arknights environment images are included in public/artwork at the user's explicit request for this local theme demonstration: Rhine corridor, blue sky, ascent over Trimounts, glowing energy well and ecology laboratory. Original images are unchanged PNGs; circular framing, mild cool overlays and typography are applied at runtime. PRTS source pages, exact filenames, dimensions and SHA-256 records are in public/credits/artwork-source.json. The ascent image was checked against the PRTS source index in reverieach/rhine-lab-art; that project's UI, shaders and runtime are not copied.

Arknights imagery and associated rights remain with Hypergryph and the respective rights holders. Non-commercial use or minor visual modification does not itself establish a redistribution licence; no such licence is asserted here. These images are not included under the archive model's MIT licence, are not original First Step artwork, and are not the music tracks' official covers. Particle/light effects, layout, optical disc material and interactions are independently implemented.
