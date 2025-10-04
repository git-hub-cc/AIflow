import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useWorkflowStore } from '../stores/workflowStore.js';

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;
const ZOOM_SENSITIVITY = 0.001;
const CARD_WIDTH = 180;
const CARD_HEIGHT = 100;

export function useCanvasInteraction(canvasRef, canvasContentRef) {
    const store = useWorkflowStore();
    const isDraggingCard = ref(false);
    let draggedCardId = null;
    // --- MODIFICATION START ---
    // Removed initialMousePos and initialCardPos.
    // Replaced with a single offset variable for more robust drag calculation.
    let draggedCardOffset = { x: 0, y: 0 };
    // --- MODIFICATION END ---

    function screenToCanvasCoords(clientX, clientY) {
        if (!canvasRef.value) return { x: 0, y: 0 };
        const rect = canvasRef.value.getBoundingClientRect();
        const viewportX = clientX - rect.left;
        const viewportY = clientY - rect.top;
        const canvasX = (viewportX - store.canvasPan.x) / store.canvasScale;
        const canvasY = (viewportY - store.canvasPan.y) / store.canvasScale;
        return { x: canvasX, y: canvasY };
    }

    function handleDropOnCanvas(event) {
        event.preventDefault();
        const cardType = event.dataTransfer.getData('text/plain');
        if (cardType) {
            const { x, y } = screenToCanvasCoords(event.clientX, event.clientY);
            const centeredX = x - CARD_WIDTH / 2;
            const centeredY = y - CARD_HEIGHT / 2;
            store.addCard(cardType, centeredX, centeredY);
            store.setSelectedItem(store.cards[store.cards.length-1].id, 'card');
        }
    }

    function onCanvasMouseDown(event) {
        const targetCard = event.target.closest('.workflow-card');
        const targetPort = event.target.closest('.port');
        const targetPath = event.target.closest('.connection-path');
        const targetDeleteBtn = event.target.closest('.card-delete-btn');

        if (targetDeleteBtn || targetPort || targetPath) {
            // Let other handlers (e.g., useConnectionDrawing) take over
            return;
        }

        if (targetCard) {
            event.preventDefault();
            isDraggingCard.value = true;
            draggedCardId = targetCard.dataset.cardId;
            store.setSelectedItem(draggedCardId, 'card');

            const cardData = store.getCardById(draggedCardId);
            const canvasCoords = screenToCanvasCoords(event.clientX, event.clientY);

            // --- MODIFICATION START ---
            // Calculate and store the mouse's offset relative to the card's top-left corner.
            // This ensures the card doesn't "jump" to the cursor position on drag start.
            draggedCardOffset.x = canvasCoords.x - cardData.x;
            draggedCardOffset.y = canvasCoords.y - cardData.y;
            // --- MODIFICATION END ---

        } else {
            store.setSelectedItem(null, null);
        }
    }

    function onDocumentMouseMove(event) {
        if (isDraggingCard.value && draggedCardId) {
            event.preventDefault();
            const currentCanvasCoords = screenToCanvasCoords(event.clientX, event.clientY);

            // --- MODIFICATION START ---
            // Removed delta-based calculation (dx, dy).
            // Calculate the new card position directly based on the current mouse position
            // and the initial offset. This method is not prone to cumulative errors.
            let newX = currentCanvasCoords.x - draggedCardOffset.x;
            let newY = currentCanvasCoords.y - draggedCardOffset.y;
            // --- MODIFICATION END ---

            store.updateCardPosition(draggedCardId, newX, newY);
        }
    }

    function onDocumentMouseUp() {
        if (isDraggingCard.value) {
            isDraggingCard.value = false;
            draggedCardId = null;
        }
    }

    function onCanvasWheel(event) {
        if (event.ctrlKey) {
            event.preventDefault();
            const rect = canvasRef.value.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const zoom = 1 - event.deltaY * ZOOM_SENSITIVITY;

            let newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, store.canvasScale * zoom));
            if (newScale === store.canvasScale) return;

            const scaleRatio = newScale / store.canvasScale;
            const newPanX = mouseX - (mouseX - store.canvasPan.x) * scaleRatio;
            const newPanY = mouseY - (mouseY - store.canvasPan.y) * scaleRatio;

            store.setCanvasTransform(newScale, { x: newPanX, y: newPanY });
        }
    }

    onMounted(() => {
        document.addEventListener('mousemove', onDocumentMouseMove);
        document.addEventListener('mouseup', onDocumentMouseUp);
        const canvasEl = canvasRef.value;
        if(canvasEl) {
            canvasEl.addEventListener('dragover', e => e.preventDefault());
            canvasEl.addEventListener('drop', handleDropOnCanvas);
            canvasEl.addEventListener('mousedown', onCanvasMouseDown);
            canvasEl.addEventListener('wheel', onCanvasWheel, { passive: false });
        }
    });

    onUnmounted(() => {
        document.removeEventListener('mousemove', onDocumentMouseMove);
        document.removeEventListener('mouseup', onDocumentMouseUp);
        const canvasEl = canvasRef.value;
        if(canvasEl) {
            canvasEl.removeEventListener('drop', handleDropOnCanvas);
            canvasEl.removeEventListener('mousedown', onCanvasMouseDown);
            canvasEl.removeEventListener('wheel', onCanvasWheel);
        }
    });

    return {
        screenToCanvasCoords
    };
}