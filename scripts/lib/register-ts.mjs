// À passer à Node avec --import : enregistre les crochets de scripts/lib/ts-hooks.mjs.
import { register } from "node:module";
register("./ts-hooks.mjs", import.meta.url);
