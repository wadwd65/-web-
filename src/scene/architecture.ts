import * as THREE from 'three';

/**
 * Editable, original architecture for the FIRST STEP exhibit.
 * All silhouettes are closed 3D meshes: no billboards, image depth or borrowed assets.
 * The renderer owns the sky, ground, lighting and geometry-to-particle choreography.
 */
export type Architecture = {
  group: THREE.Group;
  focus: THREE.Vector3;
  camera: THREE.Vector3;
  label: string;
};

type Palette = ReturnType<typeof palette>;
type Point = (u: number, v: number) => THREE.Vector3;

function palette() {
  return {
    pearl: new THREE.MeshStandardMaterial({color: '#e6edf1', roughness: .29, metalness: .27}),
    satin: new THREE.MeshStandardMaterial({color: '#c0cfdb', roughness: .23, metalness: .82}),
    porcelain: new THREE.MeshStandardMaterial({color: '#f1f4f6', roughness: .42, metalness: .12}),
    cobalt: new THREE.MeshStandardMaterial({color: '#1254b4', roughness: .24, metalness: .68}),
    ink: new THREE.MeshStandardMaterial({color: '#23384d', roughness: .3, metalness: .8}),
    glass: new THREE.MeshPhysicalMaterial({color: '#8bbbd4', roughness: .1, metalness: .07,
      transmission: .58, thickness: .18, ior: 1.46, transparent: true, opacity: .65,
      clearcoat: .65, clearcoatRoughness: .13, side: THREE.DoubleSide}),
    light: new THREE.MeshStandardMaterial({color: '#bde8ff', emissive: '#548ac4', emissiveIntensity: .55,
      roughness: .28, metalness: .25}),
  };
}

function mesh(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, weight = 1) {
  const object = new THREE.Mesh(geometry, material);
  object.castShadow = true;
  object.receiveShadow = true;
  object.userData.dissolve = true;
  object.userData.sampleWeight = weight;
  group.add(object);
  return object;
}

/** A closed smooth architectural ribbon, with genuine top, soffit and edge thickness. */
function slab(surface: Point, segments: number, across: number, thickness: number,
  normal: (u: number, v: number) => THREE.Vector3 = () => new THREE.Vector3(0, 1, 0)) {
  const positions: number[] = [], indices: number[] = [];
  for (let face = 0; face < 2; face++) {
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= across; j++) {
        const u = i / segments, v = j / across;
        const p = surface(u, v).addScaledVector(normal(u, v), -face * thickness);
        positions.push(p.x, p.y, p.z);
      }
    }
  }
  const row = across + 1, count = (segments + 1) * row;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      indices.push(a, c, b, b, c, d, a + count, b + count, c + count, b + count, d + count, c + count);
    }
  }
  function edge(a: number, b: number) { indices.push(a, b, a + count, b, b + count, a + count); }
  for (let i = 0; i < segments; i++) { edge((i + 1) * row, i * row); edge(i * row + across, (i + 1) * row + across); }
  for (let j = 0; j < across; j++) { edge(j, j + 1); edge(segments * row + j + 1, segments * row + j); }
  const origin = surface(.5, .5), du = surface(.501, .5).sub(origin), dv = surface(.5, .501).sub(origin);
  if (du.cross(dv).dot(normal(.5, .5)) < 0) {
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function tube(group: THREE.Group, points: THREE.Vector3[], radius: number, material: THREE.Material, weight = .8) {
  const curve = new THREE.CatmullRomCurve3(points);
  return mesh(group, new THREE.TubeGeometry(curve, Math.max(12, points.length * 3), radius, 7, false), material, weight);
}

function curvedEdge(group: THREE.Group, point: (u: number) => THREE.Vector3, material: THREE.Material, radius = .035) {
  const points = Array.from({length: 65}, (_, i) => point(i / 64));
  return tube(group, points, radius, material, .32);
}

function curvedPillar(group: THREE.Group, bottom: THREE.Vector3, top: THREE.Vector3, material: THREE.Material, radius = .13) {
  return tube(group, [bottom, bottom.clone().lerp(top, .28).add(new THREE.Vector3(.08, 0, 0)),
    bottom.clone().lerp(top, .68), top], radius, material, 1.65);
}

/** A solid U-section arch; extrusion supplies its visible side and back faces. */
function archGeometry(span: number, rise: number, width: number, depth: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-span, 0);
  for (let i = 0; i <= 48; i++) {
    const a = Math.PI - i / 48 * Math.PI;
    shape.lineTo(Math.cos(a) * span, Math.sin(a) * rise);
  }
  shape.lineTo(span - width, 0);
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * Math.PI;
    shape.lineTo(Math.cos(a) * (span - width), Math.sin(a) * (rise - width));
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {depth, steps: 1, bevelEnabled: true,
    bevelSegments: 2, bevelSize: .018, bevelThickness: .018, curveSegments: 12});
  geometry.translate(0, 0, -depth * .5);
  geometry.computeVertexNormals();
  return geometry;
}

