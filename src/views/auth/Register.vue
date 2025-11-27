<script setup>
import UserIcon from "@/components/icon/UserIcon.vue";
import KeyIcon from "@/components/icon/KeyIcon.vue";
import {ref} from "vue";
import {post} from "@/utils/request.js";
import {ElMessage} from "element-plus";
import router from "@/router/index.js";

const form_user = ref({
  username: '',
  password: '',
  confirm_password: '',
})

const registerForm = ref(null)

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
  ],
  confirm_password:[
    {
      validator: (_, value, callback) => {
        if(value.trim()!==form_user.value.password.trim()){
          callback(new Error('两次密码输入不一致'))
        }else {
          callback()
        }
      },
      trigger: "blur"
    }
  ]
})
function register(registerForm) {
  if(!registerForm){
    ElMessage({
      message: "注册失败，请输入相关信息",
      type: "error"
    })
    return
  }
  registerForm.validate(async (valid) => {
    if(valid){
      post("/auth/reg", {
        username: form_user.value.username.trim(),
        password: form_user.value.password.trim(),
      }).then((res) => {
        if (res.code === 200) {
          router.push("/auth/login");
        } else if(res.code === 402){
          registerForm.username.error = "用户名已存在";
        }
      })
    }else{
      ElMessage({
        message: "注册失败，请输入相关信息",
        type: "error"
      })
    }
  })
}
</script>

<template>
<div class="register">
  <el-form class="register-form"
           ref="registerForm"
           :model="form_user"
           :rules="form_rule"
  >
    <el-form-item  prop="username">
      <el-input placeholder="用户名" v-model="form_user.username" :prefix-icon="UserIcon"/>
    </el-form-item>
    <el-form-item prop="password">
      <el-input class="input" placeholder="密码" type="password" show-password v-model="form_user.password" :prefix-icon="KeyIcon"/>
    </el-form-item>
    <el-form-item prop="confirm_password">
      <el-input class="input" placeholder="确认密码" type="password" show-password v-model="form_user.confirm_password" :prefix-icon="KeyIcon"/>
    </el-form-item>

  </el-form>

  <div class="footer">
    <el-button round class="btn" type="primary" size="large" @click="register(registerForm)">注册</el-button>
    <div style="display: flex; justify-content: space-between;">
      <router-link to="login">返回登陆</router-link>
    </div>
  </div>
</div>
</template>

<style scoped>
.register{
  height: 100%;
  width: 70%;
  margin: 0 auto;
}
.register-form{
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