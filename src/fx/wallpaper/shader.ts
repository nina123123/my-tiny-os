/*
 * The wallpaper shaders.
 *
 * A full-screen triangle; the fragment shader raymarches six soft metaballs
 * (gently stretched spheres, smooth-min union) floating in front of a pastel
 * sunrise sky. Blob centers, shapes and albedos are computed on the CPU each
 * frame (cheap uniforms), so the per-pixel work is just: bounding test →
 * short march → pearly shading.
 *
 * Shading: wrap diffuse with cool tinted shadows, a warm bounce/subsurface
 * rim at the lower-right, sky reflections with a pastel thin-film shimmer,
 * a broad softbox specular + a tiny highlight, fresnel rim light (neon at night),
 * depth haze, a soft aura around blobs on the sky, anti-aliased silhouettes
 * and interleaved-gradient-noise dithering.
 */

export const BLOB_COUNT = 6

export const VERT = /* glsl */ `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

export function fragSource(highp: boolean) {
  return /* glsl */ `
precision ${highp ? 'highp' : 'mediump'} float;

#define N ${BLOB_COUNT}
#define STEPS 44

uniform vec2 uRes;
uniform float uTime;
uniform vec3 uSkyA;
uniform vec3 uSkyB;
uniform vec3 uSkyC;
uniform vec3 uSkyD;
uniform vec3 uSkyE;
uniform vec4 uBlob[N];   /* xyz center, w radius (in stretched space) */
uniform vec4 uShape[N];  /* xyz 1/stretch, w = min stretch */
uniform vec3 uCol[N];
uniform float uK;
uniform float uNight;

const float CAM_Z = 6.0;
const float TAN_HALF = 0.42;

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

/* a softly stretched sphere (slow "breathing" ellipsoid) */
float blob(vec3 p, vec4 b, vec4 s) {
  return (length((p - b.xyz) * s.xyz) - b.w) * s.w;
}

float map(vec3 p) {
  float d = 1e3;
  for (int i = 0; i < N; i++) {
    d = smin(d, blob(p, uBlob[i], uShape[i]), uK);
  }
  return d;
}

vec3 normalAt(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.002;
  return normalize(
    e.xyy * map(p + e.xyy) +
    e.yyx * map(p + e.yyx) +
    e.yxy * map(p + e.yxy) +
    e.xxx * map(p + e.xxx)
  );
}

/* albedo: blob colors blended by proximity, so merges melt smoothly */
vec3 albedoAt(vec3 p) {
  vec3 c = vec3(0.0);
  float ws = 0.0;
  for (int i = 0; i < N; i++) {
    float d = blob(p, uBlob[i], uShape[i]);
    float w = exp(-7.0 * max(d + 0.02, 0.0));
    c += uCol[i] * w;
    ws += w;
  }
  return c / max(ws, 1e-4);
}

/* sunrise sky: cool at the top, warm toward the horizon, coral glow low */
vec3 sky(vec2 uv) {
  float x = uv.x;
  float y = uv.y;
  vec3 top = mix(uSkyA, mix(uSkyA, uSkyE, 0.6 * (1.0 - uNight * 0.75)), smoothstep(0.15, 1.0, x));
  vec3 col = mix(uSkyC, uSkyB, smoothstep(-0.05, 0.5, y + 0.06 * sin(x * 3.1 + 0.6)));
  col = mix(col, top, smoothstep(0.38, 1.0, y));
  vec2 g = (uv - vec2(0.64, -0.08)) * vec2(0.85, 1.55);
  col = mix(col, uSkyD, exp(-dot(g, g) * 4.0) * (0.16 + 0.14 * uNight));
  return col;
}

