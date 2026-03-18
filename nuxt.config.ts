// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: "2024-11-01",
  devtools: { enabled: false },
  modules: ["@nuxtjs/tailwindcss"],
  runtimeConfig: {
    openaiApiKey: "", // Server only
    public: {
      googleMapsApiKey: "", // Exposed to client for Maps JS API loading
    },
  },
});
