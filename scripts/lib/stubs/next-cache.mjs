// Bouchon de next/cache pour les tests hors Next.js.
export const revalidatePath = () => {};
export const revalidateTag = () => {};
export const unstable_cache = (fn) => fn;
export const unstable_noStore = () => {};
