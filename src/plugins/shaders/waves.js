/**
 * PS3-style "wave" background: a ray-marched ribbon over a four-corner
 * gradient plus drifting dust. Colors are driven by uniforms so themes can be
 * swapped at runtime.
 */

export const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  precision mediump float;

  uniform vec2 iResolution;
  uniform float iTime;
  uniform vec3 uBottomLeft;
  uniform vec3 uBottomRight;
  uniform vec3 uTopLeft;
  uniform vec3 uTopRight;

  varying vec2 vUv;

  #define THRESHOLD .99
  #define DUST
  #define MIN_DIST .13
  #define MAX_DIST 40.
  #define MAX_DRAWS 40

  float hash12(vec2 p) {
    uvec2 q = uvec2(ivec2(p)) * uvec2(1597334673U, 3812015801U);
    uint n = (q.x ^ q.y) * 1597334673U;
    return float(n) * 2.328306437080797e-10;
  }

  float value2d(vec2 p) {
    vec2 pg = floor(p), pc = p - pg, k = vec2(0, 1);
    pc *= pc * pc * (3. - 2. * pc);
    return mix(
      mix(hash12(pg + k.xx), hash12(pg + k.yx), pc.x),
      mix(hash12(pg + k.xy), hash12(pg + k.yy), pc.x),
      pc.y
    );
  }

  float get_stars_rough(vec2 p) {
    float s = smoothstep(THRESHOLD, 1., hash12(p));
    if (s >= THRESHOLD) s = pow((s - THRESHOLD) / (1. - THRESHOLD), 10.);
    return s;
  }

  float get_stars(vec2 p, float a, float t) {
    vec2 pg = floor(p), pc = p - pg, k = vec2(0, 1);
    pc *= pc * pc * (3. - 2. * pc);
    float s = mix(
      mix(get_stars_rough(pg + k.xx), get_stars_rough(pg + k.yx), pc.x),
      mix(get_stars_rough(pg + k.xy), get_stars_rough(pg + k.yy), pc.x),
      pc.y
    );
    return smoothstep(a, a + t, s) * pow(value2d(p * .1 + iTime) * .5 + .5, 8.3);
  }

  float get_dust(vec2 p, vec2 size, float f) {
    vec2 ar = vec2(iResolution.x / iResolution.y, 1);
    vec2 pp = p * size * ar;
    return pow(.64 + .46 * cos(p.x * 6.28), 1.7) * (
      get_stars(.1 * pp + iTime * vec2(20., -10.1), .11, .71) * 4. +
      get_stars(.2 * pp + iTime * vec2(30., -10.1), .1, .31) * 5. +
      get_stars(.32 * pp + iTime * vec2(40., -10.1), .1, .91) * 2.
    ) * f;
  }

  float sdf(vec3 p) {
    p *= 2.;
    float o =
      4.2 * sin(.05 * p.x + iTime * .25) +
      (.04 * p.z) *
      sin(p.x * .11 + iTime) *
      2. * sin(p.z * .2 + iTime) *
      value2d(vec2(.03, .4) * p.xz + vec2(iTime * .5, 0));
    return abs(dot(p, normalize(vec3(0, 1, 0.05))) + 2.5 + o * .5);
  }

  vec2 raymarch(vec3 o, vec3 d, float omega) {
    float t = 0., a = 0.;
    float g = MAX_DIST, dt = 0., sl = 0., emin = 0.03, ed = emin;
    int dr = 0;
    bool hit = false;

    for (int i = 0; i < 100; i++) {
      vec3 p = o + d * t;
      float ndt = sdf(p);
      if (abs(dt) + abs(ndt) < sl) {
        sl -= omega * sl;
        omega = 1.;
      } else {
        sl = ndt * omega;
      }
      dt = ndt;
      t += sl;
      g = (t > 10.) ? min(g, abs(dt)) : MAX_DIST;

      if ((t += dt) >= MAX_DIST) break;

      if (dt < MIN_DIST) {
        if (dr > MAX_DRAWS) break;
        dr++;
        float f = smoothstep(0.09, 0.11, (p.z * .9) / 100.);
        if (!hit) {
          a = .01;
          hit = true;
        }
        ed = 2. * max(emin, abs(ndt));
        a += .0135 * f;
        t += ed;
      }
    }

    g /= 3.;
    return vec2(a, max(1. - g, 0.));
  }

  void main() {
    vec2 uv = vUv;
    vec3 o = vec3(0);
    vec3 d = vec3((uv * iResolution.xy - 0.5 * iResolution.xy) / iResolution.y, 1.);

    vec2 mg = raymarch(o, d, 1.2);

    vec3 c = mix(
      mix(uBottomLeft, uBottomRight, uv.x),
      mix(uTopLeft, uTopRight, uv.x),
      uv.y
    );

    c = mix(c, vec3(1.), mg.x);

    #ifdef DUST
    c += get_dust(uv, vec2(2000.), mg.y) * .3;
    #endif

    gl_FragColor = vec4(c, 1.0);
  }
`;
