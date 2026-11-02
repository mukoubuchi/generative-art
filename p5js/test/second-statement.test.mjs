import assert from "node:assert/strict";
import test from "node:test";
import { FRAMES, FPS, DURATION, N, SPREAD_FRAMES, BASE_LINE, WIDTH, HEIGHT, CENTRE, RADIUS,
  stateAt, frameAt, direction, crossingClass, endpoints, transform, project, linePoints, referenceNet } from "../artworks/second-statement/geometry.js";

const close = (a,b,t=2e-10) => assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const det = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
const norm2 = q => dot(q,q);
function properCross(a,b,c,d) {
  if(Math.max(a[0],b[0])<Math.min(c[0],d[0]) || Math.max(c[0],d[0])<Math.min(a[0],b[0]) ||
    Math.max(a[1],b[1])<Math.min(c[1],d[1]) || Math.max(c[1],d[1])<Math.min(a[1],b[1]))return false;
  const v=[det(a,b,c),det(a,b,d),det(c,d,a),det(c,d,b)];
  return v[0]*v[1]<-1e-20 && v[2]*v[3]<-1e-20;
}
const mix = (a,b,t) => a.map((v,i)=>v*(1-t)+b[i]*t);
function meeting(a,b) {
  const v=a[1].map((x,i)=>x-a[0][i]),w=b[1].map((x,i)=>x-b[0][i]);
  const cross=v[0]*w[1]-v[1]*w[0];
  if(Math.abs(cross)<1e-13)return null;
  const delta=b[0].map((x,i)=>x-a[0][i]),t=(delta[0]*w[1]-delta[1]*w[0])/cross;
  return a[0].map((x,i)=>x+t*v[i]);
}
function distance(a,b) {
  return Math.acosh((1-dot(a,b))/Math.sqrt((1-norm2(a))*(1-norm2(b))));
}

test("the actual pencil has multiple nonmeeting lines: exact integer certificates across all frames",()=>{
  let classified=0, ideal=0;
  for(let f=0;f<FRAMES;f++) {
    const s=stateAt(f),seen=new Set();
    for(let k=-N;k<=N;k++) {
      const [dx,dy]=direction(k,s.spread), x=3n*BigInt(dx),y=3n*BigInt(dy),w=5n*BigInt(dx);
      const exact=x*x+y*y-w*w;
      const expected=dx===0 ? "euclidean-parallel" : exact===0n ? "ideal" : exact>0n ? "outside" : "inside";
      assert.equal(crossingClass([dx,dy]),expected);assert.notEqual(expected,"inside");
      assert.equal(5n*x-3n*w,0n);assert.equal(BigInt(dy)*x-BigInt(dx)*y,0n);
      seen.add(dx/dy);classified++;if(expected==="ideal")ideal++;
    }
    assert.equal(seen.size,s.pencilCount);
  }
  assert.equal(crossingClass(direction(-N)),"ideal");assert.equal(crossingClass(direction(N)),"ideal");
  console.log(JSON.stringify({certificates:classified,idealCertificates:ideal,pencilMembers:2*N+1}));
});

test("inward directions fail the claim, and the full Euclidean plane has only one nonmeeting member",()=>{
  let euclideanNonmeeting=0;
  for(let k=-N;k<=N;k++) {
    const [dx,dy]=direction(k);
    if(!dx) {euclideanNonmeeting++;continue;}
    assert.ok(Number.isFinite(3*dy/(5*dx)));
  }
  assert.equal(euclideanNonmeeting,1);
  // Same point and reference line; only the slope is tilted into the forbidden sector.
  for(const d of [[1,1],[3,0],[3,3],[-3,3]])assert.equal(crossingClass(d),"inside");
  assert.equal(crossingClass([3,4]),"ideal");assert.equal(crossingClass([3,5]),"outside");
  // Enlarging the disk admits a formerly excluded intersection, so clipping alone is not a proof.
  const [x,y]=direction(N/2),q=[0.6,0.6*y/x];assert.ok(norm2(q)>1 && norm2(q)<4);
});