type ChamberOptions = {
  width: number; height: number; apertureX: number; apertureY: number;
  radiusX: number; radiusY: number; depth: number; turn: number;
};

function chamber(group: THREE.Group, p: Palette, o: ChamberOptions) {
  // A complete room wall with a real hole, not a ring in front of a backdrop.
  const outline = new THREE.Shape();
  outline.moveTo(-o.width * .5, -.03);
  outline.lineTo(o.width * .5, -.03);
  outline.lineTo(o.width * .5, o.height);
  outline.lineTo(-o.width * .5, o.height);
  outline.closePath();
  const aperture = new THREE.Path();
  aperture.absellipse(o.apertureX, o.apertureY, o.radiusX, o.radiusY, 0, Math.PI * 2, true, 0);
  outline.holes.push(aperture);
  const wallGeometry = new THREE.ExtrudeGeometry(outline, {depth: o.depth, steps: 1,
    bevelEnabled: true, bevelSegments: 3, bevelThickness: .095, bevelSize: .075, curveSegments: 96});
  const position = wallGeometry.getAttribute('position'), normal = wallGeometry.getAttribute('normal');
  const wallColours = new Float32Array(position.count * 3), shadow = new THREE.Color('#71879e');
  for (let n = 0; n < position.count; n++) {
    if (normal.getZ(n) > .6) wallColours.set([1, 1, 1], n * 3);
    else shadow.toArray(wallColours, n * 3);
  }
  wallGeometry.setAttribute('color', new THREE.BufferAttribute(wallColours, 3));
  const wallMaterial = p.pearl.clone(); wallMaterial.vertexColors = true; wallMaterial.metalness = .24;
  mesh(group, wallGeometry, wallMaterial, 1.45).name = 'complete-wall-with-true-sky-aperture';

  // The cylindrical wall of the opening exposes a metre of real depth and the
  // far-side metal reveal. The room wall occludes the rim naturally from outside.
  const innerMaterial = p.ink.clone(); innerMaterial.side = THREE.DoubleSide;
  innerMaterial.color.set('#405b78'); innerMaterial.metalness = .67;
  const revealGeometry = new THREE.CylinderGeometry(1, 1, o.depth + .025, 128, 1, true);
  revealGeometry.rotateX(Math.PI * .5);
  const reveal = mesh(group, revealGeometry, innerMaterial, 1.5);
  reveal.scale.set(o.radiusX - .008, o.radiusY - .008, 1);
  reveal.position.set(o.apertureX, o.apertureY, o.depth * .5);
  reveal.name = 'deep-optical-window-reveal';
  for (const [z, radius, material] of [[o.depth - .035, .009, p.cobalt], [.015, .012, p.satin]] as const) {
    const frame = mesh(group, new THREE.TorusGeometry(1, radius, 8, 128), material, .55);
    frame.scale.set(o.radiusX - .018, o.radiusY - .018, 1);
    frame.position.set(o.apertureX, o.apertureY, z);
    frame.name = 'embedded-optical-reveal';
  }

  // The camera is inside these surfaces. The curved roof and side walls are
  // physical, editable geometry that continues beyond the image boundary.
  const ceiling: Point = (u, v) => new THREE.Vector3((u - .5) * (o.width + .3),
    o.height + Math.sin(u * Math.PI) * .8 + Math.sin(v * Math.PI) * .35, o.depth + v * 17);
  mesh(group, slab(ceiling, 48, 24, .36), p.porcelain, .15).name = 'continuous-room-ceiling';
  for (const side of [-1, 1]) {
    const wall: Point = (u, v) => new THREE.Vector3(side * (o.width * .5 + Math.sin(u * Math.PI) * .5),
      v * o.height, o.depth + u * 17);
    mesh(group, slab(wall, 32, 12, .38, () => new THREE.Vector3(side, 0, 0)), p.porcelain, .12)
      .name = side < 0 ? 'quiet-left-room-wall' : 'foreground-right-room-wall';
  }
  curvedEdge(group, u => new THREE.Vector3((u - .5) * (o.width - .6), o.height - .1, o.depth + .13), p.light, .018);
  // One vertical construction joint provides scale without creating text boxes.
  for (const x of [-7.7, 10.6]) {
    tube(group, [new THREE.Vector3(x, .05, o.depth + .105), new THREE.Vector3(x, o.height - .08, o.depth + .105)],
      .009, p.satin, .025);
  }

  // Three remote gallery ribs beyond the wall are real geometry, providing a
  // second depth plane through the aperture and a visual bridge to the gallery.
  for (const [n, z] of [-13, -22, -32].entries()) {
    const remote = mesh(group, archGeometry(4.7, 7.6, .17, .25), p.satin, .55);
    remote.position.set(-2.3 - n * 2.9, .01, z);
    remote.name = `distant-exterior-gallery-${n + 1}`;
  }
  group.rotation.y = o.turn;
}

