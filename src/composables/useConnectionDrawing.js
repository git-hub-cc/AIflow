import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useWorkflowStore } from '../stores/workflowStore.js';
import { getBezierPath } from '../utils/index.js';

export function useConnectionDrawing(canvasRef, screenToCanvasCoords) {
    const store = useWorkflowStore();
    const isDrawing = ref(false);
    const tempLine = reactive({
        d: '',
        visible: false
    });
    let startPortInfo = null;

    function getPortCenter(portEl) {
        const rect = portEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        return screenToCanvasCoords(centerX, centerY);
    }

    function onMouseDown(event) {
        const targetPort = event.target.closest('.port');
        if (!targetPort) return;
        
        event.preventDefault();
        event.stopPropagation();

        isDrawing.value = true;
        tempLine.visible = true;

        const cardId = targetPort.closest('.workflow-card').dataset.cardId;
        const portType = targetPort.dataset.portType;
        const portIndex = parseInt(targetPort.dataset.portIndex);
        const startCoords = getPortCenter(targetPort);

        startPortInfo = { cardId, portType, portIndex, startCoords };
        tempLine.d = getBezierPath(startCoords.x, startCoords.y, startCoords.x, startCoords.y);
        
        // Unselect any selected item
        store.setSelectedItem(null, null);
    }

    function onMouseMove(event) {
        if (!isDrawing.value) return;
        event.preventDefault();

        const endCoords = screenToCanvasCoords(event.clientX, event.clientY);
        tempLine.d = getBezierPath(startPortInfo.startCoords.x, startPortInfo.startCoords.y, endCoords.x, endCoords.y);
    }
    
    function onMouseUp(event) {
        if (!isDrawing.value) return;

        const targetPort = event.target.closest('.port');
        if (targetPort) {
            const endCardId = targetPort.closest('.workflow-card').dataset.cardId;
            const endPortType = targetPort.dataset.portType;
            const endPortIndex = parseInt(targetPort.dataset.portIndex);

            const isValid = startPortInfo.cardId !== endCardId &&
                            startPortInfo.portType === 'output' &&
                            endPortType === 'input';

            if (isValid) {
                store.addConnection({
                    startCardId: startPortInfo.cardId,
                    startPortIndex: startPortInfo.portIndex,
                    endCardId: endCardId,
                    endPortIndex: endPortIndex,
                });
            }
        }
        
        isDrawing.value = false;
        tempLine.visible = false;
        startPortInfo = null;
    }
    
    onMounted(() => {
        const canvasEl = canvasRef.value;
        if (canvasEl) {
            canvasEl.addEventListener('mousedown', onMouseDown, true); // Use capture phase
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    onUnmounted(() => {
        const canvasEl = canvasRef.value;
        if (canvasEl) {
            canvasEl.removeEventListener('mousedown', onMouseDown, true);
        }
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    });

    return {
        isDrawing,
        tempLine,
        getPortCenter
    };
}