test("the displayed Lorentz motions preserve metric, incidence, and the excluded boundary",()=>{
  let worstBoundary=0,worstIncidence=0,worstDistance=0;
  const a=[-0.3,0.2],b=[0.35,-0.1],d=distance(a,b);
  for(let f=0;f<FRAMES;f++) {
    const s=stateAt(f),p=transform([0,0],s),blue=BASE_LINE.map(q=>transform(q,s));
    worstDistance=Math.max(worstDistance,Math.abs(distance(transform(a,s),transform(b,s))-d));
    for(let k=-N;k<=N;k++) {
      const pair=endpoints(direction(k,s.spread)).map(q=>transform(q,s));
      for(const q of pair)worstBoundary=Math.max(worstBoundary,Math.abs(norm2(q)-1));
      worstIncidence=Math.max(worstIncidence,Math.abs(det(...pair,p)));
      const crossing=meeting(pair,blue);if(crossing)assert.ok(norm2(crossing)>1-2e-11);
    }
  }
  assert.ok(worstBoundary<2e-12);assert.ok(worstIncidence<2e-12);assert.ok(worstDistance<2e-12);
  console.log(JSON.stringify({worstBoundary,worstIncidence,worstDistance}));
});

test("the curved endpoint is the Poincare model; intermediate radial maps remain one-to-one",()=>{
  let residual=0;
  for(let f=0;f<FRAMES;f++) {
    const s=stateAt(f);let previous=-1;
    for(let j=0;j<=100;j++) {
      const q=project([j/100,0],s.projectionMix);assert.ok(q[0]>previous);previous=q[0];
    }
    close(previous,1);
  }
  for(const s0 of [stateAt(0),stateAt(420),stateAt(719)]) {
    const s={...s0,projectionMix:1};
    for(const pair of [BASE_LINE,...Array.from({length:2*N+1},(_,i)=>endpoints(direction(i-N)))]) {
      const pts=linePoints(pair,s),a=pts[23],b=pts[63],den=2*(a[0]*b[1]-a[1]*b[0]);
      if(Math.abs(den)<1e-8)continue;
      const aa=1+norm2(a),bb=1+norm2(b),c=[(aa*b[1]-bb*a[1])/den,(a[0]*bb-b[0]*aa)/den];
      const r2=norm2(c)-1;assert.ok(r2>0);
      for(const q of pts)residual=Math.max(residual,Math.abs(norm2(q)-2*dot(c,q)+1));
    }
  }
  assert.ok(residual<1e-10);console.log(JSON.stringify({orthogonalCircleResidual:residual}));
});

test("the surrounding net uses complete geodesics with equal hyperbolic spacing",()=>{
  const net=referenceNet();assert.equal(net.length,135);
  for(let family=0;family<3;family++) {
    const lines=net.filter(l=>l.family===family),c=Math.cos(Math.PI*family/3),s=Math.sin(Math.PI*family/3);
    let last=null;
    for(const line of lines) {
      line.ends.forEach(q=>close(norm2(q),1));
      const mid=mix(...line.ends,0.5),coordinate=mid[0]*c+mid[1]*s;
      close(Math.atanh(coordinate),line.index*0.105);
      if(last!==null)close(Math.atanh(coordinate)-last,0.105);
      last=Math.atanh(coordinate);
    }
  }
});

test("the full finite timeline stays on the canvas and holds its last state",()=>{
  assert.equal(FRAMES,FPS*DURATION);assert.equal(frameAt(-1),0);assert.equal(frameAt(1e6),FRAMES-1);
  assert.throws(()=>stateAt(FRAMES),RangeError);assert.throws(()=>direction(1.5),RangeError);
  assert.throws(()=>crossingClass([0,0]),RangeError);
  assert.equal(stateAt(0).pencilCount,1);assert.equal(stateAt(719).projectionMix,1);
  assert.deepEqual({...stateAt(630),frameIndex:719},stateAt(719));
  let samples=0;
  for(let f=0;f<FRAMES;f++) {
    const s=stateAt(f),blue=linePoints(BASE_LINE,s);
    for(const pair of [BASE_LINE,...Array.from({length:2*N+1},(_,i)=>endpoints(direction(i-N,s.spread)))]) {
      const points=linePoints(pair,s);
      if(pair!==BASE_LINE)for(let i=1;i<points.length;i++)for(let j=1;j<blue.length;j++) {
        assert.ok(!properCross(points[i-1],points[i],blue[j-1],blue[j]), `Sampled crossing at frame ${f}`);
      }
      for(const q of points) {
        assert.ok(q.every(Number.isFinite));assert.ok(norm2(q)<1+2e-12);
        const x=CENTRE[0]+RADIUS*q[0],y=CENTRE[1]-RADIUS*q[1];
        assert.ok(x>0&&x<WIDTH&&y>0&&y<HEIGHT);samples++;
      }
    }
  }
  console.log(JSON.stringify({frames:FRAMES,renderedPathSamples:samples}));
});
