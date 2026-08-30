
class MockCtx {
  constructor() {
    this.paths = [];
    this.currentPath = [];
    this.canvas = { width: 1000, height: 1000 };
  }
  save() {} restore() {} scale() {} translate() {} transform() {} setTransform() {}
  beginPath() { this.currentPath = []; }
  moveTo(x, y) { this.currentPath.push({ type: 'moveTo', x, y }); }
  lineTo(x, y) { this.currentPath.push({ type: 'lineTo', x, y }); }
  bezierCurveTo(x1, y1, x2, y2, x3, y3) { this.currentPath.push({ type: 'bezierCurveTo', x1, y1, x2, y2, x3, y3 }); }
  closePath() { this.currentPath.push({ type: 'closePath' }); }
  stroke() { if(this.currentPath.length) this.paths.push([...this.currentPath]); }
  fill() { /* ignore fill */ }
  // ... add empty methods for all ctx methods ...
}
const ctx = new MockCtx();
const handler = {
  get(target, prop) {
    if (typeof target[prop] === 'function') return target[prop].bind(target);
    return target[prop];
  }
};
console.log(new Proxy(ctx, handler));

