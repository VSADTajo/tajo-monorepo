import ky from 'ky'
import router from '@/router'

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL,
  timeout: 30000,
  hooks: {
    beforeRequest: [
      (request) => {
        const token = localStorage.getItem('token')

        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`)
        }

        //  NO poner Content-Type aquí
      },
    ],

    afterResponse: [
      async (_request, _options, response) => {
        if (response.status === 401 || response.status === 403) {
          // 🔥 token inválido / expirado
          localStorage.removeItem('token')

          if (router.currentRoute.value.name !== 'login') {
            router.push({ name: 'login' })
          }
        }
      },
    ],

    beforeError: [
      (error) => {
        // ❌ error de red (VPN caída, backend muerto, timeout)
        if (!error.response) {
          localStorage.removeItem('token')

          if (router.currentRoute.value.name !== 'login') {
            router.push({ name: 'login' })
          }
        }

        return error
      },
    ],
  },
})
