<template>
  <div class="toolbox-item" draggable="true" @dragstart="onDragStart">
    <i :class="[icon, 'icon']"></i>
    <span class="label">{{ title }}</span>
  </div>
</template>

<script setup>
const props = defineProps({
  type: String,
  title: String,
  icon: String
});

const onDragStart = (event) => {
  event.dataTransfer.setData('text/plain', props.type);
  event.dataTransfer.effectAllowed = 'copy';
};
</script>