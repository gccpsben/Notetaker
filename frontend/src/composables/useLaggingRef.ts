import { computed, ref, unref, type Ref, toRef, type UnwrapRef } from 'vue';

export function useLaggingRef<T>(source: Ref<T>)
{
    const lastValue = ref<T|undefined>(undefined);

    const update = () => 
    {
        lastValue.value = source.value as UnwrapRef<T|undefined>;
    };

    const clear = () => { lastValue.value = undefined; };

    return {
        update,
        clear,
        lastValue
    }
}