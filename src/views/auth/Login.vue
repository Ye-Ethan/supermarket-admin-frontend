<script setup>
import {ref} from "vue";
import UserIcon from "@/components/icon/UserIcon.vue";
import KeyIcon from "@/components/icon/KeyIcon.vue";
import {post} from "@/utils/request.js";
import {useUserStore} from "@/stores/user.js";
import {ElMessage} from "element-plus";
import {useRouter,useRoute} from "vue-router";

const userStore = useUserStore();
const router = useRouter();
const route = useRoute()
const loginForm = ref(null)

const form_user = ref({
  username: '',
  password: '',
})

const form_rule = ref({
    username: [
      {
        required: true,
        message:'用户名不能为空',
        trigger: 'blur'
      },
      {
        validator: (rule, value, callback) => {
          if(value.trim().length <= 0){
            callback(new Error('用户名不能为空'))
          }else {
            callback()
          }
        }
      }
    ],
    password: [
      {
        required: true,
        message: '密码不能为空',
        trigger: 'blur'
      },
      {
        validator: (rule, value, callback) => {
          if(value.trim().length < 0){
            callback(new Error('密码不能为空'))
          }else {
            callback()
          }
        }
      }
    ]
})

const loading = ref(false)

const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT 解析失败", e);
    return null;
  }
}
/**
 * 登录函数
 * @param {Object} loginFormRef 表单引用的 Ref
 */
const login = (loginFormRef) => {
  // 1. 基础防呆校验
  if (!loginFormRef) return
  
  // 2. 表单校验
  loginFormRef.validate(async (valid) => {
    if (valid) {
      loading.value = true
      
      try {
        // 3. 发送请求
        const res = await post("/auth/login", {
          username: form_user.value.username.trim(),
          password: form_user.value.password.trim(),
        })

        // 4. 处理响应
        if (res.code === 200) {
          const { access_token, refresh_token } = res.data
          localStorage.setItem('access_token', access_token)
          localStorage.setItem('refresh_token', refresh_token)
          const payload = parseJwt(access_token)
          
          if (payload) {
             const userInfo = {
               // 通常标准 JWT 的 'sub' 字段存的是 ID，具体看你后端怎么 setSubject
               id: payload.sub, 
               username: payload.username,
               // 将 jwt 里的 role 映射为 userType
               userType: payload.role 
             }
             
             // 存入 Pinia
             userStore.user=userInfo

          localStorage.setItem('access_token', access_token)
          localStorage.setItem('refresh_token', refresh_token)

          ElMessage.success('登录成功')

          // 6. 处理重定向
          // 优先从 Vue Router 的 query 中获取，兼容之前的 window.location 写法
          // const urlParams = new URLSearchParams(window.location.search);
          // const url = urlParams.get('redirectTo');
          // if (url) {
          //   router.push({
          //     path: url
          //   });
          // }else{
          //   router.push({
          //     path: '/'
          //   });
          // }
          const redirectTo = route.query.redirectTo || '/'
          router.push({ path: redirectTo })
            }

        } else {
          // 业务状态码非 200 的情况 (账号错误等)
          ElMessage.error(res.msg || '登录失败')
          // 清空可能残留的脏数据
          userStore.clearUserInfo()
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        }
      } catch (error) {
        // 网络错误或拦截器抛出的错误
        console.error('Login error:', error)
        // 不需要在这里 alert，因为 request.js 里的拦截器通常已经弹窗了
      } finally {
        loading.value = false
      }
    } else {
      ElMessage.warning("请检查输入项是否完整")
    }
  })
}

</script>

<template>
<div class="login">
  <el-form class="login-form"
      ref="loginForm"
      :model="form_user"
      :rules="form_rule"

  >
    <el-form-item  prop="username">
      <el-input placeholder="用户名" v-model="form_user.username" :prefix-icon="UserIcon"/>
    </el-form-item>
    <el-form-item prop="password">
      <el-input class="input" placeholder="密码" type="password" v-model="form_user.password" show-password :prefix-icon="KeyIcon"/>
    </el-form-item>

  </el-form>

  <div class="footer">
    <el-button round class="btn" type="primary" size="large" @click="login(loginForm)">登陆</el-button>
    <div style="display: flex; justify-content: space-between;">
      <router-link to="register">还没有账号?去注册</router-link>
      <el-link  disabled>忘记密码</el-link>
    </div>
  </div>
</div>

</template>

<style scoped>
.login{
  height: 100%;
  width: 70%;
  margin: 0 auto;
}
.login-form{
  height: 80%;
}
.footer{
  margin: 0 auto;
}
.footer .btn{
  width:100%;
  margin-bottom: 12px;
}
</style>