import { ref, onMounted, onUnmounted } from 'vue'

export function useMouse() 
{
    const x = ref(0);
    const y = ref(0);

    // a composable can update its managed state over time.
    function update(event:any) 
    {
        x.value = event.pageX
        y.value = event.pageY
    }

    onMounted(() => window.addEventListener('mousemove', update))
    onUnmounted(() => window.removeEventListener('mousemove', update))

    return { x, y }
}