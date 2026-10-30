import * as T from 'three';

/** Radial optical response: the narrow chromatic sectors move with the viewing
 * direction. This is a designed CD surface, not a full diffraction simulation. */
export function cdMaterial(){
 const m=new T.MeshPhysicalMaterial({color:'#d9e4eb',metalness:.96,roughness:.19,clearcoat:1,clearcoatRoughness:.10,iridescence:.45,iridescenceIOR:1.32,iridescenceThicknessRange:[180,450],side:T.DoubleSide});
 m.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCdPoint;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCdPoint = position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCdPoint;').replace('#include <opaque_fragment>',`
   float cdAngle = atan(vCdPoint.y, vCdPoint.x);
   vec3 cdEye = normalize(vViewPosition);
   float cdView = atan(cdEye.x, max(.01,cdEye.z));
   float cdR = length(vCdPoint.xy);
   float cdSector = pow(abs(sin(cdAngle - .62 + cdView * 1.7)), 18.0);
   float cdPhase = cdAngle * .31 + cdR * .14 + cdView * .80;
   vec3 cdSpectrum = .5 + .5 * cos(6.2831853 * (cdPhase + vec3(.0,.333,.667)));
   float cdGroove = .98 + .02 * sin(cdR * 2200.0);
   outgoingLight = outgoingLight * cdGroove + cdSpectrum * cdSector * .62;
   #include <opaque_fragment>`);
 };
 m.customProgramCacheKey=()=> 'first-step-optical-disc-v1';return m;
}
