<template>
  <section ref="canvasRef" class="workflow-canvas">
    <div ref="canvasContentRef" class="canvas-content" :style="canvasContentStyle">
      <!-- Connection Lines -->
      <svg class="connection-svg" :width="svgSize.width" :height="svgSize.height">
        <!-- Temporary line for drawing -->
        <path v-if="tempLine.visible" class="connection-path temp-line" :d="tempLine.d"></path>

        <!-- Existing connections -->
        <path
            v-for="conn in store.connections"
            :key="conn.id"
            class="connection-path"
            :class="{ selected: store.selectedItemId === conn.id }"
            :d="getConnectionPath(conn)"
            @mousedown.stop="selectConnection(conn.id)"
        ></path>
      </svg>

      <!-- Workflow Cards -->
      <WorkflowCard
          v-for="card in store.cards"
          :key="card.id"
          :card="card"
          :status="executionStatus[card.id] || 'pending'"
          @select-card="selectCard"
      />
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useWorkflowStore } from '../../stores/workflowStore.js';
import { useCanvasInteraction } from '../../composables/useCanvasInteraction.js';
import { useConnectionDrawing } from '../../composables/useConnectionDrawing.js';
import { getBezierPath } from '../../utils/index.js';
import WorkflowCard from './WorkflowCard.vue';

// --- MODIFICATION START ---
// Define card dimensions as constants. These must match the CSS in WorkflowCard.vue.
const CARD_WIDTH = 180;
const CARD_HEIGHT = 100;
// --- MODIFICATION END ---

const props = defineProps({
  executionStatus: Object
});

const store = useWorkflowStore();
const canvasRef = ref(null);
const canvasContentRef = ref(null);
const cardElements = ref({}); // To store refs to WorkflowCard components

const { screenToCanvasCoords } = useCanvasInteraction(canvasRef, canvasContentRef);
const { tempLine, getPortCenter } = useConnectionDrawing(canvasRef, screenToCanvasCoords);

const canvasContentStyle = computed(() => ({
  transform: `translate(${store.canvasPan.x}px, ${store.canvasPan.y}px) scale(${store.canvasScale})`,
  transformOrigin: '0 0'
}));

const svgSize = ref({ width: 2000, height: 2000 }); // Start with a default size

function selectCard(cardId) {
  store.setSelectedItem(cardId, 'card');
}
function selectConnection(connId) {
  store.setSelectedItem(connId, 'connection');
}

// --- MODIFICATION START ---
// The entire logic for getConnectionPath has been replaced.
// It no longer queries the DOM. Instead, it calculates port positions
// directly from the card data in the store and the defined constants.
function getConnectionPath(conn) {
  const startCard = store.getCardById(conn.startCardId);
  const endCard = store.getCardById(conn.endCardId);

  if (!startCard || !endCard) return '';

  // Calculate start port coordinates (output, right side of the card)
  // The calculation logic for multi-port cards can be expanded here if needed.
  const startX = startCard.x + CARD_WIDTH;
  const startY = startCard.y + CARD_HEIGHT / ( (startCard.outputs || 1) + 1 ) * (conn.startPortIndex + 1);

  // Calculate end port coordinates (input, left side of the card)
  const endX = endCard.x;
  const endY = endCard.y + CARD_HEIGHT / ( (endCard.inputs || 1) + 1 ) * (conn.endPortIndex + 1);

  // If card definitions were extended to have multiple ports, a more complex calculation
  // would be needed. For a single port at 50% height, this simplifies to:
  // const startY = startCard.y + CARD_HEIGHT / 2;
  // const endY = endCard.y + CARD_HEIGHT / 2;

  return getBezierPath(startX, startY, endX, endY);
}
// --- MODIFICATION END ---
</script>

<style scoped>
.workflow-canvas {
  flex: 1;
  position: relative;
  background-color: var(--color-bg-light);
  overflow: hidden;
  background-image: linear-gradient(to right, var(--color-border) 1px, transparent 1px),
  linear-gradient(to bottom, var(--color-border) 1px, transparent 1px);
  background-size: 20px 20px;
}
.canvas-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  will-change: transform;
}
.connection-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%; /* Will be dynamically adjusted if needed */
  height: 100%;
  pointer-events: none;
  z-index: 5;
}
.connection-path {
  stroke: var(--color-line-default);
  stroke-width: 2;
  fill: none;
  transition: stroke 0.2s ease-in-out;
  cursor: pointer;
  pointer-events: stroke;
}
.connection-path.selected {
  stroke: var(--color-line-selected);
  stroke-width: 3;
  filter: drop-shadow(0 0 2px rgba(90, 90, 235, 0.5));
}
.connection-path.temp-line {
  stroke-dasharray: 5 5;
  stroke: #888;
}
</style>