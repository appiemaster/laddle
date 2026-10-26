import "./style.css";

import { registerSW } from "virtual:pwa-register";

import { mount } from "./app.ts";

mount(document.getElementById("app")!);

// Offline play: the service worker caches the game; a new version is picked
// up on the next visit.
registerSW({ immediate: true });