type GalleryOptions = {length: number; span: number; rise: number; curve: number; count: number; turn: number; split: boolean};

function gallery(group: THREE.Group, p: Palette, o: GalleryOptions) {
  const spine = (t: number) => new THREE.Vector3(Math.sin(t * Math.PI * 1.25 - .45) * o.curve,
    0, (t - .5) * o.length);
  const radius = (t: number) => o.span * (.85 + Math.sin(t * Math.PI) * .15);
  const height = (t: number) => o.rise + Math.sin(t * Math.PI) * .45;
  for (let i = 0; i < o.count; i++) {
    const t = i / (o.count - 1), pos = spine(t), span = radius(t), rise = height(t);
    const arch = mesh(group, archGeometry(span, rise, .18 + t * .03, .22), i === 0 || i === o.count - 1 ? p.satin : p.pearl, 1.7);
    arch.position.copy(pos);
    const before = spine(Math.max(0, t - .01)), after = spine(Math.min(1, t + .01));
    arch.rotation.y = Math.atan2(after.x - before.x, after.z - before.z);
    arch.name = `continuous-vault-rib-${i + 1}`;
    // A fine cobalt reveal is structurally attached to selected ribs.
    if (i % 4 === 0) {
      const line = mesh(group, archGeometry(span - .23, rise - .23, .035, .055), p.cobalt, .25);
      line.position.copy(pos).add(new THREE.Vector3(0, 0, .14));
      line.rotation.y = arch.rotation.y;
    }
  }

  // The off-centre roof ribbons leave open sky between them and shade the arches below.
  const roofSurface = (side: number): Point => (t, v) => {
    const pos = spine(t), x = (o.split ? side * (.48 + v * 1.14) : -.85 + v * 2.2);
    return new THREE.Vector3(pos.x + x, height(t) - .16 - Math.pow(x / radius(t), 2) * 1.03, pos.z);
  };
  const sides = o.split ? [-1, 1] : [1];
  for (const side of sides) {
    mesh(group, slab(roofSurface(side), 72, 5, .17), p.pearl, 1.25).name = 'sweeping-suspended-roof';
    curvedEdge(group, t => roofSurface(side)(t, side < 0 ? 1 : 0).add(new THREE.Vector3(0, -.18, 0)), p.cobalt, .045);
    curvedEdge(group, t => roofSurface(side)(t, 1).add(new THREE.Vector3(0, -.085, 0)), p.satin, .035);
  }

  // Continuous low parapets and high rails anchor the architecture to a navigable place.
  for (const side of [-1, 1]) {
    const parapet: Point = (t, v) => {
      const pos = spine(t), x = pos.x + side * (radius(t) - .02);
      return new THREE.Vector3(x, .06 + v * .54, pos.z);
    };
    mesh(group, slab(parapet, 64, 1, .09, () => new THREE.Vector3(side, 0, 0)), p.porcelain, .42);
    curvedEdge(group, t => parapet(t, 1).add(new THREE.Vector3(0, .03, 0)), p.satin, .038);
    curvedEdge(group, t => {
      const pos = spine(t); return new THREE.Vector3(pos.x + side * (radius(t) - .39), .024, pos.z);
    }, p.cobalt, .014);
  }

  // A single curved glass wind screen keeps material hierarchy restrained.
  const screen: Point = (t, v) => {
    const pos = spine(.13 + t * .69);
    return new THREE.Vector3(pos.x - radius(.13 + t * .69) + .13, .58 + v * 2.7, pos.z);
  };
  mesh(group, slab(screen, 48, 2, .022, () => new THREE.Vector3(-1, 0, 0)), p.glass, .4).name = 'gallery-wind-screen';
  group.rotation.y = o.turn;
}

