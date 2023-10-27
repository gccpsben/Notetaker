<template>
    <div v-if="visible" class="fullSize center topLayer fixed" style="background:#00000099;">
        <div id="window" style="min-height:300px; min-width:400px;">
            <div style="grid-area: title;" id="titleBar">
                <p style="grid-area: titleText;" class="text tight">{{ title }}</p>
                <button id="closeButton" style="grid-area: closeButton;" class="tight">
                    <span style="font-size:20px;"
                    class="material-symbols-outlined icon">close</span>
                </button>
            </div>
            <div style="grid-area: content;">
                <slot></slot>
            </div>
        </div>
    </div>
</template>

<style lang="less" scoped>
@import "@/stylesheets/globalStyle.less";
@import "@/stylesheets/mainTheme.less";

#window
{
    background: @background;
    border:1px solid @border;
    border-radius: 5px;
    padding:15px;
    gap:15px;

    display:grid;
    grid-template-rows: auto 1fr;
    grid-template-columns: 1fr;
    grid-template-areas: 'title' 'content';
}

#closeButton 
{
    background: transparent;
    color: @foreground; cursor:pointer;
    border:0px; transition: all 0.5s ease;
    &:hover { color:@error; }
}

#titleBar
{
    display:grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: 1fr;
    grid-template-areas: 'titleText closeButton';
}

</style>

<script lang="ts">
export default 
{
    props:
    {
        "visible": Boolean,
        "title": String
    },
    data()
    {
        return {
            
        };
    }
}
</script>