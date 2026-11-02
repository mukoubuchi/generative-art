import { WIDTH, HEIGHT, FPS, DURATION, FRAMES, N, SPREAD_FRAMES, CENTRE, RADIUS,
  BASE_LINE, stateAt, frameAt, direction, endpoints, transform, project, screen,
  linePoints, referenceNet } from "./geometry.js";

const parameters = new URLSearchParams(window.location.search);
const CAPTURE_MODE = parameters.get("capture") === "1";
const scale = CAPTURE_MODE ? Math.max(1, Number.parseInt(parameters.get("renderScale") ?? "1", 10)) : 1;
const outputWidth = WIDTH * scale, outputHeight = HEIGHT * scale;
const GROUND = "rgb(6,7,12)";
const STEEL = [104,144,204], GOLD = [252,204,116], ICE = [248,250,255];
const net = referenceNet();
const css = (c, a) => `rgba(${c.join(",")},${a})`;
function pathOf(points) {
  const path = new Path2D();
  points.forEach((q, i) => { const [x,y] = screen(q); if(i) path.lineTo(x,y); else path.moveTo(x,y); });
  return path;
}

new window.p5((p) => {
  let started;
  function drawFrame(frame) {
    const state = stateAt(frame), ctx = p.drawingContext;
    ctx.save(); ctx.scale(scale, scale);
    ctx.fillStyle = GROUND; ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const disk = new Path2D(); disk.arc(...CENTRE,RADIUS,0,2*Math.PI);
    ctx.fillStyle = "rgb(8,11,19)"; ctx.fill(disk);
    ctx.save(); ctx.clip(disk); ctx.globalCompositeOperation = "lighter";
    function ink(path, color, alpha, width) {
      ctx.strokeStyle = css(color,alpha); ctx.lineWidth = width; ctx.stroke(path);
    }
    // Three equally spaced geodesic nets expose the geometry of the entire domain.
    for(const line of net) {
      const path = pathOf(linePoints(line.ends,state));
      const major = line.index % 5 === 0;
      ink(path,STEEL,major ? 0.29 : 0.14,major ? 0.7 : 0.48);
    }
    const blue = pathOf(linePoints(BASE_LINE,state));
    ink(blue,STEEL,0.12,10); ink(blue,STEEL,0.45,3.2); ink(blue,ICE,0.82,1.05);

    const members = state.spread ? Array.from({length:2*N+1},(_,i)=>i-N) : [0];
    for(const k of members) {
      const pair = endpoints(direction(k,state.spread)), path = pathOf(linePoints(pair,state));
      const edge = Math.abs(k) === N;
      ink(path,GOLD,edge ? 0.1 : 0.025,edge ? 7 : 3);
      ink(path,GOLD,edge ? 0.9 : 0.46,edge ? 1.45 : 0.65);
      if(edge || k===0) ink(path,ICE,edge ? 0.67 : 0.8,0.5);
      // Equal hyperbolic-distance stations along each line make the shrinking legible.
      if(k % 4 === 0) for(let j=-10;j<=10;j++) {
        if(j===0) continue;
        const distance = j * 0.32, t = Math.tanh(distance);
        const q = pair[1].map(v=>v*t), [x,y] = screen(project(transform(q,state),state.projectionMix));
        ctx.beginPath();ctx.arc(x,y,0.85,0,2*Math.PI);ctx.fillStyle=css(GOLD,0.5);ctx.fill();
      }
    }
    const [px,py] = screen(project(transform([0,0],state),state.projectionMix));
    const glow=ctx.createRadialGradient(px,py,0,px,py,12);
    glow.addColorStop(0,css(GOLD,0.5));glow.addColorStop(1,css(GOLD,0));
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(px,py,12,0,2*Math.PI);ctx.fill();
    ctx.fillStyle=css(ICE,1);ctx.beginPath();ctx.arc(px,py,2.1,0,2*Math.PI);ctx.fill();
    ctx.restore();
    ctx.strokeStyle=css(STEEL,0.6);ctx.lineWidth=0.8;ctx.stroke(disk);
    // The rim marks excluded ideal points; it is not an extra line of the geometry.
    for(const q of BASE_LINE) {
      const [x,y]=screen(transform(q,state));ctx.fillStyle=GROUND;ctx.beginPath();ctx.arc(x,y,3,0,2*Math.PI);ctx.fill();
      ctx.strokeStyle=css(STEEL,0.85);ctx.lineWidth=0.85;ctx.stroke();
    }
    ctx.restore();
    return {kind:"video",...state,totalFrames:FRAMES,durationSeconds:DURATION,
      logicalSize:{width:WIDTH,height:HEIGHT},outputSize:{width:outputWidth,height:outputHeight}};
  }
  function publishState(state) {
    window.__ARTWORK_STATE__=state;window.__ARTWORK_READY__=true;return state;
  }
  p.setup=()=>{
    p.createCanvas(outputWidth,outputHeight).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(FPS);
    if(CAPTURE_MODE) {
      p.noLoop();window.__renderFrame = (frameIndex) => Promise.resolve(publishState(drawFrame(frameIndex)));
    }
    publishState(drawFrame(0));started=performance.now();
  };
  p.draw=()=>{if(!CAPTURE_MODE)publishState(drawFrame(frameAt((performance.now()-started)/1000)));};
});