const labels = ['光学阅览室', '弧光回廊', '纵光阅览室', '连续拱廊', '天际阅览室', '双脊长廊', '远光阅览室', '远光入口'];

/** One deterministic geometry set per module. Scene index is never a texture lookup. */
export function createArchitecture(index: number): Architecture {
  const normalized = ((index % 8) + 8) % 8;
  const group = new THREE.Group();
  group.name = `first-step-real-architecture-${normalized}`;
  const p = palette();
  if (normalized % 2 === 0) {
    const variants: ChamberOptions[] = [
      {width: 24, height: 11.4, apertureX: 2.4, apertureY: 5.2, radiusX: 4.25, radiusY: 4.05, depth: 1.35, turn: 0},
      {width: 23, height: 12, apertureX: 1.9, apertureY: 5.65, radiusX: 3.7, radiusY: 4.6, depth: 1.55, turn: -.1},
      {width: 25, height: 10.9, apertureX: 2.8, apertureY: 5.1, radiusX: 5.05, radiusY: 3.7, depth: 1.2, turn: .08},
      {width: 24, height: 11.7, apertureX: 2.3, apertureY: 5.45, radiusX: 4.2, radiusY: 4.2, depth: 1.65, turn: .14},
    ];
    chamber(group, p, variants[normalized / 2]);
  } else {
    const variants: GalleryOptions[] = [
      {length: 15, span: 3.7, rise: 5.7, curve: 1.55, count: 9, turn: -.36, split: true},
      {length: 14, span: 3.35, rise: 6.6, curve: 2.1, count: 8, turn: .45, split: false},
      {length: 16.3, span: 4.1, rise: 5.25, curve: 1.05, count: 10, turn: -.68, split: true},
      {length: 13, span: 3.8, rise: 6.05, curve: 2.7, count: 7, turn: .08, split: false},
    ];
    gallery(group, p, variants[(normalized - 1) / 2]);
    const o = variants[(normalized - 1) / 2];
    group.userData.axialCamera = new THREE.Vector3(Math.sin(Math.PI * 1.25 - .45) * o.curve, 2.6, o.length * .5 + 7)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), o.turn);
    group.userData.axialFocus = new THREE.Vector3(Math.sin(.2 * Math.PI * 1.25 - .45) * o.curve, 2.7, -o.length * .3)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), o.turn);
  }

  group.updateMatrixWorld(true);
  let meshCount = 0, triangleCount = 0;
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    meshCount++;
    triangleCount += object.geometry.index ? object.geometry.index.count / 3 : object.geometry.getAttribute('position').count / 3;
  });
  group.userData.geometryStats = {meshCount, triangleCount, originalProceduralGeometry: true};
  const cameras = [
    [8, 4.5, 18], [3.9, 2.3, 8.8], [7.5, 4.8, 18.8], [4.8, 2.55, 7.8],
    [8.5, 4.5, 19], [4.4, 2.35, 8.8], [8, 4.8, 18.6], [3.7, 2.45, 8.1],
  ];
  const focuses = [
    [0, 4.4, 0], [-1, 3.4, -5], [0, 4.7, 0], [-.8, 3.5, -5],
    [0, 4.4, 0], [-.5, 3.1, -5.1], [0, 4.7, 0], [-.4, 3.4, -5],
  ];
  return {group, focus: (group.userData.axialFocus as THREE.Vector3 | undefined) ?? new THREE.Vector3(...focuses[normalized] as [number, number, number]),
    camera: (group.userData.axialCamera as THREE.Vector3 | undefined) ?? new THREE.Vector3(...cameras[normalized] as [number, number, number]), label: labels[normalized]};
}