vec3 shade(vec3 p, vec3 rd, vec3 bg) {
  vec3 n = normalAt(p);
  vec3 v = -rd;
  vec3 alb = albedoAt(p);
  vec3 L = normalize(vec3(-0.55, 0.78, 0.6));
  vec3 B = normalize(vec3(0.7, -0.6, -0.15));

  float ndl = dot(n, L);
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float wrap = clamp((ndl + 0.55) / 1.55, 0.0, 1.0);
  wrap = wrap * wrap * (3.0 - 2.0 * wrap);
  float fres = pow(1.0 - ndv, 2.6);

  /* diffuse: lit side glows, shadow side turns cool lavender (never grey).
     at night the body sinks into dark glass so the rims can glow */
  vec3 cool = mix(alb * vec3(0.84, 0.8, 0.98), uSkyE, 0.28) * mix(0.9, 0.38, uNight);
  vec3 lit = alb * mix(1.05, 0.78, uNight);
  vec3 col = mix(cool, lit, wrap);

  /* fake subsurface: a warm bounce bleeding through the lower-right edge */
  float bounce = pow(max(dot(n, B), 0.0), 1.4) * pow(1.0 - ndv, 1.1);
  col += mix(alb, uSkyD, 0.45) * bounce * mix(0.42, 1.0, uNight);

  /* pearly reflections of the sky with a soft thin-film shimmer */
  vec3 r = reflect(rd, n);
  vec3 env = sky(r.xy * 0.5 + 0.5);
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + 0.7 * fres + 0.22 * n.y - 0.12 * n.x + uTime * 0.012));
  irid = mix(vec3(1.0), irid, 0.34 + 0.1 * uNight);
  col = mix(col, env * irid * (1.0 + 0.6 * uNight), (0.14 + 0.42 * fres) * (1.0 - 0.35 * uNight));

  /* speculars: a broad softbox sheen + a tiny bright highlight */
  vec3 h = normalize(L + v);
  float ndh = max(dot(n, h), 0.0);
  col += vec3(1.0, 0.98, 0.96) * (pow(ndh, 26.0) * mix(0.16, 0.1, uNight) + pow(ndh, 300.0) * 0.62);

  /* rim light: white by day, lavender/coral neon by night */
  vec3 rim = mix(vec3(1.0), mix(uSkyE, uSkyD, 0.2 + 0.3 * max(n.x, 0.0)), 0.25 + 0.7 * uNight);
  col += rim * fres * mix(0.18, 0.95, uNight);

  /* night: translucent glass — the core shows the sky through a colored glow */
  vec3 core = bg * 0.5 + alb * (0.62 + 0.6 * bounce) + uSkyD * 0.06;
  col = mix(col, core, uNight * 0.55 * (1.0 - fres) * (1.0 - 0.4 * wrap));

  /* depth haze: farther blobs melt into the sky */
  float haze = clamp(0.1 - p.z * 0.1, 0.02, 0.32);
  return mix(col, bg, haze);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/* sparse soft stars for the night sky (twinkle slowly) */
float stars(vec2 frag) {
  vec2 cell = floor(frag / 7.0);
  float h = hash12(cell);
  if (h < 0.982) return 0.0;
  vec2 c = (cell + 0.5 + (vec2(hash12(cell + 17.0), hash12(cell + 41.0)) - 0.5) * 0.7) * 7.0;
  float d = length(frag - c);
  float tw = 0.55 + 0.45 * sin(uTime * (0.6 + h * 1.5) + h * 120.0);
  return smoothstep(1.4, 0.0, d) * tw * (0.5 + 0.5 * hash12(cell + 7.0));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  vec2 q = (2.0 * frag - uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, CAM_Z);
  vec3 rd = normalize(vec3(q * TAN_HALF, -1.0));

  vec3 bg = sky(uv);

  /* bounding spheres (inflated by the blend radius) + aura accumulation */
  float tmin = 1e3;
  float tmax = -1.0;
  float aura = 0.0;
  vec3 auraCol = vec3(0.0);
  for (int i = 0; i < N; i++) {
    vec3 oc = uBlob[i].xyz - ro;
    float tc = dot(oc, rd);
    float d2 = max(dot(oc, oc) - tc * tc, 0.0);
    float rb = uBlob[i].w / min(uShape[i].x, min(uShape[i].y, uShape[i].z));
    float edge = sqrt(d2) - rb;
    float a = exp(-max(edge, 0.0) * 2.4);
    aura += a;
    auraCol += uCol[i] * a;
    float R = rb + uK * 0.6;
    if (d2 < R * R) {
      float hh = sqrt(R * R - d2);
      tmin = min(tmin, tc - hh);
      tmax = max(tmax, tc + hh);
    }
  }

  vec3 col = bg;
  if (uNight > 0.01) col += vec3(1.0, 0.95, 0.9) * stars(frag) * uNight * 0.75 * smoothstep(0.05, 0.6, uv.y);
  vec3 glow = auraCol / max(aura, 1e-4);
  float glowAmt = 1.0 - exp(-aura * 0.9);
  col = mix(col, glow, glowAmt * mix(0.12, 0.0, uNight));
  col += glow * glowAmt * 0.2 * uNight;

  if (tmax > 0.0) {
    float t = max(tmin, 0.0);
    float md = 1e3;
    float mt = t;
    bool hit = false;
    for (int s = 0; s < STEPS; s++) {
      float d = map(ro + rd * t);
      if (d < md) {
        md = d;
        mt = t;
      }
      if (d < 0.0012 * t) {
        hit = true;
        break;
      }
      t += d * 0.95;
      if (t > tmax) break;
    }
    /* soft, anti-aliased silhouette: coverage from the closest approach */
    float px = 2.0 * TAN_HALF / uRes.y;
    float cover = hit ? 1.0 : 1.0 - smoothstep(0.0, px * mt * 1.6, md);
    if (cover > 0.002) {
      vec3 p = ro + rd * (hit ? t : mt);
      col = mix(col, shade(p, rd, bg), cover);
    }
  }

  /* interleaved-gradient-noise dither kills banding in the soft gradients */
  float ign = fract(52.9829189 * fract(dot(frag, vec2(0.06711056, 0.00583715))));
  col += (ign - 0.5) * (2.5 / 255.0);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`
}
