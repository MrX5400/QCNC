
class Matrix {
  constructor(a=1, b=0, c=0, d=1, e=0, f=0) {
    this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
  }
  multiply(m) {
    return new Matrix(
      this.a * m.a + this.c * m.b,
      this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d,
      this.b * m.c + this.d * m.d,
      this.a * m.e + this.c * m.f + this.e,
      this.b * m.e + this.d * m.f + this.f
    );
  }
  transformPoint(x, y) {
    return {
      x: x * this.a + y * this.c + this.e,
      y: x * this.b + y * this.d + this.f
    };
  }
}
const m1 = new Matrix(2, 0, 0, 2, 0, 0); // scale 2x
const m2 = new Matrix(1, 0, 0, 1, 10, 10); // translate 10, 10
const m3 = m1.multiply(m2);
console.log('m1 * m2 point(5,5) =', m3.transformPoint(5, 5));

const m4 = m2.multiply(m1);
console.log('m2 * m1 point(5,5) =', m4.transformPoint(5, 5));


