<script setup lang="ts">
import { useCookiesStore } from '@/stores/cookiesStore';
import { useMainStore } from '@/stores/mainStore';


</script>

<template>
    <input type="text" v-model="formUsername"/>
    <input type="password" v-model="formPassword"/>
    <button @click="mainStore.login(formUsername, formPassword)">login</button>
</template>

<script lang="ts">
export default 
{
    mounted()
    {
        let get = this.cookiesStore.getCookie;
        if (get("notes_token") || get("username")) this.$router.push("/editor");
    },
    data()
    {
        let data = 
        {
            formUsername: "",
            formPassword: "",
            mainStore: useMainStore(),
            cookiesStore: useCookiesStore()
        };
        return data;
    }
}
</script>

<style lang="less" scoped>
@import "@/stylesheets/globalStyle.less";

</style>