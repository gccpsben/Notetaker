import { Notice } from '@/views/EditorView.vue';
import { ref, onMounted, onUnmounted, computed } from 'vue';

export function useNotices()
{
    const notices = ref<Notice[]>([]);

    /**
     * Remove all notices that opacity equals to 0
     */
    let cleanupNotice = () =>
    { 
        notices.value = notices.value.filter(x => (x.noticeOpacity as any) != 0); 
    }

    let pushNotice = (content:string, timeoutMs?: number) =>
    {
        let notice = new Notice(content);
        notices.value.push(notice as any);
        if (timeoutMs !== undefined) notice.fade(timeoutMs);
        setTimeout(() => { cleanupNotice() }, timeoutMs); // Cleanup
        return notice;
    }

    return {
        notices: notices,
        cleanup: cleanupNotice,
        push: pushNotice
    };
}