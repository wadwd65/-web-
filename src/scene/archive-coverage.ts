import type {Material,IUniform,WebGLProgramParametersWithUniforms,WebGLRenderer} from 'three';

const coverage=new WeakMap<Material,IUniform<number>>();
/** Fade a complete case with one stable screen-space mask. Applying ordinary
 * transparency to every solid layer exposes the discs behind their cases.
 * All layers use the same pixel decision and retain their original depth writes. */
export function withArchiveCoverage(material:Material){
 if(coverage.has(material))return material;
 const uniform={value:1},compile=material.onBeforeCompile,key=material.customProgramCacheKey();coverage.set(material,uniform);
 material.onBeforeCompile=function(shader:WebGLProgramParametersWithUniforms,renderer:WebGLRenderer){
  compile.call(this,shader,renderer);shader.uniforms.uArchiveCoverage=uniform;
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uArchiveCoverage;').replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
   if(uArchiveCoverage < .9999){
    float archivePixel = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
    if(archivePixel >= uArchiveCoverage)discard;
   }`);
 };
 material.customProgramCacheKey=()=>key+':archive-screen-coverage-v1';return material;
}
export function setArchiveCoverage(material:Material,value:number){
 const uniform=coverage.get(material);if(uniform)uniform.value=Number.isFinite(value)?Math.min(1,Math.max(0,value)):0;
}
export function getArchiveCoverage(material:Material){return coverage.get(material)?.value??1;}
