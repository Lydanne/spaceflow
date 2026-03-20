<script setup lang="ts">
interface WorkflowInputDef {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

const props = defineProps<{
  inputDefs: Record<string, WorkflowInputDef>;
  modelValue: Record<string, string>;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: Record<string, string>];
}>();

function updateValue(key: string, value: string) {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(def, key) in inputDefs"
      :key="key"
    >
      <label class="block text-sm font-medium mb-1">
        {{ key }}
        <span
          v-if="def.required"
          class="text-red-500"
        >*</span>
      </label>
      <p
        v-if="def.description"
        class="text-xs text-gray-400 mb-1"
      >
        {{ def.description }}
      </p>

      <USelect
        v-if="def.type === 'choice' && def.options"
        :model-value="modelValue[key]"
        :items="def.options.map((o) => ({ label: o, value: o }))"
        value-key="value"
        class="w-full"
        @update:model-value="updateValue(key, $event)"
      />
      <USwitch
        v-else-if="def.type === 'boolean'"
        :model-value="modelValue[key] === 'true'"
        @update:model-value="updateValue(key, $event ? 'true' : 'false')"
      />
      <UInput
        v-else
        :model-value="modelValue[key]"
        :placeholder="def.default || ''"
        class="w-full"
        @update:model-value="updateValue(key, $event)"
      />
    </div>
  </div>
</template>
