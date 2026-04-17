import { defineNuxtModule, addPlugin, createResolver, addImportsDir } from '@nuxt/kit'

// Module options TypeScript interface definition
export type ModuleOptions = Record<string, never>

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'laravel-rest-api-nuxt',
    configKey: 'laravelRestApiNuxt',
  },
  defaults: {},
  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)
    addImportsDir(nuxt.options.srcDir + "/models");
    addPlugin(resolver.resolve('./runtime/plugin'))
  },
})
