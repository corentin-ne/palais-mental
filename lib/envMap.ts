import { BackSide, Mesh, PMREMGenerator, Scene, ShaderMaterial, SphereGeometry, Texture, Vector3, WebGLRenderer } from 'three';
import { SUN_VISUAL_DIR } from './palaceLayout';

/**
 * A tiny procedural studio used only to bake image-based lighting (PMREM) once at
 * startup: warm floor bounce, a bright cream sky and a hot window-shaped glint in
 * front. Gives lacquer, glossy cases and vinyl their soft reflections at zero
 * per-frame cost.
 */
export function bakePalaceEnvironment(gl: WebGLRenderer): Texture | null {
  try {
    const scene = new Scene();
    const mat = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: { uSun: { value: new Vector3(...SUN_VISUAL_DIR) } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          vec3 floorCol = vec3(0.78, 0.62, 0.48);
          vec3 wallCol = vec3(0.95, 0.88, 0.80);
          vec3 topCol = vec3(1.05, 1.0, 0.96);
          vec3 col = mix(floorCol, wallCol, smoothstep(-0.35, 0.05, d.y));
          col = mix(col, topCol, smoothstep(0.2, 0.9, d.y));
          // Window: an arched bright panel straight ahead (-z), plus the sun inside it.
          float front = smoothstep(0.82, 0.9, -d.z) * smoothstep(-0.05, 0.05, d.y) * smoothstep(0.62, 0.45, d.y);
          col += vec3(2.6, 2.4, 2.1) * front;
          col += vec3(6.0, 5.2, 4.2) * pow(max(dot(d, uSun), 0.0), 400.0);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const geo = new SphereGeometry(10, 48, 24);
    scene.add(new Mesh(geo, mat));
    const pmrem = new PMREMGenerator(gl);
    const target = pmrem.fromScene(scene, 0.02);
    pmrem.dispose();
    geo.dispose();
    mat.dispose();
    return target.texture;
  } catch {
    return null; // lighting still works without IBL, just flatter
  }
}
