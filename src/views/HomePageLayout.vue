<script setup>
import { useUserStore } from "@/stores/user.js";
import {get, put, del, post} from "@/utils/request.js";
import {ref,onMounted,computed} from "vue";
import {ArrowDown, Location, Plus, User} from "@element-plus/icons-vue";
import {useRoute} from "vue-router";
import configs from "@/config/page.config.js"
import SearchBar from "@/components/SearchBar.vue";
import TableComponents from "@/components/TableComponents.vue";
import router from "@/router/index.js";
import {ElMessage, ElMessageBox, ElNotification} from "element-plus";
import {formatDateTime} from "@/utils/util.js";

const userStore = useUserStore();
//由searchBar传入
const index = ref({});
const config = ref([]);
const tableData = ref([]);
const baseUri = ref("");
//由table传入
const page = ref(0);
const total = ref(0);

const dialogVisible = ref(false);
const pageText = ref("");
const dialogContent = ref({});
const dialogShowId = ref(true);

const dialogTitle = ref("");

function logout() {
  post("/auth/logout").then(res => {
    if (res.code===200) {
      userStore.clearUserInfo();
      router.push("/auth");
    }
  })
}
//获取页面配置
const updateConfig = () => {
  configs.forEach((item) => {
    if (item.name === useRoute().name) {
      config.value = item.elements;
      baseUri.value = item.uri;
      pageText.value = item.text;
    }
  })
}


const list = () => {
  // 确保page是有效数字（处理字符串数字或非法值）
  // 验证是否为有效非负整数
  index.value['page'] = page.value;
  get(baseUri.value+"/list", index.value).then((res) => {
    if(res.code===200){
      tableData.value = res.data.records;
      total.value =res.data.total;
    }else{
      if(res.code===402){
        for (let key in res.data) {
          if (res.data.hasOwnProperty(key)) {
            console.log( key)
            ElNotification({
              title: '错误',
              message: res.data[key],
              type: 'error',
              duration: 3000
            });
          }
        }
        index.value = {};
      }
    }
  });
}
const getEleById = (id) => {
  get(baseUri.value+"/"+id).then((res) => {
    dialogContent.value = res.data;
  })
}


const updateSearch = (message) => {
  index.value = message;
  list();
}
const updatePage = (index) => {
  page.value = index;
  list();
}
const update = (id) => {
  dialogTitle.value ="修改"+pageText.value;
  dialogShowId.value=true
  getEleById(id);
  dialogVisible.value = true;
}
const deleteEle = (id) => {
  ElMessageBox.confirm(
      `确定要删除该${pageText.value}(id=${id})？`,
      `删除${pageText.value}`,
      {
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        icon: "Lock"
      }
  ).then(() => {
    del(baseUri.value+`/${id}/del`).then((res) => {
      if (res.code===200) {
        list();
      }
    });
  }).catch((err) => {
    console.log(err);
    ElMessage({
      type: 'info',
      message: '已取消操作',
    })
  })
}
const add = () => {
  dialogTitle.value ="添加"+pageText.value;
  dialogShowId.value = false;
  dialogVisible.value = true;
  dialogContent.value = {
    createDate: formatDateTime(new Date(),"yyyy-MM-dd HH:mm:ss")
  };
}
const submit = () => {
  if(dialogContent.value.id){
    put(`${baseUri.value}/${dialogContent.value.id}/update`, dialogContent.value).then((res) => {
      if (res.code===200){
        list();
        dialogVisible.value = false;
      }else {
        console.log("res:",res);
      }
    });
  }else{
    put(`${baseUri.value}/add`, dialogContent.value).then((res) => {
      if (res.code===200){
        list();
        dialogContent.value= {};
      }else{
        console.log("res:",res);
      }
    });
  }
}


onMounted(() => {
  updateConfig();
  list();
});

</script>

<template>
  <div class="common-layout">
    <el-container class="common-layout">
      <el-header style="border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center;">
          <span style="height: 40px; margin-right: 10px;"/>
          <span style="font-size: 20px; font-weight: bold;">管理系统</span>
        </div>
        <el-dropdown placement="bottom-end" style="cursor: pointer">
          <div style="display: flex; align-items: center;">
            <el-space >
            <el-avatar :size="40" ><el-icon><user/></el-icon></el-avatar>
            <span style="margin-right: 10px;">{{ userStore.user.username }}</span>
              <arrow-down />
            </el-space>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>用户信息</el-dropdown-item>
              <el-dropdown-item @click="logout">退出登陆</el-dropdown-item>
            </el-dropdown-menu>
            </template>
        </el-dropdown>

      </el-header>
      <el-container class="common-main">
          <el-menu
          >
            <el-menu-item index="1">
              <template #title>
                <el-icon><location /></el-icon>
                <span>商品管理</span>
              </template>
            </el-menu-item>
          </el-menu>
        <el-main style="display: flex; flex-direction: column; height: 100%;">
          <search-bar  style="max-height: 30vh;" :config="config" @search-value="updateSearch"/>
          <table-components style="max-height: 60vh" :config="config" :tableData="tableData" :total="total" @del-content="deleteEle" @edit-content="update" @page-update="updatePage"/>
        </el-main>
        <el-button type="primary" size="large" :icon="Plus" circle  style="position: fixed;right: 90px;bottom: 90px; z-index: 999" @click="add"/>
      </el-container>
    </el-container>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500" align-center>

      <el-form :model="dialogContent" label-width="100px" style="width: 400px; margin: 0 auto;">
        <template v-for="item in config">
          <el-form-item v-if="item.name !=='id'|| dialogShowId" :label="item.text">
            <el-input v-if="item.type==='string'" v-model="dialogContent[item.name]" autocomplete="off" :disabled="!item.allUpdate"/>
            <el-input-number v-else-if="item.type==='number'" :controls="false" v-model="dialogContent[item.name]" autocomplete="off" :disabled="!item.allUpdate"/>
            <el-date-picker type="datetime" v-else-if="item.type==='datetime'" v-model="dialogContent[item.name]" autocomplete="off" :disabled="!item.allUpdate"/>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submit">
            提交
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.common-layout {
  height: 100vh;
}

.common-main {
  height: calc(100% - 60px);
}
.el-header {
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 1;
}

</style>