import { ref, onMounted, onUnmounted, computed } from 'vue';

export function useUserSelection()
{
    const currentHighlightedText = ref("");

    document.addEventListener("selectionchange", (e) => 
    {
        let selection = window.getSelection();
        if (selection == undefined) return;
        let type = selection.type; // expect 'Range'

        if (type === 'Range') currentHighlightedText.value = selection.toString();
        else if (type === "Caret")
        {
            let anchorNode = selection.anchorNode;
            currentHighlightedText.value = (anchorNode as HTMLElement).innerText || anchorNode?.nodeValue || '';
        }
        else currentHighlightedText.value = '';
    });

    return {
        text: currentHighlightedText
    };
}