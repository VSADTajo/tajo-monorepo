import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import MapView from '@/views/MapView.vue'
import LoginView from '@/views/LoginView.vue'
import { isAuthenticated } from '@/services/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: LoginView,
      name: 'login',
    },
    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', component: MapView, name: 'dashboard' },
        { path: 'capas', component: MapView, name: 'capas' },
        { path: 'avisos', component: MapView, name: 'avisos' },
        { path: 'simulaciones', component: MapView, name: 'simulaciones' },
        { path: 'informes', component: MapView, name: 'informes' },
        { path: 'mapasbase', component: MapView, name: 'mapasbase' },
        { path: 'ajustes', component: MapView, name: 'ajustes' },
      ],
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const loggedIn = isAuthenticated()

  if (to.meta.requiresAuth && !loggedIn) {
    next({ name: 'login' })
    return
  }

  if (to.name === 'login' && loggedIn) {
    next({ name: 'dashboard' })
    return
  }

  next()
})

export default router
