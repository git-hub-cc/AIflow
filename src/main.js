import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './components/App.vue'

// 导入全局样式
import './assets/base.css'
import './assets/components.css'
import 'remixicon/fonts/remixicon.css'


const app = createApp(App)

app.use(createPinia())

app.mount('#app')