import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getCardDefinition } from '../components/Canvas/cardDefinitions.js';
import { apiService } from '../services/apiService.js';

function generateUniqueId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export const useWorkflowStore = defineStore('workflow', () => {
    // --- STATE ---
    const cards = ref([]);
    const connections = ref([]);
    const selectedItemId = ref(null);
    const selectedItemType = ref(null);
    const canvasScale = ref(1.0);
    const canvasPan = ref({ x: 0, y: 0 });

    // --- GETTERS ---
    const getCardById = computed(() => (id) => cards.value.find(card => card.id === id));
    const getConnectionById = computed(() => (id) => connections.value.find(conn => conn.id === id));
    const selectedItem = computed(() => {
        if (!selectedItemId.value) return null;
        if (selectedItemType.value === 'card') {
            return getCardById.value(selectedItemId.value);
        }
        if (selectedItemType.value === 'connection') {
            return getConnectionById.value(selectedItemId.value);
        }
        return null;
    });

    // --- ACTIONS ---
    function addCard(type, x, y, properties = {}, id = generateUniqueId('card')) {
        const definition = getCardDefinition(type);
        const cardProperties = { ...definition.defaultProperties, ...properties };
        const newCard = { id, type, x, y, properties };
        cards.value.push(newCard);
        return newCard;
    }

    function removeCard(cardId) {
        const cardIndex = cards.value.findIndex(card => card.id === cardId);
        if (cardIndex > -1) {
            cards.value.splice(cardIndex, 1);
            // Also remove related connections
            connections.value = connections.value.filter(
                conn => conn.startCardId !== cardId && conn.endCardId !== cardId
            );
            // If the deleted card was selected, unselect it
            if (selectedItemId.value === cardId) {
                setSelectedItem(null, null);
            }
        }
    }
    
    function addConnection({ startCardId, startPortIndex, endCardId, endPortIndex }) {
        const existing = connections.value.find(c =>
            c.startCardId === startCardId && c.startPortIndex === startPortIndex &&
            c.endCardId === endCardId && c.endPortIndex === endPortIndex
        );
        if (existing) return null;

        const newConnection = {
            id: generateUniqueId('conn'),
            startCardId, startPortIndex, endCardId, endPortIndex
        };
        connections.value.push(newConnection);
        return newConnection;
    }

    function removeConnection(connectionId) {
        const connIndex = connections.value.findIndex(c => c.id === connectionId);
        if (connIndex > -1) {
            connections.value.splice(connIndex, 1);
            if (selectedItemId.value === connectionId) {
                setSelectedItem(null, null);
            }
        }
    }

    function updateCardPosition(cardId, x, y) {
        const card = getCardById.value(cardId);
        if (card) {
            card.x = x;
            card.y = y;
        }
    }

    function updateCardProperty(cardId, propKey, value) {
        const card = getCardById.value(cardId);
        if (card && card.properties) {
            card.properties[propKey] = value;
        }
    }

    function setSelectedItem(id, type) {
        selectedItemId.value = id;
        selectedItemType.value = type;
    }

    function setCanvasTransform(scale, pan) {
        canvasScale.value = scale;
        canvasPan.value = pan;
    }

    function resetWorkflow() {
        cards.value = [];
        connections.value = [];
        setSelectedItem(null, null);
        setCanvasTransform(1.0, { x: 0, y: 0 });
    }

    function loadWorkflowData(data) {
        resetWorkflow();
        // Use a slight delay to ensure the DOM has cleared before re-rendering
        setTimeout(() => {
            cards.value = data.cards || [];
            connections.value = data.connections || [];
        }, 50);
    }
    
    // Initialize services that might be needed by the store or its users
    // This ensures they are ready before any workflow operations
    apiService.init();

    return {
        // State
        cards,
        connections,
        selectedItemId,
        selectedItemType,
        canvasScale,
        canvasPan,
        // Getters
        getCardById,
        getConnectionById,
        selectedItem,
        // Actions
        addCard,
        removeCard,
        addConnection,
        removeConnection,
        updateCardPosition,
        updateCardProperty,
        setSelectedItem,
        setCanvasTransform,
        resetWorkflow,
        loadWorkflowData
    };
});