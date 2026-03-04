<script setup lang="ts">
definePageMeta({
  layout: false
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin text-primary-500"
      />
      <p class="mt-4 text-sm text-gray-500">
        正在登录...
      </p>
    </div>
  </div>
</template>
