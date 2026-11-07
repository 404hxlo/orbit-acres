// Orbit Acres: the camera side of the image. The scene is drawn in high dynamic
// range, then this adds soft glow around bright things, a gentle miniature-style
// focus falloff, film-like tone mapping and a light color grade.
(function (root) {
  const OA = root.OA;
  const G = OA.Gfx;
  const T = root.THREE;
  const P = (G.Post = { on: false });
  let r, hdr, levels = [], fsScene, fsCam, quad, down, up, finish;
  let width = 0, height = 0;
  let samples = 0, bloomSteps = 0;

  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const DOWN = `
    uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
    vec3 s(vec2 o) { return min(texture2D(t, vUv + o * px).rgb, vec3(30.0)); }
    void main() {
      vec3 c = s(vec2(0.0)) * 4.0 + s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0));
      gl_FragColor = vec4(c / 8.0, 1.0);
    }`;
  const UP = `
    uniform sampler2D t; uniform sampler2D base; uniform vec2 px; uniform float mixK; varying vec2 vUv;
    vec3 s(vec2 o) { return texture2D(t, vUv + o * px).rgb; }
    void main() {
      vec3 c = s(vec2(-1.0, 0.0)) * 2.0 + s(vec2(1.0, 0.0)) * 2.0 + s(vec2(0.0, -1.0)) * 2.0 + s(vec2(0.0, 1.0)) * 2.0;
      c += s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0));
      gl_FragColor = vec4(mix(texture2D(base, vUv).rgb, c / 12.0, mixK), 1.0);
    }`;
  const FINISH = `
    uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tBlur;
    uniform float uBloom; uniform float uTilt; uniform float uExposure; uniform float uSat; uniform vec3 uTint;
    varying vec2 vUv;
    vec3 aces(vec3 x) {
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }
    float grain(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    void main() {
      vec3 c = texture2D(tScene, vUv).rgb;
      if (uTilt > 0.0) {
        float d = abs(vUv.y - 0.47);
        c = mix(c, texture2D(tBlur, vUv).rgb, smoothstep(0.24, 0.6, d) * uTilt);
      }
      c = mix(c, texture2D(tBloom, vUv).rgb, uBloom);
      c = aces(c * uExposure * uTint);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
      vec2 q = vUv - 0.5;
      c *= 1.0 - dot(q, q) * 0.34;
      c += (grain(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(c, 1.0);
    }`;

  const makeRT = (w, h) => new T.WebGLRenderTarget(w, h, {
    type: T.HalfFloatType, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, stencilBuffer: false,
  });

  const free = () => {
    if (hdr) hdr.dispose();
    levels.forEach((l) => { l.down.dispose(); if (l.up) l.up.dispose(); });
    levels = [];
    hdr = null;
  };

  P.supported = (renderer) => {
    if (!renderer.capabilities.isWebGL2) return false;
    const gl = renderer.getContext();
    return !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
  };

  P.init = (renderer) => {
    r = renderer;
    fsScene = new T.Scene();
    fsCam = new T.Camera();
    const plain = (fs, uniforms) => new T.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, blending: T.NoBlending, toneMapped: false });
    down = plain(DOWN, { t: { value: null }, px: { value: new T.Vector2() } });
    up = plain(UP, { t: { value: null }, base: { value: null }, px: { value: new T.Vector2() }, mixK: { value: 0.6 } });
    finish = plain(FINISH, {
      tScene: { value: null }, tBloom: { value: null }, tBlur: { value: null },
      uBloom: { value: 0.055 }, uTilt: { value: 0 }, uExposure: { value: 1 }, uSat: { value: 1.1 },
      uTint: { value: new T.Color(1, 1, 1) },
    });
    quad = new T.Mesh(new T.PlaneGeometry(2, 2), down);
    quad.frustumCulled = false;
    fsScene.add(quad);
    samples = G.Q.msaa;
    bloomSteps = G.Q.bloom;
    P.on = true;
  };

  // Lighter or heavier settings while playing. The next resize rebuilds the targets.
  P.quality = (msaa, bloom) => {
    if (msaa === samples && bloom === bloomSteps) return;
    samples = msaa;
    bloomSteps = bloom;
    width = 0;
  };

  P.resize = (w, h) => {
    if (!P.on || (w === width && h === height)) return;
    width = w; height = h;
    free();
    const opts = { type: T.HalfFloatType, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true, stencilBuffer: false };
    if (samples > 1 && T.WebGLMultisampleRenderTarget) {
      hdr = new T.WebGLMultisampleRenderTarget(w, h, opts);
      hdr.samples = samples;
    } else hdr = new T.WebGLRenderTarget(w, h, opts);
    let lw = w, lh = h;
    for (let i = 0; i < bloomSteps; i++) {
      lw = Math.max(2, Math.floor(lw / 2));
      lh = Math.max(2, Math.floor(lh / 2));
      levels.push({ w: lw, h: lh, down: makeRT(lw, lh), up: i < bloomSteps - 1 ? makeRT(lw, lh) : null });
    }
  };

  P.set = (o) => {
    const u = finish.uniforms;
    if (o.tilt !== undefined) u.uTilt.value = o.tilt;
    if (o.exposure !== undefined) u.uExposure.value = o.exposure;
    if (o.bloom !== undefined) u.uBloom.value = o.bloom;
    if (o.sat !== undefined) u.uSat.value = o.sat;
    if (o.tint) u.uTint.value.copy(o.tint);
  };

  const pass = (mat, target) => {
    quad.material = mat;
    r.setRenderTarget(target);
    r.render(fsScene, fsCam);
  };

  P.render = (scene, camera, overlay) => {
    r.setRenderTarget(hdr);
    r.clear();
    r.render(scene, camera);

    // Build a chain of smaller and smaller blurred copies.
    let src = hdr.texture, sw = width, sh = height;
    levels.forEach((l) => {
      down.uniforms.t.value = src;
      down.uniforms.px.value.set(1 / sw, 1 / sh);
      pass(down, l.down);
      src = l.down.texture; sw = l.w; sh = l.h;
    });
    // Then add them back together on the way up.
    let low = levels.length ? levels[levels.length - 1].down.texture : hdr.texture;
    for (let i = levels.length - 2; i >= 0; i--) {
      const l = levels[i], below = levels[i + 1];
      up.uniforms.t.value = low;
      up.uniforms.base.value = l.down.texture;
      up.uniforms.px.value.set(1 / below.w, 1 / below.h);
      pass(up, l.up);
      low = l.up.texture;
    }
    const u = finish.uniforms;
    u.tScene.value = hdr.texture;
    u.tBloom.value = low;
    u.tBlur.value = levels.length > 1 ? levels[1].down.texture : low;
    pass(finish, null);
    if (overlay) r.render(overlay, camera);
  };
})(window);
