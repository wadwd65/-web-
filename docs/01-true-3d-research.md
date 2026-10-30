# 真三维、转点与场景转换：工具调研

核验日期：2026-10-28。本轮只检索官方/作者一手资料，核对当前代码与工具入口。没有安装或运行这些新工具，没有实现原型，不保证具体帧率或成品审美。

## 当前偏差

`src/ExhibitScene.tsx`使用图像贴图平面和按图像亮度构造的浅深度点集。鼠标和粒子确实在动，但它没有建筑的真实几何、侧面、背面与空间遮挡；八模块也未各自驱动真实场景转换。用户明确否定这条背景实现路线。不要继续调这张图、增加图片点数或做深度图来声称需求完成。

## 建议保留的主工具链

**Blender制作真实可编辑场景 → GLB/glTF → 已有Three.js r183/WebGLRenderer → MeshSurfaceSampler采样真实几何 → Points/ShaderMaterial控制粒子 → 单一时间轴同步实体、相机与界面。**

这是基于已核验API作出的实现建议，不代表用户已认可某一建筑造型。工具不会自动解决构图、空间和动效节奏，仍需设计和实机自检。

### 1. Blender：场景与资产

[Blender官方管线](https://www.blender.org/features/pipeline/)支持GLB/glTF等三维格式；适合保留可编辑工程、制作有厚度与遮挡的场景。导出后逐项检查网格、法线、材质和相机，不假定任意材质节点或后期都会无损迁移。

[Blender Lab MCP](https://www.blender.org/lab/mcp-server/)是官方单独的集成项目，页面要求Blender 5.1及以上、插件与独立服务。[社区MCP for Blender](https://github.com/ahujasid/mcp-for-blender)是另一项目，不得混称官方。这些连接用于让AI操作Blender，不等于自动生成高质量网站。

本轮插件目录搜索没有找到相关Blender连接，返回的无关服务未建议安装；当前会话没有可调用的Blender工具。PATH与常见安装目录的初步查询不足以断言本机完全没有Blender。下轮先检查实际安装与接入情况，不能声称已经装好、连上或完成建模。

### 2. Three.js：从真实Mesh表面采点

[MeshSurfaceSampler官方文档](https://threejs.org/docs/pages/MeshSurfaceSampler.html)和[r183源码](https://raw.githubusercontent.com/mrdoob/three.js/r183/examples/jsm/math/MeshSurfaceSampler.js)可直接对照现有版本。它提供网格表面的XYZ等采样，**不会自动应用物体世界矩阵**。

整体场景需要遍历参与效果的Mesh，更新世界矩阵，将几何烘焙到统一粒子根坐标：

`inverse(particleRoot.matrixWorld) × mesh.matrixWorld`

按变换后的表面积和视觉权重分配采样。避免大量点落到地板、细节不足。每个场景固定总点数N，不要求各模型顶点数相同；固定随机种子并作空间排序，减少不必要的穿飞。非均匀缩放要在面积计算前处理。

静态场景先验证。InstancedMesh需要逐实例矩阵；SkinnedMesh/形变网格需要烘焙姿态，不可默认普通采样已经处理。

### 3. GPU粒子与转场

[Points](https://threejs.org/docs/pages/Points.html)、[ShaderMaterial](https://threejs.org/docs/pages/ShaderMaterial.html)足以先实现两组真实三维点集的散开/重组；不必先引入复杂流体模拟。需要持续速度与惯性时，再用[GPUComputationRenderer](https://threejs.org/docs/pages/GPUComputationRenderer.html)的状态纹理。

[Codrops：Crafting a Dreamy Particle Effect](https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/)明确从Mesh采样并用GPGPU计算，可学习几何粒子和鼠标力场。其外部面具模型另有来源，不能将教程代码许可扩大成所有资产自由使用。

实体消解与粒子显现要共享空间阈值，使粒子确实从原场景表面脱离；不能只是模型淡出、同时凭空出现另一团点。A/B点集保留对应关系，以同一批粒子连续迁移。

### 4. 统一镜头与场景节奏

[GSAP Timeline](https://gsap.com/docs/v3/GSAP/Timeline/)可把相机、实体溶解、粒子重组、文字进出放到同一条时间轴；[GSAP官方许可](https://gsap.com/standard-license/)需随实际采用版本核对。不要把它误标成MIT。

[Theatre.js官方介绍](https://www.theatrejs.com/docs/latest/getting-started)可作为需要可视化镜头编辑时的备选，本轮没有安装，不与GSAP同时堆入原型。

[Aether 1作者技术案例](https://tympanus.net/codrops/2025/08/06/building-aether-1-sound-without-boundaries/)结合真实场景、相机路径、粒子与后期转场，适合研究完整演出。它展示的两个渲染结果合成仍不等于几何转点，需要上述粒子链路。作者文章也不代表整站代码/素材获准复用。

## 其他工具结论

- [Spline GLTF/GLB导出](https://docs.spline.design/exporting-your-scene/files/exporting-as-gtlf-glb)：能导出几何，基础颜色/贴图和变换动画有限支持；灯光环境、后期、状态事件等不随GLB导出。付费导出限制见[官方套餐](https://spline.design/pricing)。可辅助搭形，不作为完整转点转场的一键替代。
- [PlayCanvas引擎](https://github.com/playcanvas/engine)与[自托管说明](https://developer.playcanvas.com/user-manual/editor/publishing/web/self-hosting/)提供可行的真三维路线，但现有Three.js已具备基础能力，迁移引擎并不直接改善设计。
- [WebGPURenderer迁移说明](https://threejs.org/manual/pages/webgpurenderer)：现有ShaderMaterial/后期不能原样迁移，涉及TSL/node改写。先基于r183/WebGL验证核心效果，不为技术名词扩大本轮范围。
- [RenderTransitionPass](https://threejs.org/docs/pages/RenderTransitionPass.html)负责渲染结果间混合，不能单独作为“模型转点/重组已实现”的证据。

## 连续操作与性能边界

首次采用单一转场控制器：正在转场时只保留最后一个目标，完成当前阶段后处理，不并行启动八条动画。异步加载带版本令牌，过期结果不得覆盖新选择。若支持中途转向，必须从当前粒子和相机状态继续；停止timeline不会自动保存或恢复状态。

点数、阴影、玻璃透射、后期与画布分辨率需共同实测。官方demo的粒子数量不是本机性能承诺。本轮未运行GPU原型或测帧时间，不能写“稳定60帧”。

## 可直接查看的一手示例

- [Three.js表面散布采样](https://threejs.org/examples/webgl_instancing_scatter.html)
- [自定义粒子属性](https://threejs.org/examples/webgl_buffergeometry_custom_attributes_particles.html)
- [WebGPU compute粒子](https://threejs.org/examples/webgpu_compute_particles.html)

这些分别验证采样或粒子技术，不代表已经包含本项目的完整艺术设计与八场景。
