declare module 'claude-code' {
  interface PluginState {
    'rtl-hebrew': {
      /** False after /rtl off: every message is left to the engine. */
      isOn: boolean
    }
  }
}
