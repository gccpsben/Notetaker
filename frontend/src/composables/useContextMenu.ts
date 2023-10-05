import { ref, onMounted, onUnmounted, computed } from 'vue';

/**
 * Represent a selectable item in the UI
 */
export abstract class Selectable 
{
    public abstract getType():string;    
}

export function useContextMenu()
{
    const activeItem = ref<undefined|Selectable>(undefined);
    const activeType = computed(() => { return activeItem.value?.getType() });
    const hasSelected = computed(() => { return activeItem.value !== undefined; });

    const select = (newItem: Selectable) => { activeItem.value = newItem; };
    const reset = () => { activeItem.value = undefined; };

    return {
        reset,
        select,
        activeItem,
        hasSelected,
        activeType
    };
}