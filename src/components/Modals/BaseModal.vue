<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-content">
          <button class="modal-close-btn" @click="$emit('close')"><i class="ri-close-line"></i></button>
          <h2 v-if="title">{{ title }}</h2>
          <slot></slot>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineProps({
  show: Boolean,
  title: String,
});
defineEmits(['close']);
</script>

<style scoped>
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.3s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
.modal-enter-active .modal-content, .modal-leave-active .modal-content {
  transition: all 0.3s ease;
}
.modal-enter-from .modal-content, .modal-leave-to .modal-content {
  transform: scale(0.95) translateY(20px);
}
</style>