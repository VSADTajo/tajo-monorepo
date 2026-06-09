import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

const light = {
  dark: false,
  colors: {
    primary: '#1D283A',
    secondary: '#577CA0',
    error: '#ff5252',
    background: '#e7e7e7',
    surface_variant: '#FFFFFF',
    dark: '#212121',
    border: '#e7e7e7',
    white: '#ffffff',
  },
}

const dark = {
  dark: true,
  colors: {
    primary: '#1D283A',
    secondary: '#577CA0',
    error: '#ff5252',
    background: '#212121',
    surface_variant: '#393939',
    dark: '#212121',
    border: '#393939',
    white: '#ffffff',
  },
}

const inputStyles = {
  variant: 'outlined',
  hideDetails: true,
}

const booleanInputStyles = {
  hideDetails: true,
  color: 'primary',
}

// ✅ Añade `components` y `directives` para que Vuetify registre los componentes automáticamente
export default createVuetify({
  components,
  directives,
  theme: {
    themes: {
      light,
      dark,
    },
  },
  defaults: {
    VTextField: inputStyles,
    VTextArea: inputStyles,
    VSwitch: booleanInputStyles,
    VCheckbox: booleanInputStyles,
  },
})
