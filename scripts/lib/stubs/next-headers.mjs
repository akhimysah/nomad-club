// Bouchon de next/headers : cookies() et headers() lisent un état global réglé par le test
// (globalThis.__ncTest = { cookies: Map, headers: Headers }).
function state() {
  const g = globalThis;
  g.__ncTest ??= { cookies: new Map(), headers: new Headers({ "x-forwarded-for": "203.0.113.7", host: "localhost:3000", "user-agent": "test" }) };
  return g.__ncTest;
}
export async function cookies() {
  const s = state();
  return {
    get: (name) => (s.cookies.has(name) ? { name, value: s.cookies.get(name) } : undefined),
    getAll: () => [...s.cookies.entries()].map(([name, value]) => ({ name, value })),
    has: (name) => s.cookies.has(name),
    set: (name, value) => {
      if (typeof name === "object") s.cookies.set(name.name, name.value);
      else s.cookies.set(name, value);
    },
    delete: (name) => s.cookies.delete(typeof name === "object" ? name.name : name),
  };
}
export async function headers() {
  return state().headers;
}
export async function draftMode() {
  return { isEnabled: false };
}
