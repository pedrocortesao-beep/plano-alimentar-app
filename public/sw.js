// Service worker mínimo — necessário para o Chrome mostrar o convite
// automático de instalação. Não faz cache (não é preciso para já).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());
self.addEventListener("fetch", () => {});
