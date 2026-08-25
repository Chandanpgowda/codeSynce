'use client';

import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';
import { useEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, MouseEventHandler, ReactNode } from 'react';
import './SpecularButton.css';

const PAD = 20;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;

  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`;

export interface SpecularButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'> {
  children?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

const SpecularButton = ({
  children = 'Get Started',
  size = 'lg',
  radius = 18,
  tint = '#ffffff',
  tintOpacity = 0,
  blur = 0,
  textColor = '#f5f5f5',
  lineColor = '#ffffff',
  baseColor = '#525252',
  intensity = 1,
  shineSize = 10,
  shineFade = 40,
  thickness = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  ...rest
}: SpecularButtonProps) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const fxRef = useRef<HTMLSpanElement>(null);
  const propsRef = useRef<Record<string, unknown>>({});

  propsRef.current = { radius, lineColor, baseColor, intensity, shineSize, shineFade, thickness, speed, followMouse, proximity, autoAnimate };

  useEffect(() => {
    const btn = btnRef.current;
    const fxEl = fxRef.current;
    if (!btn || !fxEl) return;

    const dpr = window.devicePixelRatio || 1;
    const sizeRef = { w: 1, h: 1 };

    // Browsers cap active WebGL contexts (~8-16 per page). With many buttons
    // mounted at once we must NOT create a context per button on mount.
    // Instead each button lazily creates its context when the cursor gets
    // close and disposes it after being idle for a while.
    let fx: { renderer: Renderer; program: Program; mesh: Mesh } | null = null;

    const resize = () => {
      const rect = btn.getBoundingClientRect();
      sizeRef.w = rect.width;
      sizeRef.h = rect.height;
      if (!fx) return;
      fx.renderer.setSize(rect.width + PAD * 2, rect.height + PAD * 2);
      fx.program.uniforms.uCenter.value = [(PAD + rect.width / 2) * dpr, (PAD + rect.height / 2) * dpr];
      fx.program.uniforms.uHalfSize.value = [(rect.width / 2) * dpr, (rect.height / 2) * dpr];
    };
    const ro = new ResizeObserver(resize);
    ro.observe(btn);
    resize();

    const ensureFx = () => {
      if (fx) return;
      const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const geometry = new Triangle(gl);
      if (geometry.attributes.uv) delete geometry.attributes.uv;

      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uCenter: { value: [0, 0] },
          uHalfSize: { value: [1, 1] },
          uRadius: { value: 0 },
          uAngle: { value: 2.4 },
          uPx: { value: dpr },
          uLineColor: { value: [1, 1, 1] },
          uBaseColor: { value: [0.32, 0.32, 0.32] },
          uIntensity: { value: 1 },
          uShineSize: { value: 0.17 },
          uShineFade: { value: 0.7 },
          uThickness: { value: 1 },
          uBaseWidth: { value: dpr }
        }
      });

      fx = { renderer, program, mesh: new Mesh(gl, { geometry, program }) };
      fxEl.appendChild(gl.canvas);
      resize();
    };

    const disposeFx = () => {
      if (!fx) return;
      const gl = fx.renderer.gl;
      if (gl.canvas.parentNode === fxEl) fxEl.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      fx = null;
    };

    let pointerAngle: number | null = null;
    let proximityT = 0;
    const onPointerMove = (e: PointerEvent) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist === 0) {
        const nx = (e.clientX - cx) / (rect.width / 2);
        const ny = (cy - e.clientY) / (rect.height / 2);
        pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
      }
      const t = Math.max(0, 1 - dist / Math.max(propsRef.current.proximity as number, 1));
      proximityT = t * t * (3 - 2 * t);
      if (propsRef.current.autoAnimate || proximityT > 0) ensureFx();
    };
    window.addEventListener('pointermove', onPointerMove);

    let angle = 2.4;
    let idleAngle = 2.4;
    let bright = 0;
    let last = performance.now();
    let lastActive = performance.now();
    let raf = 0;

    const lineC = new Color();
    const baseC = new Color();

    const update = (now: number) => {
      raf = requestAnimationFrame(update);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const p = propsRef.current;

      // Keep the light angle animating even without a context so it is
      // already "pointing" correctly the moment the context is created.
      idleAngle += (p.speed as number) * dt;
      const steer = p.followMouse && pointerAngle != null && (!p.autoAnimate || proximityT > 0);
      const target = steer && pointerAngle != null ? pointerAngle : idleAngle;
      const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      angle += diff * (1 - Math.exp(-dt * 7));

      const brightTarget = p.autoAnimate ? 1 : proximityT;
      bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8));

      const f = fx;
      if (!f) return;

      if (proximityT > 0 || p.autoAnimate) lastActive = now;
      // Release the WebGL context once the cursor has stayed away for a bit,
      // so pages with many buttons never exceed the browser's context limit.
      if (now - lastActive > 5000) {
        disposeFx();
        return;
      }

      lineC.set(p.lineColor as string);
      baseC.set(p.baseColor as string);
      f.program.uniforms.uAngle.value = angle;
      f.program.uniforms.uRadius.value =
        Math.min(p.radius as number, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr;
      f.program.uniforms.uLineColor.value = [lineC.r, lineC.g, lineC.b];
      f.program.uniforms.uBaseColor.value = [baseC.r, baseC.g, baseC.b];
      f.program.uniforms.uIntensity.value = (p.intensity as number) * bright;
      f.program.uniforms.uShineSize.value = ((p.shineSize as number) * Math.PI) / 180;
      f.program.uniforms.uShineFade.value = ((p.shineFade as number) * Math.PI) / 180;
      f.program.uniforms.uThickness.value = (p.thickness as number) * dpr;
      f.renderer.render({ scene: f.mesh });
    };
    raf = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      disposeFx();
    };
  }, []);

  return (
    <button
      ref={btnRef}
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...rest}
      className={`specular-button specular-button--${size}${className ? ` ${className}` : ''}`}
      style={
        {
          '--sb-radius': `${radius}px`,
          '--sb-tint': tint,
          '--sb-tint-opacity': tintOpacity,
          '--sb-blur': `${blur}px`,
          '--sb-text-color': textColor
        } as CSSProperties
      }
    >
      <span ref={fxRef} className="specular-button__fx" aria-hidden="true" />
      <span className="specular-button__label">{children}</span>
    </button>
  );
};

export default SpecularButton;
